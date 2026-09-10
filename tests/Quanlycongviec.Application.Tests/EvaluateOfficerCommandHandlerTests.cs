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

namespace Quanlycongviec.Application.Tests
{
    public class EvaluateOfficerCommandHandlerTests
    {
        private readonly DbContextOptions<ApplicationDbContext> _dbOptions;

        public EvaluateOfficerCommandHandlerTests()
        {
            _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
        }

        [Fact]
        public async Task Handle_ByCommuneLeader_ShouldEvaluateOfficerAndCalculateServerScores()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var leaderRole = new Role { Name = "Chủ tịch UBND xã", Code = "ChuTich", RankLevel = 1 };
            var staffRole = new Role { Name = "Chuyên viên Địa chính", Code = "ChuyenVien", RankLevel = 5 };
            var dept = new Department { Name = "Phòng Kinh tế" };

            var leader = new User { Username = "leader", FullName = "Nguyễn Văn Lãnh Đạo", Email = "leader@test.local", PrimaryDepartmentId = dept.Id };
            leader.UserRoles.Add(new UserRole { User = leader, Role = leaderRole });

            var staff = new User { Username = "staff", FullName = "Trần Văn Chuyên Viên", Email = "staff@test.local", PrimaryDepartmentId = dept.Id };
            staff.UserRoles.Add(new UserRole { User = staff, Role = staffRole });

            context.Roles.AddRange(leaderRole, staffRole);
            context.Departments.Add(dept);
            context.Users.AddRange(leader, staff);
            await context.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 10.0, // Client passes 10, server must calculate based on evaluator score
                EvaluatorScore70: 6.5,
                SystemScore30: 3.0,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "Hoàn thành tốt mọi công việc",
                EvaluatedByUserId: leader.Id
            );

            var result = await handler.Handle(command, CancellationToken.None);

            result.Should().NotBeNull();
            result.Success.Should().BeTrue();
            result.EvaluatorScore.Should().Be(6.5);
            result.FinalScore.Should().BeInRange(6.5, 10.0);
            result.TierGrade.Should().NotBeNullOrWhiteSpace();

            dispatcherMock.Verify(d => d.DispatchAsync(It.Is<Notification>(n => n.UserId == staff.Id && n.Type == NotificationType.Reviewed), It.IsAny<CancellationToken>()), Times.Once);

            var log = await context.ActivityLogs.FirstOrDefaultAsync(l => l.TargetEntityId == staff.Id.ToString() && l.ActionType == "officer_evaluated");
            log.Should().NotBeNull();
        }

        [Fact]
        public async Task Handle_ByStaffRank5_ShouldThrowUnauthorizedAccessException()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var staffRole = new Role { Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };
            var staff1 = new User { Username = "staff1", FullName = "Staff 1", Email = "s1@test.local" };
            staff1.UserRoles.Add(new UserRole { User = staff1, Role = staffRole });

            var staff2 = new User { Username = "staff2", FullName = "Staff 2", Email = "s2@test.local" };
            staff2.UserRoles.Add(new UserRole { User = staff2, Role = staffRole });

            context.Roles.Add(staffRole);
            context.Users.AddRange(staff1, staff2);
            await context.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff2.Id,
                RatingScore10: 8.0,
                EvaluatorScore70: 6.0,
                SystemScore30: 2.0,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "Tự đánh giá đồng nghiệp",
                EvaluatedByUserId: staff1.Id
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task Handle_ByDepartmentLeader_DifferentDepartment_ShouldThrowUnauthorizedAccessException()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var deptLeaderRole = new Role { Name = "Trưởng phòng", Code = "TruongPhong", RankLevel = 3 };
            var staffRole = new Role { Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };

            var dept1 = new Department { Name = "Phòng Kinh tế" };
            var dept2 = new Department { Name = "Phòng Văn hóa" };

            var deptLeader = new User { Username = "dept_leader", FullName = "Trưởng phòng KT", Email = "tpkt@test.local", PrimaryDepartmentId = dept1.Id };
            deptLeader.UserRoles.Add(new UserRole { User = deptLeader, Role = deptLeaderRole });

            var otherDeptStaff = new User { Username = "other_staff", FullName = "Chuyên viên VH", Email = "cvvh@test.local", PrimaryDepartmentId = dept2.Id };
            otherDeptStaff.UserRoles.Add(new UserRole { User = otherDeptStaff, Role = staffRole });

            context.Roles.AddRange(deptLeaderRole, staffRole);
            context.Departments.AddRange(dept1, dept2);
            context.Users.AddRange(deptLeader, otherDeptStaff);
            await context.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: otherDeptStaff.Id,
                RatingScore10: 8.0,
                EvaluatorScore70: 6.0,
                SystemScore30: 2.0,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "Chấm chéo phòng",
                EvaluatedByUserId: deptLeader.Id
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task Handle_WithInvalidEvaluatorScore_ShouldThrowArgumentException()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var leaderRole = new Role { Name = "Chủ tịch", Code = "ChuTich", RankLevel = 1 };
            var staffRole = new Role { Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };

            var leader = new User { Username = "leader2", FullName = "Lãnh đạo", Email = "l2@test.local" };
            leader.UserRoles.Add(new UserRole { User = leader, Role = leaderRole });

            var staff = new User { Username = "staff3", FullName = "Nhân viên", Email = "s3@test.local" };
            staff.UserRoles.Add(new UserRole { User = staff, Role = staffRole });

            context.Roles.AddRange(leaderRole, staffRole);
            context.Users.AddRange(leader, staff);
            await context.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 10.0,
                EvaluatorScore70: 8.5, // Exceeds 7.0 max
                SystemScore30: 2.0,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "Điểm vượt khung",
                EvaluatedByUserId: leader.Id
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>();
        }

        [Fact]
        public async Task Handle_WhenRatingPeriodIsClosed_ShouldThrowInvalidOperationException()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var leaderRole = new Role { Name = "Chủ tịch", Code = "ChuTich", RankLevel = 1 };
            var staffRole = new Role { Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };

            var leader = new User { Username = "leader3", FullName = "Lãnh đạo", Email = "l3@test.local" };
            leader.UserRoles.Add(new UserRole { User = leader, Role = leaderRole });

            var staff = new User { Username = "staff4", FullName = "Nhân viên", Email = "s4@test.local" };
            staff.UserRoles.Add(new UserRole { User = staff, Role = staffRole });

            var closedPeriod = new RatingPeriod
            {
                Title = "2026-08",
                PeriodType = "Monthly",
                Year = 2026,
                Month = 8,
                IsClosed = true,
                ClosedAt = DateTime.UtcNow
            };

            context.Roles.AddRange(leaderRole, staffRole);
            context.Users.AddRange(leader, staff);
            context.RatingPeriods.Add(closedPeriod);
            await context.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 8.0,
                EvaluatorScore70: 6.0,
                SystemScore30: 2.0,
                EvaluationPeriod: "2026-08", // Closed period
                EvaluationNotes: "Chấm lại kỳ đã khóa",
                EvaluatedByUserId: leader.Id
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<InvalidOperationException>();
        }
    }
}
