using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.Commands.ProcessAIStructuredTask;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;
using Quanlycongviec.Application.AI.Models;

namespace Quanlycongviec.Application.Tests.Tasks
{
    public class ProcessAIStructuredTaskAuthTests
    {
        private readonly DbContextOptions<ApplicationDbContext> _dbOptions;
        private readonly Mock<ITaskAuthorizationService> _authMock = new();

        public ProcessAIStructuredTaskAuthTests()
        {
            _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
        }

        private Guid SeedUser(string name, bool deleted = false)
        {
            using var ctx = new ApplicationDbContext(_dbOptions);
            var user = new User { Username = name, FullName = name, Email = $"{name}@test.local", IsDeleted = deleted };
            var role = new Role { Code = name, Name = name, RankLevel = 1 };
            user.ActiveRoleCode = role.Code;
            user.UserRoles.Add(new UserRole { User = user, Role = role, IsPrimary = true });
            ctx.Users.Add(user);
            ctx.SaveChanges();
            return user.Id;
        }

        [Fact]
        public async Task Handle_ShouldThrowArgumentException_WhenFallbackAssigneeIdNotFound()
        {
            using var ctx = new ApplicationDbContext(_dbOptions);
            var existingAssignor = SeedUser("assignor");

            var handler = new ProcessAIStructuredTaskCommandHandler(ctx, _authMock.Object);
            var command = new ProcessAIStructuredTaskCommand(
                MeetingNotesOrDocumentText: "Biên bản cuộc họp ...",
                AssignerId: existingAssignor,
                FallbackAssigneeId: Guid.NewGuid()   // does NOT exist in Db
            );

            var act = async () => await handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>("FallbackAssignee must exist in the user store");
        }

        [Fact]
        public async Task Handle_ShouldThrowUnauthorizedAccessException_WhenAuthorizationServiceDeny()
        {
            using var ctx = new ApplicationDbContext(_dbOptions);
            var assignor = SeedUser("a1");
            var assignee = SeedUser("a2");

            _authMock
                .Setup(s => s.CanAssignTaskAsync(assignor, assignee, It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            var handler = new ProcessAIStructuredTaskCommandHandler(ctx, _authMock.Object);
            var command = new ProcessAIStructuredTaskCommand(
                MeetingNotesOrDocumentText: "Biên bản họp ...",
                AssignerId: assignor,
                FallbackAssigneeId: assignee
            );

            var act = async () => await handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task Handle_ShouldThrowArgumentException_WhenFallbackAssigneeIdIsDeleted()
        {
            using var ctx = new ApplicationDbContext(_dbOptions);
            var assignor = SeedUser("a3");
            var deletedAssignee = SeedUser("a4_deleted", deleted: true);

            var handler = new ProcessAIStructuredTaskCommandHandler(ctx, _authMock.Object);
            var command = new ProcessAIStructuredTaskCommand(
                MeetingNotesOrDocumentText: "...",
                AssignerId: assignor,
                FallbackAssigneeId: deletedAssignee
            );

            var act = async () => await handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>("Deleted users must not be selectable as FallbackAssignee");
        }

        [Fact]
        public async Task Handle_ShouldReturnSuggestionsWithoutCreatingTask_WhenAuthorized()
        {
            using var ctx = new ApplicationDbContext(_dbOptions);
            var assignor = SeedUser("auth1");
            var assignee = SeedUser("auth2");

            _authMock
                .Setup(s => s.CanAssignTaskAsync(assignor, assignee, It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var ai = new Mock<IDocumentAiService>();
            ai.Setup(x => x.AnalyzeDocumentAsync(It.IsAny<string>(), It.IsAny<System.Collections.Generic.IEnumerable<DepartmentOption>>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new DocumentAnalysisResult { Title = "Gợi ý có thể sửa", Summary = "Tóm tắt từ văn bản" });
            var handler = new ProcessAIStructuredTaskCommandHandler(ctx, _authMock.Object, ai.Object);
            var command = new ProcessAIStructuredTaskCommand(
                MeetingNotesOrDocumentText: "Cuộc họp chỉ đạo",
                AssignerId: assignor,
                FallbackAssigneeId: assignee
            );

            var result = await handler.Handle(command, CancellationToken.None);

            result.CreatedTaskId.Should().BeNull();
            result.Title.Should().Be("Gợi ý có thể sửa");
            result.DeadlineDate.Should().BeEmpty();
            result.PassedVerification.Should().BeFalse();
            ctx.TaskItems.Should().BeEmpty();
            ctx.Notifications.Should().BeEmpty();
        }
    }
}
