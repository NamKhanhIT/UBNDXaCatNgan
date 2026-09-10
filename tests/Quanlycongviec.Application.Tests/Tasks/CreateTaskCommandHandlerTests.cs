using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Application.Tests;
using Xunit;

namespace Quanlycongviec.Application.Tests.Tasks
{
    public class CreateTaskCommandHandlerTests
    {
        private readonly ApplicationDbContext _context;

        public CreateTaskCommandHandlerTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        [Fact]
        public async Task Handle_ShouldCreateTaskAndLogAudit_Successfully()
        {
            // Arrange
            var assigner = new User { Username = "chutich", FullName = "Chủ tịch UBND", Email = "chutich@ubnd.gov.vn" };
            var assignee = new User { Username = "chuyenvien1", FullName = "Chuyên viên Nam", Email = "nam@ubnd.gov.vn" };

            _context.Users.AddRange(assigner, assignee);
            _context.WorkloadCapacities.Add(new WorkloadCapacity { UserId = assignee.Id, WeeklyMaxHours = 40.0, CurrentAssignedHours = 10.0 });
            await _context.SaveChangesAsync();

            var handler = new CreateTaskCommandHandler(_context, new AllowAllTaskAuthorizationService());
            var command = new CreateTaskCommand
            {
                Title = "Rà soát văn bản đôn đốc chỉ đạo",
                Description = "Thực hiện rà soát các nghị quyết quý 3",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                DepartmentId = null,
                Priority = TaskPriority.High,
                Type = TaskType.BAU,
                EstimatedEffortHours = 15.0
            };

            // Act
            var taskId = await handler.Handle(command, CancellationToken.None);

            // Assert
            taskId.Should().NotBeEmpty();

            var taskInDb = await _context.TaskItems.FirstOrDefaultAsync(t => t.Id == taskId);
            taskInDb.Should().NotBeNull();
            taskInDb!.Title.Should().Be("Rà soát văn bản đôn đốc chỉ đạo");
            taskInDb.Priority.Should().Be(TaskPriority.High);

            var workload = await _context.WorkloadCapacities.FirstOrDefaultAsync(w => w.UserId == assignee.Id);
            workload!.CurrentAssignedHours.Should().Be(25.0); // 10 + 15

            var auditLog = await _context.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == taskId.ToString());
            auditLog.Should().NotBeNull();
            auditLog!.Action.Should().Be("CreateTask");
        }

        [Fact]
        public async Task Handle_ShouldFailClosed_WhenAuthorizationServiceIsMissing()
        {
            var assigner = new User { Username = "assigner", FullName = "Assigner", Email = "assigner@test.local" };
            var assignee = new User { Username = "assignee", FullName = "Assignee", Email = "assignee@test.local" };
            _context.Users.AddRange(assigner, assignee);
            await _context.SaveChangesAsync();

            var handler = new CreateTaskCommandHandler(_context, null!);
            var command = new CreateTaskCommand
            {
                Title = "Authorization boundary test",
                Description = "The command must not mutate state without authorization.",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                EstimatedEffortHours = 1
            };

            Func<Task> act = () => handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<InvalidOperationException>();
            (await _context.TaskItems.CountAsync()).Should().Be(0);
        }

        [Fact]
        public void Validator_ShouldAllowMissingLegacyEffort()
        {
            var command = new CreateTaskCommand
            {
                Title = "Task without legacy effort",
                AssignerId = Guid.NewGuid(),
                AssigneeId = Guid.NewGuid(),
                EstimatedEffortHours = 0
            };

            var result = new CreateTaskCommandValidator().Validate(command);

            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void TaskItem_ShouldExposeRequirementsField()
        {
            typeof(TaskItem).GetProperty("Requirements").Should().NotBeNull();
        }

        [Fact]
        public async Task Handle_ShouldPersistTrimmedRequirements_WithoutNewEffortEstimate()
        {
            var assigner = new User { Username = "requirements_assigner", FullName = "Assigner", Email = "req.assigner@test.local" };
            var assignee = new User { Username = "requirements_assignee", FullName = "Assignee", Email = "req.assignee@test.local" };
            _context.Users.AddRange(assigner, assignee);
            await _context.SaveChangesAsync();

            var handler = new CreateTaskCommandHandler(_context, new AllowAllTaskAuthorizationService());
            var taskId = await handler.Handle(new CreateTaskCommand
            {
                Title = "Requirements contract",
                Description = "Directive",
                Requirements = "  Submit the signed result  ",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id
            }, CancellationToken.None);

            var task = await _context.TaskItems.SingleAsync(t => t.Id == taskId);
            task.Requirements.Should().Be("Submit the signed result");
            task.EstimatedEffortHours.Should().Be(0);
        }
    }
}
