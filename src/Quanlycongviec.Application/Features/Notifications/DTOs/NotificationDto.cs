using System;

namespace Quanlycongviec.Application.Features.Notifications.DTOs
{
    public class NotificationDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public Guid? TaskItemId { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Channel { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? SentAt { get; set; }
        public DateTime? ReadAt { get; set; }
        public bool IsRead { get; set; }
    }

    public class UserNotificationsVm
    {
        public System.Collections.Generic.List<NotificationDto> Items { get; set; } = new();
        public int UnreadCount { get; set; }
        public int TotalCount { get; set; }
    }
}
