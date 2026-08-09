using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Workload.Queries.GetWorkloadHeatmap;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Workload
{
    public class GetWorkloadHeatmapQueryHandlerTests
    {
        private readonly ApplicationDbContext _context;

        public GetWorkloadHeatmapQueryHandlerTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        [Fact]
        public async Task Handle_ShouldReturnWorkloadHeatmap_WithOverloadWarning()
        {
            // Arrange
            var user = new User { Username = "quatai_user", FullName = "Nguyễn Văn Quá Tải", Email = "quatai@catngan.gov.vn" };
            _context.Users.Add(user);
            _context.WorkloadCapacities.Add(new WorkloadCapacity { UserId = user.Id, WeeklyMaxHours = 40.0 });

            var task1 = new TaskItem { Title = "Task 1", AssignerId = user.Id, AssigneeId = user.Id, EstimatedEffortHours = 30.0, Status = Domain.Enums.TaskStatusEnum.InProgress };
            var task2 = new TaskItem { Title = "Task 2", AssignerId = user.Id, AssigneeId = user.Id, EstimatedEffortHours = 20.0, Status = Domain.Enums.TaskStatusEnum.Todo };
            _context.TaskItems.AddRange(task1, task2);
            await _context.SaveChangesAsync();

            var handler = new GetWorkloadHeatmapQueryHandler(_context);

            // Act
            var result = await handler.Handle(new GetWorkloadHeatmapQuery(), CancellationToken.None);

            // Assert
            result.Should().HaveCount(1);
            var heatmap = result[0];
            heatmap.FullName.Should().Be("Nguyễn Văn Quá Tải");
            heatmap.CurrentAssignedHours.Should().Be(50.0);
            heatmap.UtilizationRate.Should().Be(125.0); // 50 / 40 * 100
            heatmap.IsOverloaded.Should().BeTrue();
        }
    }
}
