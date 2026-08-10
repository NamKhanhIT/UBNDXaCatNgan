using System;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.RatingHistory.DTOs
{
    public class RatingHistoryDto
    {
        public Guid Id { get; set; }
        public Guid TaskItemId { get; set; }
        public string TaskItemTitle { get; set; } = string.Empty;
        
        public double? OldScore { get; set; }
        public double NewScore { get; set; }
        public double ScoreDelta { get; set; }

        public Guid ChangedByUserId { get; set; }
        public string ChangedByUserName { get; set; } = string.Empty;
        public string ChangedByUserRoleName { get; set; } = string.Empty;
        public DateTime ChangedAt { get; set; }

        public string Reason { get; set; } = string.Empty;
        public string EvidenceUrl { get; set; } = string.Empty;

        public RatingApprovalStatusEnum ApprovalStatus { get; set; }
        public string ApprovalStatusName { get; set; } = string.Empty;

        public Guid? ApprovedByUserId { get; set; }
        public string? ApprovedByUserName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? RejectionReason { get; set; }
    }

    public class SubmitRatingRevisionDto
    {
        public double NewScore { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string EvidenceUrl { get; set; } = string.Empty;
    }

    public class RejectRatingRevisionDto
    {
        public string RejectionReason { get; set; } = string.Empty;
    }
}
