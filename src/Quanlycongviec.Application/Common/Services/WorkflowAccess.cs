using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Common.Services;

public sealed record WorkflowActor(Guid Id, int Rank, Guid? DepartmentId, string RoleCode);

/// <summary>One server-owned visibility predicate for lists, details and file access.</summary>
public sealed class WorkflowAccess(IApplicationDbContext db)
{
    public async Task<WorkflowActor?> ActorAsync(Guid id, CancellationToken ct = default) =>
        await db.Users.Where(u => u.Id == id && !u.IsDeleted)
            .Select(u => new WorkflowActor(u.Id,
                u.UserRoles.Where(r => !r.IsDeleted && !r.Role.IsDeleted)
                    .Select(r => (int?)r.Role.RankLevel).Min() ?? 5,
                u.PrimaryDepartmentId, u.ActiveRoleCode)).FirstOrDefaultAsync(ct);

    public IQueryable<TaskItem> Tasks(WorkflowActor actor)
    {
        var query = db.TaskItems.Where(t => !t.IsDeleted);
        if (actor.Rank <= 2) return query;
        return query.Where(t => t.AssignerId == actor.Id || t.AssigneeId == actor.Id
            || t.ReviewerId == actor.Id
            || (actor.Rank <= 4 && actor.DepartmentId != null && t.DepartmentId == actor.DepartmentId)
            || (t.ParentTask != null && !t.ParentTask.IsDeleted && t.ParentTask.AssigneeId == actor.Id)
            || t.CoordinationTasks.Any(c => !c.IsDeleted && (c.AssigneeId == actor.Id || c.ReviewerId == actor.Id)));
    }

    public IQueryable<InboxDocument> Inbox(WorkflowActor actor)
    {
        var query = db.InboxDocuments.Where(d => !d.IsDeleted);
        if (actor.Rank <= 2) return query;
        var taskIds = Tasks(actor).Select(t => t.Id);
        return query.Where(d => d.ReceivedByUserId == actor.Id
            || db.DocumentAttachments.Any(a => !a.IsDeleted && a.TargetType == "Inbox" && a.DocumentId == d.Id && a.UploadedByUserId == actor.Id)
            || db.DocumentPresentations.Any(p => !p.IsDeleted && p.InboxDocumentId == d.Id && (p.SubmittedById == actor.Id || p.RecipientId == actor.Id))
            || db.TaskDocumentLinks.Any(l => !l.IsDeleted && l.InboxDocumentId == d.Id && taskIds.Contains(l.TaskItemId))
            || db.CalendarEvents.Any(e => !e.IsDeleted && e.SourceInboxDocumentId == d.Id
                && (e.OrganizerId == actor.Id || e.Participants.Any(p => !p.IsDeleted && p.UserId == actor.Id))));
    }

    public IQueryable<CalendarEvent> Events(WorkflowActor actor)
    {
        var query = db.CalendarEvents.Where(e => !e.IsDeleted);
        if (actor.Rank <= 2) return query;
        return query.Where(e => e.OrganizerId == actor.Id || e.Participants.Any(p => !p.IsDeleted && p.UserId == actor.Id)
            || (actor.Rank <= 4 && actor.DepartmentId.HasValue && e.DepartmentId == actor.DepartmentId));
    }

    public IQueryable<OutgoingDocument> Outgoing(WorkflowActor actor)
    {
        var query = db.OutgoingDocuments.Where(d => !d.IsDeleted);
        if (actor.Rank <= 2) return query;
        var taskIds = Tasks(actor).Select(t => t.Id);
        return query.Where(d => d.DraftedByUserId == actor.Id || d.SignedByUserId == actor.Id
            || db.TaskDocumentLinks.Any(l => !l.IsDeleted && l.OutgoingDocumentId == d.Id && taskIds.Contains(l.TaskItemId)));
    }

    public static bool CanAssign(WorkflowActor actor, WorkflowActor assignee, Guid? departmentId = null) =>
        actor.Id != assignee.Id && actor.Rank <= 4 && actor.Rank < assignee.Rank
        && (!departmentId.HasValue || departmentId == assignee.DepartmentId)
        && (actor.Rank <= 2 || actor.RoleCode == "ChanhVanPhong"
            || (actor.DepartmentId.HasValue && actor.DepartmentId == assignee.DepartmentId));

    public async Task<bool> CanAssignFromInboxAsync(WorkflowActor actor, InboxDocument document, CancellationToken ct = default) =>
        actor.Rank <= 4 && (actor.Rank <= 2 || document.ReceivedByUserId == actor.Id
            || await db.DocumentPresentations.AnyAsync(p => p.InboxDocumentId == document.Id && !p.IsDeleted && p.RecipientId == actor.Id, ct))
        && !await db.DocumentPresentations.AnyAsync(p => p.InboxDocumentId == document.Id && !p.IsDeleted && p.Status == "Pending" && p.RecipientId != actor.Id, ct);

