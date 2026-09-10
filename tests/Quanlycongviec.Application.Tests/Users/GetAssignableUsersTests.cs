using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Users.Queries.GetAssignableUsers;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Users
{
    public class GetAssignableUsersTests
    {
        private readonly DbContextOptions<ApplicationDbContext> _dbOptions;

        public GetAssignableUsersTests()
        {
            _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
        }

        private Guid SeedUser(ApplicationDbContext ctx, string name, Guid? deptId = null, bool deleted = false)
        {
            var u = new User { Username = name, FullName = name, Email = $"{name}@test.local", IsDeleted = deleted, PrimaryDepartmentId = deptId };
            ctx.Users.Add(u);
            return u.Id;
        }

        [Fact]
        public async Task Handle_ShouldNotIncludeCallerInResults()
        {
            using var ctx = new ApplicationDbContext(_dbOptions);
            var caller = SeedUser(ctx, "caller_x");
            var other = SeedUser(ctx, "other_y");
            ctx.SaveChanges();

            var handler = new GetAssignableUsersQueryHandler(ctx);
            var list = await handler.Handle(new GetAssignableUsersQuery
            {
                CallerUserId = caller
            }, CancellationToken.None);

            list.Should().NotBeNull();
            list.Select(u => u.Id).Should().NotContain(caller);
            list.Select(u => u.Id).Should().Contain(other);
        }

        [Fact]
        public async Task Handle_ShouldExcludeDeletedUsers()
        {
            using var ctx = new ApplicationDbContext(_dbOptions);
            var caller = SeedUser(ctx, "caller_a");
            var u1 = SeedUser(ctx, "active_z");
            var u2 = SeedUser(ctx, "deleted_z", deleted: true);
            ctx.SaveChanges();

            var handler = new GetAssignableUsersQueryHandler(ctx);
            var list = await handler.Handle(new GetAssignableUsersQuery
            {
                CallerUserId = caller
            }, CancellationToken.None);

            list.Should().NotBeNull();
            list.Select(u => u.Id).Should().Contain(u1);
            list.Select(u => u.Username).Should().NotContain("deleted_z");
        }

        [Fact]
        public async Task Handle_ShouldFilterByDepartmentId()
        {
            using var ctx = new ApplicationDbContext(_dbOptions);
            var deptA = new Department { Name = "Phòng A" };
            var deptB = new Department { Name = "Phòng B" };
            ctx.Departments.AddRange(deptA, deptB);
            await ctx.SaveChangesAsync();

            var caller = SeedUser(ctx, "caller_d");
            var inA = SeedUser(ctx, "inA", deptA.Id);
            var inB = SeedUser(ctx, "inB", deptB.Id);
            await ctx.SaveChangesAsync();

            var handler = new GetAssignableUsersQueryHandler(ctx);
            var list = await handler.Handle(new GetAssignableUsersQuery
            {
                CallerUserId = caller,
                DepartmentId = deptA.Id
            }, CancellationToken.None);

            list.Should().ContainSingle(u => u.Id == inA);
            list.Select(u => u.Id).Should().NotContain(inB);
        }

        [Fact]
        public async Task Handle_ShouldMatchCapability_ByDepartment()
        {
            using var ctx = new ApplicationDbContext(_dbOptions);
            var dc = new Department { Name = "Phòng Địa chính" };
            var hp = new Department { Name = "Phòng Hộ tịch Tư pháp" };
            ctx.Departments.AddRange(dc, hp);
            await ctx.SaveChangesAsync();

            var caller = SeedUser(ctx, "caller_cap");
            var inDc = SeedUser(ctx, "inDc", dc.Id);
            var inHp = SeedUser(ctx, "inHp", hp.Id);
            await ctx.SaveChangesAsync();

            var handler = new GetAssignableUsersQueryHandler(ctx);
            var list = await handler.Handle(new GetAssignableUsersQuery
            {
                CallerUserId = caller,
                Capability = "Địa chính"
            }, CancellationToken.None);

            list.Should().ContainSingle(u => u.Id == inDc);
            list.Select(u => u.Id).Should().NotContain(inHp);
        }

        [Fact]
        public async Task Handle_ShouldSortByMatchConfidence_Descending()
        {
            using var ctx = new ApplicationDbContext(_dbOptions);
            var caller = SeedUser(ctx, "caller_sort");
            var usr1 = SeedUser(ctx, "usr1");
            var usr2 = SeedUser(ctx, "usr2");
            await ctx.SaveChangesAsync();

            var handler = new GetAssignableUsersQueryHandler(ctx);
            var list = await handler.Handle(new GetAssignableUsersQuery
            {
                CallerUserId = caller
            }, CancellationToken.None);

            // Items must be sorted by confidence descending
            for (int i = 1; i < list.Count; i++)
            {
                list[i - 1].MatchConfidence.Should().BeGreaterOrEqualTo(list[i].MatchConfidence,
                    "results must be sorted by AI match confidence descending");
            }
        }

        [Fact]
        public async Task Handle_ShouldSearchByFullNameOrUsername()
        {
            using var ctx = new ApplicationDbContext(_dbOptions);
            var caller = SeedUser(ctx, "caller_search");
            var match = SeedUser(ctx, "pham_van_b");
            var miss = SeedUser(ctx, "le_van_c");
            await ctx.SaveChangesAsync();

            var handler = new GetAssignableUsersQueryHandler(ctx);
            var list = await handler.Handle(new GetAssignableUsersQuery
            {
                CallerUserId = caller,
                Search = "pham"
            }, CancellationToken.None);

            list.Should().ContainSingle(u => u.Id == match);
            list.Select(u => u.Id).Should().NotContain(miss);
        }
    }
}
