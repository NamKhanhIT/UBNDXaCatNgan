using System;

namespace Quanlycongviec.Application.Features.PushNotifications.DTOs
{
    public class PushSubscriptionDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Endpoint { get; set; } = string.Empty;
        public string? DeviceLabel { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastUsedAt { get; set; }
        public bool IsActive { get; set; }
    }
}
