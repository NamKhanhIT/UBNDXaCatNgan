using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.CreateOutgoingDocument;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.UpdateOutgoingDocument;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.SignAndIssue;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Common.Services;

public sealed class OutgoingDocumentWorkflow(IApplicationDbContext db, INotificationDispatcher? dispatcher = null)
{
    public async Task<Guid> CreateAsync(CreateOutgoingDocumentCommand request, CancellationToken ct)
    {
        var access = new WorkflowAccess(db);
        var actor = await access.ActorAsync(request.DraftedByUserId, ct) ?? throw new UnauthorizedAccessException();
        var ops = new WorkflowOperations(db, dispatcher);
        var fingerprint = WorkflowOperations.Fingerprint("CreateOutgoingDocument", request);
        var replay = await ops.ReplayAsync(actor.Id, request.RequestId, fingerprint, ct);
        if (replay.HasValue) return replay.Value;
        Validate(request.Title, request.DocumentType, request.ResponseDeadline);
        if (request.OriginalDocumentId.HasValue && !await access.Outgoing(actor).AnyAsync(d => d.Id == request.OriginalDocumentId, ct))
            throw new UnauthorizedAccessException("Văn bản gốc nằm ngoài quyền truy cập.");
        var doc = new OutgoingDocument { Title = request.Title.Trim(), Content = request.Content ?? "", DocumentType = request.DocumentType,
            DraftedByUserId = actor.Id, RecipientNote = request.RecipientNote, IsUrgent = request.IsUrgent,
            IsCorrectionDocument = request.IsCorrectionDocument, OriginalDocumentId = request.OriginalDocumentId,
            DestinationLevel = request.DestinationLevel, AutoCreateTask = false, SecurityLevel = request.SecurityLevel,
            UrgencyLevel = request.UrgencyLevel, ResponseDeadline = request.ResponseDeadline };
        db.OutgoingDocuments.Add(doc);
        await LinkTaskAsync(actor, doc.Id, request.RelatedTaskItemId, ct);
        ops.Audit(actor.Id, "CreateOutgoingDocument", "OutgoingDocument", doc.Id, "Soạn văn bản đi: " + doc.Title);
        return await ops.CommitAsync(actor.Id, request.RequestId, fingerprint, doc.Id, ct);
    }

    public async Task<bool> EditAsync(UpdateOutgoingDocumentCommand request, CancellationToken ct)
    {
        var access = new WorkflowAccess(db);
        var actor = await access.ActorAsync(request.UserId, ct) ?? throw new UnauthorizedAccessException();
        var ops = new WorkflowOperations(db, dispatcher);
        var fingerprint = WorkflowOperations.Fingerprint("UpdateOutgoingDocument", request);
        if (await ops.ReplayAsync(actor.Id, request.RequestId, fingerprint, ct) != null) return true;
        var doc = await access.Outgoing(actor).FirstOrDefaultAsync(d => d.Id == request.Id, ct);
        if (doc == null || doc.DraftedByUserId != actor.Id) throw new UnauthorizedAccessException("Chỉ người soạn được sửa văn bản của mình.");
        WorkflowOperations.CheckVersion(doc.Version, request.Version);
        if (doc.Status != OutgoingDocumentStatusEnum.Draft && doc.Status != OutgoingDocumentStatusEnum.Rejected)
            throw new WorkflowConflictException("Văn bản đã trình ký hoặc ban hành không được chỉnh sửa trực tiếp.");
        Validate(request.Title, request.DocumentType, request.ResponseDeadline);
        await LinkTaskAsync(actor, doc.Id, request.RelatedTaskItemId, ct);
        await SaveSnapshotAsync(doc, actor.Id, "Chỉnh sửa bản nháp", ct);
        doc.Title = request.Title.Trim(); doc.Content = request.Content ?? ""; doc.DocumentType = request.DocumentType;
        doc.RecipientNote = request.RecipientNote; doc.IsUrgent = request.IsUrgent; doc.DestinationLevel = request.DestinationLevel;
        doc.AutoCreateTask = false; doc.SecurityLevel = request.SecurityLevel; doc.UrgencyLevel = request.UrgencyLevel;
        doc.ResponseDeadline = request.ResponseDeadline; doc.Version = Guid.NewGuid(); doc.UpdatedAt = DateTime.UtcNow;
        ops.Audit(actor.Id, "UpdateOutgoingDocument", "OutgoingDocument", doc.Id, "Chỉnh sửa văn bản: " + doc.Title);
        await ops.CommitAsync(actor.Id, request.RequestId, fingerprint, doc.Id, ct);
        return true;
    }

