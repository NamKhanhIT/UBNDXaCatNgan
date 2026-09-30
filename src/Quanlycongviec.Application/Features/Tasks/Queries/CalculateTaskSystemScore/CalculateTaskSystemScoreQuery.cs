using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Tasks.Queries.CalculateTaskSystemScore
{
    public record CalculateTaskSystemScoreQuery(Guid TaskItemId, Guid CurrentUserId = default) : IRequest<SystemScoreBreakdown>;

    public class CalculateTaskSystemScoreQueryHandler : IRequestHandler<CalculateTaskSystemScoreQuery, SystemScoreBreakdown>
    {
        private readonly IApplicationDbContext _context;
        private readonly ISystemScoreCalculator _calculator;

        public CalculateTaskSystemScoreQueryHandler(
            IApplicationDbContext context,
            ISystemScoreCalculator calculator)
        {
            _context = context;
            _calculator = calculator;
        }

        public async Task<SystemScoreBreakdown> Handle(CalculateTaskSystemScoreQuery request, CancellationToken cancellationToken)
        {
            var access = new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context);
            var actor = await access.ActorAsync(request.CurrentUserId, cancellationToken)
                ?? throw new UnauthorizedAccessException("Phiên làm việc không hợp lệ.");
            var task = await access.Tasks(actor)
                .Include(t => t.SubTasks)
                .FirstOrDefaultAsync(t => t.Id == request.TaskItemId, cancellationToken);

            if (task == null)
            {
                throw new UnauthorizedAccessException("Không được truy cập công việc ngoài phạm vi quyền.");
            }

            // Đếm số lần bị trả lại từ ActivityLog
            var rejectionCount = await _context.ActivityLogs
                .CountAsync(l => l.TargetEntityId == task.Id.ToString()
                              && (l.Summary.Contains("Từ chối") || l.Summary.Contains("yêu cầu làm lại") || l.Summary.Contains("yêu cầu sửa")), cancellationToken);

            // Nếu task hiện tại có RejectionReason nhưng chưa log thì tính tối thiểu 1
            if (rejectionCount == 0 && !string.IsNullOrWhiteSpace(task.RejectionReason))
            {
                rejectionCount = 1;
            }

            return _calculator.Calculate(task, rejectionCount, task.SubTasks.ToList());
        }
    }
}
