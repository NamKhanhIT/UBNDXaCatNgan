using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Common.Services;

public sealed class DocumentWorkspaceQuery
{
    public string Source { get; set; } = "all";
    public string Scope { get; set; } = "mine";
    public string? Status { get; set; }
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public sealed class DocumentWorkspaceRow
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
    public string Sender { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime Date { get; set; }
    public string DateLabel { get; set; } = string.Empty;
    public bool IsUrgent { get; set; }
    public Guid? HandlerId { get; set; }
    public string? HandlerName { get; set; }
    public int TaskCount { get; set; }
    public Guid? Version { get; set; }
}

public sealed class DocumentWorkspaceDetail
{
    public DocumentWorkspaceRow Document { get; set; } = new();
    public string? Summary { get; set; }
    public string? Requirements { get; set; }
    public DateTime? SuggestedDeadline { get; set; }
    public DateTime? IssuedDate { get; set; }
    public List<TaskItemDto> Tasks { get; set; } = new();
    public List<PresentationDetail> Presentations { get; set; } = new();
    public bool CanAssign { get; set; }
    public bool CanPresent { get; set; }
    public bool CanDecide { get; set; }
    public bool CanArchive { get; set; }
    public bool CanUploadFiles { get; set; }
    public bool CanEditOutgoing { get; set; }
    public bool CanSubmitSignature { get; set; }
    public bool CanSign { get; set; }
    public bool CanRevokeOutgoing { get; set; }
    public bool CanRecallOutgoing { get; set; }
    public bool CanCancelOutgoing { get; set; }
    public string? ProcessingNote { get; set; }
    public List<DocumentHistoryEntry> History { get; set; } = new();
    public bool CanCreateCalendar { get; set; }
    public DateTime? SuggestedEventStart { get; set; }
    public DateTime? SuggestedEventEnd { get; set; }
    public List<DocumentCalendarReference> CalendarEvents { get; set; } = new();
}

public sealed record DocumentCalendarReference(Guid Id, string Title, DateTime StartDateTime);
public sealed record DocumentHistoryEntry(Guid Id, string Details, DateTime CreatedAt);

public sealed class PresentationDetail
{
    public Guid Id { get; set; }
    public Guid SubmittedById { get; set; }
    public Guid RecipientId { get; set; }
    public string? SubmittedByName { get; set; }
    public string? RecipientName { get; set; }
    public string Note { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? DecisionNote { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DecidedAt { get; set; }
}

public sealed class DocumentWorkspace(IApplicationDbContext db)
{
    private readonly WorkflowAccess access = new(db);

    private IQueryable<DocumentWorkspaceRow> Rows(WorkflowActor actor, string scope)
    {
        var inbox = access.Inbox(actor).AsNoTracking().Where(d => d.Channel == InboxChannel.Internal);
        var outgoing = access.Outgoing(actor).AsNoTracking();
        var myTasks = access.Tasks(actor).Where(t => t.AssigneeId == actor.Id || t.AssignerId == actor.Id || t.ReviewerId == actor.Id).Select(t => t.Id);
        var visibleTasks = access.Tasks(actor).Select(t => t.Id);
        if (scope == "mine")
        {
            inbox = inbox.Where(d => d.ReceivedByUserId == actor.Id
                || db.DocumentPresentations.Any(p => !p.IsDeleted && p.InboxDocumentId == d.Id && (p.SubmittedById == actor.Id || p.RecipientId == actor.Id))
                || db.TaskDocumentLinks.Any(l => !l.IsDeleted && l.InboxDocumentId == d.Id && myTasks.Contains(l.TaskItemId))
                || db.CalendarEvents.Any(e => !e.IsDeleted && e.SourceInboxDocumentId == d.Id
                    && (e.OrganizerId == actor.Id || e.Participants.Any(p => !p.IsDeleted && p.UserId == actor.Id))));
            outgoing = outgoing.Where(d => d.DraftedByUserId == actor.Id || d.SignedByUserId == actor.Id
                || db.TaskDocumentLinks.Any(l => !l.IsDeleted && l.OutgoingDocumentId == d.Id && myTasks.Contains(l.TaskItemId)));
        }
        var incomingRows = inbox.Select(d => new DocumentWorkspaceRow
        {
            Id = d.Id, Kind = "Inbox", Title = d.Subject, Number = d.DocumentNumber, Sender = d.Sender,
            Status = d.BusinessStatus, Date = d.ReceivedDate, DateLabel = "Ngày tiếp nhận", IsUrgent = d.IsUrgent, Version = d.Version,
            HandlerId = db.DocumentPresentations.Where(p => p.InboxDocumentId == d.Id && !p.IsDeleted && p.Status == "Pending")
                .Select(p => (Guid?)p.RecipientId).FirstOrDefault(),
            TaskCount = db.TaskDocumentLinks.Count(l => !l.IsDeleted && l.InboxDocumentId == d.Id && visibleTasks.Contains(l.TaskItemId))
        });
        var outgoingRows = outgoing.Select(d => new DocumentWorkspaceRow
        {
            Id = d.Id, Kind = "Outgoing", Title = d.Title, Number = d.DocumentNumber ?? "", Sender = d.RecipientNote ?? "",
            Status = d.Status == OutgoingDocumentStatusEnum.Draft ? "Draft"
                : d.Status == OutgoingDocumentStatusEnum.PendingSignature ? "PendingSignature"
                : d.Status == OutgoingDocumentStatusEnum.Issued ? "Issued"
                : d.Status == OutgoingDocumentStatusEnum.Sent ? "Sent"
                : d.Status == OutgoingDocumentStatusEnum.Recalled ? "Recalled"
                : d.Status == OutgoingDocumentStatusEnum.Cancelled ? "Cancelled" : "Rejected",
            Date = d.DraftedAt, DateLabel = "Ngày soạn", IsUrgent = d.IsUrgent, Version = d.Version, HandlerId = d.DraftedByUserId,
            TaskCount = db.TaskDocumentLinks.Count(l => !l.IsDeleted && l.OutgoingDocumentId == d.Id && visibleTasks.Contains(l.TaskItemId))
        });
        return incomingRows.Concat(outgoingRows);
    }

    public async Task<PaginatedResult<DocumentWorkspaceRow>> ListAsync(Guid userId, DocumentWorkspaceQuery request, CancellationToken ct)
    {
        var actor = await access.ActorAsync(userId, ct) ?? throw new UnauthorizedAccessException();
        var query = Rows(actor, request.Scope);
        if (request.Source != "all") query = query.Where(d => d.Kind == request.Source);
        if (!string.IsNullOrWhiteSpace(request.Status) && request.Status != "all") query = query.Where(d => d.Status == request.Status);
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var q = request.Search.Trim().ToLower();
            query = query.Where(d => d.Title.ToLower().Contains(q) || d.Number.ToLower().Contains(q) || d.Sender.ToLower().Contains(q));
        }
        var page = Math.Max(1, request.Page);
        var size = Math.Clamp(request.PageSize, 1, 100);
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(d => d.IsUrgent).ThenByDescending(d => d.Date).ThenBy(d => d.Kind).ThenBy(d => d.Id)
            .Skip((page - 1) * size).Take(size).ToListAsync(ct);
        await FillNames(rows, ct);
        return new(rows, total, page, size);
    }

    public async Task<DocumentWorkspaceDetail?> DetailAsync(Guid userId, string kind, Guid documentId, CancellationToken ct)
    {
        var actor = await access.ActorAsync(userId, ct) ?? throw new UnauthorizedAccessException();
        var row = await Rows(actor, "accessible").FirstOrDefaultAsync(d => d.Kind == kind && d.Id == documentId, ct);
        if (row == null) return null;
        await FillNames(new List<DocumentWorkspaceRow> { row }, ct);
        var detail = new DocumentWorkspaceDetail { Document = row };
        var taskIds = db.TaskDocumentLinks.Where(l => !l.IsDeleted && (kind == "Inbox" ? l.InboxDocumentId == documentId : l.OutgoingDocumentId == documentId)).Select(l => l.TaskItemId);
        detail.Tasks = await access.Tasks(actor).Where(t => taskIds.Contains(t.Id)).OrderBy(t => t.CreatedAt).Select(TaskProjection.Summary).ToListAsync(ct);
        detail.CanUploadFiles = await access.CanWriteDocumentAsync(userId, documentId, kind, ct);
        if (kind == "Inbox")
        {
            var doc = await access.Inbox(actor).AsNoTracking().FirstAsync(d => d.Id == documentId, ct);
            detail.Summary = doc.AiSummary; detail.Requirements = doc.AiObjectives;
            detail.SuggestedDeadline = doc.AiExtractedDeadline; detail.IssuedDate = doc.IssuedDate;
            detail.CanAssign = await access.CanAssignFromInboxAsync(actor, doc, ct);
            detail.CanCreateCalendar = detail.CanAssign;
            detail.SuggestedEventStart = doc.AiEventStartDateTime;
            detail.SuggestedEventEnd = doc.AiEventEndDateTime;
            detail.CalendarEvents = await access.Events(actor).Where(e => e.SourceInboxDocumentId == documentId)
                .OrderBy(e => e.StartDateTime).Select(e => new DocumentCalendarReference(e.Id, e.Title, e.StartDateTime)).ToListAsync(ct);
            detail.CanPresent = await new DocumentWorkflow(db).CanPresentAsync(actor, doc, ct);
            detail.Presentations = await db.DocumentPresentations.AsNoTracking().Where(p => p.InboxDocumentId == documentId && !p.IsDeleted)
                .OrderByDescending(p => p.CreatedAt).Select(p => new PresentationDetail { Id = p.Id, SubmittedById = p.SubmittedById,
                    RecipientId = p.RecipientId, Note = p.Note, Status = p.Status, DecisionNote = p.DecisionNote,
                    CreatedAt = p.CreatedAt, DecidedAt = p.DecidedAt }).ToListAsync(ct);
            var people = detail.Presentations.Select(p => p.SubmittedById).Concat(detail.Presentations.Select(p => p.RecipientId)).Distinct().ToList();
            var names = await db.Users.Where(u => people.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
            foreach (var p in detail.Presentations) { p.SubmittedByName = names.GetValueOrDefault(p.SubmittedById); p.RecipientName = names.GetValueOrDefault(p.RecipientId); }
            detail.CanDecide = actor.Rank <= 4 && detail.Presentations.Any(p => p.Status == "Pending" && p.RecipientId == actor.Id);
            detail.CanArchive = detail.CanDecide || (detail.CanAssign && !detail.Presentations.Any(p => p.Status == "Pending"));
        }
        else
        {
            var doc = await access.Outgoing(actor).AsNoTracking().FirstAsync(d => d.Id == documentId, ct);
            detail.Summary = doc.Content; detail.IssuedDate = doc.IssuedDate; detail.SuggestedDeadline = doc.ResponseDeadline;
            detail.CanAssign = WorkflowAccess.CanAssignFromOutgoing(actor, doc);
            detail.CanEditOutgoing = doc.DraftedByUserId == actor.Id && (doc.Status == OutgoingDocumentStatusEnum.Draft || doc.Status == OutgoingDocumentStatusEnum.Rejected);
            detail.CanSubmitSignature = doc.DraftedByUserId == actor.Id && (doc.Status == OutgoingDocumentStatusEnum.Draft || doc.Status == OutgoingDocumentStatusEnum.Rejected);
            detail.CanSign = actor.Rank <= 2 && doc.Status == OutgoingDocumentStatusEnum.PendingSignature;
            detail.CanRevokeOutgoing = doc.DraftedByUserId == actor.Id && doc.Status == OutgoingDocumentStatusEnum.PendingSignature;
            detail.CanRecallOutgoing = actor.Rank <= 2 && (doc.Status == OutgoingDocumentStatusEnum.Issued || doc.Status == OutgoingDocumentStatusEnum.Sent);
            detail.CanCancelOutgoing = detail.CanRecallOutgoing || (doc.DraftedByUserId == actor.Id
                && (doc.Status == OutgoingDocumentStatusEnum.Draft || doc.Status == OutgoingDocumentStatusEnum.Rejected || doc.Status == OutgoingDocumentStatusEnum.PendingSignature));
            detail.ProcessingNote = doc.RecallReason ?? doc.RejectionReason;
            detail.History = await db.AuditLogs.AsNoTracking().Where(a => a.EntityName == "OutgoingDocument" && a.EntityId == documentId.ToString())
                .OrderByDescending(a => a.CreatedAt).Select(a => new DocumentHistoryEntry(a.Id, a.Details, a.CreatedAt)).ToListAsync(ct);
        }
        return detail;
    }

    public async Task<List<DocumentWorkspaceRow>> PendingAsync(Guid userId, CancellationToken ct)
    {
        var actor = await access.ActorAsync(userId, ct) ?? throw new UnauthorizedAccessException();
        var pendingIds = db.DocumentPresentations.Where(p => !p.IsDeleted &&
            ((p.Status == "Pending" && p.RecipientId == userId) || (p.Status == "SupplementRequested" && p.SubmittedById == userId)))
            .Select(p => p.InboxDocumentId);
        var rows = await Rows(actor, "accessible").Where(d => d.Kind == "Inbox" && pendingIds.Contains(d.Id)
            && (d.Status == "Submitted" || d.Status == "NeedsSupplement")).OrderByDescending(d => d.IsUrgent).ThenBy(d => d.Date).ToListAsync(ct);
        await FillNames(rows, ct);
        return rows;
    }

    private async Task FillNames(List<DocumentWorkspaceRow> rows, CancellationToken ct)
    {
        var ids = rows.Where(r => r.HandlerId.HasValue).Select(r => r.HandlerId!.Value).Distinct().ToList();
        var names = await db.Users.Where(u => ids.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
        foreach (var row in rows) row.HandlerName = row.HandlerId.HasValue ? names.GetValueOrDefault(row.HandlerId.Value) : null;
    }
}
