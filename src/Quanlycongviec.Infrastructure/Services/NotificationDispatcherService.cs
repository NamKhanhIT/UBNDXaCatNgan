using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
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
            }
            catch
            {
                // Non-blocking nếu SignalR gặp trục trặc tạm thời
            }

            // 3. Đẩy WebPush tới người dùng
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

        public async Task DispatchBatchAsync(IEnumerable<Notification> notifications, CancellationToken cancellationToken = default)
        {
            if (notifications == null || !notifications.Any()) return;

            foreach (var notif in notifications)
            {
                await DispatchAsync(notif, cancellationToken);
            }
        }
    }
}
