using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.Commands.UpdateTaskStatus;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Common.Services;

public sealed class TaskExecutionWorkflow(IApplicationDbContext db, ITaskAuthorizationService authorization, INotificationDispatcher? dispatcher = null)
{
    public async Task<bool> ChangeStatusAsync(UpdateTaskStatusCommand request, CancellationToken ct)
    {
        if (authorization == null) throw new InvalidOperationException("Task authorization service is required.");
        var access = new WorkflowAccess(db);
        var ops = new WorkflowOperations(db, dispatcher);
        var actor = await access.ActorAsync(request.CurrentUserId, ct) ?? throw new UnauthorizedAccessException("Phiên làm việc không hợp lệ.");
        var fingerprint = WorkflowOperations.Fingerprint("TaskStatus", request);
        if (await ops.ReplayAsync(actor.Id, request.RequestId, fingerprint, ct) != null) return true;
        var task = await access.Tasks(actor).FirstOrDefaultAsync(t => t.Id == request.TaskId, ct);
        if (task == null) return false;
        WorkflowOperations.CheckVersion(task.Version, request.Version);
        var oldStatus = task.Status;
        var status = ParseStatus(request.Status);
        var isReturn = oldStatus == TaskStatusEnum.InReview && status == TaskStatusEnum.InProgress;
        var isSubmit = oldStatus == TaskStatusEnum.InProgress && status == TaskStatusEnum.InReview;
        var isAccept = oldStatus == TaskStatusEnum.InReview && status == TaskStatusEnum.Completed;
        var isStart = oldStatus == TaskStatusEnum.Todo && status == TaskStatusEnum.InProgress;
        var isCancel = status == TaskStatusEnum.Cancelled && oldStatus != TaskStatusEnum.Cancelled && oldStatus != TaskStatusEnum.Completed;
        if (!(isReturn || isSubmit || isAccept || isStart || isCancel))
            throw new WorkflowConflictException("Không thể thực hiện thao tác ở trạng thái hiện tại.");
        if (!await authorization.CanUpdateTaskStatusAsync(actor.Id, task.Id, status, ct))
            throw new UnauthorizedAccessException("Bạn không có quyền thực hiện thao tác này trên công việc.");
        if ((isReturn || isCancel) && string.IsNullOrWhiteSpace(request.RejectionReason))
            throw new ArgumentException("Vui lòng nhập lý do và yêu cầu xử lý.");
        if ((isStart || isSubmit) && actor.Id != task.AssigneeId)
            throw new UnauthorizedAccessException("Chỉ người thực hiện được bắt đầu hoặc nộp kết quả.");
        if ((isReturn || isAccept) && !await access.CanReviewAsync(actor, task, ct))
            throw new UnauthorizedAccessException("Chỉ người nghiệm thu được chỉ định có quyền nhận hoặc hoàn trả kết quả.");

        var now = DateTime.UtcNow;
        var notifications = new List<Notification>();
        if (task.ParentTaskId.HasValue)
        {
            var parent = await db.TaskItems.FirstAsync(t => t.Id == task.ParentTaskId && !t.IsDeleted, ct);
            if (parent.Status != TaskStatusEnum.Todo && parent.Status != TaskStatusEnum.InProgress)
                throw new WorkflowConflictException("Công việc tổng đã nộp hoặc kết thúc. Không thể thay đổi phần phối hợp.");
            // Root and child mutations compete on the same root version, including submission gates.
            parent.Version = Guid.NewGuid(); parent.UpdatedAt = now;
        }
        if (isSubmit)
        {
            if (string.IsNullOrWhiteSpace(request.SubmissionNote)) throw new ArgumentException("Vui lòng nhập nội dung kết quả.");
            if (!task.DueDate.HasValue || !task.ReviewerId.HasValue || string.IsNullOrWhiteSpace(task.Requirements) || task.RequiresWorkflowReview)
                throw new ArgumentException("Công việc cũ cần được người có thẩm quyền bổ sung yêu cầu, hạn và người nghiệm thu trước khi nộp.");
            if (await db.TaskItems.AnyAsync(t => t.ParentTaskId == task.Id && !t.IsDeleted
                    && t.Status != TaskStatusEnum.Completed && t.Status != TaskStatusEnum.Cancelled, ct))
                throw new WorkflowConflictException("Còn phần việc phối hợp chưa được xác nhận hoặc hủy có lý do.");
            var submission = new TaskSubmission { TaskItemId = task.Id, SubmittedById = actor.Id,
                Note = request.SubmissionNote.Trim(), SubmittedAt = now, DueDateAtSubmission = task.DueDate };
            var fileIds = request.AttachmentIds.Distinct().ToList();
            var files = await db.DocumentAttachments.Where(a => fileIds.Contains(a.Id) && !a.IsDeleted && a.DocumentId == task.Id
                && a.TargetType == "Task" && a.UploadedByUserId == actor.Id).ToListAsync(ct);
            if (files.Count != fileIds.Count || await db.TaskSubmissionAttachments.AnyAsync(a => fileIds.Contains(a.AttachmentId), ct))
                throw new ArgumentException("Tệp nộp không thuộc bản nháp của bạn hoặc đã gắn với lần nộp trước.");
            db.TaskSubmissions.Add(submission);
            foreach (var file in files) db.TaskSubmissionAttachments.Add(new TaskSubmissionAttachment { SubmissionId = submission.Id, AttachmentId = file.Id });
            task.SubmissionNote = submission.Note; // compatibility projection; history lives in TaskSubmissions
            task.RejectionReason = null;
            notifications.Add(ops.Notify(task.ReviewerId.Value, "Có kết quả chờ nghiệm thu", task.Title, task.Id));
        }
        if (isAccept || isReturn)
        {
            if (!request.SubmissionId.HasValue) throw new ArgumentException("Vui lòng chọn lần nộp đang chờ nghiệm thu.");
            var submission = await db.TaskSubmissions.FirstOrDefaultAsync(s => s.Id == request.SubmissionId && s.TaskItemId == task.Id && !s.IsDeleted, ct);
            if (submission == null || submission.Decision != "Pending") throw new WorkflowConflictException("Lần nộp này đã được xử lý hoặc không thuộc công việc.");
            submission.Decision = isAccept ? "Accepted" : "Returned";
            submission.ReviewedById = actor.Id; submission.ReviewedAt = now;
            submission.ReviewNote = isReturn ? request.RejectionReason!.Trim() : request.ApprovalNote?.Trim();
            task.RejectionReason = isReturn ? submission.ReviewNote : null;
            if (isAccept) { task.CompletedAt = now; task.ProgressPercentage = 100; }
            notifications.Add(ops.Notify(task.AssigneeId, isAccept ? "Kết quả đã được nghiệm thu" : "Kết quả cần chỉnh sửa",
                isReturn ? $"{task.Title}: {submission.ReviewNote}" : task.Title, task.Id));
        }
        if (request.NewExtendedDueDate.HasValue)
        {
            if (!isReturn || !await access.CanManageTaskAsync(actor, task, ct))
                throw new UnauthorizedAccessException("Gia hạn yêu cầu quyền quản lý công việc.");
            RecordDeadline(task, request.NewExtendedDueDate.Value, actor.Id, request.RejectionReason!, now);
        }
        if (isCancel)
        {
            task.RejectionReason = request.RejectionReason!.Trim();
            var children = await db.TaskItems.Where(t => t.ParentTaskId == task.Id && !t.IsDeleted
                && t.Status != TaskStatusEnum.Completed && t.Status != TaskStatusEnum.Cancelled).ToListAsync(ct);
            foreach (var child in children)
            {
                child.RejectionReason = "Công việc tổng bị hủy: " + task.RejectionReason;
                RecordStatus(child, TaskStatusEnum.Cancelled, actor.Id, "Công việc tổng bị hủy: " + task.RejectionReason, now, ops);
                notifications.Add(ops.Notify(child.AssigneeId, "Phần việc phối hợp đã hủy", task.RejectionReason, child.Id));
            }
            var cancelledIds = children.Select(c => c.Id).Append(task.Id).ToList();
            var pending = await db.TaskSubmissions.Where(s => cancelledIds.Contains(s.TaskItemId) && !s.IsDeleted && s.Decision == "Pending").ToListAsync(ct);
            foreach (var submission in pending)
            {
                submission.Decision = "Cancelled";
                submission.ReviewedById = actor.Id;
                submission.ReviewedAt = now;
                submission.ReviewNote = task.RejectionReason;
            }
            notifications.Add(ops.Notify(task.AssigneeId, "Công việc đã hủy", task.RejectionReason, task.Id));
        }
        RecordStatus(task, status, actor.Id, isReturn || isCancel ? request.RejectionReason : request.ApprovalNote, now, ops);
        await ops.CommitAsync(actor.Id, request.RequestId, fingerprint, task.Id, ct);
        await ops.PublishAsync(notifications, ct);
        return true;
    }

