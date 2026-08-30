using System;
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

namespace Quanlycongviec.Application.Tests.Notifications
{
    public class NotificationDispatchTests
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<IRealtimePublisherService> _realtimeMock;
        private readonly Mock<IWebPushNotificationService> _webPushMock;
        private readonly INotificationDispatcher _dispatcher;

        public NotificationDispatchTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
            _realtimeMock = new Mock<IRealtimePublisherService>();
            _webPushMock = new Mock<IWebPushNotificationService>();

            _dispatcher = new NotificationDispatcherService(_context, _realtimeMock.Object, _webPushMock.Object);
        }

        [Fact]
        public async Task DispatchAsync_ShouldSaveNotification_AndCallRealtimePublisher()
        {
            var user = new User
            {
                Username = "nam",
                FullName = "Nguyễn Văn Nam",
                Email = "nam@ubnd.gov.vn"
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var notification = new Notification
            {
                UserId = user.Id,
                Type = NotificationType.Assigned,
                Channel = NotificationChannel.InApp,
                Title = "Nhiệm vụ mới",
                Message = "Bạn được phân công nhiệm vụ mới.",
                SentAt = DateTime.UtcNow,
                IsRead = false
            };

            await _dispatcher.DispatchAsync(notification, CancellationToken.None);

            var saved = await _context.Notifications.FirstOrDefaultAsync(n => n.UserId == user.Id);
            saved.Should().NotBeNull();
            saved!.Title.Should().Be("Nhiệm vụ mới");

            _realtimeMock.Verify(r => r.PublishToUserAsync(user.Id, "NotificationReceived", It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
