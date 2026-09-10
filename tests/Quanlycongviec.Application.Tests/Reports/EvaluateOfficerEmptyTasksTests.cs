using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Reports.Commands.EvaluateOfficer;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Reports
{
    public class EvaluateOfficerEmptyTasksTests
    {
        private readonly DbContextOptions<ApplicationDbContext> _dbOptions;

        public EvaluateOfficerEmptyTasksTests()
        {
            _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
        }

        // Helper: builds a User + Role + UserRole entry and saves to context
        private User BuildAndAddUser(
            ApplicationDbContext ctx,
            string username,
            string fullName,
            string roleName,
            int roleRank,
            Guid? deptId = null)
        {
            // Role
            var role = new Role { Name = roleName, Code = roleName, RankLevel = roleRank };
            ctx.Roles.Add(role);

            // User
            var user = new User
            {
                Username = username,
                FullName = fullName,
                Email = $"{username}@test.local",
                PrimaryDepartmentId = deptId
            };
            ctx.Users.Add(user);

            // Link via UserRole
            user.UserRoles.Add(new UserRole { User = user, Role = role, IsDeleted = false });
            return user;
        }

        [Fact]
        public async Task Handle_ShouldReturnZeroSystemScore_WhenOfficerHasNoAssignedTasks()
        {
            await using var ctx = new ApplicationDbContext(_dbOptions);
            var dept = new Department { Name = "Phòng Kinh tế" };
            ctx.Departments.Add(dept);
            await ctx.SaveChangesAsync();

            // Rank 1 leader
            var leader = BuildAndAddUser(ctx, "l1", "Lãnh Đạo", "Chủ tịch", 1, dept.Id);
            // Rank 5 staff (no tasks)
            var staff = BuildAndAddUser(ctx, "s1", "Nhân Viên", "Chuyên viên", 5, dept.Id);
            await ctx.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(ctx, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 0,
                EvaluatorScore70: 5.0,
                SystemScore30: null,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "No tasks assigned",
                EvaluatedByUserId: leader.Id
            );

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.SystemScore.Should().Be(0.0,
                "officer with zero assigned tasks should receive zero system score, not the maximum 3.0");
            result.FinalScore.Should().Be(5.0);
        }

        [Fact]
        public async Task Handle_ShouldReturnLowSystemScore_WhenAllTasksAreOverdue()
        {
            await using var ctx = new ApplicationDbContext(_dbOptions);
            var dept = new Department { Name = "Phòng Kinh tế" };
            ctx.Departments.Add(dept);
            await ctx.SaveChangesAsync();

            var leader = BuildAndAddUser(ctx, "l2", "Lãnh Đạo 2", "Chủ tịch", 1, dept.Id);
            var staff = BuildAndAddUser(ctx, "s2", "Nhân Viên 2", "Chuyên viên", 5, dept.Id);
            await ctx.SaveChangesAsync();

            // Add 1 overdue task at 0% progress (not completed, past due date)
            var overdueTask = new TaskItem
            {
                Title = "Overdue task",
                AssigneeId = staff.Id,
                AssignerId = leader.Id,
                Status = TaskStatusEnum.InProgress, // NOT completed
                DueDate = DateTime.UtcNow.AddDays(-5),
                ProgressPercentage = 0,
                Priority = TaskPriority.High,
                Type = TaskType.BAU,
                StartDate = DateTime.UtcNow.AddDays(-10),
                CreatedAt = DateTime.UtcNow.AddDays(-10),
                IsDeleted = false
            };
            ctx.TaskItems.Add(overdueTask);
            await ctx.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(ctx, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 0,
                EvaluatorScore70: 5.0,
                SystemScore30: null,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "All tasks overdue",
                EvaluatedByUserId: leader.Id
            );

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.SystemScore.Should().BeLessThan(1.5,
                "overdue tasks should produce a system score well below the maximum 1.5 on-time component");
        }
    }
}