    public async Task<Guid> ActAsync(Guid actorId, Guid documentId, string action, OutgoingActionInput request, CancellationToken ct)
    {
        var access = new WorkflowAccess(db);
        var actor = await access.ActorAsync(actorId, ct) ?? throw new UnauthorizedAccessException();
        var ops = new WorkflowOperations(db, dispatcher);
        var fingerprint = WorkflowOperations.Fingerprint("OutgoingAction", new { documentId, action, request });
        var replay = await ops.ReplayAsync(actorId, request.RequestId, fingerprint, ct);
        if (replay.HasValue) return replay.Value;
        var doc = await access.Outgoing(actor).FirstOrDefaultAsync(d => d.Id == documentId, ct)
            ?? throw new UnauthorizedAccessException("Không tìm thấy văn bản trong phạm vi quyền.");
        WorkflowOperations.CheckVersion(doc.Version, request.Version);
        var notifications = new List<Notification>();
        if (action == "submit")
        {
            if (doc.DraftedByUserId != actor.Id) throw new UnauthorizedAccessException("Chỉ người soạn được trình ký.");
            if (doc.Status != OutgoingDocumentStatusEnum.Draft && doc.Status != OutgoingDocumentStatusEnum.Rejected)
                throw new WorkflowConflictException("Văn bản không còn ở bước soạn hoặc yêu cầu chỉnh sửa.");
            doc.Status = OutgoingDocumentStatusEnum.PendingSignature; doc.RejectionReason = null;
        }
        else if (action == "revoke")
        {
            if (doc.DraftedByUserId != actor.Id) throw new UnauthorizedAccessException("Chỉ người soạn được thu hồi bản trình ký.");
            if (doc.Status != OutgoingDocumentStatusEnum.PendingSignature) throw new WorkflowConflictException("Văn bản không còn chờ ký.");
            doc.Status = OutgoingDocumentStatusEnum.Draft;
        }
        else if (action == "sign" || action == "reject")
        {
            if (actor.Rank > 2) throw new UnauthorizedAccessException("Không có thẩm quyền ký hoặc hoàn trả văn bản.");
            if (doc.Status != OutgoingDocumentStatusEnum.PendingSignature) throw new WorkflowConflictException("Văn bản không còn chờ ký.");
            if (action == "reject")
            {
                if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Vui lòng ghi yêu cầu chỉnh sửa.");
                doc.Status = OutgoingDocumentStatusEnum.Rejected; doc.RejectionReason = request.Reason.Trim();
            }
            else await IssueAsync(doc, actor.Id, ct);
            var notification = new Notification { UserId = doc.DraftedByUserId, Type = NotificationType.Reviewed, OutgoingDocumentId = doc.Id,
                Title = action == "sign" ? "Văn bản đã phát hành" : "Văn bản cần chỉnh sửa", Message = doc.Title + (request.Reason == null ? "" : ": " + request.Reason),
                RequiresRealtimeDelivery = true };
            db.Notifications.Add(notification); notifications.Add(notification);
        }
        else if (action == "recall" || action == "cancel")
        {
            if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Lý do thu hồi hoặc hủy là bắt buộc.");
            if (doc.Status == OutgoingDocumentStatusEnum.Cancelled || doc.Status == OutgoingDocumentStatusEnum.Recalled)
                throw new WorkflowConflictException("Văn bản đã kết thúc.");
            var issued = doc.Status == OutgoingDocumentStatusEnum.Issued || doc.Status == OutgoingDocumentStatusEnum.Sent;
            if (action == "recall" && !issued) throw new WorkflowConflictException("Chỉ thu hồi văn bản đã ban hành hoặc đã gửi.");
            if (issued ? actor.Rank > 2 : doc.DraftedByUserId != actor.Id)
                throw new UnauthorizedAccessException("Không có quyền thu hồi hoặc hủy văn bản này.");
            if (issued) await SaveSnapshotAsync(doc, actor.Id, request.Reason, ct);
            doc.Status = action == "recall" ? OutgoingDocumentStatusEnum.Recalled : OutgoingDocumentStatusEnum.Cancelled;
            doc.RecallReason = request.Reason.Trim(); doc.RecalledAt = DateTime.UtcNow; doc.RecalledByUserId = actor.Id;
            var notification = new Notification { UserId = doc.DraftedByUserId, OutgoingDocumentId = doc.Id,
                Type = NotificationType.Reviewed, Title = action == "recall" ? "Văn bản đã thu hồi" : "Văn bản đã hủy",
                Message = doc.Title + ": " + request.Reason, RequiresRealtimeDelivery = true };
            db.Notifications.Add(notification); notifications.Add(notification);
        }
        else throw new ArgumentException("Thao tác văn bản không hợp lệ.");
        doc.Version = Guid.NewGuid(); doc.UpdatedAt = DateTime.UtcNow;
        var label = action switch { "submit" => "Trình ký", "revoke" => "Thu hồi về nháp", "sign" => "Ký phát hành", "recall" => "Thu hồi văn bản", "cancel" => "Hủy văn bản", _ => "Yêu cầu chỉnh sửa" };
        ops.Audit(actor.Id, "OutgoingDocument:" + action, "OutgoingDocument", doc.Id, label + ": " + doc.Title + (request.Reason == null ? "" : ". " + request.Reason));
        try { await ops.CommitAsync(actor.Id, request.RequestId, fingerprint, doc.Id, ct); }
        catch (DbUpdateException) when (action == "sign")
        {
            throw new WorkflowConflictException("Văn bản hoặc sổ cấp số vừa thay đổi. Vui lòng tải lại và xác nhận phát hành.");
        }
        await ops.PublishAsync(notifications, ct);
        return doc.Id;
    }

