using System;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.TaskAnnotations.DTOs
{
    public class TaskReviewAnnotationDto
    {
        public Guid Id { get; set; }
        public Guid TaskItemId { get; set; }
        public string AnchorText { get; set; } = string.Empty;
        public int? StartOffsetHint { get; set; }
        public string CommentText { get; set; } = string.Empty;
        public AnnotationSeverityEnum Severity { get; set; }
        public string SeverityName { get; set; } = string.Empty;
        public Guid CreatedByUserId { get; set; }
        public string CreatedByUserName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public AnnotationStatusEnum ResolvedStatus { get; set; }
        public string ResolvedStatusName { get; set; } = string.Empty;
        public Guid? ResolvedByUserId { get; set; }
        public string? ResolvedByUserName { get; set; }
        public DateTime? ResolvedAt { get; set; }
    }
}
