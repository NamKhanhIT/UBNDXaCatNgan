namespace Quanlycongviec.Application.Features.Tasks.DTOs;

public sealed class SubmissionDetailDto
{
    public Guid Id { get; set; }
    public Guid SubmittedById { get; set; }
    public string Note { get; set; } = string.Empty;
    public DateTime? SubmittedAt { get; set; }
    public DateTime? DueDateAtSubmission { get; set; }
    public bool IsLegacy { get; set; }
    public bool? WasLate { get; set; }
    public string Decision { get; set; } = string.Empty;
    public string? ReviewNote { get; set; }
    public Guid? ReviewedById { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public List<SubmissionFileDto> Files { get; set; } = new();
}

public sealed class SubmissionFileDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public long Size { get; set; }
}

public sealed class LinkedDocumentDto
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Number { get; set; } = string.Empty;
}

public sealed class WorkflowChangeDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string? Reason { get; set; }
    public DateTime CreatedAt { get; set; }
}
