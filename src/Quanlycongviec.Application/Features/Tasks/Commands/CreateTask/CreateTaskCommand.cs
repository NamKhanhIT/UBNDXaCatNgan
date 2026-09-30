using System;
using MediatR;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Commands.CreateTask
{
    public class CreateTaskCommand : IRequest<Guid>
    {
        public Guid RequestId { get; set; }
        public Guid? ReviewerId { get; set; }
        public Guid? ParentTaskId { get; set; }
        public Guid? ParentVersion { get; set; }
        public List<WorkflowDocumentReference> Documents { get; set; } = new();
        public List<CoordinationTaskInput> CoordinationTasks { get; set; } = new();
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Requirements { get; set; }
        public Guid AssignerId { get; set; }
        public Guid AssigneeId { get; set; }
        public Guid? DepartmentId { get; set; }
        public TaskPriority Priority { get; set; } = TaskPriority.Medium;
        public TaskType Type { get; set; } = TaskType.BAU;
        // Legacy compatibility only. New clients must omit this field.
        public double? EstimatedEffortHours { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? DueDate { get; set; }
        public string? OCRText { get; set; }
        public string? DocumentUrl { get; set; }
        public bool IsDelegatedAction { get; set; } = false;
    }

    public sealed class WorkflowDocumentReference
    {
        public Guid Id { get; set; }
        public string Kind { get; set; } = "Inbox";
        public Guid? Version { get; set; }
    }

    public sealed class CoordinationTaskInput
    {
        public string Title { get; set; } = string.Empty;
        public string Requirements { get; set; } = string.Empty;
        public Guid AssigneeId { get; set; }
        public DateTime? DueDate { get; set; }
    }
}
