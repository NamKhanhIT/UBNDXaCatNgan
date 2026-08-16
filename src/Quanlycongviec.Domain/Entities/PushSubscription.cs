using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class PushSubscription : BaseEntity
    {
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        /// <summary>
        /// Push service endpoint URL do trình duyệt cấp
        /// </summary>
        public string Endpoint { get; set; } = string.Empty;

        /// <summary>
        /// Khóa công khai p256dh của client (dùng để mã hóa payload)
        /// </summary>
        public string P256dhKey { get; set; } = string.Empty;

        /// <summary>
        /// Chuỗi xác thực auth của client (dùng để mã hóa payload)
        /// </summary>
        public string AuthKey { get; set; } = string.Empty;

        /// <summary>
        /// Nhãn thiết bị tùy chọn (ví dụ: "iPhone PWA của anh Nam", "Chrome trên Windows", etc.)
        /// </summary>
        public string? DeviceLabel { get; set; }

        /// <summary>
        /// Thời điểm gần nhất thông báo đẩy được gửi thành công tới thiết bị này
        /// </summary>
        public DateTime? LastUsedAt { get; set; }

        /// <summary>
        /// Trạng thái hoạt động của subscription
        /// </summary>
        public bool IsActive { get; set; } = true;
    }
}
