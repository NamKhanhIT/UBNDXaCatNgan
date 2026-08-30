using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Features.RatingHistory.Queries.GetActiveRatingPeriod
{
    public record RatingPeriodDto(
        Guid Id,
        string Title,
        string PeriodType,
        int Year,
        int? Quarter,
        int? Month,
        DateTime StartDate,
        DateTime EndDate,
        bool IsClosed
    );

    public record GetActiveRatingPeriodQuery : IRequest<RatingPeriodDto?>;

    public class GetActiveRatingPeriodQueryHandler : IRequestHandler<GetActiveRatingPeriodQuery, RatingPeriodDto?>
    {
        private readonly IApplicationDbContext _context;

        public GetActiveRatingPeriodQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<RatingPeriodDto?> Handle(GetActiveRatingPeriodQuery request, CancellationToken cancellationToken)
        {
            var now = DateTime.UtcNow;
            var period = await _context.RatingPeriods
                .Where(p => !p.IsClosed && p.StartDate <= now && p.EndDate >= now)
                .OrderByDescending(p => p.StartDate)
                .FirstOrDefaultAsync(cancellationToken);

            if (period == null)
            {
                // Nếu chưa có kỳ nào trong DB, tự động tạo kỳ quý hiện tại mặc định
                int currentYear = now.Year;
                int currentQuarter = (now.Month - 1) / 3 + 1;
                var startDate = new DateTime(currentYear, (currentQuarter - 1) * 3 + 1, 1, 0, 0, 0, DateTimeKind.Utc);
                var endDate = startDate.AddMonths(3).AddSeconds(-1);

                period = new RatingPeriod
                {
                    Title = $"Đánh giá công tác Quý {currentQuarter}/{currentYear}",
                    PeriodType = "Quarterly",
                    Year = currentYear,
                    Quarter = currentQuarter,
                    StartDate = startDate,
                    EndDate = endDate,
                    IsClosed = false
                };

                _context.RatingPeriods.Add(period);
                await _context.SaveChangesAsync(cancellationToken);
            }

            return new RatingPeriodDto(
                period.Id,
                period.Title,
                period.PeriodType,
                period.Year,
                period.Quarter,
                period.Month,
                period.StartDate,
                period.EndDate,
                period.IsClosed
            );
        }
    }
}
