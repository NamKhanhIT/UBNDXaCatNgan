using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common;
using Quanlycongviec.Application.Features.Tasks.Queries.GetTasks;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Tasks
{
    public class GetTasksTodayFilterTests
    {
        private readonly DbContextOptions<ApplicationDbContext> _dbOptions;

        public GetTasksTodayFilterTests()
        {
            _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
        }

        private (Guid userId, Guid otherUserId, ApplicationDbContext ctx) Setup()
        {
            var ctx = new ApplicationDbContext(_dbOptions);
            var user = new User { Username = "u1", FullName = "User 1", Email = "u1@test.local" };
            var other = new User { Username = "u2", FullName = "User 2", Email = "u2@test.local" };
            ctx.Users.AddRange(user, other);
            ctx.SaveChanges();
            return (user.Id, other.Id, ctx);
        }

        [Fact]
        public async Task Handle_WithTodayOnly_ShouldReturnTasksDueTodayOrOverdue_ForCaller()
        {
            var (userId, otherId, ctx) = Setup();
            var today = DateTime.UtcNow.Date;
            var past = today.AddDays(-3);
            var future = today.AddDays(3);

            // Task 1: due today, assigned to user -> INCLUDE
            ctx.TaskItems.Add(new TaskItem
            {
                Title = "Task today",
                AssigneeId = userId,
                AssignerId = otherId,
                DueDate = today,
                Status = TaskStatusEnum.InProgress,
                Priority = TaskPriority.High,
                Type = TaskType.BAU,
                StartDate = today.AddDays(-1),
                CreatedAt = today.AddDays(-1),
                IsDeleted = false
            });
            // Task 2: overdue (past), assigned to user -> INCLUDE
            ctx.TaskItems.Add(new TaskItem
            {
                Title = "Task overdue",
                AssigneeId = userId,
                AssignerId = otherId,
                DueDate = past,
                Status = TaskStatusEnum.InProgress,
                Priority = TaskPriority.Medium,
                Type = TaskType.BAU,
                StartDate = past.AddDays(-1),
                CreatedAt = past.AddDays(-1),
                IsDeleted = false
            });
            // Task 3: future due, assigned to user -> EXCLUDE
            ctx.TaskItems.Add(new TaskItem
            {
                Title = "Task future",
                AssigneeId = userId,
                AssignerId = otherId,
                DueDate = future,
                Status = TaskStatusEnum.Todo,
                Priority = TaskPriority.Low,
                Type = TaskType.BAU,
                StartDate = future.AddDays(-1),
                CreatedAt = future.AddDays(-1),
                IsDeleted = false
            });
            // Task 4: due today, between OTHER users -> EXCLUDE (not related to caller)
            ctx.TaskItems.Add(new TaskItem
            {
                Title = "Task other-user",
                AssigneeId = otherId,
                AssignerId = Guid.NewGuid(),
                DueDate = today,
                Status = TaskStatusEnum.InProgress,
                Priority = TaskPriority.Low,
                Type = TaskType.BAU,
                StartDate = today,
                CreatedAt = today,
                IsDeleted = false
            });
            await ctx.SaveChangesAsync();

            var handler = new GetTasksQueryHandler(ctx);
            var query = new GetTasksQuery(
                userId: userId,
                rankLevel: 5, // staff scope
                todayOnly: true
            );

            var result = await handler.Handle(query, CancellationToken.None);

            result.Items.Should().HaveCount(2,
                "only tasks related to the caller and DueDate <= today are returned");
            result.Items.Select(t => t.Title).Should().Contain(new[] { "Task today", "Task overdue" });
        }

        [Fact]
        public async Task Handle_WithTodayOnly_ShouldIncludeTasksCreatedByCaller_EvenIfAssignedToOther()
        {
            var (userId, otherId, ctx) = Setup();
            var today = DateTime.UtcNow.Date;

            // Caller giao cho người khác, due hôm nay -> INCLUDE (vì AssignerId = userId)
            ctx.TaskItems.Add(new TaskItem
            {
                Title = "Caller assigned, due today",
                AssigneeId = otherId,
                AssignerId = userId,
                DueDate = today,
                Status = TaskStatusEnum.InProgress,
                Priority = TaskPriority.Medium,
                Type = TaskType.BAU,
                StartDate = today.AddDays(-2),
                CreatedAt = today.AddDays(-2),
                IsDeleted = false
            });
            await ctx.SaveChangesAsync();

            var handler = new GetTasksQueryHandler(ctx);
            var query = new GetTasksQuery(
                userId: userId,
                rankLevel: 5,
                todayOnly: true
            );

            var result = await handler.Handle(query, CancellationToken.None);
            result.Items.Should().ContainSingle(t => t.Title == "Caller assigned, due today");
        }

        [Fact]
        public async Task Handle_WithoutTodayOnly_ShouldNotApplyFilter()
        {
            var (userId, otherId, ctx) = Setup();
            var today = DateTime.UtcNow.Date;
            var future = today.AddDays(5);

            ctx.TaskItems.Add(new TaskItem
            {
                Title = "Future task",
                AssigneeId = userId,
                AssignerId = otherId,
                DueDate = future,
                Status = TaskStatusEnum.Todo,
                Priority = TaskPriority.Low,
                Type = TaskType.BAU,
                StartDate = today,
                CreatedAt = today,
                IsDeleted = false
            });
            await ctx.SaveChangesAsync();

            var handler = new GetTasksQueryHandler(ctx);
            var query = new GetTasksQuery(
                userId: userId,
                rankLevel: 5,
                todayOnly: false
            );

            var result = await handler.Handle(query, CancellationToken.None);
            result.Items.Should().HaveCount(1);
        }
    }
}
