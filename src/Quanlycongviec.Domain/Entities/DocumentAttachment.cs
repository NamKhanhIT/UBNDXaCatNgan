using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    /// <summary>
    /// Bảng quản lý nhiều file đính kèm (Văn bản chính, Phụ lục, Bản scan ký số, Tài liệu kèm theo)
    /// Hỗ trợ cả văn bản đến (Inbox) và văn bản đi (Outgoing)
    /// </summary>
    public class DocumentAttachment : BaseEntity
    {
        /// <summary>
        /// ID của văn bản liên quan (InboxDocumentId hoặc OutgoingDocumentId)
        /// </summary>
        public Guid DocumentId { get; set; }

        /// <summary>
        /// Phân loại loại văn bản liên kết ("Inbox" | "Outgoing")
        /// </summary>
        public string TargetType { get; set; } = "Inbox";

        /// <summary>
        /// Tên file lưu trên hệ thống / storage
        /// </summary>
        public string FileName { get; set; } = string.Empty;

        /// <summary>
        /// Tên file gốc người dùng tải lên
        /// </summary>
        public string OriginalFileName { get; set; } = string.Empty;

        /// <summary>
        /// Đường dẫn lưu trữ (tối ưu đường dẫn tương đối để bảo mật)
        /// </summary>
        public string FilePath { get; set; } = string.Empty;

        /// <summary>
        /// Định dạng file (VD: "pdf", "docx", "xlsx", "png", "jpg")
        /// </summary>
        public string FileType { get; set; } = "pdf";

        /// <summary>
        /// Dung lượng file tính bằng bytes
        /// </summary>
        public long FileSize { get; set; }

        /// <summary>
        /// Phân loại tài liệu đính kèm ("MainDocument" | "Appendix" | "SignedScan" | "AttachedRef")
        /// </summary>
        public string AttachmentType { get; set; } = "MainDocument";

        /// <summary>
        /// Đánh dấu là văn bản chính
        /// </summary>
        public bool IsMainDocument { get; set; } = false;

        /// <summary>
        /// Thời điểm tải lên
        /// </summary>
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Người tải lên
        /// </summary>
        public Guid UploadedByUserId { get; set; }
    }
}
