using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.RatingHistory.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.RatingHistory.Queries.GetPendingRatingRevisions
{
    public record GetPendingRatingRevisionsQuery() : IRequest<List<RatingHistoryDto>>;

    public class GetPendingRatingRevisionsQueryHandler : IRequestHandler<GetPendingRatingRevisionsQuery, List<RatingHistoryDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetPendingRatingRevisionsQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<RatingHistoryDto>> Handle(GetPendingRatingRevisionsQuery request, CancellationToken cancellationToken)
        {
            var pendingHistories = await _context.RatingHistories
                .Include(r => r.TaskItem)
                .Where(r => r.ApprovalStatus == RatingApprovalStatusEnum.PendingApproval)
                .OrderByDescending(r => r.ChangedAt)
                .ToListAsync(cancellationToken);

            var userIds = pendingHistories.Select(h => h.ChangedByUserId).Distinct().ToList();

            var usersMap = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u, cancellationToken);

            return pendingHistories.Select(h => new RatingHistoryDto
            {
                Id = h.Id,
                TaskItemId = h.TaskItemId,
                TaskItemTitle = h.TaskItem != null ? h.TaskItem.Title : string.Empty,
                OldScore = h.OldScore,
                NewScore = h.NewScore,
                ScoreDelta = h.ScoreDelta,
                ChangedByUserId = h.ChangedByUserId,
                ChangedByUserName = usersMap.TryGetValue(h.ChangedByUserId, out var user) ? user.FullName : "Không xác định",
                ChangedByUserRoleName = usersMap.TryGetValue(h.ChangedByUserId, out var uRole) ? uRole.ActiveRoleCode : string.Empty,
                ChangedAt = h.ChangedAt,
                Reason = h.Reason,
                EvidenceUrl = h.EvidenceUrl,
                ApprovalStatus = h.ApprovalStatus,
                ApprovalStatusName = "Chờ cấp trên duyệt"
            }).ToList();
        }
    }
}
