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
        public List<SubmissionDetailDto> Submissions { get; set; } = new();
        public List<TaskItemDto> CoordinationTasks { get; set; } = new();
        public List<LinkedDocumentDto> Documents { get; set; } = new();
        public List<WorkflowChangeDto> Changes { get; set; } = new();
        public bool CanStart { get; set; }
        public bool CanCancel { get; set; }
        public bool CanAmend { get; set; }
        public bool CanAddCoordination { get; set; }
        public string? SubmissionBlockedReason { get; set; }
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
                .Include(t => t.Reviewer)
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

            var access = new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context);
            var actor = await access.ActorAsync(request.CurrentUserId, cancellationToken);
            if (actor == null) return null;
            var coordination = await access.Tasks(actor).AsNoTracking().Where(t => t.ParentTaskId == task.Id)
                .OrderBy(t => t.DueDate).Select(TaskProjection.Summary).ToListAsync(cancellationToken);
            var unfinishedCoordination = await _context.TaskItems.AnyAsync(t => t.ParentTaskId == task.Id && !t.IsDeleted
                && t.Status != TaskStatusEnum.Completed && t.Status != TaskStatusEnum.Cancelled, cancellationToken);
            var canManage = await access.CanManageTaskAsync(actor, task, cancellationToken);
            var submissions = await _context.TaskSubmissions.AsNoTracking().Where(s => s.TaskItemId == task.Id && !s.IsDeleted)
                .OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id).Select(s => new SubmissionDetailDto
                {
                    Id = s.Id, SubmittedById = s.SubmittedById, Note = s.Note, SubmittedAt = s.SubmittedAt,
                    DueDateAtSubmission = s.DueDateAtSubmission, IsLegacy = s.IsLegacy,
                    WasLate = s.SubmittedAt.HasValue && s.DueDateAtSubmission.HasValue ? s.SubmittedAt > s.DueDateAtSubmission : null,
                    Decision = s.Decision, ReviewNote = s.ReviewNote, ReviewedById = s.ReviewedById, ReviewedAt = s.ReviewedAt,
                    Files = s.Attachments.Where(a => !a.IsDeleted && !a.Attachment.IsDeleted).Select(a => new SubmissionFileDto
                    { Id = a.AttachmentId, Name = a.Attachment.OriginalFileName, Size = a.Attachment.FileSize }).ToList()
                }).ToListAsync(cancellationToken);
            var documents = await _context.TaskDocumentLinks.AsNoTracking().Where(l => l.TaskItemId == task.Id && !l.IsDeleted
                && ((l.InboxDocument != null && !l.InboxDocument.IsDeleted) || (l.OutgoingDocument != null && !l.OutgoingDocument.IsDeleted)))
                .Select(l => new LinkedDocumentDto { Id = l.InboxDocumentId ?? l.OutgoingDocumentId!.Value,
                    Kind = l.InboxDocumentId.HasValue ? "Inbox" : "Outgoing",
                    Title = l.InboxDocument != null ? l.InboxDocument.Subject : l.OutgoingDocument!.Title,
                    Number = l.InboxDocument != null ? l.InboxDocument.DocumentNumber : l.OutgoingDocument!.DocumentNumber }).ToListAsync(cancellationToken);
            var changes = await _context.TaskWorkflowChanges.AsNoTracking().Where(c => c.TaskItemId == task.Id && !c.IsDeleted)
                .OrderByDescending(c => c.CreatedAt).Select(c => new WorkflowChangeDto { Id = c.Id, UserId = c.UserId,
                    Kind = c.Kind, OldValue = c.OldValue, NewValue = c.NewValue, Reason = c.Reason, CreatedAt = c.CreatedAt }).ToListAsync(cancellationToken);
            var blocked = task.RequiresWorkflowReview || !task.DueDate.HasValue || !task.ReviewerId.HasValue || string.IsNullOrWhiteSpace(task.Requirements)
                ? "Cần người có thẩm quyền bổ sung thông tin công việc cũ."
                : unfinishedCoordination ? "Còn phần phối hợp chưa được xác nhận hoặc hủy có lý do." : null;

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
                ReviewerId = task.ReviewerId, ReviewerName = task.Reviewer?.FullName,
                ParentTaskId = task.ParentTaskId, Version = task.Version, RequiresWorkflowReview = task.RequiresWorkflowReview,
                Submissions = submissions, Documents = documents, CoordinationTasks = coordination, Changes = changes,
                CanStart = actor.Id == task.AssigneeId && task.Status == TaskStatusEnum.Todo,
                CanCancel = canManage && task.Status != TaskStatusEnum.Completed && task.Status != TaskStatusEnum.Cancelled,
                CanAmend = canManage && task.Status != TaskStatusEnum.Completed && task.Status != TaskStatusEnum.Cancelled,
                CanAddCoordination = canManage && !task.ParentTaskId.HasValue && (task.Status == TaskStatusEnum.Todo || task.Status == TaskStatusEnum.InProgress),
                SubmissionBlockedReason = blocked,
                CanSubmit = canSubmit && blocked == null,
                CanAccept = canAccept,
                CanReturn = canReturn
            };
        }
    }
}
