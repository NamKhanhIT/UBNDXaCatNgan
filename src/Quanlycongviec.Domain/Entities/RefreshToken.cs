using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    // Entity lưu Refresh Token (chỉ lưu SHA-256 hash, không lưu token thô)
    public class RefreshToken : BaseEntity
    {
        public Guid UserId { get; set; }
        public User? User { get; set; }

        // SHA-256 hash (hex) của token thô
        public string TokenHash { get; set; } = string.Empty;

        public DateTime ExpiresUtc { get; set; }
        public DateTime CreatedUtc { get; set; }
        public DateTime? RevokedUtc { get; set; }

        // Hash của refresh token mới khi token này bị xoay vòng (rotation)
        public string? ReplacedByTokenHash { get; set; }
    }
}