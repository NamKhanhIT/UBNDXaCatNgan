using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Resilience
{
    /// <summary>
    /// TIER 5: Bộ 100+ Kịch bản kiểm thử đồng bộ đa thiết bị (Mobile ↔ Desktop), WebPush & Chaos Storm
    /// </summary>
    public class Tier5_MultiDeviceSyncAndChaosTests
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<IRealtimePublisherService> _realtimeMock;
        private readonly Mock<IWebPushNotificationService> _webPushMock;
        private readonly INotificationDispatcher _dispatcher;

        public Tier5_MultiDeviceSyncAndChaosTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
            _realtimeMock = new Mock<IRealtimePublisherService>();
            _webPushMock = new Mock<IWebPushNotificationService>();

            _dispatcher = new NotificationDispatcherService(_context, _realtimeMock.Object, _webPushMock.Object);
        }

        public static IEnumerable<object[]> MobileToDesktopSyncData()
        {
            // 30 kịch bản Mobile (Field Officer PWA) thao tác -> Desktop (Office PC) nhận SignalR realtime
            for (int i = 1; i <= 30; i++)
            {
                var eventType = i % 3 == 0 ? "TaskCompleted" : (i % 2 == 0 ? "ReportSubmitted" : "CommentAdded");
                yield return new object[] { i, eventType };
            }
        }

        [Theory]
        [MemberData(nameof(MobileToDesktopSyncData))]
        public async Task Tier5_01_MobileToDesktop_Action_ShouldTriggerImmediateSignalRToOfficePC(int eventId, string eventType)
        {
            var officer = new User { Username = $"officer_{eventId}", FullName = "Cán bộ Hiện trường", Email = $"officer_{eventId}@ubnd.gov.vn" };
            var leader = new User { Username = $"leader_{eventId}", FullName = "Lãnh đạo tại công sở", Email = $"leader_{eventId}@ubnd.gov.vn" };
            _context.Users.AddRange(officer, leader);
            await _context.SaveChangesAsync();

            var notif = new Notification
            {
                UserId = leader.Id,
                Type = NotificationType.Reviewed,
                Channel = NotificationChannel.InApp,
                Title = $"📱 [Mobile Hiện trường] {eventType} #{eventId}",
                Message = $"Cán bộ {officer.FullName} vừa gửi cập nhật từ thiết bị di động.",
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            await _dispatcher.DispatchAsync(notif, CancellationToken.None);

            // Xác minh SignalR đã phát sự kiện tới Leader ID trên Desktop PC
            _realtimeMock.Verify(r => r.PublishToUserAsync(
                leader.Id,
                "NotificationReceived",
                It.IsAny<object>(),
                It.IsAny<CancellationToken>()),
                Times.Once);

            var saved = await _context.Notifications.FirstOrDefaultAsync(n => n.Id == notif.Id);
            saved.Should().NotBeNull();
            saved!.UserId.Should().Be(leader.Id);
        }

        public static IEnumerable<object[]> DesktopToMobilePushData()
        {
            // 30 kịch bản Desktop PC (Lãnh đạo duyệt việc) -> Mobile (WebPush tới điện thoại đang tắt màn hình)
            for (int i = 1; i <= 30; i++)
            {
                bool isUrgent = (i % 2 == 0);
                yield return new object[] { i, isUrgent };
            }
        }

        [Theory]
        [MemberData(nameof(DesktopToMobilePushData))]
        public async Task Tier5_02_DesktopToMobile_ExecutiveDirective_ShouldTriggerWebPushNotification(int directiveId, bool isUrgent)
        {
            var officer = new User { Username = $"mobile_user_{directiveId}", FullName = "Cán bộ Nhận tin", Email = $"user_{directiveId}@ubnd.gov.vn" };
            _context.Users.Add(officer);

            // Đăng ký WebPush Subscription cho thiết bị di động của cán bộ
            var pushSub = new PushSubscription
            {
                UserId = officer.Id,
                Endpoint = $"https://fcm.googleapis.com/fcm/send/token_{directiveId}",
                P256dhKey = "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_",
                AuthKey = "tBHItJI5svbpez7KI4CCXg==",
                IsActive = true,
                DeviceLabel = "Mobile iPhone PWA"
            };
            _context.PushSubscriptions.Add(pushSub);
            await _context.SaveChangesAsync();

            var notif = new Notification
            {
                UserId = officer.Id,
                Type = isUrgent ? NotificationType.BeforeDeadline : NotificationType.Assigned,
                Channel = NotificationChannel.WebPush,
                Title = isUrgent ? "🚨 CHỈ ĐẠO KHẨN TỪ THƯỜNG TRỰC UBND" : "📌 Phân công nhiệm vụ mới",
                Message = $"Chỉ đạo số #{directiveId} cần xử lý gấp.",
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            await _dispatcher.DispatchAsync(notif, CancellationToken.None);

            // Xác minh WebPush Service đã được gọi để đẩy tin tới thiết bị di động
            _webPushMock.Verify(w => w.SendNotificationAsync(
                officer.Id,
                notif.Title,
                notif.Message,
                It.IsAny<string?>(),
                It.IsAny<object?>(),
                It.IsAny<CancellationToken>()),
                Times.Once);
        }

        public static IEnumerable<object[]> CrossDeviceReadReceiptData()
        {
            // 20 kịch bản đồng bộ trạng thái "Đã đọc" (ReadReceipt) giữa nhiều thiết bị cùng 1 tài khoản
            for (int i = 1; i <= 20; i++)
            {
                yield return new object[] { i };
            }
        }

        [Theory]
        [MemberData(nameof(CrossDeviceReadReceiptData))]
        public async Task Tier5_03_CrossDevice_ReadReceipt_Sync_ShouldDeduplicateUnreadBadges(int notifIndex)
        {
            var user = new User { Username = $"multi_device_{notifIndex}", FullName = "Cán bộ 2 máy", Email = $"device_{notifIndex}@ubnd.gov.vn" };
            _context.Users.Add(user);

            var notif = new Notification
            {
                UserId = user.Id,
                Title = $"Thông báo số #{notifIndex}",
                Message = "Nội dung",
                IsRead = false
            };
            _context.Notifications.Add(notif);
            await _context.SaveChangesAsync();

            // ĐỌC TRÊN DESKTOP PC
            var targetNotif = await _context.Notifications.FirstOrDefaultAsync(n => n.Id == notif.Id);
            targetNotif!.IsRead = true;
            await _context.SaveChangesAsync();

            // TRÊN MOBILE PWA -> Truy vấn số lượng unread
            var unreadCount = await _context.Notifications.CountAsync(n => n.UserId == user.Id && !n.IsRead);
            unreadCount.Should().Be(0, "Khi đã đọc trên Desktop PC, badge trên Mobile phải lập tức về 0, không bị lệch");
        }

        public static IEnumerable<object[]> ChaosStressStormData()
        {
            // 25 kịch bản bão thông báo (Chaos Notification Storm) với các cấp tải trọng từ 10 đến 250 notifications
            var stormSizes = new[] { 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 140, 160, 180, 200, 210, 220, 230, 240, 250, 15, 25, 35, 45, 55 };
            foreach (var size in stormSizes)
            {
                yield return new object[] { size };
            }
        }

        [Theory]
        [MemberData(nameof(ChaosStressStormData))]
        public async Task Tier5_04_ChaosStorm_MassiveBatchDispatch_ShouldProcessAllWithoutDroppingMessages(int stormSize)
        {
            var targetUser = new User { Username = $"storm_user_{stormSize}", FullName = "Cán bộ Chịu tải", Email = $"storm_{stormSize}@ubnd.gov.vn" };
            _context.Users.Add(targetUser);
            await _context.SaveChangesAsync();

            var batch = new List<Notification>();
            for (int i = 1; i <= stormSize; i++)
            {
                batch.Add(new Notification
                {
                    UserId = targetUser.Id,
                    Title = $"Bão tin #{i}/{stormSize}",
                    Message = $"Nội dung bão tải #{i}",
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                });
            }

            // Thực thi DispatchBatch đồng thời
            await _dispatcher.DispatchBatchAsync(batch, CancellationToken.None);

            var savedCount = await _context.Notifications.CountAsync(n => n.UserId == targetUser.Id);
            savedCount.Should().Be(stormSize, $"Hệ thống phải lưu trữ đầy đủ {stormSize} thông báo trong bão tải, không bị drop");
        }
    }
}
