using System;
using FluentAssertions;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Domain.Enums;
using Xunit;

namespace Quanlycongviec.Application.Tests.Tasks
{
    public class CreateTaskSelfAssignmentTests
    {
        private static CreateTaskCommand BuildValidCmd(Guid? assignerId = null, Guid? assigneeId = null)
        {
            return new CreateTaskCommand
            {
                Title = "Demo task",
                AssignerId = assignerId ?? Guid.NewGuid(),
                AssigneeId = assigneeId ?? Guid.NewGuid(),
                Priority = TaskPriority.Medium,
                StartDate = DateTime.UtcNow,
                DueDate = DateTime.UtcNow.AddDays(3),
                Type = TaskType.BAU,
                Description = "desc",
                Requirements = "req"
            };
        }

        [Fact]
        public void Validator_ShouldFail_WhenAssigneeEqualsAssigner()
        {
            var userId = Guid.NewGuid();
            var validator = new CreateTaskCommandValidator();
            var cmd = BuildValidCmd(assignerId: userId, assigneeId: userId);

            var result = validator.Validate(cmd);

            result.IsValid.Should().BeFalse("validator must reject self-assignment");
            result.Errors.Should().Contain(e =>
                e.PropertyName == "AssigneeId" &&
                e.ErrorMessage.Contains("Không thể tự giao việc", StringComparison.OrdinalIgnoreCase));
        }

        [Fact]
        public void Validator_ShouldPass_WhenAssigneeDifferentFromAssigner()
        {
            var validator = new CreateTaskCommandValidator();
            var cmd = BuildValidCmd();

            var result = validator.Validate(cmd);

            result.IsValid.Should().BeTrue();
        }
    }
}
