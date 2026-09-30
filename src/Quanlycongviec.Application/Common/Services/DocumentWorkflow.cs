using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Services;

public sealed class PresentDocumentInput
{
    public Guid RequestId { get; set; }
    public Guid? Version { get; set; }
    public Guid RecipientId { get; set; }
    public string Note { get; set; } = string.Empty;
}

public sealed class DocumentDecisionInput
{
    public Guid RequestId { get; set; }
    public Guid? Version { get; set; }
    public Guid? PresentationId { get; set; }
    public string Decision { get; set; } = string.Empty;
    public string Note { get; set; } = string.Empty;
}

public sealed class DocumentWorkflow(IApplicationDbContext db, INotificationDispatcher? dispatcher = null)
{
    private readonly WorkflowAccess access = new(db);

    public async Task<bool> CanPresentAsync(WorkflowActor actor, InboxDocument doc, CancellationToken ct) =>
        doc.ReceivedByUserId == actor.Id
        && (doc.BusinessStatus == "New" || doc.BusinessStatus == "NeedsSupplement" || doc.BusinessStatus == "Archived")
        && await access.CanReceiveInboxAsync(actor, ct);

    public static bool EligibleRecipient(WorkflowActor sender, WorkflowActor recipient) =>
        sender.Id != recipient.Id && recipient.Rank <= 4
        && (recipient.Rank <= 2 || recipient.RoleCode == "ChanhVanPhong"
            || (sender.DepartmentId.HasValue && sender.DepartmentId == recipient.DepartmentId));

    public async Task<Guid> PresentAsync(Guid userId, Guid documentId, PresentDocumentInput request, CancellationToken ct)
    {
        var actor = await access.ActorAsync(userId, ct) ?? throw new UnauthorizedAccessException();
        var ops = new WorkflowOperations(db, dispatcher);
        var fingerprint = WorkflowOperations.Fingerprint("PresentDocument", new { documentId, request });
        var replay = await ops.ReplayAsync(userId, request.RequestId, fingerprint, ct);
        if (replay.HasValue) return replay.Value;
        var doc = await access.Inbox(actor).FirstOrDefaultAsync(d => d.Id == documentId, ct) ?? throw new UnauthorizedAccessException();
        if (!await CanPresentAsync(actor, doc, ct)) throw new UnauthorizedAccessException("Bạn không có quyền trình văn bản này hoặc văn bản đang được xử lý.");
        WorkflowOperations.CheckVersion(doc.Version, request.Version);
        var recipient = await access.ActorAsync(request.RecipientId, ct);
        if (recipient == null || !EligibleRecipient(actor, recipient)) throw new ArgumentException("Người nhận trình không thuộc phạm vi thẩm quyền phù hợp.");
        var presentation = new DocumentPresentation { InboxDocumentId = doc.Id, SubmittedById = userId, RecipientId = request.RecipientId, Note = request.Note.Trim() };
        db.DocumentPresentations.Add(presentation);
        doc.BusinessStatus = "Submitted"; doc.Version = Guid.NewGuid(); doc.UpdatedAt = DateTime.UtcNow;
        ops.Audit(userId, "PresentDocument", "InboxDocument", doc.Id, "Trình xử lý văn bản. " + request.Note.Trim());
        var notification = ops.Notify(request.RecipientId, "Có văn bản chờ xử lý", doc.Subject, documentId: doc.Id);
        await ops.CommitAsync(userId, request.RequestId, fingerprint, presentation.Id, ct);
        await ops.PublishAsync(new[] { notification }, ct);
        return presentation.Id;
    }

    public async Task<Guid> DecideAsync(Guid userId, Guid documentId, DocumentDecisionInput request, CancellationToken ct)
    {
        var actor = await access.ActorAsync(userId, ct) ?? throw new UnauthorizedAccessException();
        var ops = new WorkflowOperations(db, dispatcher);
        var fingerprint = WorkflowOperations.Fingerprint("DecideDocument", new { documentId, request });
        var replay = await ops.ReplayAsync(userId, request.RequestId, fingerprint, ct);
        if (replay.HasValue) return replay.Value;
        var doc = await access.Inbox(actor).FirstOrDefaultAsync(d => d.Id == documentId, ct) ?? throw new UnauthorizedAccessException();
        WorkflowOperations.CheckVersion(doc.Version, request.Version);
        if (request.Decision != "Supplement" && request.Decision != "Archive") throw new ArgumentException("Quyết định không hợp lệ.");
        var pending = await db.DocumentPresentations.FirstOrDefaultAsync(p => p.InboxDocumentId == doc.Id && p.Status == "Pending" && !p.IsDeleted, ct);
        if (pending != null)
        {
            if (pending.RecipientId != userId || pending.Id != request.PresentationId || actor.Rank > 4)
                throw new UnauthorizedAccessException("Bạn không phải người nhận lượt trình đang chờ xử lý.");
        }
        else if (request.PresentationId.HasValue || request.Decision != "Archive" || !await access.CanAssignFromInboxAsync(actor, doc, ct))
            throw new WorkflowConflictException("Lượt trình đã được xử lý hoặc bạn không có quyền lưu tra cứu.");
        if (request.Decision == "Supplement" && string.IsNullOrWhiteSpace(request.Note)) throw new ArgumentException("Vui lòng ghi rõ yêu cầu bổ sung.");
        doc.BusinessStatus = request.Decision == "Archive" ? "Archived" : "NeedsSupplement";
        doc.Version = Guid.NewGuid(); doc.UpdatedAt = DateTime.UtcNow;
        var notifications = new List<Notification>();
        if (pending != null)
        {
            pending.Status = request.Decision == "Archive" ? "Archived" : "SupplementRequested";
            pending.DecidedAt = DateTime.UtcNow; pending.DecisionNote = request.Note.Trim();
            notifications.Add(ops.Notify(pending.SubmittedById, request.Decision == "Archive" ? "Văn bản đã lưu tra cứu" : "Văn bản cần bổ sung",
                doc.Subject + (string.IsNullOrWhiteSpace(request.Note) ? "" : ": " + request.Note), documentId: doc.Id));
        }
        ops.Audit(userId, "DecideDocument", "InboxDocument", doc.Id, (request.Decision == "Archive" ? "Lưu tra cứu. " : "Yêu cầu bổ sung. ") + request.Note);
        await ops.CommitAsync(userId, request.RequestId, fingerprint, doc.Id, ct);
        await ops.PublishAsync(notifications, ct);
        return doc.Id;
    }
}
