using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
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
            var assigner = new User { Username = "chutich", FullName = "Chủ tịch UBND", Email = "chutich@catngan.gov.vn" };
            var assignee = new User { Username = "chuyenvien1", FullName = "Chuyên viên Nam", Email = "nam@catngan.gov.vn" };

            _context.Users.AddRange(assigner, assignee);
            _context.WorkloadCapacities.Add(new WorkloadCapacity { UserId = assignee.Id, WeeklyMaxHours = 40.0, CurrentAssignedHours = 10.0 });
            await _context.SaveChangesAsync();

            var handler = new CreateTaskCommandHandler(_context);
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
    }
}
