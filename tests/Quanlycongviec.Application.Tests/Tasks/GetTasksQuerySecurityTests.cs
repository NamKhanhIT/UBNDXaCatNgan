using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Tasks.Queries.GetTasks;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Tasks
{
    public class GetTasksQuerySecurityTests
    {
        [Fact]
        public async Task ManagerQuery_WithoutClientDepartmentFilter_ShouldStayInCallersDepartment()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

            var ownDepartment = new Department { Name = "Own", Code = "OWN" };
            var otherDepartment = new Department { Name = "Other", Code = "OTHER" };
            var manager = new User
            {
                Username = "manager",
                FullName = "Manager",
                Email = "manager@test.local",
                PrimaryDepartmentId = ownDepartment.Id,
                ActiveRoleCode = "TruongPhong"
            };
            var staff = new User
            {
                Username = "staff",
                FullName = "Staff",
                Email = "staff@test.local",
                PrimaryDepartmentId = ownDepartment.Id
            };
            var otherStaff = new User
            {
                Username = "other",
                FullName = "Other",
                Email = "other@test.local",
                PrimaryDepartmentId = otherDepartment.Id
            };
            context.Departments.AddRange(ownDepartment, otherDepartment);
            context.Users.AddRange(manager, staff, otherStaff);
            context.TaskItems.AddRange(
                new TaskItem { Title = "Own task", AssignerId = manager.Id, AssigneeId = staff.Id, DepartmentId = ownDepartment.Id },
                new TaskItem { Title = "Other task", AssignerId = Guid.NewGuid(), AssigneeId = otherStaff.Id, DepartmentId = otherDepartment.Id });
            await context.SaveChangesAsync();

            var result = await new GetTasksQueryHandler(context).Handle(
                new GetTasksQuery(manager.Id, 3, page: 1, pageSize: 25), CancellationToken.None);

            result.Items.Select(x => x.Title).Should().ContainSingle("Own task");
        }

        [Fact]
        public async Task QueryWithoutCallerIdentity_ShouldReturnNoTasks()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
            context.TaskItems.Add(new TaskItem
            {
                Title = "Protected task",
                AssignerId = Guid.NewGuid(),
                AssigneeId = Guid.NewGuid()
            });
            await context.SaveChangesAsync();

            var result = await new GetTasksQueryHandler(context).Handle(
                new GetTasksQuery(), CancellationToken.None);

            result.TotalCount.Should().Be(0);
            result.Items.Should().BeEmpty();
        }

        [Fact]
        public async Task Query_ShouldApplyPriorityFilterBeforePagination()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
            var user = new User { Username = "priority_user", FullName = "User", Email = "priority@test.local" };
            context.Users.Add(user);
            context.TaskItems.AddRange(
                new TaskItem { Title = "Urgent", AssignerId = user.Id, AssigneeId = user.Id, Priority = TaskPriority.Urgent },
                new TaskItem { Title = "Low", AssignerId = user.Id, AssigneeId = user.Id, Priority = TaskPriority.Low });
            await context.SaveChangesAsync();

            var result = await new GetTasksQueryHandler(context).Handle(
                new GetTasksQuery(user.Id, 5, page: 1, pageSize: 10) { PriorityFilter = "Urgent" },
                CancellationToken.None);

            result.TotalCount.Should().Be(1);
            result.Items.Should().ContainSingle(x => x.Title == "Urgent");
        }
    }
}
