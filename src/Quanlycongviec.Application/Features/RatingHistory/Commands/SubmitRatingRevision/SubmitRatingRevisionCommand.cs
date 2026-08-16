using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Application.Features.RatingHistory.DTOs;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.RatingHistory.Commands.SubmitRatingRevision
{
    public record SubmitRatingRevisionCommand(
        Guid TaskItemId,
        double NewScore,
        string Reason,
        string EvidenceUrl,
        Guid CurrentUserId,
        double? NewSystemScore = null,
        double? NewEvaluatorScore = null
    ) : IRequest<RatingHistoryDto>;

    public class SubmitRatingRevisionCommandHandler : IRequestHandler<SubmitRatingRevisionCommand, RatingHistoryDto>
    {
        private readonly IApplicationDbContext _context;
        private readonly RatingRevisionOptions _options;

        public SubmitRatingRevisionCommandHandler(
            IApplicationDbContext context,
            IOptions<RatingRevisionOptions> options)
        {
            _context = context;
            _options = options.Value;
        }

        public async Task<RatingHistoryDto> Handle(SubmitRatingRevisionCommand request, CancellationToken cancellationToken)
        {
            var taskItem = await _context.TaskItems
                .Include(t => t.Assigner)
                .Include(t => t.Assignee)
                .FirstOrDefaultAsync(t => t.Id == request.TaskItemId, cancellationToken);

            if (taskItem == null)
            {
                throw new InvalidOperationException("Công việc không tồn tại.");
            }

            var currentUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.CurrentUserId, cancellationToken);

            if (currentUser == null)
            {
                throw new InvalidOperationException("Người dùng không tồn tại.");
            }

            var currentUserRank = await _context.UserRoles
                .Where(ur => ur.UserId == request.CurrentUserId)
                .MinAsync(ur => (int?)ur.Role.RankLevel) ?? 5;

            var assignerRank = await _context.UserRoles
                .Where(ur => ur.UserId == taskItem.AssignerId)
                .MinAsync(ur => (int?)ur.Role.RankLevel) ?? 5;

            // 1. Chặn người bị đánh giá (Assignee) tự sửa điểm của chính mình
            if (taskItem.AssigneeId == request.CurrentUserId)
            {
                throw new UnauthorizedAccessException("Cán bộ được giao việc không được tự sửa điểm đánh giá của chính mình.");
            }

            // 2. Chặn người không có thẩm quyền (Phải là Assigner hoặc có RankLevel nhỏ hơn/bằng Assigner)
            if (request.CurrentUserId != taskItem.AssignerId && currentUserRank > assignerRank)
            {
                throw new UnauthorizedAccessException("Bạn không có thẩm quyền sửa đánh giá cho công việc này.");
            }

            // 3. Validate điểm số (Thang 10)
            if (request.NewScore < 0.0 || request.NewScore > 10.0)
            {
                throw new ArgumentException("Điểm số đánh giá phải nằm trong khoảng từ 0 đến 10 điểm.");
            }

            // 4. Validate lý do (Tối thiểu minReasonLength ký tự)
            var trimmedReason = request.Reason?.Trim() ?? string.Empty;
            if (trimmedReason.Length < _options.MinReasonLength)
            {
                throw new ArgumentException($"Lý do thay đổi đánh giá phải chứa ít nhất {_options.MinReasonLength} ký tự để đảm bảo tính minh bạch.");
            }

            // 5. Validate minh chứng
            var trimmedEvidence = request.EvidenceUrl?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(trimmedEvidence))
            {
                throw new ArgumentException("Vui lòng đính kèm tệp văn bản / hình ảnh minh chứng cho việc điều chỉnh điểm.");
            }

            double? oldScore = taskItem.RatingScore;
            double? oldSystemScore = taskItem.SystemScore;
            double? oldEvaluatorScore = taskItem.EvaluatorScore;

            double scoreDelta = Math.Abs(request.NewScore - (oldScore ?? request.NewScore));

            RatingApprovalStatusEnum approvalStatus;
            if (scoreDelta <= _options.ApprovalThreshold)
            {
                // Độ lệch <= threshold (1.0đ): Áp dụng ngay lập tức
                approvalStatus = RatingApprovalStatusEnum.Applied;
                taskItem.RatingScore = request.NewScore;
                if (request.NewSystemScore.HasValue) taskItem.SystemScore = request.NewSystemScore;
                if (request.NewEvaluatorScore.HasValue) taskItem.EvaluatorScore = request.NewEvaluatorScore;
            }
            else
            {
                // Độ lệch > threshold (10.0đ): Cần cấp trên duyệt (Maker-Checker). Điểm cũ GIỮ NGUYÊN!
                approvalStatus = RatingApprovalStatusEnum.PendingApproval;
            }

            var ratingHistory = new Domain.Entities.RatingHistory
            {
                Id = Guid.NewGuid(),
                TaskItemId = taskItem.Id,
                OldScore = oldScore,
                OldSystemScore = oldSystemScore,
                OldEvaluatorScore = oldEvaluatorScore,
                NewScore = request.NewScore,
                NewSystemScore = request.NewSystemScore,
                NewEvaluatorScore = request.NewEvaluatorScore,
                ScoreDelta = scoreDelta,
                ChangedByUserId = request.CurrentUserId,
                ChangedAt = DateTime.UtcNow,
                Reason = trimmedReason,
                EvidenceUrl = trimmedEvidence,
                ApprovalStatus = approvalStatus
            };

            _context.RatingHistories.Add(ratingHistory);

            // Ghi AuditLog
            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.CurrentUserId,
                Username = currentUser.Username,
                ActingRole = currentUser.ActiveRoleCode,
                Action = approvalStatus == RatingApprovalStatusEnum.Applied ? "RATING_REVISED_APPLIED" : "RATING_REVISED_PENDING",
                EntityName = "TaskItem",
                EntityId = taskItem.Id.ToString(),
                Details = approvalStatus == RatingApprovalStatusEnum.Applied
                    ? $"Đã điều chỉnh điểm đánh giá việc \"{taskItem.Title}\" từ {(oldScore.HasValue ? oldScore.Value.ToString("F1") : "Chưa chấm")} thành {request.NewScore:F1}/100 (Áp dụng ngay)."
                    : $"Đề xuất điều chỉnh điểm việc \"{taskItem.Title}\" từ {(oldScore.HasValue ? oldScore.Value.ToString("F1") : "Chưa chấm")} thành {request.NewScore:F1}/100 (Chờ cấp trên duyệt do chênh lệch > {_options.ApprovalThreshold:F1} điểm).",
                IpAddress = "127.0.0.1"
            };
            _context.AuditLogs.Add(auditLog);

            await _context.SaveChangesAsync(cancellationToken);

            return new RatingHistoryDto
            {
                Id = ratingHistory.Id,
                TaskItemId = ratingHistory.TaskItemId,
                TaskItemTitle = taskItem.Title,
                OldScore = ratingHistory.OldScore,
                OldSystemScore = ratingHistory.OldSystemScore,
                OldEvaluatorScore = ratingHistory.OldEvaluatorScore,
                NewScore = ratingHistory.NewScore,
                NewSystemScore = ratingHistory.NewSystemScore,
                NewEvaluatorScore = ratingHistory.NewEvaluatorScore,
                ScoreDelta = ratingHistory.ScoreDelta,
                ChangedByUserId = ratingHistory.ChangedByUserId,
                ChangedByUserName = currentUser.FullName,
                ChangedByUserRoleName = currentUser.ActiveRoleCode,
                ChangedAt = ratingHistory.ChangedAt,
                Reason = ratingHistory.Reason,
                EvidenceUrl = ratingHistory.EvidenceUrl,
                ApprovalStatus = ratingHistory.ApprovalStatus,
                ApprovalStatusName = GetStatusName(ratingHistory.ApprovalStatus)
            };
        }

        private static string GetStatusName(RatingApprovalStatusEnum status) => status switch
        {
            RatingApprovalStatusEnum.Applied => "Đã áp dụng",
            RatingApprovalStatusEnum.PendingApproval => "Chờ cấp trên duyệt",
            RatingApprovalStatusEnum.ApprovedBySuperior => "Cấp trên đã duyệt",
            RatingApprovalStatusEnum.RejectedBySuperior => "Cấp trên từ chối",
            _ => status.ToString()
        };
    }
}
