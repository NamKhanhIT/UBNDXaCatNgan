using System;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.AI
{
    public class StaffWorkloadAndExpertiseTests
    {
        private readonly ApplicationDbContext _context;

        public StaffWorkloadAndExpertiseTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        [Fact]
        public void UserEntity_YearsOfExperience_DefaultValueShouldBeZero()
        {
            // Arrange & Act
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "canbo_moi",
                FullName = "Nguyễn Văn A"
            };

            // Assert
            user.YearsOfExperience.Should().Be(0, "Mặc định sau migration toàn bộ cán bộ có số năm kinh nghiệm = 0");
            user.Expertise.Should().BeNull();
        }

        [Fact]
        public void UserEntity_SetExpertiseAndYearsOfExperience_ShouldRetainValues()
        {
            // Arrange & Act
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "canbo_diachinh",
                FullName = "Trần Thị Mai",
                Expertise = "Đất đai, Quy hoạch, TTHC",
                YearsOfExperience = 7
            };

            // Assert
            user.Expertise.Should().Be("Đất đai, Quy hoạch, TTHC");
            user.YearsOfExperience.Should().Be(7);
        }

        [Fact]
        public async Task ActiveTasksCount_ShouldOnlyCountActiveNonDeletedTasks()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "canbo1",
                FullName = "Lê Văn C"
            };
            _context.Users.Add(user);

            // Active tasks (should be counted: 3)
            var taskTodo = new TaskItem { Id = Guid.NewGuid(), Title = "Task 1", AssigneeId = user.Id, Status = TaskStatusEnum.Todo, IsDeleted = false };
            var taskInProgress = new TaskItem { Id = Guid.NewGuid(), Title = "Task 2", AssigneeId = user.Id, Status = TaskStatusEnum.InProgress, IsDeleted = false };
            var taskInReview = new TaskItem { Id = Guid.NewGuid(), Title = "Task 3", AssigneeId = user.Id, Status = TaskStatusEnum.InReview, IsDeleted = false };

            // Inactive / completed tasks (should NOT be counted)
            var taskCompleted = new TaskItem { Id = Guid.NewGuid(), Title = "Task 4", AssigneeId = user.Id, Status = TaskStatusEnum.Completed, IsDeleted = false };
            var taskCancelled = new TaskItem { Id = Guid.NewGuid(), Title = "Task 5", AssigneeId = user.Id, Status = TaskStatusEnum.Cancelled, IsDeleted = false };
            var taskDeleted = new TaskItem { Id = Guid.NewGuid(), Title = "Task 6", AssigneeId = user.Id, Status = TaskStatusEnum.InProgress, IsDeleted = true };

            _context.TaskItems.AddRange(taskTodo, taskInProgress, taskInReview, taskCompleted, taskCancelled, taskDeleted);
            await _context.SaveChangesAsync();

            // Act: Calculate active tasks count using the exact query from InboxController
            var activeCount = await _context.TaskItems
                .Where(t => t.AssigneeId == user.Id &&
                            t.Status != TaskStatusEnum.Completed &&
                            t.Status != TaskStatusEnum.Cancelled &&
                            !t.IsDeleted)
                .CountAsync();

            var workloadPercentage = activeCount * 10.0; // 10% per active task

            // Assert
            activeCount.Should().Be(3, "Chỉ có Todo, InProgress, InReview là active và không bị xóa");
            workloadPercentage.Should().Be(30.0);
        }
    }
}
