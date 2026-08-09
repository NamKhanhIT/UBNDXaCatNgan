using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.SubTasks.Commands.ToggleSubTask
{
    public class ToggleSubTaskCommand : IRequest<bool>
    {
        public Guid SubTaskId { get; set; }

        public ToggleSubTaskCommand(Guid subTaskId)
        {
            SubTaskId = subTaskId;
        }
    }

    public class ToggleSubTaskCommandHandler : IRequestHandler<ToggleSubTaskCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public ToggleSubTaskCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(ToggleSubTaskCommand request, CancellationToken cancellationToken)
        {
            var subTask = await _context.SubTasks.FirstOrDefaultAsync(st => st.Id == request.SubTaskId, cancellationToken);
            if (subTask == null) return false;

            subTask.IsCompleted = !subTask.IsCompleted;
            subTask.UpdatedAt = DateTime.UtcNow;

            // Lấy toàn bộ subtasks của task để tính lại ProgressPercentage
            var task = await _context.TaskItems
                .Include(t => t.SubTasks)
                .FirstOrDefaultAsync(t => t.Id == subTask.TaskItemId, cancellationToken);

            if (task != null && task.SubTasks.Count > 0)
            {
                var completedCount = task.SubTasks.Count(s => s.Id == subTask.Id ? subTask.IsCompleted : s.IsCompleted);
                task.ProgressPercentage = (int)Math.Round((double)completedCount / task.SubTasks.Count * 100);
                
                // Nếu 100% subtask hoàn thành và task đang Todo -> chuyển InReview (Chờ duyệt)
                if (task.ProgressPercentage >= 100 && task.Status == Domain.Enums.TaskStatusEnum.Todo)
                {
                    task.Status = Domain.Enums.TaskStatusEnum.InReview;
                }
                
                task.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
