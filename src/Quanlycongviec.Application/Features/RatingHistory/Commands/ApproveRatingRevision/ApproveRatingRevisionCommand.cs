using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.RatingHistory.Commands.ApproveRatingRevision
{
    public record ApproveRatingRevisionCommand(
        Guid RatingHistoryId,
        Guid CurrentUserId
    ) : IRequest<bool>;

    public class ApproveRatingRevisionCommandHandler : IRequestHandler<ApproveRatingRevisionCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public ApproveRatingRevisionCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(ApproveRatingRevisionCommand request, CancellationToken cancellationToken)
        {
            var ratingHistory = await _context.RatingHistories
                .Include(r => r.TaskItem)
                .ThenInclude(t => t.Assigner)
                .FirstOrDefaultAsync(r => r.Id == request.RatingHistoryId, cancellationToken);

            if (ratingHistory == null)
            {
                throw new InvalidOperationException("Bản ghi lịch sử đánh giá không tồn tại.");
            }

            if (ratingHistory.ApprovalStatus != RatingApprovalStatusEnum.PendingApproval)
            {
                throw new InvalidOperationException("Bản ghi này không ở trạng thái chờ duyệt.");
            }

            var approver = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.CurrentUserId, cancellationToken);

            if (approver == null)
            {
                throw new InvalidOperationException("Người duyệt không tồn tại.");
            }

            var proposer = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == ratingHistory.ChangedByUserId, cancellationToken);

            var approverRank = await _context.UserRoles
                .Where(ur => ur.UserId == request.CurrentUserId)
                .MinAsync(ur => (int?)ur.Role.RankLevel) ?? 5;

            var proposerRank = await _context.UserRoles
                .Where(ur => ur.UserId == ratingHistory.ChangedByUserId)
                .MinAsync(ur => (int?)ur.Role.RankLevel) ?? 5;

            var assignerRank = await _context.UserRoles
                .Where(ur => ur.UserId == ratingHistory.TaskItem.AssignerId)
                .MinAsync(ur => (int?)ur.Role.RankLevel) ?? 5;

            if (approverRank >= proposerRank || approverRank >= assignerRank)
            {
                throw new UnauthorizedAccessException("Bạn phải có cấp bậc cao hơn người giao việc và người đề xuất để phê duyệt thay đổi điểm.");
            }

            // Phê duyệt & Cập nhật điểm chính thức
            ratingHistory.ApprovalStatus = RatingApprovalStatusEnum.ApprovedBySuperior;
            ratingHistory.ApprovedByUserId = request.CurrentUserId;
            ratingHistory.ApprovedAt = DateTime.UtcNow;

            ratingHistory.TaskItem.RatingScore = ratingHistory.NewScore;
            if (ratingHistory.NewSystemScore.HasValue) ratingHistory.TaskItem.SystemScore = ratingHistory.NewSystemScore;
            if (ratingHistory.NewEvaluatorScore.HasValue) ratingHistory.TaskItem.EvaluatorScore = ratingHistory.NewEvaluatorScore;

            // Ghi AuditLog
            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.CurrentUserId,
                Username = approver.Username,
                ActingRole = approver.ActiveRoleCode,
                Action = "RATING_REVISION_APPROVED",
                EntityName = "RatingHistory",
                EntityId = ratingHistory.Id.ToString(),
                Details = $"Lãnh đạo {approver.FullName} đã phê duyệt đề xuất điều chỉnh điểm của việc \"{ratingHistory.TaskItem.Title}\" lên {ratingHistory.NewScore:F1}.",
                IpAddress = "127.0.0.1"
            };
            _context.AuditLogs.Add(auditLog);

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
