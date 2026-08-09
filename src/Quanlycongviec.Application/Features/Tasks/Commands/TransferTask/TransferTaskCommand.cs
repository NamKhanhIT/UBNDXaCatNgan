using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Commands.TransferTask
{
    public class TransferTaskCommand : IRequest<bool>
    {
        public Guid TaskId { get; set; }
        public Guid TargetUserId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public Guid CurrentUserId { get; set; }

        public TransferTaskCommand(Guid taskId, Guid targetUserId, string reason, Guid currentUserId)
        {
            TaskId = taskId;
            TargetUserId = targetUserId;
            Reason = reason;
            CurrentUserId = currentUserId;
        }
    }

    public class TransferTaskCommandHandler : IRequestHandler<TransferTaskCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public TransferTaskCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(TransferTaskCommand request, CancellationToken cancellationToken)
        {
            var task = await _context.TaskItems.FirstOrDefaultAsync(t => t.Id == request.TaskId, cancellationToken);
            if (task == null) return false;

            var oldAssigneeId = task.AssigneeId;
            var targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.TargetUserId, cancellationToken);
            if (targetUser == null) return false;

            // Update Assignee
            task.AssigneeId = request.TargetUserId;
            task.UpdatedAt = DateTime.UtcNow;

            // Cập nhật Tải công chức WorkloadCapacity
            var oldWorkload = await _context.WorkloadCapacities.FirstOrDefaultAsync(w => w.UserId == oldAssigneeId, cancellationToken);
            if (oldWorkload != null)
            {
                oldWorkload.CurrentAssignedHours = Math.Max(0, oldWorkload.CurrentAssignedHours - task.EstimatedEffortHours);
            }

            var newWorkload = await _context.WorkloadCapacities.FirstOrDefaultAsync(w => w.UserId == request.TargetUserId, cancellationToken);
            if (newWorkload != null)
            {
                newWorkload.CurrentAssignedHours += task.EstimatedEffortHours;
            }

            // Ghi AuditLog
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = request.CurrentUserId,
                ActingRole = "Manager",
                Action = "TransferTask",
                EntityName = "TaskItem",
                EntityId = task.Id.ToString(),
                Details = $"Điều chuyển nhiệm vụ [{task.Title}] sang cán bộ [{targetUser.FullName}]. Lý do: {request.Reason}"
            });

            // Gửi Notification cho cán bộ mới
            _context.Notifications.Add(new Notification
            {
                UserId = request.TargetUserId,
                TaskItemId = task.Id,
                Type = NotificationType.Assigned,
                Channel = NotificationChannel.InApp,
                Title = $"🔄 Bạn vừa được điều chuyển nhận công việc mới: {task.Title}",
                Message = $"Đồng chí được điều chuyển đảm nhận nhiệm vụ [{task.Title}]. Lý do: {request.Reason}",
                SentAt = DateTime.UtcNow,
                IsRead = false
            });

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
