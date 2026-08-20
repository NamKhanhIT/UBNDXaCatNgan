using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    /// <summary>
    /// Refresh token — dùng để cấp lại access token (thời hạn ngắn) mà không cần đăng nhập lại.
    /// Chỉ lưu SHA-256 hash của token, không lưu token thô.
    /// </summary>
    public class RefreshToken : BaseEntity
    {
        public Guid UserId { get; set; }
        public User? User { get; set; }

        /// <summary>SHA-256 hash (hex) của token thô — tuyệt đối không lưu token thô</summary>
        public string TokenHash { get; set; } = string.Empty;

        public DateTime ExpiresUtc { get; set; }
        public DateTime CreatedUtc { get; set; }
        public DateTime? RevokedUtc { get; set; }

        /// <summary>Hash của refresh token mới khi token này bị xoay vòng (rotation)</summary>
        public string? ReplacedByTokenHash { get; set; }
    }
}