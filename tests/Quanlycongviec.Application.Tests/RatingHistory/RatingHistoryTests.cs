using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Application.Features.RatingHistory.Commands.ApproveRatingRevision;
using Quanlycongviec.Application.Features.RatingHistory.Commands.RejectRatingRevision;
using Quanlycongviec.Application.Features.RatingHistory.Commands.SubmitRatingRevision;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.RatingHistory
{
    public class RatingHistoryTests
    {
        private readonly ApplicationDbContext _context;
        private readonly IOptions<RatingRevisionOptions> _options;

        public RatingHistoryTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
            _options = Options.Create(new RatingRevisionOptions
            {
                ApprovalThreshold = 1.0,
                MinReasonLength = 30
            });
        }

        private async Task<User> CreateUserWithRoleAsync(string username, string fullName, int rankLevel, string roleCode)
        {
            var user = new User { Id = Guid.NewGuid(), Username = username, FullName = fullName, ActiveRoleCode = roleCode };
            var role = new Role { Id = Guid.NewGuid(), Code = roleCode, Name = roleCode, RankLevel = rankLevel };
            var userRole = new UserRole { UserId = user.Id, RoleId = role.Id, Role = role, User = user };

            _context.Users.Add(user);
            _context.Roles.Add(role);
            _context.UserRoles.Add(userRole);
            await _context.SaveChangesAsync();
            return user;
        }

        [Fact]
        public async Task SubmitRevision_DeltaLessOrEqualThreshold_ShouldApplyImmediately()
        {
            // Arrange
            var assigner = await CreateUserWithRoleAsync("bithu", "Bí Thư Xã", 1, "BiThuDU");
            var assignee = await CreateUserWithRoleAsync("chuyenvien", "Chuyên Viên A", 5, "ChuyenVien");

            var taskItem = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Kiểm tra trật tự đô thị tuyến đường A",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                RatingScore = 9.0,
                SystemScore = 3.0,
                EvaluatorScore = 6.0
            };
            _context.TaskItems.Add(taskItem);
            await _context.SaveChangesAsync();

            var handler = new SubmitRatingRevisionCommandHandler(_context, _options);
            var command = new SubmitRatingRevisionCommand(
                taskItem.Id,
                8.5, // Chênh 0.5 điểm (<= 1.0 threshold)
                "Bổ sung đánh giá còn tồn tại thiếu sót nhỏ trong biên bản kiểm tra",
                "https://minhchung.catngan.gov.vn/bienban-85.pdf",
                assigner.Id,
                3.0,
                5.5
            );

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.ApprovalStatus.Should().Be(RatingApprovalStatusEnum.Applied);
            result.OldScore.Should().Be(9.0);
            result.NewScore.Should().Be(8.5);
            result.NewEvaluatorScore.Should().Be(5.5);

            var updatedTask = await _context.TaskItems.FindAsync(taskItem.Id);
            updatedTask!.RatingScore.Should().Be(8.5); // Áp dụng ngay!
            updatedTask.EvaluatorScore.Should().Be(5.5);
        }

        [Fact]
        public async Task SubmitRevision_DeltaGreaterThanThreshold_ShouldSetPendingApproval()
        {
            // Arrange
            var assigner = await CreateUserWithRoleAsync("bithu", "Bí Thư Xã", 1, "BiThuDU");
            var assignee = await CreateUserWithRoleAsync("chuyenvien", "Chuyên Viên A", 5, "ChuyenVien");

            var taskItem = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Số hóa dữ liệu hộ tịch năm 2025",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                RatingScore = 8.5,
                SystemScore = 3.0,
                EvaluatorScore = 5.5
            };
            _context.TaskItems.Add(taskItem);
            await _context.SaveChangesAsync();

            var handler = new SubmitRatingRevisionCommandHandler(_context, _options);
            var command = new SubmitRatingRevisionCommand(
                taskItem.Id,
                5.0, // Chênh 3.5 điểm (> 1.0) -> Cần cấp trên duyệt
                "Phát hiện hồ sơ vi phạm quy trình lưu trữ, điều chỉnh giảm điểm để kiểm điểm",
                "https://minhchung.catngan.gov.vn/phieu-kiem-doan-inspect.pdf",
                assigner.Id,
                3.0,
                2.0
            );

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.ApprovalStatus.Should().Be(RatingApprovalStatusEnum.PendingApproval);
            
            var updatedTask = await _context.TaskItems.FindAsync(taskItem.Id);
            updatedTask!.RatingScore.Should().Be(8.5); // ĐIỂM CŨ GIỮ NGUYÊN cho tới khi cấp trên duyệt!
        }

        [Fact]
        public async Task SubmitRevision_AssigneeAttemptingToSelfRevise_ShouldThrowUnauthorized()
        {
            // Arrange
            var assigner = await CreateUserWithRoleAsync("bithu", "Bí Thư Xã", 1, "BiThuDU");
            var assignee = await CreateUserWithRoleAsync("chuyenvien", "Chuyên Viên A", 5, "ChuyenVien");

            var taskItem = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Tuyên truyền an toàn giao thông",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                RatingScore = 6.0
            };
            _context.TaskItems.Add(taskItem);
            await _context.SaveChangesAsync();

            var handler = new SubmitRatingRevisionCommandHandler(_context, _options);
            var command = new SubmitRatingRevisionCommand(
                taskItem.Id,
                9.5, // Chuyên viên tự nâng điểm của mình
                "Tự cảm thấy làm tốt nên muốn tự sửa nâng điểm số công việc",
                "https://minhchung.catngan.gov.vn/tu-danh-gia.pdf",
                assignee.Id // Assignee tự gọi
            );

            // Act & Assert
            var act = async () => await handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task SubmitRevision_ReasonLengthLessThan30Chars_ShouldThrowArgumentException()
        {
            // Arrange
            var assigner = await CreateUserWithRoleAsync("bithu", "Bí Thư Xã", 1, "BiThuDU");
            var assignee = await CreateUserWithRoleAsync("chuyenvien", "Chuyên Viên A", 5, "ChuyenVien");

            var taskItem = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Thu hoạch vụ mùa",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                RatingScore = 7.0
            };
            _context.TaskItems.Add(taskItem);
            await _context.SaveChangesAsync();

            var handler = new SubmitRatingRevisionCommandHandler(_context, _options);
            var command = new SubmitRatingRevisionCommand(
                taskItem.Id,
                8.0,
                "Sửa lại thôi", // Chỉ 12 ký tự (< 30)
                "https://minhchung.catngan.gov.vn/minhchung.pdf",
                assigner.Id
            );

            // Act & Assert
            var act = async () => await handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>();
        }

        [Fact]
        public async Task ApproveRevision_SuperiorUser_ShouldUpdateTaskRatingScore()
        {
            // Arrange
            var superiorLeader = await CreateUserWithRoleAsync("chutich", "Chủ Tịch UBND", 1, "ChuTichUBND");
            var assigner = await CreateUserWithRoleAsync("truongphong", "Trưởng Phòng VP", 3, "TruongPhong");
            var assignee = await CreateUserWithRoleAsync("chuyenvien", "Chuyên Viên A", 5, "ChuyenVien");

            var taskItem = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Báo cáo kinh tế xã hội quý I",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                RatingScore = 8.5,
                SystemScore = 3.0,
                EvaluatorScore = 5.5
            };
            _context.TaskItems.Add(taskItem);

            var pendingRevision = new Domain.Entities.RatingHistory
            {
                Id = Guid.NewGuid(),
                TaskItemId = taskItem.Id,
                OldScore = 8.5,
                OldSystemScore = 3.0,
                OldEvaluatorScore = 5.5,
                NewScore = 5.0,
                NewSystemScore = 3.0,
                NewEvaluatorScore = 2.0,
                ScoreDelta = 3.5,
                ChangedByUserId = assigner.Id,
                Reason = "Điều chỉnh giảm điểm do phát hiện sai sót số liệu tổng hợp trong phụ lục",
                EvidenceUrl = "https://minhchung.catngan.gov.vn/bien-ban-sai-so.pdf",
                ApprovalStatus = RatingApprovalStatusEnum.PendingApproval
            };
            _context.RatingHistories.Add(pendingRevision);
            await _context.SaveChangesAsync();

            var approveHandler = new ApproveRatingRevisionCommandHandler(_context);
            var command = new ApproveRatingRevisionCommand(pendingRevision.Id, superiorLeader.Id);

            // Act
            var result = await approveHandler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();

            var updatedHistory = await _context.RatingHistories.FindAsync(pendingRevision.Id);
            updatedHistory!.ApprovalStatus.Should().Be(RatingApprovalStatusEnum.ApprovedBySuperior);
            updatedHistory.ApprovedByUserId.Should().Be(superiorLeader.Id);

            var updatedTask = await _context.TaskItems.FindAsync(taskItem.Id);
            updatedTask!.RatingScore.Should().Be(5.0); // Điểm mới 5.0 CHÍNH THỨC CẤP TRÊN DUYỆT ÁP DỤNG!
            updatedTask.EvaluatorScore.Should().Be(2.0);
        }

        [Fact]
        public async Task RejectRevision_SuperiorUserWithValidReason_ShouldKeepOldScore()
        {
            // Arrange
            var superiorLeader = await CreateUserWithRoleAsync("chutich2", "Chủ Tịch UBND", 1, "ChuTichUBND");
            var assigner = await CreateUserWithRoleAsync("truongphong2", "Trưởng Phòng VP", 3, "TruongPhong");
            var assignee = await CreateUserWithRoleAsync("chuyenvien2", "Chuyên Viên B", 5, "ChuyenVien");

            var taskItem = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Số hóa hồ sơ công chức 2026",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                RatingScore = 8.5
            };
            _context.TaskItems.Add(taskItem);

            var pendingRevision = new Domain.Entities.RatingHistory
            {
                Id = Guid.NewGuid(),
                TaskItemId = taskItem.Id,
                OldScore = 8.5,
                NewScore = 5.0,
                ScoreDelta = 3.5,
                ChangedByUserId = assigner.Id,
                Reason = "Đề xuất hạ điểm do nhận thấy công việc chưa đạt tiến độ cam kết",
                EvidenceUrl = "https://minhchung.catngan.gov.vn/bienban-ha-diem.pdf",
                ApprovalStatus = RatingApprovalStatusEnum.PendingApproval
            };
            _context.RatingHistories.Add(pendingRevision);
            await _context.SaveChangesAsync();

            var rejectHandler = new RejectRatingRevisionCommandHandler(_context);
            var command = new RejectRatingRevisionCommand(
                pendingRevision.Id,
                "Không đồng ý hạ điểm vì minh chứng giải trình chưa thuyết phục", // >= 10 chars
                superiorLeader.Id
            );

            // Act
            var result = await rejectHandler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();

            var updatedHistory = await _context.RatingHistories.FindAsync(pendingRevision.Id);
            updatedHistory!.ApprovalStatus.Should().Be(RatingApprovalStatusEnum.RejectedBySuperior);
            updatedHistory.RejectionReason.Should().Be("Không đồng ý hạ điểm vì minh chứng giải trình chưa thuyết phục");

            var updatedTask = await _context.TaskItems.FindAsync(taskItem.Id);
            updatedTask!.RatingScore.Should().Be(8.5); // Điểm cũ GIỮ NGUYÊN!
        }
    }
}