    public async Task<Guid> SaveVersionAsync(Guid actorId, Guid documentId, OutgoingActionInput request, string title, string content, CancellationToken ct)
    {
        var access = new WorkflowAccess(db);
        var actor = await access.ActorAsync(actorId, ct) ?? throw new UnauthorizedAccessException();
        var ops = new WorkflowOperations(db, dispatcher);
        var fingerprint = WorkflowOperations.Fingerprint("OutgoingVersion", new { documentId, request, title, content });
        var replay = await ops.ReplayAsync(actorId, request.RequestId, fingerprint, ct);
        if (replay.HasValue) return replay.Value;
        var doc = await access.Outgoing(actor).FirstOrDefaultAsync(d => d.Id == documentId, ct);
        if (doc == null || doc.DraftedByUserId != actorId) throw new UnauthorizedAccessException("Chỉ người soạn được lưu phiên bản nháp.");
        WorkflowOperations.CheckVersion(doc.Version, request.Version);
        if (doc.Status != OutgoingDocumentStatusEnum.Draft && doc.Status != OutgoingDocumentStatusEnum.Rejected)
            throw new WorkflowConflictException("Không sửa nội dung văn bản đã phát hành. Hãy soạn văn bản đính chính riêng.");
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Vui lòng ghi lý do lưu phiên bản.");
        var snapshot = await SaveSnapshotAsync(doc, actorId, request.Reason, ct);
        if (!string.IsNullOrWhiteSpace(title)) doc.Title = title.Trim();
        if (!string.IsNullOrWhiteSpace(content)) doc.Content = content;
        doc.Version = Guid.NewGuid(); doc.UpdatedAt = DateTime.UtcNow;
        ops.Audit(actorId, "CREATE_VERSION", "OutgoingDocument", documentId, request.Reason);
        return await ops.CommitAsync(actorId, request.RequestId, fingerprint, snapshot.Id, ct);
    }

