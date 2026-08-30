using System;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.RatingHistory
{
    public class RatingPeriodTests
    {
        private readonly ApplicationDbContext _context;

        public RatingPeriodTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        [Fact]
        public async Task RatingPeriod_CanBeCreated_AndClosedSuccessfully()
        {
            var period = new RatingPeriod
            {
                Title = "Đánh giá công tác Quý 3/2026",
                PeriodType = "Quarterly",
                Year = 2026,
                Quarter = 3,
                StartDate = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc),
                EndDate = new DateTime(2026, 9, 30, 23, 59, 59, DateTimeKind.Utc),
                IsClosed = false
            };

            _context.RatingPeriods.Add(period);
            await _context.SaveChangesAsync();

            period.Id.Should().NotBeEmpty();
            period.IsClosed.Should().BeFalse();

            // Đóng chu kỳ
            period.IsClosed = true;
            period.ClosedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var saved = await _context.RatingPeriods.FirstOrDefaultAsync(p => p.Id == period.Id);
            saved!.IsClosed.Should().BeTrue();
            saved.ClosedAt.Should().NotBeNull();
        }
    }
}