    public async Task<Guid> AmendAsync(Guid taskId, Guid actorId, TaskAmendment request, CancellationToken ct)
    {
        var access = new WorkflowAccess(db);
        var ops = new WorkflowOperations(db, dispatcher);
        var actor = await access.ActorAsync(actorId, ct) ?? throw new UnauthorizedAccessException();
        var fingerprint = WorkflowOperations.Fingerprint("AmendTask", new { taskId, request });
        var replay = await ops.ReplayAsync(actorId, request.RequestId, fingerprint, ct);
        if (replay.HasValue) return replay.Value;
        var task = await access.Tasks(actor).FirstOrDefaultAsync(t => t.Id == taskId, ct) ?? throw new UnauthorizedAccessException();
        WorkflowOperations.CheckVersion(task.Version, request.Version);
        if (!await access.CanManageTaskAsync(actor, task, ct)) throw new UnauthorizedAccessException("Không có quyền điều chỉnh công việc.");
        if (task.Status == TaskStatusEnum.Completed || task.Status == TaskStatusEnum.Cancelled) throw new WorkflowConflictException("Công việc đã kết thúc.");
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Vui lòng nhập lý do điều chỉnh.");
        var now = DateTime.UtcNow;
        if (request.DueDate.HasValue) RecordDeadline(task, request.DueDate.Value, actorId, request.Reason, now);
        if (request.ReviewerId.HasValue && request.ReviewerId != task.ReviewerId)
        {
            if (task.ParentTaskId.HasValue) throw new ArgumentException("Người nhận kết quả phối hợp là chủ trì công việc tổng.");
            if (!await authorization.CanAssignTaskAsync(request.ReviewerId.Value, task.AssigneeId, task.DepartmentId, ct))
                throw new ArgumentException("Người nghiệm thu không có thẩm quyền đối với người thực hiện.");
            db.TaskWorkflowChanges.Add(new TaskWorkflowChange { TaskItemId = task.Id, UserId = actorId, Kind = "ReviewerChanged",
                OldValue = task.ReviewerId?.ToString(), NewValue = request.ReviewerId.ToString(), Reason = request.Reason });
            task.ReviewerId = request.ReviewerId;
        }
        if (request.Requirements != null)
        {
            if (string.IsNullOrWhiteSpace(request.Requirements)) throw new ArgumentException("Yêu cầu kết quả không được để trống.");
            db.TaskWorkflowChanges.Add(new TaskWorkflowChange { TaskItemId = task.Id, UserId = actorId, Kind = "RequirementsChanged",
                OldValue = task.Requirements, NewValue = request.Requirements.Trim(), Reason = request.Reason });
            task.Requirements = request.Requirements.Trim();
        }
        task.RequiresWorkflowReview = !task.DueDate.HasValue || !task.ReviewerId.HasValue || string.IsNullOrWhiteSpace(task.Requirements);
        task.Version = Guid.NewGuid(); task.UpdatedAt = now;
        ops.Audit(actorId, "AmendTask", "TaskItem", taskId, "Điều chỉnh công việc: " + request.Reason);
        var notifications = new List<Notification> { ops.Notify(task.AssigneeId, "Công việc được điều chỉnh", request.Reason, task.Id) };
        if (task.Status == TaskStatusEnum.InReview && task.ReviewerId.HasValue)
            notifications.Add(ops.Notify(task.ReviewerId.Value, "Có kết quả chờ nghiệm thu", task.Title, task.Id));
        await ops.CommitAsync(actorId, request.RequestId, fingerprint, taskId, ct);
        await ops.PublishAsync(notifications, ct);
        return taskId;
    }

