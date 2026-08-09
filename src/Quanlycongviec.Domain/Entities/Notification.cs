using System;
using Quanlycongviec.Domain.Common;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Domain.Entities
{
    public class Notification : BaseEntity
    {
        public Guid UserId { get; set; }
        public User? User { get; set; }

        public Guid? TaskItemId { get; set; }
        public TaskItem? TaskItem { get; set; }

        public NotificationType Type { get; set; }
        public NotificationChannel Channel { get; set; } = NotificationChannel.InApp;

        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;

        public DateTime? SentAt { get; set; }
        public DateTime? ReadAt { get; set; }
        public bool IsRead { get; set; } = false;
    }
}
