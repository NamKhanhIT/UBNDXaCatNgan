using System;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;

namespace Quanlycongviec.Infrastructure.Services
{
    /// <summary>
    /// 07-09-2026: Background service tổng hợp điểm thi đua theo tháng từ RatingHistory + TaskItem.
    /// - Chạy mỗi 15 phút, kiểm tra xem có phải là ngày cuối tháng + 23:45 giờ VN hay không.
    /// - Khi đến giờ: aggregate toàn bộ RatingHistory trong tháng → MonthlyRatingSummary.
    /// - Idempotent: unique index (UserId, Year, Month) cho phép re-aggregate.
    /// Pattern: copy từ TaskReminderBackgroundService (PeriodicTimer, không cần Hangfire NuGet).
    /// </summary>
    public class MonthlyRatingAggregationService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<MonthlyRatingAggregationService> _logger;

        public MonthlyRatingAggregationService(
            IServiceProvider serviceProvider,
            ILogger<MonthlyRatingAggregationService> logger)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("MonthlyRatingAggregationService đã khởi động. Chu kỳ quét: 15 phút.");

            using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));
            while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    var vnTimeZone = GetVnTimeZone();
                    var nowVn = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTimeZone);
                    int daysInMonth = DateTime.DaysInMonth(nowVn.Year, nowVn.Month);

                    // Chạy vào 23:45-23:59 ngày cuối tháng (giờ VN)
                    if (nowVn.Day == daysInMonth && nowVn.Hour == 23 && nowVn.Minute >= 45)
                    {
                        await AggregateMonthAsync(nowVn.Year, nowVn.Month, stoppingToken);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi MonthlyRatingAggregationService");
                }
            }
        }

        /// <summary>
        /// Aggregate tháng cụ thể (public method để test gọi trực tiếp).
        /// </summary>
        public async Task<int> AggregateMonthAsync(int year, int month, CancellationToken cancellationToken)
        {
            using var scope = _serviceProvider.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            // 1. Lấy tất cả TaskItem có RatingHistory trong tháng
            var from = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
            var to = from.AddMonths(1);

            // Lấy các user đã được chấm trong tháng (qua TaskItem.AssigneeId)
            var scoredTasksInMonth = await context.TaskItems
                .AsNoTracking()
                .Where(t => !t.IsDeleted
                            && t.RatingScore.HasValue
                            && t.UpdatedAt.HasValue
                            && t.UpdatedAt.Value >= from
                            && t.UpdatedAt.Value < to)
                .ToListAsync(cancellationToken);

            if (!scoredTasksInMonth.Any())
            {
                _logger.LogInformation("Không có dữ liệu chấm điểm trong tháng {Year}-{Month:D2}.", year, month);
                return 0;
            }

            // 2. Group theo AssigneeId
            var grouped = scoredTasksInMonth
                .GroupBy(t => t.AssigneeId)
                .ToList();

            int processed = 0;
            foreach (var group in grouped)
            {
                var userId = group.Key;
                var tasks = group.ToList();

                double avgSystem = tasks.Where(t => t.SystemScore.HasValue).Any()
                    ? Math.Round(tasks.Where(t => t.SystemScore.HasValue).Average(t => t.SystemScore!.Value), 1)
                    : 0.0;
                double avgEvaluator = tasks.Where(t => t.EvaluatorScore.HasValue).Any()
                    ? Math.Round(tasks.Where(t => t.EvaluatorScore.HasValue).Average(t => t.EvaluatorScore!.Value), 1)
                    : 0.0;
                double avgTotal = Math.Round(avgSystem + avgEvaluator, 1);

                string grade = avgTotal >= 9.0 ? "Hoàn thành xuất sắc"
                    : avgTotal >= 7.5 ? "Hoàn thành tốt"
                    : avgTotal >= 6.0 ? "Hoàn thành"
                    : "Cần cải thiện";

                var existing = await context.MonthlyRatingSummaries
                    .FirstOrDefaultAsync(s => s.UserId == userId && s.Year == year && s.Month == month,
                        cancellationToken);

                if (existing != null)
                {
                    existing.AverageFinalScore = avgTotal;
                    existing.SumSystemScore = Math.Round(avgSystem * tasks.Count, 1);
                    existing.SumEvaluatorScore = Math.Round(avgEvaluator * tasks.Count, 1);
                    existing.TasksEvaluated = tasks.Count;
                    existing.LastEvaluationAt = tasks.Max(t => t.UpdatedAt ?? DateTime.UtcNow);
                    existing.AggregatedAt = DateTime.UtcNow;
                    existing.TierGrade = grade;
                    _context_MarkUpdated(context, existing);
                }
                else
                {
                    var summary = new MonthlyRatingSummary
                    {
                        Id = Guid.NewGuid(),
                        UserId = userId,
                        Year = year,
                        Month = month,
                        AverageFinalScore = avgTotal,
                        SumSystemScore = Math.Round(avgSystem * tasks.Count, 1),
                        SumEvaluatorScore = Math.Round(avgEvaluator * tasks.Count, 1),
                        TasksEvaluated = tasks.Count,
                        LastEvaluationAt = tasks.Max(t => t.UpdatedAt ?? DateTime.UtcNow),
                        AggregatedAt = DateTime.UtcNow,
                        TierGrade = grade,
                        CreatedAt = DateTime.UtcNow,
                        IsDeleted = false
                    };
                    context.MonthlyRatingSummaries.Add(summary);
                }
                processed++;
            }

            await context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation(
                "Đã tổng hợp tháng {Year}-{Month:D2}: {Count} cán bộ, {Tasks} đầu việc.",
                year, month, processed, scoredTasksInMonth.Count);

            return processed;
        }

        private static void _context_MarkUpdated(ApplicationDbContext context, MonthlyRatingSummary entity)
        {
            context.Entry(entity).State = EntityState.Modified;
        }

        private static TimeZoneInfo GetVnTimeZone()
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
            }
            catch
            {
                return TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
            }
        }
    }
}