    public async Task<bool> TransferAsync(Guid taskId, Guid actorId, TaskTransferInput request, CancellationToken ct)
    {
        if (authorization == null) throw new InvalidOperationException("Task authorization service is required.");
        var access = new WorkflowAccess(db);
        var actor = await access.ActorAsync(actorId, ct) ?? throw new UnauthorizedAccessException();
        var ops = new WorkflowOperations(db, dispatcher);
        var fingerprint = WorkflowOperations.Fingerprint("TransferTask", new { taskId, request });
        if (await ops.ReplayAsync(actorId, request.RequestId, fingerprint, ct) != null) return true;
        var task = await access.Tasks(actor).FirstOrDefaultAsync(t => t.Id == taskId, ct);
        if (task == null) return false;
        WorkflowOperations.CheckVersion(task.Version, request.Version);
        if (!await authorization.CanTransferTaskAsync(actorId, taskId, request.TargetUserId, ct))
            throw new UnauthorizedAccessException("Không có quyền điều chuyển công việc.");
        if (task.Status != TaskStatusEnum.Todo && task.Status != TaskStatusEnum.InProgress)
            throw new WorkflowConflictException("Chỉ điều chuyển khi công việc chưa bắt đầu hoặc đang thực hiện.");
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Vui lòng ghi lý do điều chuyển.");
        if (request.TargetUserId == task.AssigneeId) throw new ArgumentException("Người mới phải khác người đang thực hiện.");
        var target = await access.ActorAsync(request.TargetUserId, ct) ?? throw new ArgumentException("Người nhận không hợp lệ.");
        var reviewerId = request.ReviewerId ?? task.ReviewerId;
        var notifications = new List<Notification>();
        if (task.ParentTaskId.HasValue)
        {
            var parent = await db.TaskItems.FirstAsync(t => t.Id == task.ParentTaskId && !t.IsDeleted, ct);
            if (parent.Status != TaskStatusEnum.Todo && parent.Status != TaskStatusEnum.InProgress)
                throw new WorkflowConflictException("Công việc tổng đã nộp hoặc kết thúc.");
            if (target.Id == parent.AssigneeId || (request.ReviewerId.HasValue && request.ReviewerId != parent.AssigneeId))
                throw new ArgumentException("Người thực hiện phối hợp phải khác chủ trì; chủ trì nhận kết quả phối hợp.");
            reviewerId = parent.AssigneeId; parent.Version = Guid.NewGuid();
        }
        else
        {
            var reviewer = reviewerId.HasValue ? await access.ActorAsync(reviewerId.Value, ct) : null;
            if (reviewer == null || !WorkflowAccess.CanAssign(reviewer, target))
                throw new ArgumentException("Cần chọn người nghiệm thu đủ thẩm quyền đối với người thực hiện mới.");
            var children = await db.TaskItems.Where(t => t.ParentTaskId == task.Id && !t.IsDeleted
                && t.Status != TaskStatusEnum.Completed && t.Status != TaskStatusEnum.Cancelled).ToListAsync(ct);
            if (children.Any(c => c.AssigneeId == target.Id)) throw new ArgumentException("Người mới đang thực hiện một phần phối hợp. Cần điều chuyển phần đó trước để tránh tự nghiệm thu.");
            foreach (var child in children)
            {
                db.TaskWorkflowChanges.Add(new TaskWorkflowChange { TaskItemId = child.Id, UserId = actorId,
                    Kind = "ReviewerChanged", OldValue = child.ReviewerId?.ToString(), NewValue = target.Id.ToString(), Reason = request.Reason });
                child.ReviewerId = target.Id; child.Version = Guid.NewGuid(); child.UpdatedAt = DateTime.UtcNow;
                if (child.Status == TaskStatusEnum.InReview) notifications.Add(ops.Notify(target.Id, "Có kết quả phối hợp chờ nhận", child.Title, child.Id));
            }
        }
        var oldAssignee = task.AssigneeId;
        db.TaskWorkflowChanges.Add(new TaskWorkflowChange { TaskItemId = task.Id, UserId = actorId, Kind = "AssigneeChanged",
            OldValue = oldAssignee.ToString(), NewValue = target.Id.ToString(), Reason = request.Reason });
        if (reviewerId != task.ReviewerId) db.TaskWorkflowChanges.Add(new TaskWorkflowChange { TaskItemId = task.Id, UserId = actorId,
            Kind = "ReviewerChanged", OldValue = task.ReviewerId?.ToString(), NewValue = reviewerId.ToString(), Reason = request.Reason });
        task.AssigneeId = target.Id; task.DepartmentId = target.DepartmentId; task.ReviewerId = reviewerId;
        task.RequiresWorkflowReview = !task.DueDate.HasValue || !reviewerId.HasValue || string.IsNullOrWhiteSpace(task.Requirements);
        RecordStatus(task, TaskStatusEnum.Todo, actorId, request.Reason, DateTime.UtcNow, ops);
        ops.Audit(actorId, "TransferTask", "TaskItem", task.Id, "Điều chuyển công việc: " + request.Reason);
        notifications.Add(ops.Notify(target.Id, "Công việc được điều chuyển đến bạn", task.Title + ": " + request.Reason, task.Id));
        notifications.Add(ops.Notify(oldAssignee, "Công việc đã được điều chuyển", task.Title + ": " + request.Reason, task.Id));
        await ops.CommitAsync(actorId, request.RequestId, fingerprint, task.Id, ct);
        await ops.PublishAsync(notifications, ct);
        return true;
    }

