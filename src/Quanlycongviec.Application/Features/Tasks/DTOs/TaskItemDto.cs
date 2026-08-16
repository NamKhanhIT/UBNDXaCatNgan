using System;

namespace Quanlycongviec.Application.Features.Tasks.DTOs
{
    public class TaskItemDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public Guid AssignerId { get; set; }
        public string AssignerName { get; set; } = string.Empty;
        public Guid AssigneeId { get; set; }
        public string AssigneeName { get; set; } = string.Empty;
        public Guid? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public string Priority { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public double EstimatedEffortHours { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? DueDate { get; set; }
        public DateTime? CompletedAt { get; set; }

        public string? SubmissionNote { get; set; }
        public double? SystemScore { get; set; }
        public double? EvaluatorScore { get; set; }
        public double? RatingScore { get; set; }
        public string? RejectionReason { get; set; }
        public bool IsEscalated { get; set; }
        public int OpenAnnotationCount { get; set; }
        public int TotalAnnotationCount { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
