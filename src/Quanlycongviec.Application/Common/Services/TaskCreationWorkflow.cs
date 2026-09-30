using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Common.Services;

public sealed class TaskCreationWorkflow(IApplicationDbContext db, ITaskAuthorizationService authorization, INotificationDispatcher? dispatcher = null)
{
    public async Task<Guid> CreateAsync(CreateTaskCommand request, CancellationToken ct)
    {
        if (authorization == null) throw new InvalidOperationException("Task authorization service is required.");
        var access = new WorkflowAccess(db);
        var ops = new WorkflowOperations(db, dispatcher);
        var actor = await access.ActorAsync(request.AssignerId, ct) ?? throw new UnauthorizedAccessException("Phiên làm việc không hợp lệ.");
        var fingerprint = WorkflowOperations.Fingerprint("CreateTask", request);
        var replay = await ops.ReplayAsync(actor.Id, request.RequestId, fingerprint, ct);
        if (replay.HasValue) return replay.Value;

        Validate(request.Title, request.Requirements, request.DueDate);
        if (!Enum.IsDefined(request.Priority) || !Enum.IsDefined(request.Type)) throw new ArgumentException("Loại công việc hoặc mức ưu tiên không hợp lệ.");
        if (!await authorization.CanAssignTaskAsync(actor.Id, request.AssigneeId, request.DepartmentId, ct))
            throw new UnauthorizedAccessException("Bạn không có thẩm quyền giao việc cho cán bộ này.");
        var assignee = await access.ActorAsync(request.AssigneeId, ct) ?? throw new ArgumentException("Người thực hiện không còn hoạt động.");
        TaskItem? parent = null;
        var reviewerId = request.ReviewerId ?? actor.Id;
        if (request.ParentTaskId.HasValue)
        {
            parent = await db.TaskItems.FirstOrDefaultAsync(t => t.Id == request.ParentTaskId && !t.IsDeleted, ct)
                ?? throw new ArgumentException("Không tìm thấy công việc tổng.");
            WorkflowOperations.CheckVersion(parent.Version, request.ParentVersion);
            if (parent.ParentTaskId.HasValue || request.CoordinationTasks.Count != 0)
                throw new ArgumentException("Chỉ hỗ trợ một cấp phần việc phối hợp.");
            if (parent.Status != TaskStatusEnum.Todo && parent.Status != TaskStatusEnum.InProgress)
                throw new WorkflowConflictException("Chỉ thêm phần phối hợp khi công việc tổng chưa nộp nghiệm thu.");
            if (!await access.CanManageTaskAsync(actor, parent, ct)) throw new UnauthorizedAccessException("Bạn không có quyền phân công phần phối hợp cho công việc này.");
            reviewerId = parent.AssigneeId;
        }
        if (reviewerId == assignee.Id) throw new ArgumentException("Người thực hiện không được tự nghiệm thu kết quả của mình.");
        if (parent == null && !await authorization.CanAssignTaskAsync(reviewerId, assignee.Id, assignee.DepartmentId, ct))
            throw new ArgumentException("Người nghiệm thu không có thẩm quyền đối với cán bộ được chọn.");

        var task = new TaskItem { Title = request.Title.Trim(), Description = request.Description, Requirements = request.Requirements!.Trim(),
            AssignerId = actor.Id, AssigneeId = assignee.Id, DepartmentId = assignee.DepartmentId, ReviewerId = reviewerId,
            ParentTaskId = parent?.Id, Priority = request.Priority, Type = request.Type, Status = TaskStatusEnum.Todo,
            StartDate = request.StartDate.HasValue ? WorkflowOperations.Utc(request.StartDate.Value) : DateTime.UtcNow,
            DueDate = WorkflowOperations.Utc(request.DueDate!.Value), EstimatedEffortHours = 0,
            IsDelegatedAction = request.IsDelegatedAction };
        var children = new List<TaskItem>();
        foreach (var input in request.CoordinationTasks)
        {
            Validate(input.Title, input.Requirements, input.DueDate);
            if (input.AssigneeId == task.AssigneeId) throw new ArgumentException("Người chủ trì không thể tự nhận kết quả phối hợp của chính mình.");
            if (!await authorization.CanAssignTaskAsync(actor.Id, input.AssigneeId, null, ct)) throw new UnauthorizedAccessException("Bạn không có quyền giao một trong các phần việc phối hợp.");
            var person = await access.ActorAsync(input.AssigneeId, ct) ?? throw new ArgumentException("Người phối hợp không còn hoạt động.");
            children.Add(new TaskItem { Title = input.Title.Trim(), Requirements = input.Requirements.Trim(), AssignerId = actor.Id,
                AssigneeId = input.AssigneeId, DepartmentId = person.DepartmentId, ReviewerId = task.AssigneeId, ParentTaskId = task.Id,
                DueDate = WorkflowOperations.Utc(input.DueDate!.Value), StartDate = task.StartDate, Priority = task.Priority, Type = task.Type, EstimatedEffortHours = 0 });
        }

        var links = new List<TaskDocumentLink>();
        var notifications = new List<Notification>();
        foreach (var source in request.Documents.DistinctBy(d => (d.Kind, d.Id)))
        {
            var link = new TaskDocumentLink { TaskItemId = task.Id };
            if (source.Kind == "Inbox")
            {
                var document = await access.Inbox(actor).FirstOrDefaultAsync(d => d.Id == source.Id, ct)
                    ?? throw new UnauthorizedAccessException("Không được truy cập văn bản nguồn.");
                WorkflowOperations.CheckVersion(document.Version, source.Version);
                if (!await access.CanAssignFromInboxAsync(actor, document, ct)) throw new UnauthorizedAccessException("Bạn được xem nhưng không có quyền giao việc từ văn bản này.");
                var pending = await db.DocumentPresentations.FirstOrDefaultAsync(p => p.InboxDocumentId == source.Id && p.Status == "Pending" && !p.IsDeleted, ct);
                if (pending != null && pending.RecipientId != actor.Id) throw new UnauthorizedAccessException("Văn bản đang được trình cho người có thẩm quyền khác.");
                if (pending != null)
                {
                    pending.Status = "Assigned"; pending.DecidedAt = DateTime.UtcNow; pending.DecisionNote = task.Title;
                    notifications.Add(ops.Notify(pending.SubmittedById, "Văn bản đã được giao việc", document.Subject, documentId: document.Id));
                }
                document.BusinessStatus = "Assigned"; document.Version = Guid.NewGuid(); document.UpdatedAt = DateTime.UtcNow;
                link.InboxDocumentId = document.Id;
            }
            else if (source.Kind == "Outgoing")
            {
                var document = await access.Outgoing(actor).FirstOrDefaultAsync(d => d.Id == source.Id, ct);
                if (document == null || !WorkflowAccess.CanAssignFromOutgoing(actor, document))
                    throw new UnauthorizedAccessException("Văn bản đi phải được phát hành và bạn phải có quyền giao việc từ văn bản này.");
                WorkflowOperations.CheckVersion(document.Version, source.Version);
                document.Version = Guid.NewGuid(); document.UpdatedAt = DateTime.UtcNow;
                link.OutgoingDocumentId = source.Id;
            }
            else throw new ArgumentException("Nguồn văn bản không hợp lệ.");
            links.Add(link);
        }
        if (parent != null)
        {
            parent.Version = Guid.NewGuid(); parent.UpdatedAt = DateTime.UtcNow;
            var parentLinks = await db.TaskDocumentLinks.Where(l => l.TaskItemId == parent.Id && !l.IsDeleted).ToListAsync(ct);
            links.AddRange(parentLinks.Where(l => !links.Any(x => x.InboxDocumentId == l.InboxDocumentId && x.OutgoingDocumentId == l.OutgoingDocumentId))
                .Select(l => new TaskDocumentLink { TaskItemId = task.Id, InboxDocumentId = l.InboxDocumentId, OutgoingDocumentId = l.OutgoingDocumentId }));
        }
        db.TaskItems.Add(task);
        foreach (var child in children)
        {
            db.TaskItems.Add(child);
            foreach (var link in links)
                db.TaskDocumentLinks.Add(new TaskDocumentLink { TaskItemId = child.Id, InboxDocumentId = link.InboxDocumentId, OutgoingDocumentId = link.OutgoingDocumentId });
        }
        db.TaskDocumentLinks.AddRange(links);
        foreach (var item in children.Prepend(task))
        {
            ops.Audit(actor.Id, "CreateTask", "TaskItem", item.Id, $"Giao công việc: {item.Title}");
            notifications.Add(ops.Notify(item.AssigneeId, "Bạn có công việc mới", item.Title, item.Id));
        }
        var result = await ops.CommitAsync(actor.Id, request.RequestId, fingerprint, task.Id, ct);
        await ops.PublishAsync(notifications, ct);
        return result;
    }

    private static void Validate(string title, string? requirements, DateTime? deadline)
    {
        if (string.IsNullOrWhiteSpace(title) || title.Trim().Length > 200) throw new ArgumentException("Tên công việc phải có từ 1 đến 200 ký tự.");
        if (string.IsNullOrWhiteSpace(requirements)) throw new ArgumentException("Vui lòng nhập yêu cầu kết quả.");
        if (!deadline.HasValue) throw new ArgumentException("Vui lòng xác nhận thời hạn công việc.");
        WorkflowOperations.Utc(deadline.Value);
    }
}
