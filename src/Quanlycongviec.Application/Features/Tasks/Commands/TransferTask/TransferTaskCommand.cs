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
        private readonly ITaskAuthorizationService? _authService;
        private readonly INotificationDispatcher? _notificationDispatcher;

        public TransferTaskCommandHandler(
            IApplicationDbContext context,
            ITaskAuthorizationService? authService = null,
            INotificationDispatcher? notificationDispatcher = null)
        {
            _context = context;
            _authService = authService;
            _notificationDispatcher = notificationDispatcher;
        }

        public async Task<bool> Handle(TransferTaskCommand request, CancellationToken cancellationToken)
        {
            var task = await _context.TaskItems.FirstOrDefaultAsync(t => t.Id == request.TaskId, cancellationToken);
            if (task == null) return false;

            var targetUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.TargetUserId, cancellationToken);
            if (targetUser == null) return false;

            // Kiểm tra thẩm quyền điều chuyển
            if (_authService != null)
            {
                var canTransfer = await _authService.CanTransferTaskAsync(request.CurrentUserId, request.TaskId, request.TargetUserId, cancellationToken);
                if (!canTransfer)
                {
                    throw new UnauthorizedAccessException("Bạn không có thẩm quyền điều chuyển công việc này.");
                }
            }

            var oldAssigneeId = task.AssigneeId;

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
            var notification = new Notification
            {
                UserId = request.TargetUserId,
                TaskItemId = task.Id,
                Type = NotificationType.Assigned,
                Channel = NotificationChannel.InApp,
                Title = $"🔄 Bạn vừa được điều chuyển nhận công việc mới: {task.Title}",
                Message = $"Đồng chí được điều chuyển đảm nhận nhiệm vụ [{task.Title}]. Lý do: {request.Reason}",
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            if (_notificationDispatcher != null)
            {
                await _context.SaveChangesAsync(cancellationToken);
                await _notificationDispatcher.DispatchAsync(notification, cancellationToken);
            }
            else
            {
                _context.Notifications.Add(notification);
                await _context.SaveChangesAsync(cancellationToken);
            }

            return true;
        }
    }
}
