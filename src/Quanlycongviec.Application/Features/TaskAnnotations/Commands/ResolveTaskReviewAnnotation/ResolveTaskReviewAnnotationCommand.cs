using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.TaskAnnotations.DTOs;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.TaskAnnotations.Commands.ResolveTaskReviewAnnotation
{
    public record ResolveTaskReviewAnnotationCommand(
        Guid TaskItemId,
        Guid AnnotationId,
        Guid CurrentUserId
    ) : IRequest<TaskReviewAnnotationDto>;

    public class ResolveTaskReviewAnnotationCommandHandler : IRequestHandler<ResolveTaskReviewAnnotationCommand, TaskReviewAnnotationDto>
    {
        private readonly IApplicationDbContext _context;

        public ResolveTaskReviewAnnotationCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<TaskReviewAnnotationDto> Handle(ResolveTaskReviewAnnotationCommand request, CancellationToken cancellationToken)
        {
            var annotation = await _context.TaskReviewAnnotations
                .Include(a => a.TaskItem)
                .Include(a => a.CreatedByUser)
                .FirstOrDefaultAsync(a => a.Id == request.AnnotationId && a.TaskItemId == request.TaskItemId, cancellationToken);

            if (annotation == null)
            {
                throw new InvalidOperationException("Chú thích không tồn tại.");
            }

            var currentUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.CurrentUserId, cancellationToken);

            if (currentUser == null)
            {
                throw new InvalidOperationException("Người dùng không tồn tại.");
            }

            // Phân quyền: Chỉ người bị góp ý (Assignee) hoặc người tạo góp ý (CreatedByUserId) hoặc Assigner mới được resolve
            bool canResolve = request.CurrentUserId == annotation.TaskItem.AssigneeId
                           || request.CurrentUserId == annotation.CreatedByUserId
                           || request.CurrentUserId == annotation.TaskItem.AssignerId;

            if (!canResolve)
            {
                throw new UnauthorizedAccessException("Bạn không có quyền đánh dấu đã sửa cho chú thích này.");
            }

            annotation.ResolvedStatus = AnnotationStatusEnum.Resolved;
            annotation.ResolvedByUserId = request.CurrentUserId;
            annotation.ResolvedAt = DateTime.UtcNow;

            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.CurrentUserId,
                Username = currentUser.Username,
                ActingRole = currentUser.ActiveRoleCode,
                Action = "RESOLVE_TASK_ANNOTATION",
                EntityName = "TaskReviewAnnotation",
                EntityId = annotation.Id.ToString(),
                Details = $"Đã đánh dấu đã sửa xong chú thích \"{annotation.AnchorText}\" trên nhiệm vụ \"{annotation.TaskItem.Title}\"",
                IpAddress = "127.0.0.1"
            });

            await _context.SaveChangesAsync(cancellationToken);

            return new TaskReviewAnnotationDto
            {
                Id = annotation.Id,
                TaskItemId = annotation.TaskItemId,
                AnchorText = annotation.AnchorText,
                StartOffsetHint = annotation.StartOffsetHint,
                CommentText = annotation.CommentText,
                Severity = annotation.Severity,
                SeverityName = annotation.Severity.ToString(),
                CreatedByUserId = annotation.CreatedByUserId,
                CreatedByUserName = annotation.CreatedByUser?.FullName ?? "Cán bộ",
                CreatedAt = annotation.CreatedAt,
                ResolvedStatus = annotation.ResolvedStatus,
                ResolvedStatusName = "Đã sửa xong",
                ResolvedByUserId = annotation.ResolvedByUserId,
                ResolvedByUserName = currentUser.FullName,
                ResolvedAt = annotation.ResolvedAt
            };
        }
    }
}
