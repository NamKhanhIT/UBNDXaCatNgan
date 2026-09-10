using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.TaskAnnotations.Commands.CreateTaskReviewAnnotation;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Tasks
{
    public class CreateTaskReviewAnnotationAuthTests
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<ITaskAuthorizationService> _authMock = new();

        public CreateTaskReviewAnnotationAuthTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            _context = new ApplicationDbContext(options);
        }

        private CreateTaskReviewAnnotationCommandHandler BuildHandler()
            => new(_context, _authMock.Object);

        private async Task<(Guid userId, Guid taskId)> SeedAsync()
        {
            var user = new User { Username = "u1", FullName = "U One", Email = "u1@test.local" };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var task = new TaskItem
            {
                Title = "Demo task",
                AssignerId = Guid.NewGuid(),
                AssigneeId = Guid.NewGuid(),
                Status = TaskStatusEnum.InProgress,
                Priority = TaskPriority.Medium,
                Type = TaskType.BAU,
                StartDate = DateTime.UtcNow,
                IsDeleted = false,
                CreatedAt = DateTime.UtcNow
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            return (user.Id, task.Id);
        }

        [Fact]
        public async Task Handle_ShouldThrowUnauthorizedAccessException_WhenAuthorizationServiceReturnsFalse()
        {
            var (userId, taskId) = await SeedAsync();
            _authMock
                .Setup(s => s.CanAccessTaskAsync(userId, taskId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            var handler = BuildHandler();
            var command = new CreateTaskReviewAnnotationCommand(
                TaskItemId: taskId,
                AnchorText: "anchor",
                StartOffsetHint: 10,
                CommentText: "comment",
                Severity: AnnotationSeverityEnum.CanChinhSua,
                CurrentUserId: userId);

            var act = async () => await handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task Handle_ShouldCreateAnnotation_WhenAuthorizationServiceReturnsTrue()
        {
            var (userId, taskId) = await SeedAsync();
            _authMock
                .Setup(s => s.CanAccessTaskAsync(userId, taskId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var handler = BuildHandler();
            var command = new CreateTaskReviewAnnotationCommand(
                TaskItemId: taskId,
                AnchorText: "anchor",
                StartOffsetHint: 10,
                CommentText: "comment",
                Severity: AnnotationSeverityEnum.CanChinhSua,
                CurrentUserId: userId);

            var dto = await handler.Handle(command, CancellationToken.None);

            dto.Should().NotBeNull();
            dto.AnchorText.Should().Be("anchor");
            _context.TaskReviewAnnotations.Should().ContainSingle(a => a.TaskItemId == taskId && a.CreatedByUserId == userId);
        }

        [Fact]
        public async Task Handle_ShouldThrowInvalidOperationException_WhenTaskMissing()
        {
            var (userId, _) = await SeedAsync();
            _authMock
                .Setup(s => s.CanAccessTaskAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var handler = BuildHandler();
            var command = new CreateTaskReviewAnnotationCommand(
                TaskItemId: Guid.NewGuid(),
                AnchorText: "anchor",
                StartOffsetHint: 10,
                CommentText: "comment",
                Severity: AnnotationSeverityEnum.CanChinhSua,
                CurrentUserId: userId);

            var act = async () => await handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<InvalidOperationException>();
        }
    }
}