    public async Task<bool> CanManageTaskAsync(WorkflowActor actor, TaskItem task, CancellationToken ct = default)
    {
        var assignee = await ActorAsync(task.AssigneeId, ct);
        // Recovery uses the departed person's stored role and department solely to assess the
        // active manager's scope. It never reactivates that account or grants it write access.
        assignee ??= await db.Users.Where(u => u.Id == task.AssigneeId && u.IsDeleted)
            .Select(u => new WorkflowActor(u.Id,
                u.UserRoles.Where(r => !r.IsDeleted && !r.Role.IsDeleted).Select(r => (int?)r.Role.RankLevel).Min() ?? 5,
                u.PrimaryDepartmentId, u.ActiveRoleCode)).FirstOrDefaultAsync(ct);
        return assignee != null && CanAssign(actor, assignee, task.DepartmentId)
            && (task.AssignerId == actor.Id || actor.Rank <= 2 || actor.RoleCode == "ChanhVanPhong");
    }

    public static bool CanAssignFromOutgoing(WorkflowActor actor, OutgoingDocument document) => actor.Rank <= 4
        && (document.Status == OutgoingDocumentStatusEnum.Issued || document.Status == OutgoingDocumentStatusEnum.Sent)
        && (actor.Rank <= 2 || document.DraftedByUserId == actor.Id || document.SignedByUserId == actor.Id);

    public async Task<bool> CanReviewAsync(WorkflowActor actor, TaskItem task, CancellationToken ct = default)
    {
        if (actor.Id == task.AssigneeId || actor.Id != task.ReviewerId) return false;
        if (task.ParentTaskId.HasValue)
            return await db.TaskItems.AnyAsync(p => p.Id == task.ParentTaskId && !p.IsDeleted && p.AssigneeId == actor.Id, ct);
        var assignee = await ActorAsync(task.AssigneeId, ct);
        return assignee != null && CanAssign(actor, assignee, task.DepartmentId);
    }

    public async Task<bool> CanWriteDocumentAsync(Guid userId, Guid documentId, string type, CancellationToken ct = default)
    {
        var actor = await ActorAsync(userId, ct);
        if (actor == null) return false;
        if (type == "Task")
            return await Tasks(actor).AnyAsync(t => t.Id == documentId && t.AssigneeId == actor.Id
                && (t.Status == TaskStatusEnum.Todo || t.Status == TaskStatusEnum.InProgress), ct);
        if (type == "Outgoing")
            return await Outgoing(actor).AnyAsync(d => d.Id == documentId && d.DraftedByUserId == actor.Id
                && (d.Status == OutgoingDocumentStatusEnum.Draft || d.Status == OutgoingDocumentStatusEnum.Rejected), ct);
        if (type != "Inbox") return false;
        if (!await CanReceiveInboxAsync(actor, ct)) return false;
        return await Inbox(actor).AnyAsync(d => d.Id == documentId && d.ReceivedByUserId == actor.Id
            && (d.BusinessStatus == "New" || d.BusinessStatus == "NeedsSupplement"), ct);
    }

    public async Task<bool> GuardFileWriteAsync(Guid userId, Guid documentId, string type, CancellationToken ct = default)
    {
        var actor = await ActorAsync(userId, ct);
        if (actor == null || (type == "Inbox" && !await CanReceiveInboxAsync(actor, ct))) return false;
        object? owner = type switch
        {
            "Task" => await db.TaskItems.FirstOrDefaultAsync(t => !t.IsDeleted && t.Id == documentId && t.AssigneeId == userId
                && (t.Status == TaskStatusEnum.Todo || t.Status == TaskStatusEnum.InProgress), ct),
            "Inbox" => await db.InboxDocuments.FirstOrDefaultAsync(d => !d.IsDeleted && d.Id == documentId && d.ReceivedByUserId == userId
                && (d.BusinessStatus == "New" || d.BusinessStatus == "NeedsSupplement"), ct),
            "Outgoing" => await db.OutgoingDocuments.FirstOrDefaultAsync(d => !d.IsDeleted && d.Id == documentId && d.DraftedByUserId == userId
                && (d.Status == OutgoingDocumentStatusEnum.Draft || d.Status == OutgoingDocumentStatusEnum.Rejected), ct),
            _ => null
        };
        if (owner == null) return false;
        if (db is not DbContext context) throw new InvalidOperationException("File writes require a transactional context.");
        // An unchanged version write still checks the concurrency token at commit. A submission/signature
        // committed during file transfer therefore rolls back attachment metadata rather than bypassing state rules.
        context.Entry(owner).Property("Version").IsModified = true;
        return true;
    }

    public async Task<bool> CanReceiveInboxAsync(WorkflowActor actor, CancellationToken ct = default) =>
        actor.Rank <= 4 || await db.WorkflowPermissions.AnyAsync(p => p.UserId == actor.Id && !p.IsDeleted && p.CanReceiveDocuments, ct);
}
