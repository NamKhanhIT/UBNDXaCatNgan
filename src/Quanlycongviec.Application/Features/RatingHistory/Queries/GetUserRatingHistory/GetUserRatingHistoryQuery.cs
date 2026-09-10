using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.RatingHistory.DTOs;

namespace Quanlycongviec.Application.Features.RatingHistory.Queries.GetUserRatingHistory
{
    /// <summary>
    /// Lấy tất cả lịch sử chỉnh sửa điểm của các công việc được giao cho 1 user cụ thể.
    /// Dùng cho Evaluation Timeline modal (frontend EvaluationFeature.tsx).
    /// </summary>
    public record GetUserRatingHistoryQuery(Guid UserId, DateTime? From, DateTime? To)
        : IRequest<List<RatingHistoryDto>>;

    public class GetUserRatingHistoryQueryHandler
        : IRequestHandler<GetUserRatingHistoryQuery, List<RatingHistoryDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetUserRatingHistoryQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<RatingHistoryDto>> Handle(
            GetUserRatingHistoryQuery request,
            CancellationToken cancellationToken)
        {
            // Lấy tất cả TaskItem mà user là người được giao
            var userTaskIds = await _context.TaskItems
                .Where(t => t.AssigneeId == request.UserId)
                .Select(t => t.Id)
                .ToListAsync(cancellationToken);

            if (userTaskIds.Count == 0)
            {
                return new List<RatingHistoryDto>();
            }

            var query = _context.RatingHistories
                .Where(r => userTaskIds.Contains(r.TaskItemId));

            if (request.From.HasValue)
            {
                query = query.Where(r => r.ChangedAt >= request.From.Value);
            }
            if (request.To.HasValue)
            {
                query = query.Where(r => r.ChangedAt <= request.To.Value);
            }

            var histories = await query
                .OrderByDescending(r => r.ChangedAt)
                .Take(200) // cap để tránh quá tải
                .ToListAsync(cancellationToken);

            if (histories.Count == 0)
            {
                return new List<RatingHistoryDto>();
            }

            var taskItemsMap = await _context.TaskItems
                .Where(t => userTaskIds.Contains(t.Id))
                .ToDictionaryAsync(t => t.Id, cancellationToken);

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
                TaskItemTitle = taskItemsMap.TryGetValue(h.TaskItemId, out var ti) ? ti.Title : "(đã xóa)",
                OldScore = h.OldScore,
                OldSystemScore = h.OldSystemScore,
                OldEvaluatorScore = h.OldEvaluatorScore,
                NewScore = h.NewScore,
                NewSystemScore = h.NewSystemScore,
                NewEvaluatorScore = h.NewEvaluatorScore,
                ScoreDelta = h.ScoreDelta,
                ChangedByUserId = h.ChangedByUserId,
                ChangedByUserName = usersMap.TryGetValue(h.ChangedByUserId, out var cu) ? cu.FullName : "Không xác định",
                ChangedByUserRoleName = usersMap.TryGetValue(h.ChangedByUserId, out var cur) ? cur.ActiveRoleCode : string.Empty,
                ChangedAt = h.ChangedAt,
                Reason = h.Reason,
                EvidenceUrl = h.EvidenceUrl,
                ApprovalStatus = h.ApprovalStatus,
                ApprovalStatusName = GetStatusName(h.ApprovalStatus),
                ApprovedByUserId = h.ApprovedByUserId,
                ApprovedByUserName = h.ApprovedByUserId.HasValue && usersMap.TryGetValue(h.ApprovedByUserId.Value, out var au) ? au.FullName : null,
                ApprovedAt = h.ApprovedAt,
                RejectionReason = h.RejectionReason
            }).ToList();
        }

        private static string GetStatusName(Quanlycongviec.Domain.Enums.RatingApprovalStatusEnum status) => status switch
        {
            Quanlycongviec.Domain.Enums.RatingApprovalStatusEnum.Applied => "Đã áp dụng",
            Quanlycongviec.Domain.Enums.RatingApprovalStatusEnum.PendingApproval => "Chờ cấp trên duyệt",
            Quanlycongviec.Domain.Enums.RatingApprovalStatusEnum.ApprovedBySuperior => "Cấp trên đã duyệt",
            Quanlycongviec.Domain.Enums.RatingApprovalStatusEnum.RejectedBySuperior => "Cấp trên từ chối",
            _ => status.ToString()
        };
    }
}
