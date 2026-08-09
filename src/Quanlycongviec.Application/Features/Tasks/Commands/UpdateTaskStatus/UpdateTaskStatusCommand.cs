using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Commands.UpdateTaskStatus
{
    public class UpdateTaskStatusCommand : IRequest<bool>
    {
        public Guid TaskId { get; set; }
        public string Status { get; set; } = string.Empty;
        public double? RatingScore { get; set; }
        public string? RejectionReason { get; set; }
        public DateTime? NewExtendedDueDate { get; set; }
        public Guid CurrentUserId { get; set; }

        public UpdateTaskStatusCommand(Guid taskId, string status, Guid currentUserId, double? ratingScore = null, string? rejectionReason = null, DateTime? newExtendedDueDate = null)
        {
            TaskId = taskId;
            Status = status;
            CurrentUserId = currentUserId;
            RatingScore = ratingScore;
            RejectionReason = rejectionReason;
            NewExtendedDueDate = newExtendedDueDate;
        }
    }

    public class UpdateTaskStatusCommandHandler : IRequestHandler<UpdateTaskStatusCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public UpdateTaskStatusCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(UpdateTaskStatusCommand request, CancellationToken cancellationToken)
        {
            var task = await _context.TaskItems.FirstOrDefaultAsync(t => t.Id == request.TaskId, cancellationToken);
            if (task == null) return false;

            var newStatus = MapStatus(request.Status);
            var oldStatus = task.Status;

            // ── Luật 72/2025: Project tasks phải có phản biện UBMTTQ trước khi vào InReview ──
            if (task.Type == TaskType.Project
                && newStatus == TaskStatusEnum.InReview
                && oldStatus != TaskStatusEnum.PendingUBMTTQReview)
            {
                // Chuyển sang PendingUBMTTQReview thay vì InReview trực tiếp
                task.Status = TaskStatusEnum.PendingUBMTTQReview;
                task.UpdatedAt = DateTime.UtcNow;

                _context.ActivityLogs.Add(new Domain.Entities.ActivityLog
                {
                    UserId = request.CurrentUserId,
                    ActionType = "status_changed",
                    TargetEntityType = "TaskItem",
                    TargetEntityId = task.Id.ToString(),
                    Summary = $"Nhiệm vụ Dự án \"{task.Title}\" chuyển sang Chờ phản biện UBMTTQ (bắt buộc theo Luật 72/2025)"
                });

                _context.Notifications.Add(new Notification
                {
                    UserId = task.AssignerId,
                    TaskItemId = task.Id,
                    Type = NotificationType.BeforeDeadline,
                    Channel = NotificationChannel.InApp,
                    Title = $"Cần phản biện UBMTTQ: {task.Title}",
                    Message = $"Nhiệm vụ Dự án \"{task.Title}\" cần phản biện UBMTTQ trước khi trình duyệt.",
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                });

                await _context.SaveChangesAsync(cancellationToken);
                return true;
            }

            task.Status = newStatus;

            if (newStatus == TaskStatusEnum.Completed)
            {
                task.ProgressPercentage = 100;
                task.CompletedAt = DateTime.UtcNow;
                if (request.RatingScore.HasValue)
                {
                    task.RatingScore = request.RatingScore.Value;
                }
            }

            if (newStatus == TaskStatusEnum.Cancelled && !string.IsNullOrWhiteSpace(request.RejectionReason))
            {
                task.RejectionReason = request.RejectionReason;
                if (request.NewExtendedDueDate.HasValue)
                {
                    var val = request.NewExtendedDueDate.Value;
                    task.DueDate = val.Kind == DateTimeKind.Utc ? val : DateTime.SpecifyKind(val, DateTimeKind.Utc);
                }
            }

            task.UpdatedAt = DateTime.UtcNow;

            // Audit log
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = request.CurrentUserId,
                ActingRole = "User",
                Action = "UpdateTaskStatus",
                EntityName = "TaskItem",
                EntityId = task.Id.ToString(),
                Details = $"Chuyển trạng thái nhiệm vụ [{task.Title}] từ {oldStatus} -> {newStatus}"
            });

            // Notification
            var recipientId = request.CurrentUserId == task.AssigneeId ? task.AssignerId : task.AssigneeId;
            _context.Notifications.Add(new Notification
            {
                UserId = recipientId,
                TaskItemId = task.Id,
                Type = newStatus == TaskStatusEnum.Completed ? NotificationType.Reviewed : NotificationType.Comment,
                Channel = NotificationChannel.InApp,
                Title = $"🔔 Cập nhật tiến độ: {task.Title}",
                Message = $"Nhiệm vụ [{task.Title}] đã chuyển sang trạng thái [{newStatus}].",
                SentAt = DateTime.UtcNow,
                IsRead = false
            });

            // Activity Log
            _context.ActivityLogs.Add(new Domain.Entities.ActivityLog
            {
                UserId = request.CurrentUserId,
                ActionType = "status_changed",
                TargetEntityType = "TaskItem",
                TargetEntityId = task.Id.ToString(),
                Summary = $"Chuyển trạng thái [{task.Title}] từ {oldStatus} → {newStatus}"
            });

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }

        private static TaskStatusEnum MapStatus(string statusStr)
        {
            if (string.IsNullOrWhiteSpace(statusStr)) return TaskStatusEnum.Todo;
            return statusStr.ToLower() switch
            {
                "chua_lam" or "todo" => TaskStatusEnum.Todo,
                "dang_xu_ly" or "inprogress" => TaskStatusEnum.InProgress,
                "cho_duyet" or "inreview" or "pendingapproval" => TaskStatusEnum.InReview,
                "hoan_thanh" or "completed" => TaskStatusEnum.Completed,
                "tu_choi" or "rejected" or "cancelled" => TaskStatusEnum.Cancelled,
                "cho_phan_bien" or "pendingubmttqreview" => TaskStatusEnum.PendingUBMTTQReview,
                _ => Enum.TryParse<TaskStatusEnum>(statusStr, true, out var parsed) ? parsed : TaskStatusEnum.Todo
            };
        }
    }
}
