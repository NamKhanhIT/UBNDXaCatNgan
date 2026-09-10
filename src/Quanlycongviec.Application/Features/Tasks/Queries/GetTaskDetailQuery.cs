using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Queries.GetTaskDetail
{
    public sealed class GetTaskDetailQuery : IRequest<TaskDetailDto?>
    {
        public Guid TaskId { get; }
        public Guid CurrentUserId { get; }

        public GetTaskDetailQuery(Guid taskId, Guid currentUserId)
        {
            TaskId = taskId;
            CurrentUserId = currentUserId;
        }
    }

    public sealed class TaskDetailDto : TaskItemDto
    {
        public List<TaskDetailSubTaskDto> SubTasks { get; set; } = new();
        public List<TaskDetailCommentDto> Comments { get; set; } = new();
        public List<TaskDetailAttachmentDto> Attachments { get; set; } = new();
        public List<TaskTimelineEntryDto> Timeline { get; set; } = new();
        public bool CanSubmit { get; set; }
        public bool CanAccept { get; set; }
        public bool CanReturn { get; set; }
    }

    public sealed class TaskDetailSubTaskDto
    {
        public Guid Id { get; set; }
        public Guid TaskItemId { get; set; }
        public string Title { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
    }

    public sealed class TaskDetailCommentDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string UserFullName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public sealed class TaskDetailAttachmentDto
    {
        public Guid Id { get; set; }
        public string OriginalFileName { get; set; } = string.Empty;
        public string FileType { get; set; } = string.Empty;
        public long FileSize { get; set; }
        public DateTime UploadedAt { get; set; }
    }

    public sealed class TaskTimelineEntryDto
    {
        public Guid Id { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public Guid UserId { get; set; }
        public string UserFullName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public sealed class GetTaskDetailQueryHandler : IRequestHandler<GetTaskDetailQuery, TaskDetailDto?>
    {
        private readonly IApplicationDbContext _context;
        private readonly ITaskAuthorizationService _authorization;

        public GetTaskDetailQueryHandler(
            IApplicationDbContext context,
            ITaskAuthorizationService authorization)
        {
            _context = context;
            _authorization = authorization;
        }

        public async Task<TaskDetailDto?> Handle(
            GetTaskDetailQuery request,
            CancellationToken cancellationToken)
        {
            if (!await _authorization.CanAccessTaskAsync(
                    request.CurrentUserId, request.TaskId, cancellationToken))
            {
                return null;
            }

            var task = await _context.TaskItems
                .AsNoTracking()
                .Include(t => t.Assigner)
                .Include(t => t.Assignee)
                .Include(t => t.Department)
                .FirstOrDefaultAsync(
                    t => t.Id == request.TaskId && !t.IsDeleted,
                    cancellationToken);

            if (task == null) return null;

            var subtasks = await _context.SubTasks
                .AsNoTracking()
                .Where(s => s.TaskItemId == task.Id && !s.IsDeleted)
                .OrderBy(s => s.CreatedAt)
                .Select(s => new TaskDetailSubTaskDto
                {
                    Id = s.Id,
                    TaskItemId = s.TaskItemId,
                    Title = s.Title,
                    IsCompleted = s.IsCompleted
                })
                .ToListAsync(cancellationToken);

            var comments = await _context.TaskComments
                .AsNoTracking()
                .Where(c => c.TaskItemId == task.Id && !c.IsDeleted)
                .OrderBy(c => c.CreatedAt)
                .Select(c => new TaskDetailCommentDto
                {
                    Id = c.Id,
                    UserId = c.UserId,
                    UserFullName = c.User.FullName,
                    Content = c.Content,
                    CreatedAt = c.CreatedAt
                })
                .ToListAsync(cancellationToken);

            var attachments = await _context.DocumentAttachments
                .AsNoTracking()
                .Where(a => a.DocumentId == task.Id
                            && a.TargetType == "Task"
                            && !a.IsDeleted)
                .OrderByDescending(a => a.UploadedAt)
                .Select(a => new TaskDetailAttachmentDto
                {
                    Id = a.Id,
                    OriginalFileName = a.OriginalFileName,
                    FileType = a.FileType,
                    FileSize = a.FileSize,
                    UploadedAt = a.UploadedAt
                })
                .ToListAsync(cancellationToken);

            var timeline = await _context.ActivityLogs
                .AsNoTracking()
                .Where(a => a.TargetEntityType == "TaskItem"
                            && a.TargetEntityId == task.Id.ToString()
                            && !a.IsDeleted)
                .OrderBy(a => a.CreatedAt)
                .Select(a => new TaskTimelineEntryDto
                {
                    Id = a.Id,
                    ActionType = a.ActionType,
                    Summary = a.Summary,
                    UserId = a.UserId,
                    UserFullName = a.User != null ? a.User.FullName : string.Empty,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync(cancellationToken);

            var canSubmit = task.AssigneeId == request.CurrentUserId
                && task.Status == TaskStatusEnum.InProgress
                && await _authorization.CanUpdateTaskStatusAsync(
                    request.CurrentUserId, task.Id, TaskStatusEnum.InReview, cancellationToken);
            var canAccept = task.Status == TaskStatusEnum.InReview
                && await _authorization.CanUpdateTaskStatusAsync(
                    request.CurrentUserId, task.Id, TaskStatusEnum.Completed, cancellationToken);
            var canReturn = task.Status == TaskStatusEnum.InReview
                && task.AssigneeId != request.CurrentUserId
                && await _authorization.CanUpdateTaskStatusAsync(
                    request.CurrentUserId, task.Id, TaskStatusEnum.InProgress, cancellationToken);

            return new TaskDetailDto
            {
                Id = task.Id,
                Title = task.Title,
                Description = task.Description,
                Requirements = task.Requirements,
                AssignerId = task.AssignerId,
                AssignerName = task.Assigner?.FullName ?? string.Empty,
                AssigneeId = task.AssigneeId,
                AssigneeName = task.Assignee?.FullName ?? string.Empty,
                DepartmentId = task.DepartmentId,
                DepartmentName = task.Department?.Name,
                Priority = task.Priority.ToString(),
                Status = task.Status.ToString(),
                Type = task.Type.ToString(),
                EstimatedEffortHours = task.EstimatedEffortHours,
                StartDate = task.StartDate ?? task.DueDate,
                DueDate = task.DueDate,
                CompletedAt = task.CompletedAt,
                SubmissionNote = task.SubmissionNote,
                SystemScore = task.SystemScore,
                EvaluatorScore = task.EvaluatorScore,
                RatingScore = task.RatingScore,
                RejectionReason = task.RejectionReason,
                IsEscalated = task.IsEscalated,
                OpenAnnotationCount = await _context.TaskReviewAnnotations
                    .CountAsync(a => a.TaskItemId == task.Id
                                     && !a.IsDeleted
                                     && a.ResolvedStatus == AnnotationStatusEnum.Open,
                        cancellationToken),
                TotalAnnotationCount = await _context.TaskReviewAnnotations
                    .CountAsync(a => a.TaskItemId == task.Id && !a.IsDeleted, cancellationToken),
                CreatedAt = task.CreatedAt,
                SubTasks = subtasks,
                Comments = comments,
                Attachments = attachments,
                Timeline = timeline,
                CanSubmit = canSubmit,
                CanAccept = canAccept,
                CanReturn = canReturn
            };
        }
    }
}
