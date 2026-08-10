using System;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.DTOs
{
    public class OutgoingDocumentDto
    {
        public Guid Id { get; set; }
        public string? DocumentNumber { get; set; }
        public DocumentTypeEnum DocumentType { get; set; }
        public string DocumentTypeName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public OutgoingDocumentStatusEnum Status { get; set; }
        public string StatusName { get; set; } = string.Empty;

        public Guid DraftedByUserId { get; set; }
        public string DraftedByUserName { get; set; } = string.Empty;
        public DateTime DraftedAt { get; set; }

        public Guid? SignedByUserId { get; set; }
        public string? SignedByUserName { get; set; }
        public DateTime? SignedAt { get; set; }
        public DateTime? IssuedDate { get; set; }

        public string? RecipientNote { get; set; }
        public string? AttachmentUrl { get; set; }
        public Guid? RelatedTaskItemId { get; set; }
        public bool IsUrgent { get; set; }
        public string? RejectionReason { get; set; }

        public bool IsCorrectionDocument { get; set; }
        public Guid? OriginalDocumentId { get; set; }

        public int? DocumentSequenceNumber { get; set; }
        public string? DocumentSymbol { get; set; }
        public string? RecallReason { get; set; }
        public DateTime? RecalledAt { get; set; }
    }
}
