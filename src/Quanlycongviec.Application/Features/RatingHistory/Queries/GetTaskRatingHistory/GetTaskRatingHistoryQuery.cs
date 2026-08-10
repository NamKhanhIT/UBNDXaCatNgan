using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.RatingHistory.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.RatingHistory.Queries.GetTaskRatingHistory
{
    public record GetTaskRatingHistoryQuery(Guid TaskItemId) : IRequest<List<RatingHistoryDto>>;

    public class GetTaskRatingHistoryQueryHandler : IRequestHandler<GetTaskRatingHistoryQuery, List<RatingHistoryDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetTaskRatingHistoryQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<RatingHistoryDto>> Handle(GetTaskRatingHistoryQuery request, CancellationToken cancellationToken)
        {
            var taskItem = await _context.TaskItems.FirstOrDefaultAsync(t => t.Id == request.TaskItemId, cancellationToken);
            if (taskItem == null)
            {
                return new List<RatingHistoryDto>();
            }

            var histories = await _context.RatingHistories
                .Where(r => r.TaskItemId == request.TaskItemId)
                .OrderByDescending(r => r.ChangedAt)
                .ToListAsync(cancellationToken);

            var userIds = histories.Select(h => h.ChangedByUserId)
                .Concat(histories.Where(h => h.ApprovedByUserId.HasValue).Select(h => h.ApprovedByUserId!.Value))
                .Distinct()
                .ToList();

            var usersMap = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u, cancellationToken);

            return histories.Select(h => new RatingHistoryDto
            {
                Id = h.Id,
                TaskItemId = h.TaskItemId,
                TaskItemTitle = taskItem.Title,
                OldScore = h.OldScore,
                NewScore = h.NewScore,
                ScoreDelta = h.ScoreDelta,
                ChangedByUserId = h.ChangedByUserId,
                ChangedByUserName = usersMap.TryGetValue(h.ChangedByUserId, out var changedUser) ? changedUser.FullName : "Không xác định",
                ChangedByUserRoleName = usersMap.TryGetValue(h.ChangedByUserId, out var cuRole) ? cuRole.ActiveRoleCode : string.Empty,
                ChangedAt = h.ChangedAt,
                Reason = h.Reason,
                EvidenceUrl = h.EvidenceUrl,
                ApprovalStatus = h.ApprovalStatus,
                ApprovalStatusName = GetStatusName(h.ApprovalStatus),
                ApprovedByUserId = h.ApprovedByUserId,
                ApprovedByUserName = h.ApprovedByUserId.HasValue && usersMap.TryGetValue(h.ApprovedByUserId.Value, out var appUser) ? appUser.FullName : null,
                ApprovedAt = h.ApprovedAt,
                RejectionReason = h.RejectionReason
            }).ToList();
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
