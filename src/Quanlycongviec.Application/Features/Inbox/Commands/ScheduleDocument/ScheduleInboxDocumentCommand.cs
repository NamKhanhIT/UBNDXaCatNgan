using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Inbox.Commands.ScheduleDocument
{
    public class ScheduleInboxDocumentCommand : IRequest<Guid>
    {
        public Guid DocumentId { get; set; }
        public DateTime ScheduledDate { get; set; }
        public string ScheduledShift { get; set; } = "Sang"; // Sang / Chieu / Toi
        public Guid AssignerId { get; set; }
        public Guid AssigneeId { get; set; }

        public ScheduleInboxDocumentCommand(Guid documentId, DateTime scheduledDate, string scheduledShift, Guid assignerId, Guid assigneeId)
        {
            DocumentId = documentId;
            ScheduledDate = scheduledDate;
            ScheduledShift = scheduledShift;
            AssignerId = assignerId;
            AssigneeId = assigneeId;
        }
    }

    public class ScheduleInboxDocumentCommandHandler : IRequestHandler<ScheduleInboxDocumentCommand, Guid>
    {
        private readonly IApplicationDbContext _context;

        public ScheduleInboxDocumentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Handle(ScheduleInboxDocumentCommand request, CancellationToken cancellationToken)
        {
            var doc = await _context.InboxDocuments.FirstOrDefaultAsync(d => d.Id == request.DocumentId, cancellationToken);
            if (doc == null) throw new InvalidOperationException("Không tìm thấy công văn.");

            var utcScheduledDate = request.ScheduledDate.Kind == DateTimeKind.Utc
                ? request.ScheduledDate
                : DateTime.SpecifyKind(request.ScheduledDate, DateTimeKind.Utc);

            // Tạo TaskItem từ Công văn
            var task = new TaskItem
            {
                Title = doc.Subject,
                Description = $"Xếp lịch xử lý từ công văn số {doc.DocumentNumber} ({doc.Sender}).",
                AssignerId = request.AssignerId,
                AssigneeId = request.AssigneeId,
                Priority = doc.IsUrgent ? TaskPriority.Urgent : TaskPriority.Medium,
                Status = TaskStatusEnum.Todo,
                Type = TaskType.BAU,
                EstimatedEffortHours = 8.0,
                DueDate = utcScheduledDate,
                OCRText = $"VĂN BẢN CHỈ ĐẠO SỐ {doc.DocumentNumber}: {doc.Subject}"
            };

            _context.TaskItems.Add(task);

            // Cập nhật trạng thái cho InboxDocument
            doc.IsScheduled = true;
            doc.ScheduledDate = utcScheduledDate;
            doc.ScheduledShift = request.ScheduledShift;
            doc.ScheduledTaskId = task.Id;
            doc.UpdatedAt = DateTime.UtcNow;

            // Audit log
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = request.AssignerId,
                ActingRole = "Assigner",
                Action = "ScheduleInboxDocument",
                EntityName = "InboxDocument",
                EntityId = doc.Id.ToString(),
                Details = $"Xếp lịch xử lý công văn số [{doc.DocumentNumber}] thành nhiệm vụ [{task.Title}]"
            });

            // Notification cho Assignee
            _context.Notifications.Add(new Notification
            {
                UserId = request.AssigneeId,
                TaskItemId = task.Id,
                Type = NotificationType.Assigned,
                Channel = NotificationChannel.InApp,
                Title = $"📅 Công văn mới đã được xếp lịch: {task.Title}",
                Message = $"Công văn số [{doc.DocumentNumber}] đã được xếp lịch xử lý ngày {utcScheduledDate:dd/MM/yyyy}.",
                SentAt = DateTime.UtcNow,
                IsRead = false
            });

            await _context.SaveChangesAsync(cancellationToken);
            return task.Id;
        }
    }
}
