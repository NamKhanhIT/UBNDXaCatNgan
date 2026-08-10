using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Users.Queries.GetUsersPaginated;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Users
{
    public class GetUsersPaginatedQueryTests
    {
        private readonly ApplicationDbContext _context;

        public GetUsersPaginatedQueryTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        [Fact]
        public async Task Handle_ShouldReturnPaginatedUsersWithCalculatedWorkload_Successfully()
        {
            // Arrange
            var dept1 = new Department { Name = "Văn phòng HĐND & UBND", Code = "VP" };
            var dept2 = new Department { Name = "Phòng Địa chính - Xây dựng", Code = "DC" };

            var role1 = new Role { Name = "Chủ tịch UBND xã", Code = "ChuTichUBND", RankLevel = 1 };
            var role2 = new Role { Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };

            _context.Departments.AddRange(dept1, dept2);
            _context.Roles.AddRange(role1, role2);

            var user1 = new User { Username = "hungbd", FullName = "Bùi Văn Hùng", Email = "hung@catngan.gov.vn", PrimaryDepartment = dept1, ActiveRoleCode = "ChuTichUBND" };
            var user2 = new User { Username = "namnv", FullName = "Nguyễn Văn Nam", Email = "nam@catngan.gov.vn", PrimaryDepartment = dept1, ActiveRoleCode = "ChuyenVien" };
            var user3 = new User { Username = "maitt", FullName = "Trần Thị Mai", Email = "mai@catngan.gov.vn", PrimaryDepartment = dept2, ActiveRoleCode = "TruongPhong" };

            _context.Users.AddRange(user1, user2, user3);

            _context.UserRoles.Add(new UserRole { User = user1, Role = role1, Department = dept1, IsPrimary = true });
            _context.UserRoles.Add(new UserRole { User = user2, Role = role2, Department = dept1, IsPrimary = true });

            _context.WorkloadCapacities.Add(new WorkloadCapacity { UserId = user2.Id, WeeklyMaxHours = 40.0 });

            // Seed active tasks for user2 (Nam): 50 hours total -> Overloaded (>100%)
            _context.TaskItems.Add(new TaskItem { Title = "Task 1", AssigneeId = user2.Id, AssignerId = user1.Id, EstimatedEffortHours = 30.0, Status = TaskStatusEnum.InProgress });
            _context.TaskItems.Add(new TaskItem { Title = "Task 2", AssigneeId = user2.Id, AssignerId = user1.Id, EstimatedEffortHours = 20.0, Status = TaskStatusEnum.InReview });
            // Completed task should NOT count towards active workload
            _context.TaskItems.Add(new TaskItem { Title = "Task 3", AssigneeId = user2.Id, AssignerId = user1.Id, EstimatedEffortHours = 10.0, Status = TaskStatusEnum.Completed });

            await _context.SaveChangesAsync();

            var handler = new GetUsersPaginatedQueryHandler(_context);

            // Act 1: Get all users paginated
            var query = new GetUsersPaginatedQuery { Page = 1, PageSize = 10 };
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert 1
            result.Should().NotBeNull();
            result.TotalCount.Should().Be(3);
            result.Items.Should().HaveCount(3);

            var nam = result.Items.Find(u => u.Username == "namnv");
            nam.Should().NotBeNull();
            nam!.AssignedHours.Should().Be(50.0); // 30 + 20
            nam.UtilizationRate.Should().Be(125.0); // (50 / 40) * 100
            nam.IsOverloaded.Should().BeTrue();

            // Act 2: Search filter
            var searchResult = await handler.Handle(new GetUsersPaginatedQuery { Search = "Bùi Văn" }, CancellationToken.None);
            searchResult.TotalCount.Should().Be(1);
            searchResult.Items[0].FullName.Should().Be("Bùi Văn Hùng");

            // Act 3: Workload status filter (Overloaded)
            var overloadedResult = await handler.Handle(new GetUsersPaginatedQuery { WorkloadStatus = "Overloaded" }, CancellationToken.None);
            overloadedResult.TotalCount.Should().Be(1);
            overloadedResult.Items[0].Username.Should().Be("namnv");
        }
    }
}