    private async Task<DocumentVersion> SaveSnapshotAsync(OutgoingDocument doc, Guid actorId, string reason, CancellationToken ct)
    {
        var number = (await db.DocumentVersions.Where(v => v.DocumentId == doc.Id && v.TargetType == "Outgoing").MaxAsync(v => (int?)v.VersionNumber, ct) ?? 0) + 1;
        var snapshot = new DocumentVersion { DocumentId = doc.Id, TargetType = "Outgoing", VersionNumber = number,
            VersionName = "Phiên bản " + number, Title = doc.Title, Content = doc.Content, DocumentNumber = doc.DocumentNumber,
            DocumentSymbol = doc.DocumentSymbol, AttachmentUrl = doc.AttachmentUrl, ChangeReason = reason,
            ChangedByUserId = actorId, ChangedAt = DateTime.UtcNow };
        db.DocumentVersions.Add(snapshot);
        return snapshot;
    }

    private async Task LinkTaskAsync(WorkflowActor actor, Guid documentId, Guid? taskId, CancellationToken ct)
    {
        if (!taskId.HasValue) return;
        if (await db.TaskDocumentLinks.AnyAsync(l => l.OutgoingDocumentId == documentId && l.TaskItemId == taskId && !l.IsDeleted, ct)) return;
        var access = new WorkflowAccess(db);
        var task = await access.Tasks(actor).FirstOrDefaultAsync(t => t.Id == taskId, ct)
            ?? throw new UnauthorizedAccessException("Không được liên kết công việc ngoài quyền truy cập.");
        if ((task.Status != TaskStatusEnum.Todo && task.Status != TaskStatusEnum.InProgress)
            || (task.AssigneeId != actor.Id && !await access.CanManageTaskAsync(actor, task, ct)))
            throw new UnauthorizedAccessException("Không có quyền bổ sung văn bản cho công việc này.");
        var existing = await db.TaskDocumentLinks.FirstOrDefaultAsync(l => l.OutgoingDocumentId == documentId && l.TaskItemId == taskId, ct);
        if (existing == null) db.TaskDocumentLinks.Add(new TaskDocumentLink { TaskItemId = task.Id, OutgoingDocumentId = documentId });
        else existing.IsDeleted = false;
        task.Version = Guid.NewGuid();
    }

    private async Task IssueAsync(OutgoingDocument doc, Guid actorId, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var year = now.AddHours(7).Year;
        var symbol = SignAndIssueOutgoingDocumentCommandHandler.GetTypeAbbreviation(doc.DocumentType) + "-UBND";
        var sequence = await db.DocumentNumberSequences.FirstOrDefaultAsync(s => s.Year == year && s.Symbol == symbol, ct);
        if (sequence == null)
        {
            var yearStart = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddHours(-7);
            var yearEnd = yearStart.AddYears(1);
            var issued = db.OutgoingDocuments.Where(d => d.DocumentType == doc.DocumentType && d.IssuedDate >= yearStart && d.IssuedDate < yearEnd);
            if (await issued.AnyAsync(d => !d.DocumentSequenceNumber.HasValue, ct))
                throw new WorkflowConflictException("Cần đối chiếu sổ cấp số văn bản cũ trước khi phát hành thêm.");
            sequence = new DocumentNumberSequence { Year = year, Symbol = symbol,
                CurrentNumber = await issued.MaxAsync(d => (int?)d.DocumentSequenceNumber, ct) ?? 0 };
            db.DocumentNumberSequences.Add(sequence);
        }
        sequence.CurrentNumber++; sequence.UpdatedAt = now;
        doc.DocumentNumber = $"{sequence.CurrentNumber:D2}/{symbol}"; doc.DocumentSequenceNumber = sequence.CurrentNumber; doc.DocumentSymbol = symbol;
        doc.Status = OutgoingDocumentStatusEnum.Issued; doc.SignedByUserId = actorId; doc.SignedAt = now; doc.IssuedDate = now;
    }

    private static void Validate(string title, DocumentTypeEnum type, DateTime? due)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Trích yếu văn bản không được để trống.");
        if (!Enum.IsDefined(type)) throw new ArgumentException("Loại văn bản không hợp lệ.");
        if (due.HasValue) WorkflowOperations.Utc(due.Value);
    }
}

public sealed class OutgoingActionInput
{
    public Guid RequestId { get; set; }
    public Guid? Version { get; set; }
    public string? Reason { get; set; }
}
