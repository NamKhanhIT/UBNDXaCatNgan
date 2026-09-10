using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Reports.Commands.DeleteOfficerRating;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Reports
{
    /// <summary>
    /// 07-09-2026: Tests cho DeleteOfficerRatingCommand (soft-delete điểm thi đua aggregate).
    /// </summary>
    public class DeleteOfficerRatingCommandHandlerTests
    {
        private readonly DbContextOptions<ApplicationDbContext> _dbOptions;

        public DeleteOfficerRatingCommandHandlerTests()
        {
            _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
        }

        private (ApplicationDbContext context, User leader, User staff, int taskCount)
            SetupLeaderStaffWithScoredTasks(int taskCount = 5, double sysScore = 2.5, double evalScore = 6.0)
        {
            var context = new ApplicationDbContext(_dbOptions);
            var leaderRole = new Role { Name = "Chủ tịch UBND xã", Code = "ChuTich", RankLevel = 1 };
            var staffRole = new Role { Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };
            var dept = new Department { Name = "Phòng Kinh tế" };

            var leader = new User { Username = "leader", FullName = "Lãnh đạo", Email = "l@test.local", PrimaryDepartmentId = dept.Id };
            leader.UserRoles.Add(new UserRole { User = leader, Role = leaderRole });

            var staff = new User { Username = "staff", FullName = "Nhân viên", Email = "s@test.local", PrimaryDepartmentId = dept.Id };
            staff.UserRoles.Add(new UserRole { User = staff, Role = staffRole });

            // Thêm tasks với SystemScore + EvaluatorScore đã chấm
            for (int i = 0; i < taskCount; i++)
            {
                context.TaskItems.Add(new TaskItem
                {
                    Title = $"Task {i}",
                    AssigneeId = staff.Id,
                    AssignerId = leader.Id,
                    Status = TaskStatusEnum.Completed,
                    ProgressPercentage = 100,
                    SystemScore = sysScore,
                    EvaluatorScore = evalScore,
                    RatingScore = sysScore + evalScore
                });
            }

            context.Roles.AddRange(leaderRole, staffRole);
            context.Departments.Add(dept);
            context.Users.AddRange(leader, staff);
            context.SaveChanges();

            return (context, leader, staff, taskCount);
        }

        // ── HAPPY PATH ──────────────────────────────────────────────────

        [Fact]
        public async Task DeleteOfficerRating_ValidRequest_Succeeds()
        {
            var (context, leader, staff, taskCount) = SetupLeaderStaffWithScoredTasks();
            var validFileId = Guid.NewGuid();
            context.DocumentAttachments.Add(new DocumentAttachment
            {
                Id = validFileId,
                FileName = "valid.pdf",
                OriginalFileName = "valid.pdf",
                FilePath = "/files/valid.pdf",
                FileType = "pdf",
                FileSize = 2048,
                DocumentId = Guid.NewGuid(),
                TargetType = "Inbox",
                UploadedByUserId = leader.Id,
                UploadedAt = DateTime.UtcNow.AddDays(-1)
            });
            await context.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new DeleteOfficerRatingCommandHandler(context, dispatcherMock.Object);

            var command = new DeleteOfficerRatingCommand(
                TargetUserId: staff.Id,
                EvaluationPeriod: "2026-09",
                Reason: "Trễ hạn nhiều lần, vi phạm quy trình nên xóa điểm",
                EvidenceFileIds: new[] { validFileId },
                CurrentUserId: leader.Id);

            var result = await handler.Handle(command, CancellationToken.None);

            result.Success.Should().BeTrue();
            result.TasksReset.Should().Be(taskCount);
            result.OldScore.Should().Be(8.5); // 2.5 + 6.0
            result.RatingHistoryId.Should().NotBe(Guid.Empty);

            // TaskItem phải được soft-reset
            var tasks = await context.TaskItems.Where(t => t.AssigneeId == staff.Id).ToListAsync();
            tasks.Should().AllSatisfy(t =>
            {
                t.RatingScore.Should().BeNull();
                t.SystemScore.Should().BeNull();
                t.EvaluatorScore.Should().BeNull();
            });

            // RatingHistory phải được tạo với prefix [DELETE]
            var history = await context.RatingHistories.FirstAsync(h => h.Id == result.RatingHistoryId);
            history.Should().NotBeNull();
            history.Reason.Should().StartWith("[DELETE]");
            history.ScoreDelta.Should().Be(-8.5);
            history.OldScore.Should().Be(8.5);
            history.NewScore.Should().Be(0.0);
            history.EvidenceUrl.Should().Be(validFileId.ToString());

            // ActivityLog
            var log = await context.ActivityLogs.FirstAsync(l => l.ActionType == "officer_score_deleted");
            log.Should().NotBeNull();
            log.Summary.Should().Contain("Xóa điểm thi đua");

            // Notification dispatched
            dispatcherMock.Verify(d => d.DispatchAsync(
                It.Is<Notification>(n => n.UserId == staff.Id && n.Type == NotificationType.Reviewed),
                It.IsAny<CancellationToken>()),
                Times.Once);
        }

        // ── R.1: CẤM TỰ XÓA ĐIỂM ─────────────────────────────────────

        [Fact]
        public async Task DeleteOfficerRating_SelfDelete_ThrowsForbidden()
        {
            // User vừa là leader vừa tự xóa điểm của chính mình
            await using var context = new ApplicationDbContext(_dbOptions);
            var leaderRole = new Role { Name = "CT", Code = "ChuTich", RankLevel = 1 };
            var dept = new Department { Name = "Phòng KT" };

            var dualUser = new User { Username = "dual", FullName = "Dual user", Email = "d@test.local", PrimaryDepartmentId = dept.Id };
            dualUser.UserRoles.Add(new UserRole { User = dualUser, Role = leaderRole });

            // Tasks đã chấm cho chính dualUser
            for (int i = 0; i < 3; i++)
            {
                context.TaskItems.Add(new TaskItem
                {
                    Title = $"Self task {i}",
                    AssigneeId = dualUser.Id,
                    Status = TaskStatusEnum.Completed,
                    SystemScore = 2.5,
                    EvaluatorScore = 6.0,
                    RatingScore = 8.5
                });
            }
            context.Roles.Add(leaderRole);
            context.Departments.Add(dept);
            context.Users.Add(dualUser);
            await context.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new DeleteOfficerRatingCommandHandler(context, dispatcherMock.Object);

            var command = new DeleteOfficerRatingCommand(
                TargetUserId: dualUser.Id,
                EvaluationPeriod: "2026-09",
                Reason: "Trễ hạn nên xóa điểm bản thân",
                EvidenceFileIds: new[] { Guid.NewGuid() },
                CurrentUserId: dualUser.Id);

            var act = () => handler.Handle(command, CancellationToken.None);

            await act.Should().ThrowAsync<UnauthorizedAccessException>()
                .WithMessage("*chính mình*");
        }

        // ── PERMISSION: Staff không được xóa ──────────────────────────

        [Fact]
        public async Task DeleteOfficerRating_NonLeaderStaff_ThrowsForbidden()
        {
            var (context, _, staff, _) = SetupLeaderStaffWithScoredTasks();
            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new DeleteOfficerRatingCommandHandler(context, dispatcherMock.Object);

            var command = new DeleteOfficerRatingCommand(
                TargetUserId: staff.Id,
                EvaluationPeriod: "2026-09",
                Reason: "Trễ hạn nên xóa điểm",
                EvidenceFileIds: new[] { Guid.NewGuid() },
                CurrentUserId: staff.Id); // staff có Rank=5 → reject

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>()
                .WithMessage("*Phó Trưởng phòng*");
        }

        // ── R.2: REASON không hợp lệ ──────────────────────────────────

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("ngắn")]
        [InlineData("test điểm cho vui")]
        public async Task DeleteOfficerRating_BadReason_Throws(string? badReason)
        {
            var (context, leader, staff, _) = SetupLeaderStaffWithScoredTasks();
            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new DeleteOfficerRatingCommandHandler(context, dispatcherMock.Object);

            var command = new DeleteOfficerRatingCommand(
                TargetUserId: staff.Id,
                EvaluationPeriod: "2026-09",
                Reason: badReason ?? string.Empty,
                EvidenceFileIds: new[] { Guid.NewGuid() },
                CurrentUserId: leader.Id);

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*Lý do*");
        }

        [Fact]
        public async Task DeleteOfficerRating_ReasonWithoutDecreaseKeyword_Throws()
        {
            var (context, leader, staff, _) = SetupLeaderStaffWithScoredTasks();
            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new DeleteOfficerRatingCommandHandler(context, dispatcherMock.Object);

            // Lý do dài đủ, KHÔNG chứa từ khóa giảm
            var command = new DeleteOfficerRatingCommand(
                TargetUserId: staff.Id,
                EvaluationPeriod: "2026-09",
                Reason: "Hoàn thành tốt mọi việc được giao nên xóa điểm cũ để chấm lại",
                EvidenceFileIds: new[] { Guid.NewGuid() },
                CurrentUserId: leader.Id);

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*không khớp*với việc giảm*");
        }

        // ── R.3: EVIDENCE không hợp lệ ─────────────────────────────────

        [Fact]
        public async Task DeleteOfficerRating_NoEvidence_Throws()
        {
            var (context, leader, staff, _) = SetupLeaderStaffWithScoredTasks();
            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new DeleteOfficerRatingCommandHandler(context, dispatcherMock.Object);

            var command = new DeleteOfficerRatingCommand(
                TargetUserId: staff.Id,
                EvaluationPeriod: "2026-09",
                Reason: "Trễ hạn nên xóa điểm thi đua cán bộ",
                EvidenceFileIds: Array.Empty<Guid>(),
                CurrentUserId: leader.Id);

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*bằng chứng*");
        }

        [Fact]
        public async Task DeleteOfficerRating_SelfUploadedEvidence_Throws()
        {
            var (context, leader, staff, _) = SetupLeaderStaffWithScoredTasks();
            // File do chính staff (target) upload
            var selfFileId = Guid.NewGuid();
            context.DocumentAttachments.Add(new DocumentAttachment
            {
                Id = selfFileId,
                FileName = "self.pdf",
                OriginalFileName = "self.pdf",
                FilePath = "/files/self.pdf",
                FileType = "pdf",
                FileSize = 1024,
                DocumentId = Guid.NewGuid(),
                TargetType = "Inbox",
                UploadedByUserId = staff.Id, // ← do staff (target) upload
                UploadedAt = DateTime.UtcNow.AddDays(-1)
            });
            await context.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new DeleteOfficerRatingCommandHandler(context, dispatcherMock.Object);

            var command = new DeleteOfficerRatingCommand(
                TargetUserId: staff.Id,
                EvaluationPeriod: "2026-09",
                Reason: "Trễ hạn nên xóa điểm thi đua cán bộ",
                EvidenceFileIds: new[] { selfFileId },
                CurrentUserId: leader.Id);

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*chính cán bộ*");
        }

        // ── Target user không tồn tại ──────────────────────────────────

        [Fact]
        public async Task DeleteOfficerRating_TargetNotFound_Throws()
        {
            var (context, leader, _, _) = SetupLeaderStaffWithScoredTasks();
            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new DeleteOfficerRatingCommandHandler(context, dispatcherMock.Object);

            var command = new DeleteOfficerRatingCommand(
                TargetUserId: Guid.NewGuid(),
                EvaluationPeriod: "2026-09",
                Reason: "Trễ hạn nên xóa điểm thi đua cán bộ",
                EvidenceFileIds: new[] { Guid.NewGuid() },
                CurrentUserId: leader.Id);

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<KeyNotFoundException>();
        }

        // ── Soft-reset: sau delete có thể re-evaluate ────────────────────

        [Fact]
        public async Task DeleteOfficerRating_AfterDelete_TaskCanBeReEvaluated()
        {
            var (context, leader, staff, taskCount) = SetupLeaderStaffWithScoredTasks();
            var validFileId = Guid.NewGuid();
            context.DocumentAttachments.Add(new DocumentAttachment
            {
                Id = validFileId,
                FileName = "valid.pdf",
                OriginalFileName = "valid.pdf",
                FilePath = "/files/valid.pdf",
                FileType = "pdf",
                FileSize = 2048,
                DocumentId = Guid.NewGuid(),
                TargetType = "Inbox",
                UploadedByUserId = leader.Id,
                UploadedAt = DateTime.UtcNow.AddDays(-1)
            });
            await context.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new DeleteOfficerRatingCommandHandler(context, dispatcherMock.Object);

            var command = new DeleteOfficerRatingCommand(
                TargetUserId: staff.Id,
                EvaluationPeriod: "2026-09",
                Reason: "Trễ hạn nhiều vi phạm quy trình nên xóa điểm",
                EvidenceFileIds: new[] { validFileId },
                CurrentUserId: leader.Id);

            var result = await handler.Handle(command, CancellationToken.None);
            result.Success.Should().BeTrue();
            result.TasksReset.Should().Be(taskCount);

            // Verify TaskItem đã được reset — re-evaluate sẽ tính lại từ đầu
            var tasks = await context.TaskItems.Where(t => t.AssigneeId == staff.Id).ToListAsync();
            tasks.Should().HaveCount(taskCount);
            tasks.Should().AllSatisfy(t =>
            {
                t.RatingScore.Should().BeNull();
                t.EvaluatorScore.Should().BeNull();
                t.SystemScore.Should().BeNull();
            });
        }
    }
}
