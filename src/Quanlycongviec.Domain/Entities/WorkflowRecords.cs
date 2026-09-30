using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities;

public class TaskDocumentLink : BaseEntity
{
    public Guid TaskItemId { get; set; }
    public TaskItem TaskItem { get; set; } = null!;
    public Guid? InboxDocumentId { get; set; }
    public InboxDocument? InboxDocument { get; set; }
    public Guid? OutgoingDocumentId { get; set; }
    public OutgoingDocument? OutgoingDocument { get; set; }
}

public class TaskSubmission : BaseEntity
{
    public Guid TaskItemId { get; set; }
    public TaskItem TaskItem { get; set; } = null!;
    public Guid SubmittedById { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTime? SubmittedAt { get; set; }
    public DateTime? DueDateAtSubmission { get; set; }
    public bool IsLegacy { get; set; }
    public string Decision { get; set; } = "Pending";
    public Guid? ReviewedById { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewNote { get; set; }
    public ICollection<TaskSubmissionAttachment> Attachments { get; set; } = new List<TaskSubmissionAttachment>();
}

public class TaskSubmissionAttachment : BaseEntity
{
    public Guid SubmissionId { get; set; }
    public TaskSubmission Submission { get; set; } = null!;
    public Guid AttachmentId { get; set; }
    public DocumentAttachment Attachment { get; set; } = null!;
}

public class TaskWorkflowChange : BaseEntity
{
    public Guid TaskItemId { get; set; }
    public TaskItem TaskItem { get; set; } = null!;
    public Guid UserId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? Reason { get; set; }
}

public class DocumentPresentation : BaseEntity
{
    public Guid InboxDocumentId { get; set; }
    public InboxDocument InboxDocument { get; set; } = null!;
    public Guid SubmittedById { get; set; }
    public Guid RecipientId { get; set; }
    public string Note { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending";
    public string? DecisionNote { get; set; }
    public DateTime? DecidedAt { get; set; }
}

public class WorkflowPermission : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;
    public bool CanReceiveDocuments { get; set; }
    public bool CanManageWorkflowPermissions { get; set; }
    public Guid? UpdatedById { get; set; }
    public Guid Version { get; set; } = Guid.NewGuid();
}

// The actor and request key identify a logical operation across network retries.
public class WorkflowRequest : BaseEntity
{
    public Guid UserId { get; set; }
    public Guid RequestId { get; set; }
    public string Fingerprint { get; set; } = string.Empty;
    public Guid ResultId { get; set; }
}
