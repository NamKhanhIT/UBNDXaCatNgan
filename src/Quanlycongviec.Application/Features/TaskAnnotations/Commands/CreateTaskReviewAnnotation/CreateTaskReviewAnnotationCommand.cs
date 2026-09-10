using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.TaskAnnotations.DTOs;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.TaskAnnotations.Commands.CreateTaskReviewAnnotation
{
    public record CreateTaskReviewAnnotationCommand(
        Guid TaskItemId,
        string AnchorText,
        int? StartOffsetHint,
        string CommentText,
        AnnotationSeverityEnum Severity,
        Guid CurrentUserId
    ) : IRequest<TaskReviewAnnotationDto>;

    public class CreateTaskReviewAnnotationCommandHandler : IRequestHandler<CreateTaskReviewAnnotationCommand, TaskReviewAnnotationDto>
    {
        private readonly IApplicationDbContext _context;
        private readonly ITaskAuthorizationService? _authorizationService;
        private readonly INotificationDispatcher? _notificationDispatcher;

        public CreateTaskReviewAnnotationCommandHandler(
            IApplicationDbContext context,
            ITaskAuthorizationService? authorizationService = null,
            INotificationDispatcher? notificationDispatcher = null)
        {
            _context = context;
            _authorizationService = authorizationService;
            _notificationDispatcher = notificationDispatcher;
        }

        public async Task<TaskReviewAnnotationDto> Handle(CreateTaskReviewAnnotationCommand request, CancellationToken cancellationToken)
        {
            var taskItem = await _context.TaskItems
                .FirstOrDefaultAsync(t => t.Id == request.TaskItemId, cancellationToken);

            if (taskItem == null)
            {
                throw new InvalidOperationException("Công việc không tồn tại.");
            }

            // BẢO MẬT (Audit 04-09-2026): Người dùng phải có quyền truy cập task mới được ghi chú.
            if (_authorizationService != null)
            {
                var canAccess = await _authorizationService.CanAccessTaskAsync(
                    request.CurrentUserId, request.TaskItemId, cancellationToken);
                if (!canAccess)
                {
                    throw new UnauthorizedAccessException("Bạn không có quyền ghi chú trên nhiệm vụ này.");
                }
            }

            var currentUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.CurrentUserId, cancellationToken);

            if (currentUser == null)
            {
                throw new InvalidOperationException("Người dùng không tồn tại.");
            }

            if (string.IsNullOrWhiteSpace(request.AnchorText))
            {
                throw new ArgumentException("Vui lòng chọn đoạn văn bản cần ghi chú.");
            }

            if (string.IsNullOrWhiteSpace(request.CommentText))
            {
                throw new ArgumentException("Nội dung nhận xét/góp ý không được để trống.");
            }

            var annotation = new TaskReviewAnnotation
            {
                Id = Guid.NewGuid(),
                TaskItemId = taskItem.Id,
                AnchorText = request.AnchorText.Trim(),
                StartOffsetHint = request.StartOffsetHint,
                CommentText = request.CommentText.Trim(),
                Severity = request.Severity,
                CreatedByUserId = request.CurrentUserId,
                CreatedAt = DateTime.UtcNow,
                ResolvedStatus = AnnotationStatusEnum.Open
            };

            _context.TaskReviewAnnotations.Add(annotation);

            // Audit log
            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.CurrentUserId,
                Username = currentUser.Username,
                ActingRole = currentUser.ActiveRoleCode,
                Action = "CREATE_TASK_ANNOTATION",
                EntityName = "TaskReviewAnnotation",
                EntityId = annotation.Id.ToString(),
                Details = $"Đã thêm chú thích '{annotation.Severity}' cho đoạn text \"{annotation.AnchorText}\" trên nhiệm vụ \"{taskItem.Title}\"",
                IpAddress = "127.0.0.1"
            });

            await _context.SaveChangesAsync(cancellationToken);

            // Notification cho người thực hiện nếu người tạo không phải assignee
            if (taskItem.AssigneeId != request.CurrentUserId && _notificationDispatcher != null)
            {
                await _notificationDispatcher.DispatchAsync(new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = taskItem.AssigneeId,
                    TaskItemId = taskItem.Id,
                    Type = NotificationType.Comment,
                    Channel = NotificationChannel.InApp,
                    Title = $"Góp ý kết quả nộp: {taskItem.Title}",
                    Message = $"Lãnh đạo/Người chấm đã khoanh vùng góp ý ({GetSeverityLabel(annotation.Severity)}): \"{annotation.AnchorText}\"",
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                }, cancellationToken);
            }

            return new TaskReviewAnnotationDto
            {
                Id = annotation.Id,
                TaskItemId = annotation.TaskItemId,
                AnchorText = annotation.AnchorText,
                StartOffsetHint = annotation.StartOffsetHint,
                CommentText = annotation.CommentText,
                Severity = annotation.Severity,
                SeverityName = GetSeverityLabel(annotation.Severity),
                CreatedByUserId = annotation.CreatedByUserId,
                CreatedByUserName = currentUser.FullName,
                CreatedAt = annotation.CreatedAt,
                ResolvedStatus = annotation.ResolvedStatus,
                ResolvedStatusName = "Chờ sửa"
            };
        }

        private static string GetSeverityLabel(AnnotationSeverityEnum severity) => severity switch
        {
            AnnotationSeverityEnum.LoiSai => "Lỗi sai",
            AnnotationSeverityEnum.CanChinhSua => "Cần chỉnh sửa",
            AnnotationSeverityEnum.GopY => "Góp ý",
            _ => severity.ToString()
        };
    }
}
