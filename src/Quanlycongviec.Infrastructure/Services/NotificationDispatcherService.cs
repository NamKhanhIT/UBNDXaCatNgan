using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Infrastructure.Services
{
    public class NotificationDispatcherService : INotificationDispatcher
    {
        private readonly IApplicationDbContext _context;
        private readonly IRealtimePublisherService _realtimePublisher;
        private readonly IWebPushNotificationService _webPushService;

        public NotificationDispatcherService(
            IApplicationDbContext context,
            IRealtimePublisherService realtimePublisher,
            IWebPushNotificationService webPushService)
        {
            _context = context;
            _realtimePublisher = realtimePublisher;
            _webPushService = webPushService;
        }

        public async Task DispatchAsync(Notification notification, CancellationToken cancellationToken = default)
        {
            if (notification == null) return;

            // 1. Lưu thông báo vào CSDL
            _context.Notifications.Add(notification);
            await _context.SaveChangesAsync(cancellationToken);

            // 2. Bắn SignalR realtime đến người nhận
            try
            {
                await _realtimePublisher.PublishToUserAsync(
                    notification.UserId,
                    "NotificationReceived",
                    new
                    {
                        id = notification.Id,
                        title = notification.Title,
                        message = notification.Message,
                        type = notification.Type.ToString(),
                        taskItemId = notification.TaskItemId,
                        sentAt = notification.SentAt
                    },
                    cancellationToken);

                await _realtimePublisher.PublishToUserAsync(
                    notification.UserId,
                    "ReceiveNotification",
                    new
                    {
                        id = notification.Id,
                        userId = notification.UserId,
                        taskItemId = notification.TaskItemId,
                        calendarEventId = notification.CalendarEventId,
                        type = notification.Type.ToString(),
                        channel = notification.Channel.ToString(),
                        title = notification.Title,
                        message = notification.Message,
                        createdAt = notification.CreatedAt,
                        isRead = notification.IsRead
                    },
                    cancellationToken);
            }
            catch
            {
                // Non-blocking nếu SignalR gặp trục trặc tạm thời
            }

            // 3. Đẩy WebPush tới người dùng
            if (await ShouldSendWebPushAsync(notification, cancellationToken))
            {
                try
                {
                    await _webPushService.SendNotificationAsync(
                        notification.UserId,
                        notification.Title,
                        notification.Message,
                        cancellationToken: cancellationToken);
                }
                catch
                {
                    // Non-blocking
                }
            }
        }

        public async Task DispatchBatchAsync(IEnumerable<Notification> notifications, CancellationToken cancellationToken = default)
        {
            if (notifications == null || !notifications.Any()) return;

            foreach (var notif in notifications)
            {
                await DispatchAsync(notif, cancellationToken);
            }
        }

        private async Task<bool> ShouldSendWebPushAsync(
            Notification notification,
            CancellationToken cancellationToken)
        {
            var preferences = await _context.Users
                .AsNoTracking()
                .Where(u => u.Id == notification.UserId && !u.IsDeleted)
                .Select(u => u.NotificationPreferences)
                .FirstOrDefaultAsync(cancellationToken);

            if (string.IsNullOrWhiteSpace(preferences)) return true;

            try
            {
                using var document = JsonDocument.Parse(preferences);
                var root = document.RootElement;

                if (root.TryGetProperty("channelWebPush", out var channel)
                    && channel.ValueKind == JsonValueKind.False)
                {
                    return false;
                }

                var eventKey = notification.Type switch
                {
                    Domain.Enums.NotificationType.Assigned => "notifyNewTask",
                    Domain.Enums.NotificationType.BeforeDeadline
                        or Domain.Enums.NotificationType.BeforeDeadline48h
                        or Domain.Enums.NotificationType.BeforeDeadline1d
                        or Domain.Enums.NotificationType.BeforeDeadline3d
                        or Domain.Enums.NotificationType.Overdue
                        or Domain.Enums.NotificationType.Escalation => "notifyDeadline",
                    Domain.Enums.NotificationType.Reviewed => "notifyApproval",
                    Domain.Enums.NotificationType.WeeklySummary => "notifyDailyDigest",
                    _ => null
                };

                return eventKey == null
                    || !root.TryGetProperty(eventKey, out var enabled)
                    || enabled.ValueKind != JsonValueKind.False;
            }
            catch (JsonException)
            {
                return true;
            }
        }
    }
}
