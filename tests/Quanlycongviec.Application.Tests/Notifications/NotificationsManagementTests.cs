using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Quanlycongviec.Application.Common.Models;
using Quanlycongviec.Application.Features.Notifications.Commands.MarkRead;
using Quanlycongviec.Application.Features.Notifications.Queries.GetMyNotifications;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Hubs;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Notifications
{
    public class NotificationsManagementTests
    {
        private readonly DbContextOptions<ApplicationDbContext> _dbOptions;

        public NotificationsManagementTests()
        {
            _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
        }

        [Fact]
        public async Task GetMyNotifications_ShouldReturnCorrectItemsAndUnreadCount()
        {
            // Arrange
            using var context = new ApplicationDbContext(_dbOptions);
            var userId = Guid.NewGuid();
            var otherUserId = Guid.NewGuid();

            var notif1 = new Notification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Title = "Nhiệm vụ mới được giao",
                Message = "Đồng chí được phân công xử lý văn bản số 45/UBND",
                Type = NotificationType.Assigned,
                Channel = NotificationChannel.InApp,
                IsRead = false,
                SentAt = DateTime.UtcNow.AddMinutes(-10),
                CreatedAt = DateTime.UtcNow.AddMinutes(-10)
            };

            var notif2 = new Notification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Title = "Báo cáo đã được duyệt",
                Message = "Chủ tịch UBND đã nghiệm thu báo cáo tháng 8",
                Type = NotificationType.Reviewed,
                Channel = NotificationChannel.InApp,
                IsRead = true,
                ReadAt = DateTime.UtcNow.AddMinutes(-5),
                SentAt = DateTime.UtcNow.AddHours(-1),
                CreatedAt = DateTime.UtcNow.AddHours(-1)
            };

            var otherNotif = new Notification
            {
                Id = Guid.NewGuid(),
                UserId = otherUserId,
                Title = "Thông báo cán bộ khác",
                Message = "Không thuộc về user hiện tại",
                Type = NotificationType.EventReminder,
                Channel = NotificationChannel.InApp,
                IsRead = false,
                SentAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };

            context.Notifications.AddRange(notif1, notif2, otherNotif);
            await context.SaveChangesAsync();

            var handler = new GetMyNotificationsQueryHandler(context);
            var query = new GetMyNotificationsQuery(userId, page: 1, pageSize: 20);

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Items.Should().HaveCount(2);
            result.TotalCount.Should().Be(2);
            result.UnreadCount.Should().Be(1);
            result.Items.First().Title.Should().Be("Nhiệm vụ mới được giao");
            result.Items.First().IsRead.Should().BeFalse();
        }

        [Fact]
        public async Task MarkNotificationRead_ShouldMarkSpecificNotificationAsRead()
        {
            // Arrange
            using var context = new ApplicationDbContext(_dbOptions);
            var userId = Guid.NewGuid();

            var notif = new Notification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Title = "Nhắc nhở hạn chót",
                Message = "Nhiệm vụ sắp đến hạn hôm nay",
                Type = NotificationType.BeforeDeadline1d,
                Channel = NotificationChannel.InApp,
                IsRead = false,
                SentAt = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow
            };

            context.Notifications.Add(notif);
            await context.SaveChangesAsync();

            var handler = new MarkNotificationReadCommandHandler(context);
            var command = new MarkNotificationReadCommand(userId, new List<Guid> { notif.Id });

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            var updatedNotif = await context.Notifications.FindAsync(notif.Id);
            updatedNotif.Should().NotBeNull();
            updatedNotif!.IsRead.Should().BeTrue();
            updatedNotif.ReadAt.Should().NotBeNull();
        }

        [Fact]
        public async Task MarkAllNotificationsRead_ShouldMarkAllUserNotificationsAsRead()
        {
            // Arrange
            using var context = new ApplicationDbContext(_dbOptions);
            var userId = Guid.NewGuid();
            var otherUserId = Guid.NewGuid();

            var notifs = new List<Notification>
            {
                new Notification { Id = Guid.NewGuid(), UserId = userId, Title = "TB1", Message = "M1", Type = NotificationType.EventReminder, Channel = NotificationChannel.InApp, IsRead = false, CreatedAt = DateTime.UtcNow },
                new Notification { Id = Guid.NewGuid(), UserId = userId, Title = "TB2", Message = "M2", Type = NotificationType.EventReminder, Channel = NotificationChannel.InApp, IsRead = false, CreatedAt = DateTime.UtcNow },
                new Notification { Id = Guid.NewGuid(), UserId = otherUserId, Title = "TB3 Khác", Message = "M3", Type = NotificationType.EventReminder, Channel = NotificationChannel.InApp, IsRead = false, CreatedAt = DateTime.UtcNow }
            };

            context.Notifications.AddRange(notifs);
            await context.SaveChangesAsync();

            var handler = new MarkNotificationReadCommandHandler(context);
            var command = new MarkNotificationReadCommand(userId, markAllAsRead: true);

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            var userNotifs = await context.Notifications.Where(n => n.UserId == userId).ToListAsync();
            userNotifs.Should().OnlyContain(n => n.IsRead == true && n.ReadAt != null);

            var otherNotif = await context.Notifications.FindAsync(notifs[2].Id);
            otherNotif!.IsRead.Should().BeFalse(); // Không bị ảnh hưởng
        }

        [Fact]
        public async Task RealtimePublisherService_ShouldBroadcastEventWithValidEnvelope()
        {
            // Arrange
            var hubContextMock = new Mock<IHubContext<NotificationHub>>();
            var clientsMock = new Mock<IHubClients>();
            var clientProxyMock = new Mock<IClientProxy>();

            clientsMock.Setup(c => c.All).Returns(clientProxyMock.Object);
            hubContextMock.Setup(h => h.Clients).Returns(clientsMock.Object);

            var publisher = new RealtimePublisherService(
                hubContextMock.Object,
                NullLogger<RealtimePublisherService>.Instance);

            var payload = new { TaskId = Guid.NewGuid(), Title = "Kiểm tra hệ thống thời gian thực" };

            // Act
            await publisher.BroadcastAsync("TaskUpdated", payload);

            // Assert
            clientProxyMock.Verify(
                c => c.SendCoreAsync(
                    "TaskUpdated",
                    It.Is<object[]>(args =>
                        args.Length == 1 &&
                        args[0] != null
                    ),
                    default),
                Times.Once);
        }

        [Fact]
        public async Task RealtimePublisherService_ShouldPublishToSpecificUser()
        {
            // Arrange
            var hubContextMock = new Mock<IHubContext<NotificationHub>>();
            var clientsMock = new Mock<IHubClients>();
            var clientProxyMock = new Mock<IClientProxy>();
            var targetUserId = Guid.NewGuid();

            clientsMock.Setup(c => c.User(targetUserId.ToString())).Returns(clientProxyMock.Object);
            hubContextMock.Setup(h => h.Clients).Returns(clientsMock.Object);

            var publisher = new RealtimePublisherService(
                hubContextMock.Object,
                NullLogger<RealtimePublisherService>.Instance);

            var payload = new { NotificationId = Guid.NewGuid(), Content = "Thông báo giao việc" };

            // Act
            await publisher.PublishToUserAsync(targetUserId, "ReceiveNotification", payload);

            // Assert
            clientsMock.Verify(c => c.User(targetUserId.ToString()), Times.Once);
            clientProxyMock.Verify(
                c => c.SendCoreAsync(
                    "ReceiveNotification",
                    It.Is<object[]>(args =>
                        args.Length == 1 &&
                        args[0] != null
                    ),
                    default),
                Times.Once);
        }
    }
}
