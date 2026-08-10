using System;
using Quanlycongviec.Domain.Common;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Domain.Entities
{
    public class OutgoingDocument : BaseEntity
    {
        /// <summary>
        /// Số hiệu chính thức (VD: "45/QĐ-UBND"). Chỉ có giá trị khi Status = Issued.
        /// </summary>
        public string? DocumentNumber { get; set; }

        public DocumentTypeEnum DocumentType { get; set; } = DocumentTypeEnum.CongVan;

        /// <summary>
        /// Trích yếu nội dung văn bản đi
        /// </summary>
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// Nội dung chi tiết văn bản
        /// </summary>
        public string Content { get; set; } = string.Empty;

        public OutgoingDocumentStatusEnum Status { get; set; } = OutgoingDocumentStatusEnum.Draft;

        // ── Thông tin người soạn nháp ──
        public Guid DraftedByUserId { get; set; }
        public DateTime DraftedAt { get; set; } = DateTime.UtcNow;

        // ── Thông tin người ký duyệt ──
        public Guid? SignedByUserId { get; set; }
        public DateTime? SignedAt { get; set; }
        public DateTime? IssuedDate { get; set; }

        /// <summary>
        /// Nơi nhận văn bản (Ngoại xã, Huyện, Công dân, Các phòng ban)
        /// </summary>
        public string? RecipientNote { get; set; }

        public string? AttachmentUrl { get; set; }

        /// <summary>
        /// Liên kết đến TaskItem / InboxDocument làm phát sinh văn bản này (nếu có)
        /// </summary>
        public Guid? RelatedTaskItemId { get; set; }

        /// <summary>
        /// Số thứ tự văn bản (VD: 125). Tách riêng để hỗ trợ sắp xếp và tìm kiếm.
        /// </summary>
        public int? DocumentSequenceNumber { get; set; }

        /// <summary>
        /// Ký hiệu văn bản (VD: "UBND-VP"). Kết hợp với DocumentSequenceNumber tạo "125/UBND-VP".
        /// </summary>
        public string? DocumentSymbol { get; set; }

        public bool IsUrgent { get; set; } = false;

        /// <summary>
        /// Lý do người ký từ chối duyệt (nếu Status = Rejected)
        /// </summary>
        public string? RejectionReason { get; set; }

        // ── Workflow thu hồi văn bản ──
        public string? RecallReason { get; set; }
        public DateTime? RecalledAt { get; set; }
        public Guid? RecalledByUserId { get; set; }

        /// <summary>
        /// Đánh dấu là văn bản đính chính cho 1 văn bản đã ban hành trước đó
        /// </summary>
        public bool IsCorrectionDocument { get; set; } = false;
        public Guid? OriginalDocumentId { get; set; }
    }
}
