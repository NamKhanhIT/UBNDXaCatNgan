using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Validators;
using Quanlycongviec.Application.Features.Reports.Commands.EvaluateOfficer;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Reports
{
    /// <summary>
    /// 07-09-2026: Tests cho ràng buộc nghiệp vụ mới (R.1-R.4) trên Evaluation feature.
    /// Reference: docs/operations/2026-09-02-implementation-progress-and-ai-handoff.md §J
    /// </summary>
    public class EvaluationBusinessRulesTests
    {
        private readonly DbContextOptions<ApplicationDbContext> _dbOptions;

        public EvaluationBusinessRulesTests()
        {
            _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
        }

        private (ApplicationDbContext context, User leader, User staff, Role leaderRole, Role staffRole)
            SetupLeaderAndStaff()
        {
            var context = new ApplicationDbContext(_dbOptions);
            var leaderRole = new Role { Name = "Chủ tịch UBND xã", Code = "ChuTich", RankLevel = 1 };
            var staffRole = new Role { Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };
            var dept = new Department { Name = "Phòng Kinh tế" };

            var leader = new User { Username = "leader", FullName = "Lãnh đạo", Email = "l@test.local", PrimaryDepartmentId = dept.Id };
            leader.UserRoles.Add(new UserRole { User = leader, Role = leaderRole });

            var staff = new User { Username = "staff", FullName = "Nhân viên", Email = "s@test.local", PrimaryDepartmentId = dept.Id };
            staff.UserRoles.Add(new UserRole { User = staff, Role = staffRole });

            // Pre-create tasks with SystemScore=2.5 để server-calc systemScore = 2.5
            // (không rơi vào branch totalAssigned==0 → systemScore=0)
            // 5 tasks completed
            for (int i = 0; i < 5; i++)
            {
                context.TaskItems.Add(new TaskItem
                {
                    Title = $"SetupTask{i}",
                    AssigneeId = staff.Id,
                    AssignerId = leader.Id,
                    Status = TaskStatusEnum.Completed,
                    ProgressPercentage = 100,
                    SystemScore = 2.5,
                });
            }

            context.Roles.AddRange(leaderRole, staffRole);
            context.Departments.Add(dept);
            context.Users.AddRange(leader, staff);
            context.SaveChanges();

            return (context, leader, staff, leaderRole, staffRole);
        }

        // ── R.1: CẤM TỰ ĐÁNH GIÁ ĐIỂM BẢN THÂN ───────────────────────────

        [Fact]
        public async Task EvaluateOfficer_TargetIsSelf_ThrowsForbidden()
        {
            var (context, leader, _, _, _) = SetupLeaderAndStaff();
            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: leader.Id, // self
                RatingScore10: 9.5,
                EvaluatorScore70: 6.8,
                SystemScore30: 2.7,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "Tự chấm bản thân",
                EvaluatedByUserId: leader.Id
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>()
                .WithMessage("*chính mình*");
        }

        // ── R.2: LÝ DO KHÔNG HỢP LỆ ────────────────────────────────────────

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("ngắn")]
        public async Task EvaluateOfficer_DeltaEdit_WithoutValidReason_Throws(string? badReason)
        {
            var (context, leader, staff, _, _) = SetupLeaderAndStaff();
            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 9.0, // tăng từ 8.0
                EvaluatorScore70: 6.5,
                SystemScore30: 2.5,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "test",
                EvaluatedByUserId: leader.Id,
                Reason: badReason,
                EvidenceFileIds: new[] { Guid.NewGuid() },
                OldScore: 8.0
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*Lý do*");
        }

        [Fact]
        public async Task EvaluateOfficer_IncreaseScoreWithDecreaseKeyword_Throws()
        {
            var (context, leader, staff, _, _) = SetupLeaderAndStaff();
            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            // Tăng điểm nhưng dùng từ khóa giảm
            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 9.0,
                EvaluatorScore70: 6.5,
                SystemScore30: 2.5,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "test",
                EvaluatedByUserId: leader.Id,
                Reason: "Cán bộ trễ hạn nhiều lần nên được thưởng thêm", // TĂNG điểm nhưng dùng từ "trễ"
                EvidenceFileIds: new[] { Guid.NewGuid() },
                OldScore: 7.5
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*không khớp*với việc tăng*");
        }

        [Fact]
        public async Task EvaluateOfficer_DecreaseScoreWithIncreaseKeyword_Throws()
        {
            var (context, leader, staff, _, _) = SetupLeaderAndStaff();
            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            // Giảm điểm nhưng dùng từ khóa tăng
            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 7.0,
                EvaluatorScore70: 4.5,
                SystemScore30: 2.5,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "test",
                EvaluatedByUserId: leader.Id,
                Reason: "Cán bộ hoàn thành xuất sắc nên giảm điểm để cân bằng", // GIẢM nhưng dùng từ "hoàn thành", "xuất sắc"
                EvidenceFileIds: new[] { Guid.NewGuid() },
                OldScore: 8.5
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*không khớp*với việc giảm*");
        }

        [Theory]
        [InlineData("test điểm cho vui")]
        [InlineData("abc xyz")]
        [InlineData("chưa rõ lý do cụ thể")]
        public async Task EvaluateOfficer_GenericKeywordReason_Throws(string badReason)
        {
            var (context, leader, staff, _, _) = SetupLeaderAndStaff();
            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 9.0,
                EvaluatorScore70: 6.5,
                SystemScore30: 2.5,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "test",
                EvaluatedByUserId: leader.Id,
                Reason: badReason,
                EvidenceFileIds: new[] { Guid.NewGuid() },
                OldScore: 8.0
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*Lý do*");
        }

        // ── R.3: BẰNG CHỨNG KHÔNG HỢP LỆ ──────────────────────────────────

        [Fact]
        public async Task EvaluateOfficer_DeltaEdit_WithoutEvidence_Throws()
        {
            var (context, leader, staff, _, _) = SetupLeaderAndStaff();
            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 9.0,
                EvaluatorScore70: 6.5,
                SystemScore30: 2.5,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "test",
                EvaluatedByUserId: leader.Id,
                Reason: "Hoàn thành xuất sắc công việc tháng 9",
                EvidenceFileIds: null,
                OldScore: 8.0
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*bằng chứng*");
        }

        [Fact]
        public async Task EvaluateOfficer_EmptyEvidenceFile_Throws()
        {
            var (context, leader, staff, _, _) = SetupLeaderAndStaff();
            // File 0 byte do leader upload
            var emptyFileId = Guid.NewGuid();
            context.DocumentAttachments.Add(new DocumentAttachment
            {
                Id = emptyFileId,
                FileName = "empty.pdf",
                OriginalFileName = "empty.pdf",
                FilePath = "/files/empty.pdf",
                FileType = "pdf",
                FileSize = 0,
                DocumentId = Guid.NewGuid(),
                TargetType = "Inbox",
                UploadedByUserId = leader.Id,
                UploadedAt = DateTime.UtcNow.AddDays(-1)
            });
            context.SaveChanges();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 9.0,
                EvaluatorScore70: 6.5,
                SystemScore30: 2.5,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "test",
                EvaluatedByUserId: leader.Id,
                Reason: "Hoàn thành xuất sắc công việc tháng 9",
                EvidenceFileIds: new[] { emptyFileId },
                OldScore: 8.0
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*rỗng*");
        }

        [Fact]
        public async Task EvaluateOfficer_EvidenceOwnedByTarget_Throws()
        {
            var (context, leader, staff, _, _) = SetupLeaderAndStaff();
            // File do chính staff (target) upload — không được chấp nhận
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
                UploadedByUserId = staff.Id, // ← do target upload
                UploadedAt = DateTime.UtcNow.AddDays(-1)
            });
            context.SaveChanges();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 9.0,
                EvaluatorScore70: 6.5,
                SystemScore30: 2.5,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "test",
                EvaluatedByUserId: leader.Id,
                Reason: "Hoàn thành xuất sắc công việc tháng 9",
                EvidenceFileIds: new[] { selfFileId },
                OldScore: 8.0
            );

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*chính cán bộ*");
        }

        // ── HAPPY PATH: đủ lý do + evidence hợp lệ → succeed ────────────────

        [Fact]
        public async Task EvaluateOfficer_ValidReasonAndEvidence_Succeeds()
        {
            var (context, leader, staff, _, _) = SetupLeaderAndStaff();
            // File hợp lệ: do leader upload, size > 0
            var validFileId = Guid.NewGuid();
            context.DocumentAttachments.Add(new DocumentAttachment
            {
                Id = validFileId,
                FileName = "bienban.pdf",
                OriginalFileName = "bienban-hop.pdf",
                FilePath = "/files/bienban.pdf",
                FileType = "pdf",
                FileSize = 2048,
                DocumentId = Guid.NewGuid(),
                TargetType = "Inbox",
                UploadedByUserId = leader.Id,
                UploadedAt = DateTime.UtcNow.AddDays(-1)
            });
            context.SaveChanges();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 9.0,
                EvaluatorScore70: 6.5,
                SystemScore30: 2.5,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "test",
                EvaluatedByUserId: leader.Id,
                Reason: "Hoàn thành xuất sắc nhiệm vụ tháng 9, vượt chỉ tiêu KPI đề ra",
                EvidenceFileIds: new[] { validFileId },
                EvidenceUrls: new[] { "/files/bienban.pdf" },
                OldScore: 8.0
            );

            var result = await handler.Handle(command, CancellationToken.None);
            result.Success.Should().BeTrue();
            result.FinalScore.Should().Be(9.0);

            // R.4: audit log + RatingHistory phải được tạo
            var log = context.ActivityLogs.FirstOrDefault(l => l.TargetEntityId == staff.Id.ToString() && l.ActionType == "officer_score_updated");
            log.Should().NotBeNull();
            log!.Summary.Should().Contain("Cập nhật điểm thi đua");

            var history = context.RatingHistories.FirstOrDefault(h => h.NewScore == 9.0);
            history.Should().NotBeNull();
            history!.Reason.Should().Contain("Hoàn thành xuất sắc");
            history.EvidenceUrl.Should().Be("/files/bienban.pdf");
        }

        // ── R.5 (Thang 10): leader 7.0 + system 3.0 = 10.0 → Loại A ─────────

        [Fact]
        public async Task EvaluateOfficer_LeaderScoreAtMax_ReturnsTotal10_GradeA()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var leaderRole = new Role { Name = "Chủ tịch", Code = "ChuTich", RankLevel = 1 };
            var staffRole = new Role { Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };

            var leader = new User { Username = "leader", FullName = "Leader", Email = "l@test.local" };
            leader.UserRoles.Add(new UserRole { User = leader, Role = leaderRole });

            var staff = new User { Username = "staff", FullName = "Staff", Email = "s@test.local" };
            staff.UserRoles.Add(new UserRole { User = staff, Role = staffRole });

            // Tạo tasks có SystemScore = 3.0 để leader max-out
            for (int i = 0; i < 5; i++)
            {
                context.TaskItems.Add(new TaskItem
                {
                    Title = $"Task {i}",
                    AssigneeId = staff.Id,
                    AssignerId = leader.Id,
                    Status = TaskStatusEnum.Completed,
                    ProgressPercentage = 100,
                    SystemScore = 3.0
                });
            }

            context.Roles.AddRange(leaderRole, staffRole);
            context.Users.AddRange(leader, staff);
            await context.SaveChangesAsync();

            var dispatcherMock = new Mock<INotificationDispatcher>();
            var handler = new EvaluateOfficerCommandHandler(context, dispatcherMock.Object);

            var command = new EvaluateOfficerCommand(
                TargetUserId: staff.Id,
                RatingScore10: 10.0,
                EvaluatorScore70: 7.0, // MAX
                SystemScore30: 3.0,
                EvaluationPeriod: "2026-09",
                EvaluationNotes: "Xuất sắc",
                EvaluatedByUserId: leader.Id
            );

            var result = await handler.Handle(command, CancellationToken.None);
            result.Success.Should().BeTrue();
            result.FinalScore.Should().Be(10.0);
            result.TierGrade.Should().Contain("xuất sắc");
        }

        // ── Unit test cho RatingReasonValidator (sync, không cần DB) ────────

        [Theory]
        [InlineData("", 5, 7, false)]
        [InlineData("ngắn", 5, 7, false)]
        [InlineData("Hoàn thành tốt mọi việc", 5, 7, true)] // tăng + đúng từ khóa
        [InlineData("Trễ hạn nhiều, vi phạm quy trình", 8, 6, true)] // giảm + đúng từ khóa
        [InlineData("Cán bộ được thưởng vì hoàn thành xuất sắc", 5, 7, true)]
        [InlineData("Cán bộ trễ hạn nên được tăng điểm", 5, 7, false)] // tăng + từ khóa giảm
        [InlineData("test thử abc xyz", 5, 7, false)]
        [InlineData("chưa rõ lý do cụ thể", 5, 7, false)]
        public void RatingReasonValidator_HonorsDeltaAndBlocklist(string reason, double oldScore, double newScore, bool expectValid)
        {
            var error = RatingReasonValidator.Validate(reason, oldScore, newScore);
            if (expectValid) error.Should().BeNull();
            else error.Should().NotBeNull();
        }
    }
}
