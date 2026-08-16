using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Application.Features.PushNotifications.Commands.SendTestPush;
using Quanlycongviec.Application.Features.PushNotifications.Commands.SubscribePush;
using Quanlycongviec.Application.Features.PushNotifications.Commands.UnsubscribePush;
using Quanlycongviec.Application.Features.PushNotifications.Queries.GetMyPushSubscriptions;
using Quanlycongviec.Application.Features.PushNotifications.Queries.GetVapidPublicKey;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.PushNotifications
{
    public class WebPushNotificationTests
    {
        private readonly ApplicationDbContext _context;

        public WebPushNotificationTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        [Fact]
        public async Task SubscribePush_NewEndpoint_ShouldCreateActiveSubscription()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var handler = new SubscribePushCommandHandler(_context);
            var command = new SubscribePushCommand
            {
                UserId = userId,
                Endpoint = "https://fcm.googleapis.com/fcm/send/device-token-123",
                P256dhKey = "test_p256dh_key_base64",
                AuthKey = "test_auth_key_base64",
                DeviceLabel = "Chrome trên Windows 11"
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.UserId.Should().Be(userId);
            result.Endpoint.Should().Be(command.Endpoint);
            result.DeviceLabel.Should().Be("Chrome trên Windows 11");
            result.IsActive.Should().BeTrue();

            var inDb = await _context.PushSubscriptions.FirstOrDefaultAsync(s => s.Endpoint == command.Endpoint);
            inDb.Should().NotBeNull();
            inDb!.IsActive.Should().BeTrue();
        }

        [Fact]
        public async Task SubscribePush_ExistingEndpoint_ShouldUpdateSubscriptionAndKeepActive()
        {
            // Arrange
            var userId1 = Guid.NewGuid();
            var userId2 = Guid.NewGuid();
            var endpoint = "https://fcm.googleapis.com/fcm/send/device-token-abc";

            var existing = new PushSubscription
            {
                Id = Guid.NewGuid(),
                UserId = userId1,
                Endpoint = endpoint,
                P256dhKey = "old_key",
                AuthKey = "old_auth",
                DeviceLabel = "Thiết bị cũ",
                IsActive = false,
                CreatedAt = DateTime.UtcNow.AddDays(-5)
            };
            _context.PushSubscriptions.Add(existing);
            await _context.SaveChangesAsync();

            var handler = new SubscribePushCommandHandler(_context);
            var command = new SubscribePushCommand
            {
                UserId = userId2,
                Endpoint = endpoint,
                P256dhKey = "new_p256dh_key",
                AuthKey = "new_auth_key",
                DeviceLabel = "iPhone 15 PWA"
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Id.Should().Be(existing.Id);
            result.UserId.Should().Be(userId2);
            result.DeviceLabel.Should().Be("iPhone 15 PWA");
            result.IsActive.Should().BeTrue();

            var count = await _context.PushSubscriptions.CountAsync(s => s.Endpoint == endpoint);
            count.Should().Be(1);
        }

        [Fact]
        public async Task UnsubscribePush_ByEndpoint_ShouldDeactivateSubscription()
        {
            // Arrange
            var userId = Guid.NewGuid();
            var endpoint = "https://fcm.googleapis.com/fcm/send/device-token-to-remove";

            var sub = new PushSubscription
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Endpoint = endpoint,
                P256dhKey = "k",
                AuthKey = "a",
                IsActive = true
            };
            _context.PushSubscriptions.Add(sub);
            await _context.SaveChangesAsync();

            var handler = new UnsubscribePushCommandHandler(_context);
            var command = new UnsubscribePushCommand
            {
                UserId = userId,
                Endpoint = endpoint
            };

            // Act
            var success = await handler.Handle(command, CancellationToken.None);

            // Assert
            success.Should().BeTrue();
            var inDb = await _context.PushSubscriptions.FindAsync(sub.Id);
            inDb!.IsActive.Should().BeFalse();
        }

        [Fact]
        public async Task GetMyPushSubscriptions_ShouldReturnOnlyActiveSubscriptionsForUser()
        {
            // Arrange
            var user1 = Guid.NewGuid();
            var user2 = Guid.NewGuid();

            _context.PushSubscriptions.AddRange(
                new PushSubscription { Id = Guid.NewGuid(), UserId = user1, Endpoint = "ep1", P256dhKey = "k1", AuthKey = "a1", DeviceLabel = "Laptop", IsActive = true },
                new PushSubscription { Id = Guid.NewGuid(), UserId = user1, Endpoint = "ep2", P256dhKey = "k2", AuthKey = "a2", DeviceLabel = "Điện thoại cũ", IsActive = false },
                new PushSubscription { Id = Guid.NewGuid(), UserId = user2, Endpoint = "ep3", P256dhKey = "k3", AuthKey = "a3", DeviceLabel = "User2 Tablet", IsActive = true }
            );
            await _context.SaveChangesAsync();

            var handler = new GetMyPushSubscriptionsQueryHandler(_context);

            // Act
            var result = await handler.Handle(new GetMyPushSubscriptionsQuery(user1), CancellationToken.None);

            // Assert
            result.Should().HaveCount(1);
            result[0].Endpoint.Should().Be("ep1");
            result[0].DeviceLabel.Should().Be("Laptop");
        }

        [Fact]
        public async Task GetVapidPublicKey_ShouldReturnConfiguredKey()
        {
            // Arrange
            var mockService = new Mock<IWebPushNotificationService>();
            mockService.Setup(s => s.GetVapidPublicKey()).Returns("TEST_VAPID_PUBLIC_KEY_123");

            var handler = new GetVapidPublicKeyQueryHandler(mockService.Object);

            // Act
            var key = await handler.Handle(new GetVapidPublicKeyQuery(), CancellationToken.None);

            // Assert
            key.Should().Be("TEST_VAPID_PUBLIC_KEY_123");
        }

        [Fact]
        public async Task SendTestPush_ShouldInvokeServiceSuccessfully()
        {
            // Arrange
            var mockService = new Mock<IWebPushNotificationService>();
            var userId = Guid.NewGuid();
            var endpoint = "https://fcm.googleapis.com/fcm/send/sample";

            mockService.Setup(s => s.SendTestNotificationAsync(userId, endpoint, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var handler = new SendTestPushCommandHandler(mockService.Object);

            // Act
            var result = await handler.Handle(new SendTestPushCommand { UserId = userId, Endpoint = endpoint }, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            mockService.Verify(s => s.SendTestNotificationAsync(userId, endpoint, It.IsAny<CancellationToken>()), Times.Once);
        }

        [Fact]
        public void WebPushService_GetVapidPublicKey_ShouldReturnValidString()
        {
            // Arrange
            var options = Options.Create(new WebPushOptions
            {
                PublicKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U",
                PrivateKey = "UU224Yug2No0EP8v5Y34q9_75yYc5-j_rP90xYk2-K0",
                Subject = "mailto:admin@catngan.gov.vn"
            });

            var configMock = new Mock<IConfiguration>();
            var service = new WebPushNotificationService(_context, options, configMock.Object, NullLogger<WebPushNotificationService>.Instance);

            // Act
            var key = service.GetVapidPublicKey();

            // Assert
            key.Should().NotBeNullOrWhiteSpace();
            key.Should().Be("BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U");
        }
    }
}
