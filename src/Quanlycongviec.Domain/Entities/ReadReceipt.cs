using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    /// <summary>
    /// Xác nhận "đã xem" — tracking lãnh đạo biết cán bộ đã đọc chỉ đạo hay chưa.
    /// Mỗi (UserId, TargetEntityType, TargetEntityId) là duy nhất.
    /// </summary>
    public class ReadReceipt : BaseEntity
    {
        public Guid UserId { get; set; }
        public User? User { get; set; }

        /// <summary>
        /// Loại entity: "Task", "Notification", "InboxDocument"
        /// </summary>
        public string TargetEntityType { get; set; } = string.Empty;
        public string TargetEntityId { get; set; } = string.Empty;

        public DateTime ReadAt { get; set; } = DateTime.UtcNow;
    }
}
