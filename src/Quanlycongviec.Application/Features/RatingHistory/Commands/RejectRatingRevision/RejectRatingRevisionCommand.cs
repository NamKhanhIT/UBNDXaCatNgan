using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.RatingHistory.Commands.RejectRatingRevision
{
    public record RejectRatingRevisionCommand(
        Guid RatingHistoryId,
        string RejectionReason,
        Guid CurrentUserId
    ) : IRequest<bool>;

    public class RejectRatingRevisionCommandHandler : IRequestHandler<RejectRatingRevisionCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public RejectRatingRevisionCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(RejectRatingRevisionCommand request, CancellationToken cancellationToken)
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
                throw new UnauthorizedAccessException("Bạn phải có cấp bậc cao hơn người giao việc và người đề xuất để phê duyệt hoặc từ chối thay đổi điểm.");
            }

            var trimmedReason = request.RejectionReason?.Trim() ?? string.Empty;
            if (trimmedReason.Length < 10)
            {
                throw new ArgumentException("Lý do từ chối phải chứa ít nhất 10 ký tự.");
            }

            // Từ chối phê duyệt. Điểm cũ GIỮ NGUYÊN!
            ratingHistory.ApprovalStatus = RatingApprovalStatusEnum.RejectedBySuperior;
            ratingHistory.RejectionReason = trimmedReason;
            ratingHistory.ApprovedByUserId = request.CurrentUserId;
            ratingHistory.ApprovedAt = DateTime.UtcNow;

            // Ghi AuditLog
            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.CurrentUserId,
                Username = approver.Username,
                ActingRole = approver.ActiveRoleCode,
                Action = "RATING_REVISION_REJECTED",
                EntityName = "RatingHistory",
                EntityId = ratingHistory.Id.ToString(),
                Details = $"Lãnh đạo {approver.FullName} đã từ chối đề xuất điều chỉnh điểm của việc \"{ratingHistory.TaskItem.Title}\". Lý do: {ratingHistory.RejectionReason}",
                IpAddress = "127.0.0.1"
            };
            _context.AuditLogs.Add(auditLog);

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