    private void RecordDeadline(TaskItem task, DateTime dueDate, Guid userId, string reason, DateTime now)
    {
        var utc = WorkflowOperations.Utc(dueDate);
        db.TaskWorkflowChanges.Add(new TaskWorkflowChange { TaskItemId = task.Id, UserId = userId, Kind = "DeadlineChanged",
            OldValue = task.DueDate?.ToString("O"), NewValue = utc.ToString("O"), Reason = reason, CreatedAt = now });
        task.DueDate = utc;
    }

    private void RecordStatus(TaskItem task, TaskStatusEnum status, Guid userId, string? reason, DateTime now, WorkflowOperations ops)
    {
        db.TaskWorkflowChanges.Add(new TaskWorkflowChange { TaskItemId = task.Id, UserId = userId, Kind = "StatusChanged",
            OldValue = task.Status.ToString(), NewValue = status.ToString(), Reason = reason, CreatedAt = now });
        ops.Audit(userId, "status_changed", "TaskItem", task.Id, $"{StatusLabel(task.Status)} → {StatusLabel(status)}" + (string.IsNullOrWhiteSpace(reason) ? "" : ": " + reason));
        task.Status = status; task.Version = Guid.NewGuid(); task.UpdatedAt = now;
    }

    public static string StatusLabel(TaskStatusEnum status) => status switch
    {
        TaskStatusEnum.Todo => "Chưa bắt đầu", TaskStatusEnum.InProgress => "Đang thực hiện",
        TaskStatusEnum.InReview => "Chờ nghiệm thu", TaskStatusEnum.Completed => "Đã nghiệm thu",
        TaskStatusEnum.Cancelled => "Đã hủy", _ => "Cần rà soát"
    };

    private static TaskStatusEnum ParseStatus(string status) => status.ToLowerInvariant() switch
    {
        "inprogress" or "dang_xu_ly" => TaskStatusEnum.InProgress,
        "inreview" or "cho_duyet" or "pendingapproval" => TaskStatusEnum.InReview,
        "completed" or "hoan_thanh" => TaskStatusEnum.Completed,
        "cancelled" or "tu_choi" or "rejected" => TaskStatusEnum.Cancelled,
        _ => throw new ArgumentException("Trạng thái xử lý không hợp lệ.")
    };
}

public sealed class TaskTransferInput
{
    public Guid RequestId { get; set; }
    public Guid? Version { get; set; }
    public Guid TargetUserId { get; set; }
    public Guid? ReviewerId { get; set; }
    public string Reason { get; set; } = string.Empty;
}

public sealed class TaskAmendment
{
    public Guid RequestId { get; set; }
    public Guid? Version { get; set; }
    public DateTime? DueDate { get; set; }
    public Guid? ReviewerId { get; set; }
    public string? Requirements { get; set; }
    public string Reason { get; set; } = string.Empty;
}
