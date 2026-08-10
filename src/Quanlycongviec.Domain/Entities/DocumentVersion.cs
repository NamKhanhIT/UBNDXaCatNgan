using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    /// <summary>
    /// Bảng quản lý lịch sử phiên bản văn bản (NĐ 30/2020)
    /// Đảm bảo văn bản sau khi phát hành không được sửa trực tiếp mà phải tạo phiên bản đính chính / thay thế.
    /// </summary>
    public class DocumentVersion : BaseEntity
    {
        public Guid DocumentId { get; set; }
        public string TargetType { get; set; } = "Outgoing"; // "Outgoing" | "Inbox"

        public int VersionNumber { get; set; } = 1;
        public string VersionName { get; set; } = "Phiên bản gốc";

        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? DocumentNumber { get; set; }
        public string? DocumentSymbol { get; set; }

        public string? AttachmentUrl { get; set; }
        public string ChangeReason { get; set; } = string.Empty;

        public Guid ChangedByUserId { get; set; }
        public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
    }
}
