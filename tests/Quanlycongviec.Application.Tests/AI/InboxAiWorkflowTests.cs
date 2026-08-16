using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.AI.Models;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.AI
{
    public class InboxAiWorkflowTests
    {
        private readonly ApplicationDbContext _context;

        public InboxAiWorkflowTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        [Fact]
        public async Task ConfirmClassification_RouteEvent_ShouldCreateCalendarEventDraft()
        {
            // Arrange
            var docId = Guid.NewGuid();
            var organizerId = Guid.NewGuid();
            var deptId = Guid.NewGuid();

            var doc = new InboxDocument
            {
                Id = docId,
                DocumentNumber = "12/GM-UBND",
                Subject = "Giấy mời họp Ban chấp hành Đảng bộ xã",
                AiCategory = "MeetingInvitation",
                AiTitle = "Họp Ban chấp hành Đảng bộ xã tháng 8",
                AiSummary = "Đánh giá công tác tháng 7 và triển khai nhiệm vụ trọng tâm tháng 8.",
                AiEventStartDateTime = DateTime.UtcNow.AddDays(2),
                AiEventEndDateTime = DateTime.UtcNow.AddDays(2).AddHours(2),
                AiSuggestedDepartmentId = deptId,
                AiProcessingStatus = "Analyzed"
            };

            _context.InboxDocuments.Add(doc);
            await _context.SaveChangesAsync();

            // Act: Simulate confirm classification with route='event'
            doc.AiReviewedByUserId = organizerId;
            doc.AiReviewedAt = DateTime.UtcNow;
            doc.AiProcessingStatus = "Confirmed";

            var calEvent = new CalendarEvent
            {
                Id = Guid.NewGuid(),
                Title = doc.AiTitle ?? doc.Subject,
                Description = doc.AiSummary ?? "",
                EventType = EventTypeEnum.Meeting,
                StartDateTime = doc.AiEventStartDateTime ?? DateTime.UtcNow.AddDays(1),
                EndDateTime = doc.AiEventEndDateTime ?? DateTime.UtcNow.AddDays(1).AddHours(2),
                OrganizerId = organizerId,
                DepartmentId = doc.AiSuggestedDepartmentId,
                ColorTag = "#3B82F6"
            };
            _context.CalendarEvents.Add(calEvent);
            await _context.SaveChangesAsync();

            // Assert
            var savedEvent = await _context.CalendarEvents.FirstOrDefaultAsync(e => e.Id == calEvent.Id);
            savedEvent.Should().NotBeNull();
            savedEvent!.Title.Should().Be("Họp Ban chấp hành Đảng bộ xã tháng 8");
            savedEvent.EventType.Should().Be(EventTypeEnum.Meeting);
            savedEvent.OrganizerId.Should().Be(organizerId);
            savedEvent.DepartmentId.Should().Be(deptId);

            var updatedDoc = await _context.InboxDocuments.FindAsync(docId);
            updatedDoc!.AiProcessingStatus.Should().Be("Confirmed");
            updatedDoc.AiReviewedByUserId.Should().Be(organizerId);
        }

        [Fact]
        public async Task CreateTaskFromInbox_WithAiSubTasks_ShouldInitializeProgressToZero()
        {
            // Arrange
            var assignerId = Guid.NewGuid();
            var assigneeId = Guid.NewGuid();
            var docId = Guid.NewGuid();

            var doc = new InboxDocument
            {
                Id = docId,
                DocumentNumber = "45/KH-UBND",
                Subject = "Kế hoạch đảm bảo an toàn giao thông mùa mưa bão",
                AiTitle = "Kế hoạch đảm bảo ATGT mùa mưa bão 2026",
                AiSummary = "Rà soát các điểm có nguy cơ sạt lở, cắm biển cảnh báo và lập chốt trực 24/7.",
                AiExtractedDeadline = DateTime.UtcNow.AddDays(10),
                AiProcessingStatus = "Confirmed"
            };
            _context.InboxDocuments.Add(doc);

            // Mock AI checklist suggestions
            var mockAiChecklist = new List<ProgressChecklistItem>
            {
                new ProgressChecklistItem { Title = "Khảo sát các điểm xung yếu dọc sông Lam", Order = 1 },
                new ProgressChecklistItem { Title = "Cắm biển cảnh báo và rào chắn tạm thời", Order = 2 },
                new ProgressChecklistItem { Title = "Phân công tổ trực ban 24/7 tại trung tâm chỉ huy", Order = 3 },
                new ProgressChecklistItem { Title = "Báo cáo tổng hợp kết quả triển khai cho Chủ tịch UBND xã", Order = 4 }
            };

            // Act
            var taskItem = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = doc.AiTitle ?? doc.Subject,
                Description = doc.AiSummary ?? doc.Subject,
                AssignerId = assignerId,
                AssigneeId = assigneeId,
                Status = TaskStatusEnum.Todo,
                Type = TaskType.BAU,
                DueDate = doc.AiExtractedDeadline,
                ProgressPercentage = 0,
                AISummary = doc.AiSummary
            };
            _context.TaskItems.Add(taskItem);

            foreach (var item in mockAiChecklist)
            {
                var subTask = new SubTask
                {
                    Id = Guid.NewGuid(),
                    TaskItemId = taskItem.Id,
                    Title = item.Title,
                    IsCompleted = false
                };
                _context.SubTasks.Add(subTask);
            }

            doc.ScheduledTaskId = taskItem.Id;
            doc.IsScheduled = true;
            await _context.SaveChangesAsync();

            // Assert
            var savedTask = await _context.TaskItems.FindAsync(taskItem.Id);
            savedTask.Should().NotBeNull();
            savedTask!.ProgressPercentage.Should().Be(0);
            savedTask.Status.Should().Be(TaskStatusEnum.Todo);

            var savedSubTasks = await _context.SubTasks.Where(s => s.TaskItemId == taskItem.Id).ToListAsync();
            savedSubTasks.Should().HaveCount(4);
            savedSubTasks.Should().OnlyContain(s => !s.IsCompleted);
        }

        [Fact]
        public async Task ToggleSubTask_ShouldUpdateProgressPercentageAndCreateTwoNotifications()
        {
            // Arrange
            var assignerId = Guid.NewGuid();
            var assigneeId = Guid.NewGuid();

            var taskItem = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Kiểm tra cấp phép xây dựng khu vực chợ Cát Ngạn",
                AssignerId = assignerId,
                AssigneeId = assigneeId,
                Status = TaskStatusEnum.InProgress,
                ProgressPercentage = 0
            };
            _context.TaskItems.Add(taskItem);

            var subTask1 = new SubTask { Id = Guid.NewGuid(), TaskItemId = taskItem.Id, Title = "Kiểm tra hồ sơ thiết kế", IsCompleted = false };
            var subTask2 = new SubTask { Id = Guid.NewGuid(), TaskItemId = taskItem.Id, Title = "Đo đạc hiện trường", IsCompleted = false };
            var subTask3 = new SubTask { Id = Guid.NewGuid(), TaskItemId = taskItem.Id, Title = "Lập biên bản kiểm tra", IsCompleted = false };
            var subTask4 = new SubTask { Id = Guid.NewGuid(), TaskItemId = taskItem.Id, Title = "Trình lãnh đạo ký phê duyệt", IsCompleted = false };

            _context.SubTasks.AddRange(subTask1, subTask2, subTask3, subTask4);
            await _context.SaveChangesAsync();

            // Act: Toggle subTask1 -> Completed
            subTask1.IsCompleted = true;
            subTask1.UpdatedAt = DateTime.UtcNow;

            var allSubTasks = await _context.SubTasks.Where(s => s.TaskItemId == taskItem.Id && !s.IsDeleted).ToListAsync();
            var totalCount = allSubTasks.Count;
            var completedCount = allSubTasks.Count(s => s.IsCompleted);
            taskItem.ProgressPercentage = totalCount > 0 ? (int)Math.Round(100.0 * completedCount / totalCount) : 0;
            taskItem.UpdatedAt = DateTime.UtcNow;

            // Create 2-way notifications (Assigner + Assignee)
            var userIds = new[] { taskItem.AssignerId, taskItem.AssigneeId }.Distinct();
            foreach (var userId in userIds)
            {
                _context.Notifications.Add(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    TaskItemId = taskItem.Id,
                    Type = NotificationType.SubTaskProgress,
                    Title = $"Tiến độ: {taskItem.Title}",
                    Message = $" \"{subTask1.Title}\" — Tiến độ: {taskItem.ProgressPercentage}%",
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                });
            }

            await _context.SaveChangesAsync();

            // Assert
            taskItem.ProgressPercentage.Should().Be(25, "1 trong 4 subtask hoàn thành = 25%");

            var notifications = await _context.Notifications.Where(n => n.TaskItemId == taskItem.Id).ToListAsync();
            notifications.Should().HaveCount(2, "Cả Assigner và Assignee đều phải nhận thông báo");
            notifications.Should().ContainSingle(n => n.UserId == assignerId);
            notifications.Should().ContainSingle(n => n.UserId == assigneeId);
            notifications.First().Message.Should().Contain("25%");

            // Act 2: Toggle subTask2 & subTask3 -> Completed
            subTask2.IsCompleted = true;
            subTask3.IsCompleted = true;
            completedCount = allSubTasks.Count(s => s.IsCompleted);
            taskItem.ProgressPercentage = (int)Math.Round(100.0 * completedCount / totalCount);
            await _context.SaveChangesAsync();

            // Assert 2
            taskItem.ProgressPercentage.Should().Be(75, "3 trong 4 subtask hoàn thành = 75%");
        }
    }
}
