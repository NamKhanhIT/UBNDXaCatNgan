using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.Commands.UpdateTaskStatus;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Tasks
{
    public class TaskStatusWorkflowTests
    {
        [Fact]
        public async Task Handle_ShouldFailClosed_WhenAuthorizationServiceIsMissing()
        {
            await using var context = CreateContext();
            var task = AddTask(context, TaskStatusEnum.InProgress);
            await context.SaveChangesAsync();

            var calculator = new Mock<ISystemScoreCalculator>().Object;
            var handler = new UpdateTaskStatusCommandHandler(context, calculator, null!);

            Func<Task> act = () => handler.Handle(new UpdateTaskStatusCommand
            {
                RequestId = Guid.NewGuid(), Version = task.Version,
                TaskId = task.Id,
                Status = "InReview",
                CurrentUserId = task.AssigneeId,
                SubmissionNote = "result"
            }, CancellationToken.None);

            await act.Should().ThrowAsync<InvalidOperationException>();
            (await context.TaskItems.SingleAsync(t => t.Id == task.Id)).Status.Should().Be(TaskStatusEnum.InProgress);
        }

        [Fact]
        public async Task Handle_ShouldRejectDirectCompletionFromTodo()
        {
            await using var context = CreateContext();
            var task = AddTask(context, TaskStatusEnum.Todo);
            await context.SaveChangesAsync();

            var handler = CreateHandler(context);
            Func<Task> act = () => handler.Handle(new UpdateTaskStatusCommand
            {
                RequestId = Guid.NewGuid(), Version = task.Version,
                TaskId = task.Id,
                Status = "Completed",
                CurrentUserId = task.AssignerId
            }, CancellationToken.None);

            await act.Should().ThrowAsync<InvalidOperationException>();
            (await context.TaskItems.SingleAsync(t => t.Id == task.Id)).Status.Should().Be(TaskStatusEnum.Todo);
        }

        [Fact]
        public async Task Handle_ShouldRequireFeedbackWhenReturningReviewToInProgress()
        {
            await using var context = CreateContext();
            var task = AddTask(context, TaskStatusEnum.InReview);
            await context.SaveChangesAsync();

            var handler = CreateHandler(context);
            Func<Task> act = () => handler.Handle(new UpdateTaskStatusCommand
            {
                RequestId = Guid.NewGuid(), Version = task.Version,
                TaskId = task.Id,
                Status = "InProgress",
                CurrentUserId = task.AssignerId
            }, CancellationToken.None);

            await act.Should().ThrowAsync<ArgumentException>();
            (await context.TaskItems.SingleAsync(t => t.Id == task.Id)).Status.Should().Be(TaskStatusEnum.InReview);
        }

        [Fact]
        public async Task Handle_ShouldPreserveLegacyScores_AndIgnoreScoresInAcceptance()
        {
            await using var context = CreateContext();
            var task = AddTask(context, TaskStatusEnum.InReview);
            await context.SaveChangesAsync();

            var auth = new Mock<ITaskAuthorizationService>();
            auth.Setup(a => a.CanUpdateTaskStatusAsync(task.AssignerId, task.Id, TaskStatusEnum.Completed, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);
            auth.Setup(a => a.CanScoreTaskAsync(task.AssignerId, task.Id, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var calculator = new Mock<ISystemScoreCalculator>();
            calculator.Setup(c => c.Calculate(It.IsAny<TaskItem>(), It.IsAny<int>(), It.IsAny<System.Collections.Generic.IReadOnlyCollection<SubTask>>()))
                .Returns(new SystemScoreBreakdown { TotalSystemScore = 2.5 });

            var handler = new UpdateTaskStatusCommandHandler(context, calculator.Object, auth.Object);
            var result = await handler.Handle(new UpdateTaskStatusCommand
            {
                RequestId = Guid.NewGuid(), Version = task.Version,
                TaskId = task.Id,
                Status = "Completed",
                CurrentUserId = task.AssignerId,
                SubmissionId = (await context.TaskSubmissions.SingleAsync()).Id,
                SystemScore = 99,
                RatingScore = 100,
                EvaluatorScore = 6.5
            }, CancellationToken.None);

            result.Should().BeTrue();
            var saved = await context.TaskItems.SingleAsync(t => t.Id == task.Id);
            saved.SystemScore.Should().BeNull();
            saved.EvaluatorScore.Should().BeNull();
            saved.RatingScore.Should().BeNull();
            calculator.Invocations.Should().BeEmpty();
        }

        [Fact]
        public async Task Handle_ShouldAllowOnlyAssigneeToSubmitForReview()
        {
            await using var context = CreateContext();
            var task = AddTask(context, TaskStatusEnum.InProgress);
            await context.SaveChangesAsync();

            var handler = CreateHandler(context);
            Func<Task> act = () => handler.Handle(new UpdateTaskStatusCommand
            {
                RequestId = Guid.NewGuid(), Version = task.Version,
                TaskId = task.Id,
                Status = "InReview",
                CurrentUserId = task.AssignerId,
                SubmissionNote = "submitted by wrong actor"
            }, CancellationToken.None);

            await act.Should().ThrowAsync<UnauthorizedAccessException>();
            (await context.TaskItems.SingleAsync(t => t.Id == task.Id)).Status.Should().Be(TaskStatusEnum.InProgress);
        }

        private static ApplicationDbContext CreateContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new ApplicationDbContext(options);
        }

        private static TaskItem AddTask(ApplicationDbContext context, TaskStatusEnum status)
        {
            var leader = new User { Username = "leader", Email = "leader@example.invalid" };
            var officer = new User { Username = "officer", Email = "officer@example.invalid" };
            WorkflowTestData.AddAssignmentRoles(context, leader, officer);
            var task = new TaskItem
            {
                Title = "Workflow test", AssignerId = leader.Id, AssigneeId = officer.Id,
                ReviewerId = leader.Id, Requirements = "Kết quả", DueDate = DateTime.UtcNow.AddDays(1),
                Status = status, DepartmentId = leader.PrimaryDepartment!.Id
            };
            context.TaskItems.Add(task);
            if (status == TaskStatusEnum.InReview)
                context.TaskSubmissions.Add(new TaskSubmission { TaskItemId = task.Id, SubmittedById = officer.Id,
                    Note = "Kết quả thử", SubmittedAt = DateTime.UtcNow, DueDateAtSubmission = task.DueDate });
            return task;
        }

        private static UpdateTaskStatusCommandHandler CreateHandler(ApplicationDbContext context)
        {
            var calculator = new Mock<ISystemScoreCalculator>();
            calculator.Setup(c => c.Calculate(It.IsAny<TaskItem>(), It.IsAny<int>(), It.IsAny<System.Collections.Generic.IReadOnlyCollection<SubTask>>()))
                .Returns(new SystemScoreBreakdown { TotalSystemScore = 3.0 });
            return new UpdateTaskStatusCommandHandler(
                context,
                calculator.Object,
                new AllowAllTaskAuthorizationService());
        }
    }
}
