using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Commands.CreateTask
{
    public class CreateTaskCommandHandler : IRequestHandler<CreateTaskCommand, Guid>
    {
        private readonly IApplicationDbContext _context;

        public CreateTaskCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Handle(CreateTaskCommand request, CancellationToken cancellationToken)
        {
            DateTime? utcStartDate = request.StartDate.HasValue
                ? (request.StartDate.Value.Kind == DateTimeKind.Utc ? request.StartDate.Value : DateTime.SpecifyKind(request.StartDate.Value, DateTimeKind.Utc))
                : null;

            DateTime? utcDueDate = request.DueDate.HasValue
                ? (request.DueDate.Value.Kind == DateTimeKind.Utc ? request.DueDate.Value : DateTime.SpecifyKind(request.DueDate.Value, DateTimeKind.Utc))
                : null;

            // Mặc định StartDate nếu không truyền: dùng utcDueDate hoặc DateTime.UtcNow
            DateTime? finalStartDate = utcStartDate ?? utcDueDate ?? DateTime.UtcNow;

            var task = new TaskItem
            {
                Title = request.Title,
                Description = request.Description,
                AssignerId = request.AssignerId,
                AssigneeId = request.AssigneeId,
                DepartmentId = request.DepartmentId,
                Priority = request.Priority,
                Status = TaskStatusEnum.Todo,
                Type = request.Type,
                EstimatedEffortHours = request.EstimatedEffortHours,
                StartDate = finalStartDate,
                DueDate = utcDueDate,
                OCRText = request.OCRText,
                DocumentUrl = request.DocumentUrl,
                IsDelegatedAction = request.IsDelegatedAction
            };

            _context.TaskItems.Add(task);

            // Cập nhật Workload Capacity cho Assignee
            var workload = await _context.WorkloadCapacities
                .FirstOrDefaultAsync(w => w.UserId == request.AssigneeId, cancellationToken);

            if (workload != null)
            {
                workload.CurrentAssignedHours += request.EstimatedEffortHours;
            }

            // Ghi Audit Log cho hành động giao việc
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = request.AssignerId,
                ActingRole = "Assigner",
                IsDelegatedAction = request.IsDelegatedAction,
                Action = "CreateTask",
                EntityName = "TaskItem",
                EntityId = task.Id.ToString(),
                Details = $"Giao nhiệm vụ [{task.Title}] cho cán bộ [{request.AssigneeId}]"
            });

            // Tạo thông báo cho người thực hiện (Assignee)
            _context.Notifications.Add(new Notification
            {
                UserId = request.AssigneeId,
                TaskItemId = task.Id,
                Type = NotificationType.Assigned,
                Channel = NotificationChannel.InApp,
                Title = $"📌 Bạn có công việc mới được giao: {task.Title}",
                Message = $"Đồng chí được giao nhiệm vụ [{task.Title}]. Hạn chót: {(task.DueDate.HasValue ? task.DueDate.Value.ToString("dd/MM/yyyy HH:mm") : "Không có")}.",
                SentAt = DateTime.UtcNow,
                IsRead = false
            });

            await _context.SaveChangesAsync(cancellationToken);

            return task.Id;
        }
    }
}
