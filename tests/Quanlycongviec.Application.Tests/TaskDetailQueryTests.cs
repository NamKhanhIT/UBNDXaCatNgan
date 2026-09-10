using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Tasks.Queries.GetTaskDetail;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests
{
    public class TaskDetailQueryTests
    {
        [Fact]
        public async Task Handle_ShouldReturnScopedTaskDetailWithTimelineAndAttachments()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
            var assigner = new User { Username = "detail_assigner", FullName = "Assigner", Email = "detail.assigner@test.local" };
            var assignee = new User { Username = "detail_assignee", FullName = "Assignee", Email = "detail.assignee@test.local" };
            var task = new TaskItem
            {
                Title = "Detail task",
                Description = "Directive",
                Requirements = "Signed result",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                Status = TaskStatusEnum.InProgress,
                DueDate = DateTime.UtcNow.AddDays(1)
            };
            context.Users.AddRange(assigner, assignee);
            context.TaskItems.Add(task);
            context.SubTasks.Add(new SubTask { TaskItemId = task.Id, Title = "First step" });
            context.TaskComments.Add(new TaskComment { TaskItemId = task.Id, UserId = assignee.Id, Content = "Working" });
            context.ActivityLogs.Add(new ActivityLog
            {
                UserId = assigner.Id,
                ActionType = "task_created",
                TargetEntityType = "TaskItem",
                TargetEntityId = task.Id.ToString(),
                Summary = "Created"
            });
            context.DocumentAttachments.Add(new DocumentAttachment
            {
                DocumentId = task.Id,
                TargetType = "Task",
                UploadedByUserId = assignee.Id,
                FileName = "result.pdf",
                OriginalFileName = "result.pdf",
                FileType = "pdf"
            });
            await context.SaveChangesAsync();

            var handler = new GetTaskDetailQueryHandler(
                context,
                new TaskAuthorizationService(context));
            var result = await handler.Handle(
                new GetTaskDetailQuery(task.Id, assignee.Id),
                CancellationToken.None);

            result.Should().NotBeNull();
            result!.Requirements.Should().Be("Signed result");
            result.SubTasks.Should().ContainSingle();
            result.Comments.Should().ContainSingle();
            result.Attachments.Should().ContainSingle();
            result.Timeline.Should().ContainSingle();
        }

        [Fact]
        public async Task Handle_ShouldReturnNullForUnrelatedUser()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
            var task = new TaskItem
            {
                Title = "Private task",
                AssignerId = Guid.NewGuid(),
                AssigneeId = Guid.NewGuid()
            };
            context.TaskItems.Add(task);
            await context.SaveChangesAsync();

            var result = await new GetTaskDetailQueryHandler(
                context,
                new TaskAuthorizationService(context)).Handle(
                    new GetTaskDetailQuery(task.Id, Guid.NewGuid()),
                    CancellationToken.None);

            result.Should().BeNull();
        }
    }
}
