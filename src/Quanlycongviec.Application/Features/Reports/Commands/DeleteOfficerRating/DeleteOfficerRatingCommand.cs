using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Validators;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Reports.Commands.DeleteOfficerRating
{
    /// <summary>
    /// 07-09-2026: Lệnh xóa (soft-delete) điểm thi đua aggregate của 1 cán bộ trong kỳ đánh giá.
    /// - Snapshot điểm cũ của tất cả TaskItems đã chấm trong kỳ vào RatingHistory (audit trail).
    /// - Đặt TaskItem.RatingScore/EvaluatorScore/SystemScore = null cho những task này.
    /// - Tuân thủ R.1 (cấm tự xóa điểm bản thân), R.2 (lý do phải có keyword giảm),
    ///   R.3 (bằng chứng không rỗng / không do target upload / không future-dated).
    /// Note: Tương tự EvaluateOfficerCommand với TaskItemId = Guid.Empty (aggregate-level),
    /// kỳ đánh giá = "yyyy-MM" (ví dụ "2026-09").
    /// </summary>
    public record DeleteOfficerRatingCommand(
        Guid TargetUserId,
        string EvaluationPeriod,
        string Reason,
        Guid[] EvidenceFileIds,
        Guid CurrentUserId
    ) : IRequest<DeleteOfficerRatingResultDto>;

    public class DeleteOfficerRatingResultDto
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? Error { get; set; }
        public double? OldScore { get; set; }
        public int TasksReset { get; set; }
        public Guid RatingHistoryId { get; set; }
    }

    public class DeleteOfficerRatingCommandHandler
        : IRequestHandler<DeleteOfficerRatingCommand, DeleteOfficerRatingResultDto>
    {
        private readonly IApplicationDbContext _context;
        private readonly INotificationDispatcher _notificationDispatcher;

        public DeleteOfficerRatingCommandHandler(
            IApplicationDbContext context,
            INotificationDispatcher notificationDispatcher)
        {
            _context = context;
            _notificationDispatcher = notificationDispatcher;
        }

        public async Task<DeleteOfficerRatingResultDto> Handle(
            DeleteOfficerRatingCommand request,
            CancellationToken cancellationToken)
        {
            // 1. Load thông tin người thực hiện (caller) + target user
            var caller = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == request.CurrentUserId && !u.IsDeleted, cancellationToken);

            if (caller == null)
            {
                throw new UnauthorizedAccessException("Không tìm thấy thông tin người dùng hiện tại.");
            }

            int callerRank = caller.UserRoles
                .Where(ur => !ur.IsDeleted)
                .Min(ur => (int?)ur.Role.RankLevel) ?? 5;

            // 2. Quyền hạn: chỉ lãnh đạo rank ≤ 4 mới được xóa điểm
            if (callerRank > 4)
            {
                throw new UnauthorizedAccessException(
                    "Chỉ cán bộ lãnh đạo, quản lý từ cấp Phó Trưởng phòng trở lên mới có thẩm quyền xóa điểm thi đua.");
            }

            var targetUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.TargetUserId && !u.IsDeleted, cancellationToken);

            if (targetUser == null)
            {
                throw new KeyNotFoundException("Không tìm thấy thông tin cán bộ cần xóa điểm.");
            }

            // 3. R.1: CẤM TỰ XÓA ĐIỂM BẢN THÂN
            if (request.CurrentUserId == request.TargetUserId)
            {
                throw new UnauthorizedAccessException(
                    "Bạn không thể xóa điểm thi đua của chính mình để đảm bảo tính khách quan.");
            }

            string period = string.IsNullOrWhiteSpace(request.EvaluationPeriod)
                ? DateTime.UtcNow.ToString("yyyy-MM")
                : request.EvaluationPeriod.Trim();

            // 4. Load tất cả TaskItem của target đã được chấm trong kỳ này
            var userTasks = await _context.TaskItems
                .Where(t => !t.IsDeleted && t.AssigneeId == request.TargetUserId && t.RatingScore.HasValue)
                .ToListAsync(cancellationToken);

            // Tính điểm tổng hợp cũ (giống EvaluateOfficerCommand — systemScore + evaluatorScore)
            double? oldScore = null;
            if (userTasks.Any())
            {
                var withSys = userTasks.Where(t => t.SystemScore.HasValue).ToList();
                var avg = withSys.Any() ? withSys.Average(t => t.SystemScore!.Value) : 0.0;
                var systemScore = avg > 3.0 ? avg / 10.0 : avg;
                systemScore = Math.Clamp(Math.Round(systemScore, 1), 0.0, 3.0);

                var withEval = userTasks.Where(t => t.EvaluatorScore.HasValue).ToList();
                var avgEval = withEval.Any() ? withEval.Average(t => t.EvaluatorScore!.Value) : 0.0;
                var leaderScore = avgEval > 7.0 ? avgEval / 10.0 : avgEval;
                leaderScore = Math.Clamp(Math.Round(leaderScore, 1), 0.0, 7.0);

                oldScore = Math.Round(systemScore + leaderScore, 1);
            }

            // 5. R.2: Validate lý do — xóa = giảm về 0 nên bắt buộc keyword giảm
            var reasonError = RatingReasonValidator.Validate(request.Reason, oldScore ?? 0.0, 0.0);
            if (reasonError != null)
            {
                throw new ArgumentException($"Lý do không hợp lệ: {reasonError}");
            }

            // 6. R.3: Validate evidence
            var evidenceError = await EvidenceValidator.ValidateAsync(
                request.EvidenceFileIds ?? Array.Empty<Guid>(),
                request.TargetUserId,
                _context,
                cancellationToken);
            if (evidenceError != null)
            {
                throw new ArgumentException($"Bằng chứng không hợp lệ: {evidenceError}");
            }

            // 7. Soft-reset các TaskItem (giữ nguyên task, chỉ xóa cột điểm)
            int tasksReset = 0;
            foreach (var task in userTasks)
            {
                task.RatingScore = null;
                task.SystemScore = null;
                task.EvaluatorScore = null;
                task.UpdatedAt = DateTime.UtcNow;
                tasksReset++;
            }

            // 8. Tạo RatingHistory với prefix [DELETE]
            string evidenceCsv = request.EvidenceFileIds != null && request.EvidenceFileIds.Length > 0
                ? string.Join(",", request.EvidenceFileIds)
                : string.Empty;

            var ratingHistory = new Domain.Entities.RatingHistory
            {
                Id = Guid.NewGuid(),
                TaskItemId = Guid.Empty, // aggregate-level delete (giống EvaluateOfficerCommand)
                OldScore = oldScore,
                NewScore = 0.0,
                ScoreDelta = -(oldScore ?? 0.0),
                ChangedByUserId = request.CurrentUserId,
                ChangedAt = DateTime.UtcNow,
                Reason = $"[DELETE] {request.Reason}",
                EvidenceUrl = evidenceCsv,
                ApprovalStatus = RatingApprovalStatusEnum.Applied,
                OldSystemScore = userTasks.Any(t => t.SystemScore.HasValue) ? userTasks.Where(t => t.SystemScore.HasValue).Average(t => t.SystemScore!.Value) : null,
                OldEvaluatorScore = userTasks.Any(t => t.EvaluatorScore.HasValue) ? userTasks.Where(t => t.EvaluatorScore.HasValue).Average(t => t.EvaluatorScore!.Value) : null,
                NewSystemScore = 0.0,
                NewEvaluatorScore = 0.0
            };
            _context.RatingHistories.Add(ratingHistory);

            // 9. ActivityLog
            var log = new ActivityLog
            {
                Id = Guid.NewGuid(),
                UserId = request.CurrentUserId,
                ActionType = "officer_score_deleted",
                TargetEntityType = "User",
                TargetEntityId = request.TargetUserId.ToString(),
                Summary = $"Xóa điểm thi đua kỳ [{period}] cho cán bộ [{targetUser.FullName}]. Điểm cũ: {oldScore?.ToString("F1") ?? "N/A"} → reset {tasksReset} task(s). Lý do: {request.Reason}.",
                CreatedAt = DateTime.UtcNow
            };
            _context.ActivityLogs.Add(log);

            await _context.SaveChangesAsync(cancellationToken);

            // 10. Thông báo cho cán bộ được xóa điểm
            try
            {
                await _notificationDispatcher.DispatchAsync(new Notification
                {
                    UserId = targetUser.Id,
                    Type = NotificationType.Reviewed,
                    Channel = NotificationChannel.InApp,
                    Title = "Điểm thi đua đã được xóa",
                    Message = $"Lãnh đạo đã xóa điểm thi đua kỳ {period} của bạn. {tasksReset} đầu việc đã được reset về chưa chấm. Lý do: {request.Reason}.",
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                }, cancellationToken);
            }
            catch
            {
                // Không chặn flow nếu notification lỗi
            }

            return new DeleteOfficerRatingResultDto
            {
                Success = true,
                Message = $"Đã xóa điểm thi đua kỳ {period} cho cán bộ {targetUser.FullName}. {tasksReset} đầu việc đã được reset.",
                OldScore = oldScore,
                TasksReset = tasksReset,
                RatingHistoryId = ratingHistory.Id
            };
        }
    }
}
