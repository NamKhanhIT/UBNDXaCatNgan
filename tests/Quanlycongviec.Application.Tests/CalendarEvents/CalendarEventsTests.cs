using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.CalendarEvents.Commands.CreateCalendarEvent;
using Quanlycongviec.Application.Features.CalendarEvents.Queries.GetCalendarEvents;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.CalendarEvents
{
    public class CalendarEventsTests
    {
        private ApplicationDbContext GetInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new ApplicationDbContext(options);
        }

        [Fact]
        public async Task GetCalendarEvents_ShouldReturnSpanningMultiDayEvents()
        {
            // Arrange
            using var context = GetInMemoryDbContext();
            var organizer = new User { Id = Guid.NewGuid(), FullName = "Nguyễn Văn A", Username = "user_a", PasswordHash = "hash" };
            context.Users.Add(organizer);

            // Sự kiện 3 ngày: từ 10/08 đến 13/08
            var evt = new CalendarEvent
            {
                Id = Guid.NewGuid(),
                Title = "Đại hội chi bộ xã Cát Ngạn",
                Description = "Đại hội tổng kết nhiệm kỳ 3 ngày",
                EventType = EventTypeEnum.Conference,
                StartDateTime = new DateTime(2026, 8, 10, 8, 0, 0, DateTimeKind.Utc),
                EndDateTime = new DateTime(2026, 8, 13, 17, 0, 0, DateTimeKind.Utc),
                IsAllDay = true,
                OrganizerId = organizer.Id,
                IsDeleted = false
            };
            context.CalendarEvents.Add(evt);
            await context.SaveChangesAsync();

            var handler = new GetCalendarEventsQueryHandler(context);

            // Query khoảng ngày giao ở giữa (ví dụ: ngày 11/08 - 12/08)
            var query = new GetCalendarEventsQuery
            {
                From = new DateTime(2026, 8, 11, 0, 0, 0, DateTimeKind.Utc),
                To = new DateTime(2026, 8, 12, 23, 59, 59, DateTimeKind.Utc)
            };

            // Act
            var result = await handler.Handle(query, CancellationToken.None);

            // Assert
            Assert.Single(result);
            Assert.Equal("Đại hội chi bộ xã Cát Ngạn", result[0].Title);
            Assert.Equal("Hội nghị / Đại hội", result[0].EventTypeName);
        }

        [Fact]
        public async Task CreateCalendarEvent_ShouldAddDefault30MinReminderOffset()
        {
            // Arrange
            using var context = GetInMemoryDbContext();
            var organizer = new User { Id = Guid.NewGuid(), FullName = "Trần Văn B", Username = "user_b", PasswordHash = "hash" };
            context.Users.Add(organizer);
            await context.SaveChangesAsync();

            var handler = new CreateCalendarEventCommandHandler(context);
            var command = new CreateCalendarEventCommand
            {
                Title = "Họp triển khai công tác tháng 8",
                EventType = EventTypeEnum.Meeting,
                StartDateTime = DateTime.UtcNow.AddDays(1),
                EndDateTime = DateTime.UtcNow.AddDays(1).AddHours(2),
                OrganizerId = organizer.Id,
                ReminderOffsetsMinutes = new List<int>() // Rỗng -> Mặc định 30 phút
            };

            // Act
            var eventId = await handler.Handle(command, CancellationToken.None);

            // Assert
            var createdEvt = await context.CalendarEvents
                .Include(e => e.ReminderOffsets)
                .FirstOrDefaultAsync(e => e.Id == eventId);

            Assert.NotNull(createdEvt);
            Assert.Single(createdEvt.ReminderOffsets);
            Assert.Equal(30, createdEvt.ReminderOffsets.First().MinutesBefore);
        }
    }
}
