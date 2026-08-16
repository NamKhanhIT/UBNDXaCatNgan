using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.TaskAnnotations.Commands.CreateTaskReviewAnnotation;
using Quanlycongviec.Application.Features.TaskAnnotations.Commands.ResolveTaskReviewAnnotation;
using Quanlycongviec.Application.Features.TaskAnnotations.Queries.GetTaskReviewAnnotations;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Tasks
{
    public class TaskReviewAnnotationTests
    {
        private readonly ApplicationDbContext _context;

        public TaskReviewAnnotationTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        private async Task<User> CreateUserWithRoleAsync(string username, string fullName, int rankLevel, string roleCode)
        {
            var user = new User { Id = Guid.NewGuid(), Username = username, FullName = fullName, ActiveRoleCode = roleCode };
            var role = new Role { Id = Guid.NewGuid(), Code = roleCode, Name = roleCode, RankLevel = rankLevel };
            var userRole = new UserRole { UserId = user.Id, RoleId = role.Id, Role = role, User = user };

            _context.Users.Add(user);
            _context.Roles.Add(role);
            _context.UserRoles.Add(userRole);
            await _context.SaveChangesAsync();
            return user;
        }

        [Fact]
        public async Task CreateAnnotation_ValidInput_ShouldCreateSuccessfully()
        {
            // Arrange
            var assigner = await CreateUserWithRoleAsync("bithu", "Bí Thư Xã", 1, "BiThuDU");
            var assignee = await CreateUserWithRoleAsync("chuyenvien", "Chuyên Viên A", 5, "ChuyenVien");

            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Báo cáo số liệu quý III",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                SubmissionNote = "Đã hoàn thành 15/15 chỉ tiêu kinh tế, riêng chỉ tiêu thu ngân sách đạt 102% kế hoạch."
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            var handler = new CreateTaskReviewAnnotationCommandHandler(_context);
            var command = new CreateTaskReviewAnnotationCommand(
                task.Id,
                "riêng chỉ tiêu thu ngân sách đạt 102%",
                40,
                "Cần làm rõ thêm nguồn thu phát sinh đột biến từ đấu giá đất",
                AnnotationSeverityEnum.CanChinhSua,
                assigner.Id
            );

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.AnchorText.Should().Be("riêng chỉ tiêu thu ngân sách đạt 102%");
            result.Severity.Should().Be(AnnotationSeverityEnum.CanChinhSua);
            result.ResolvedStatus.Should().Be(AnnotationStatusEnum.Open);

            var saved = await _context.TaskReviewAnnotations.FindAsync(result.Id);
            saved.Should().NotBeNull();
            saved!.CommentText.Should().Be("Cần làm rõ thêm nguồn thu phát sinh đột biến từ đấu giá đất");
        }

        [Fact]
        public async Task GetAnnotations_ShouldReturnAllAnnotationsOrdered()
        {
            // Arrange
            var assigner = await CreateUserWithRoleAsync("chutich", "Chủ Tịch Xã", 1, "ChuTichUBND");
            var assignee = await CreateUserWithRoleAsync("chuyenvien2", "Chuyên Viên B", 5, "ChuyenVien");

            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Kế hoạch tổ chức lễ hội",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id
            };
            _context.TaskItems.Add(task);

            var a1 = new TaskReviewAnnotation
            {
                Id = Guid.NewGuid(),
                TaskItemId = task.Id,
                AnchorText = "Địa điểm tổ chức tại sân vận động",
                CommentText = "Nên dự phòng phương án mưa lớn",
                Severity = AnnotationSeverityEnum.GopY,
                CreatedByUserId = assigner.Id,
                CreatedAt = DateTime.UtcNow.AddMinutes(-10),
                ResolvedStatus = AnnotationStatusEnum.Open
            };
            var a2 = new TaskReviewAnnotation
            {
                Id = Guid.NewGuid(),
                TaskItemId = task.Id,
                AnchorText = "Dự toán kinh phí 50 triệu",
                CommentText = "Vượt hạn mức quy định",
                Severity = AnnotationSeverityEnum.LoiSai,
                CreatedByUserId = assigner.Id,
                CreatedAt = DateTime.UtcNow.AddMinutes(-5),
                ResolvedStatus = AnnotationStatusEnum.Open
            };
            _context.TaskReviewAnnotations.AddRange(a1, a2);
            await _context.SaveChangesAsync();

            var queryHandler = new GetTaskReviewAnnotationsQueryHandler(_context);

            // Act
            var list = await queryHandler.Handle(new GetTaskReviewAnnotationsQuery(task.Id), CancellationToken.None);

            // Assert
            list.Should().HaveCount(2);
            list[0].AnchorText.Should().Be("Địa điểm tổ chức tại sân vận động");
            list[1].AnchorText.Should().Be("Dự toán kinh phí 50 triệu");
        }

        [Fact]
        public async Task ResolveAnnotation_ByAssignee_ShouldMarkResolved()
        {
            // Arrange
            var assigner = await CreateUserWithRoleAsync("chutich3", "Chủ Tịch Xã", 1, "ChuTichUBND");
            var assignee = await CreateUserWithRoleAsync("chuyenvien3", "Chuyên Viên C", 5, "ChuyenVien");

            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Kiểm kê tài sản công",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id
            };
            _context.TaskItems.Add(task);

            var annotation = new TaskReviewAnnotation
            {
                Id = Guid.NewGuid(),
                TaskItemId = task.Id,
                AnchorText = "Thiếu danh mục máy in phòng một cửa",
                CommentText = "Bổ sung máy in mới tiếp nhận tháng trước",
                Severity = AnnotationSeverityEnum.CanChinhSua,
                CreatedByUserId = assigner.Id,
                ResolvedStatus = AnnotationStatusEnum.Open
            };
            _context.TaskReviewAnnotations.Add(annotation);
            await _context.SaveChangesAsync();

            var resolveHandler = new ResolveTaskReviewAnnotationCommandHandler(_context);

            // Act
            var result = await resolveHandler.Handle(new ResolveTaskReviewAnnotationCommand(task.Id, annotation.Id, assignee.Id), CancellationToken.None);

            // Assert
            result.ResolvedStatus.Should().Be(AnnotationStatusEnum.Resolved);
            result.ResolvedByUserId.Should().Be(assignee.Id);

            var updated = await _context.TaskReviewAnnotations.FindAsync(annotation.Id);
            updated!.ResolvedStatus.Should().Be(AnnotationStatusEnum.Resolved);
            updated.ResolvedAt.Should().NotBeNull();
        }

        [Fact]
        public async Task ResolveAnnotation_ByUnrelatedUser_ShouldThrowUnauthorized()
        {
            // Arrange
            var assigner = await CreateUserWithRoleAsync("chutich4", "Chủ Tịch Xã", 1, "ChuTichUBND");
            var assignee = await CreateUserWithRoleAsync("chuyenvien4", "Chuyên Viên D", 5, "ChuyenVien");
            var unrelatedUser = await CreateUserWithRoleAsync("chuyenvien_la", "Chuyên Viên Lạ", 5, "ChuyenVien");

            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Dự thảo báo cáo nội bộ",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id
            };
            _context.TaskItems.Add(task);

            var annotation = new TaskReviewAnnotation
            {
                Id = Guid.NewGuid(),
                TaskItemId = task.Id,
                AnchorText = "Nội dung cần soát lại chính tả",
                CommentText = "Sửa lại lỗi chính tả",
                Severity = AnnotationSeverityEnum.GopY,
                CreatedByUserId = assigner.Id,
                ResolvedStatus = AnnotationStatusEnum.Open
            };
            _context.TaskReviewAnnotations.Add(annotation);
            await _context.SaveChangesAsync();

            var resolveHandler = new ResolveTaskReviewAnnotationCommandHandler(_context);

            // Act & Assert
            var act = async () => await resolveHandler.Handle(new ResolveTaskReviewAnnotationCommand(task.Id, annotation.Id, unrelatedUser.Id), CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>();
        }
    }
}
