using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Services
{
    /// <summary>
    /// 10-09-2026: Unit tests cho MonthlyRatingAggregationService.
    /// Tests idempotency, multi-user, empty-data edge cases.
    /// Note: TaskItems must have RatingScore set (simulates UpdateTaskStatusCommand behavior).
    /// </summary>
    public class MonthlyRatingAggregationServiceTests
    {
        private readonly DbContextOptions<ApplicationDbContext> _dbOptions;

        public MonthlyRatingAggregationServiceTests()
        {
            _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
        }

        /// <summary>
        /// Builds a minimal IServiceProvider so that AggregateMonthAsync (which uses
        /// CreateScope().ServiceProvider.GetRequiredService&lt;ApplicationDbContext&gt;) can resolve
        /// the shared context instance passed in.
        /// </summary>
        private IServiceProvider BuildServiceProvider(ApplicationDbContext context)
        {
            // A scoped provider that always returns the same context instance
            var scopedServices = new ServiceCollection();
            scopedServices.AddScoped(_ => context);
            var scopedSp = scopedServices.BuildServiceProvider();

            // Mock scope → returns the scoped provider
            var scopeMock = new Mock<IServiceScope>();
            scopeMock.Setup(s => s.ServiceProvider).Returns(scopedSp);

            // Mock scope factory → each CreateScope() call returns our mock scope
            var scopeFactoryMock = new Mock<IServiceScopeFactory>();
            scopeFactoryMock.Setup(f => f.CreateScope()).Returns(scopeMock.Object);

            // Root provider → returns the scope factory and logger
            var rootServices = new ServiceCollection();
            rootServices.AddSingleton(scopeFactoryMock.Object);
            rootServices.AddSingleton(Mock.Of<ILogger<MonthlyRatingAggregationService>>());
            var rootSp = rootServices.BuildServiceProvider();

            // Primary provider mock → forwards scope-factory and logger requests
            var primaryMock = new Mock<IServiceProvider>();
            primaryMock.Setup(p => p.GetService(typeof(IServiceScopeFactory)))
                .Returns(scopeFactoryMock.Object);
            primaryMock.Setup(p => p.GetService(typeof(ILogger<MonthlyRatingAggregationService>)))
                .Returns(Mock.Of<ILogger<MonthlyRatingAggregationService>>());

            return primaryMock.Object;
        }

        private MonthlyRatingAggregationService BuildService(ApplicationDbContext context)
            => new MonthlyRatingAggregationService(
                BuildServiceProvider(context),
                Mock.Of<ILogger<MonthlyRatingAggregationService>>());

        // ── Test 1: 3 tasks → creates correct summary ────────────────────────

        [Fact]
        public async Task AggregateMonth_WithThreeRatedTasks_CreatesCorrectSummary()
        {
            await using var context = new ApplicationDbContext(_dbOptions);

            var userId = Guid.NewGuid();
            var now = DateTime.UtcNow;
            var month = now.Month;
            var year = now.Year;

            // Task scores: System=3.0/3.5/4.0, Evaluator=6.0/6.5/7.0
            // avgSystem = 3.5, avgEvaluator = 6.5, avgTotal = 10.0
            for (int i = 0; i < 3; i++)
            {
                var sys = 3.0 + i * 0.5;
                var ev = 6.0 + i * 0.5;
                context.TaskItems.Add(new TaskItem
                {
                    Id = Guid.NewGuid(),
                    Title = $"Task {i}",
                    AssigneeId = userId,
                    Status = Domain.Enums.TaskStatusEnum.Completed,
                    CreatedAt = now.AddDays(-10),
                    UpdatedAt = now.AddDays(-i),
                    SystemScore = sys,
                    EvaluatorScore = ev,
                    RatingScore = Math.Round(sys + ev, 1),
                    IsDeleted = false
                });
            }
            await context.SaveChangesAsync();

            var service = BuildService(context);
            var processed = await service.AggregateMonthAsync(year, month, CancellationToken.None);

            processed.Should().Be(1);

            var summaries = await context.MonthlyRatingSummaries.ToListAsync();
            summaries.Should().HaveCount(1);
            var s = summaries[0];
            s.UserId.Should().Be(userId);
            s.Year.Should().Be(year);
            s.Month.Should().Be(month);
            s.TasksEvaluated.Should().Be(3);
            // avgSystem=3.5, avgEvaluator=6.5, avgTotal=10.0 → ≥9 "Hoàn thành xuất sắc"
            s.TierGrade.Should().Be("Hoàn thành xuất sắc");
            s.AverageFinalScore.Should().Be(10.0);
            s.SumSystemScore.Should().Be(10.5); // 3.5 * 3
            s.SumEvaluatorScore.Should().Be(19.5); // 6.5 * 3
        }

        // ── Test 2: Re-aggregate same month → updates existing (idempotent) ──

        [Fact]
        public async Task AggregateMonth_ReAggregateSameMonth_UpdatesExistingSummary()
        {
            await using var context = new ApplicationDbContext(_dbOptions);

            var userId = Guid.NewGuid();
            var now = DateTime.UtcNow;
            var month = now.Month;
            var year = now.Year;

            // Pre-existing summary from a previous run
            var existing = new MonthlyRatingSummary
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Year = year,
                Month = month,
                AverageFinalScore = 5.0,
                SumSystemScore = 10.0,
                SumEvaluatorScore = 0.0,
                TasksEvaluated = 2,
                TierGrade = "Cần cải thiện",
                LastEvaluationAt = now.AddDays(-5),
                AggregatedAt = now.AddDays(-5),
                CreatedAt = now.AddDays(-5),
                IsDeleted = false
            };
            context.MonthlyRatingSummaries.Add(existing);
            await context.SaveChangesAsync();

            // 3 new tasks rated in the same month
            for (int i = 0; i < 3; i++)
            {
                context.TaskItems.Add(new TaskItem
                {
                    Id = Guid.NewGuid(),
                    Title = $"Task {i}",
                    AssigneeId = userId,
                    Status = Domain.Enums.TaskStatusEnum.Completed,
                    CreatedAt = now.AddDays(-10),
                    UpdatedAt = now.AddDays(-i),
                    SystemScore = 3.5,
                    EvaluatorScore = 6.5,
                    RatingScore = 10.0,
                    IsDeleted = false
                });
            }
            await context.SaveChangesAsync();

            var service = BuildService(context);
            var processed = await service.AggregateMonthAsync(year, month, CancellationToken.None);

            processed.Should().Be(1);

            var summaries = await context.MonthlyRatingSummaries.ToListAsync();
            summaries.Should().HaveCount(1); // No new record
            summaries[0].Id.Should().Be(existing.Id); // Same record updated
            summaries[0].TasksEvaluated.Should().Be(3);
            summaries[0].TierGrade.Should().Be("Hoàn thành xuất sắc");
            summaries[0].AggregatedAt.Should().BeOnOrAfter(existing.AggregatedAt);
        }

        // ── Test 3: Month with no data → returns 0 ───────────────────────────

        [Fact]
        public async Task AggregateMonth_WithNoRatedTasks_ReturnsZero()
        {
            await using var context = new ApplicationDbContext(_dbOptions);

            // Task exists but has no RatingScore
            context.TaskItems.Add(new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Unscored Task",
                AssigneeId = Guid.NewGuid(),
                Status = Domain.Enums.TaskStatusEnum.Completed,
                CreatedAt = DateTime.UtcNow,
                IsDeleted = false
                // RatingScore = null (implicit)
            });
            await context.SaveChangesAsync();

            var service = BuildService(context);
            var processed = await service.AggregateMonthAsync(2099, 12, CancellationToken.None);

            processed.Should().Be(0);
            (await context.MonthlyRatingSummaries.AnyAsync()).Should().BeFalse();
        }

        // ── Test 4: Multiple users → one summary per user ─────────────────────

        [Fact]
        public async Task AggregateMonth_MultipleUsers_CreatesOneSummaryPerUser()
        {
            await using var context = new ApplicationDbContext(_dbOptions);

            var user1 = Guid.NewGuid();
            var user2 = Guid.NewGuid();
            var user3 = Guid.NewGuid();
            var now = DateTime.UtcNow;
            var month = now.Month;
            var year = now.Year;

            foreach (var uid in new[] { user1, user2, user3 })
            {
                context.TaskItems.Add(new TaskItem
                {
                    Id = Guid.NewGuid(),
                    Title = $"Task for {uid}",
                    AssigneeId = uid,
                    Status = Domain.Enums.TaskStatusEnum.Completed,
                    CreatedAt = now.AddDays(-5),
                    UpdatedAt = now.AddDays(-1),
                    SystemScore = 4.0,
                    EvaluatorScore = 5.0,
                    RatingScore = 9.0,
                    IsDeleted = false
                });
            }
            await context.SaveChangesAsync();

            var service = BuildService(context);
            var processed = await service.AggregateMonthAsync(year, month, CancellationToken.None);

            processed.Should().Be(3);

            var summaries = await context.MonthlyRatingSummaries.OrderBy(s => s.UserId).ToListAsync();
            summaries.Should().HaveCount(3);
            summaries.Select(s => s.UserId).Should().BeEquivalentTo(new[] { user1, user2, user3 });
            summaries.All(s => s.TasksEvaluated == 1).Should().BeTrue();
            // 4+5=9.0 ≥ 9.0 → "Hoàn thành xuất sắc"
            summaries.All(s => s.TierGrade == "Hoàn thành xuất sắc").Should().BeTrue();
        }

        // ── Test 5: Deleted tasks excluded from aggregation ──────────────────

        [Fact]
        public async Task AggregateMonth_DeletedTasks_AreExcluded()
        {
            await using var context = new ApplicationDbContext(_dbOptions);

            var userId = Guid.NewGuid();
            var now = DateTime.UtcNow;
            var month = now.Month;
            var year = now.Year;

            // Rated task — should be included
            context.TaskItems.Add(new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Active Task",
                AssigneeId = userId,
                Status = Domain.Enums.TaskStatusEnum.Completed,
                CreatedAt = now.AddDays(-5),
                UpdatedAt = now.AddDays(-1),
                SystemScore = 3.0,
                EvaluatorScore = 5.0,
                RatingScore = 8.0,
                IsDeleted = false
            });

            // Deleted rated task — should be excluded
            context.TaskItems.Add(new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Deleted Task",
                AssigneeId = userId,
                Status = Domain.Enums.TaskStatusEnum.Completed,
                CreatedAt = now.AddDays(-5),
                UpdatedAt = now.AddDays(-1),
                SystemScore = 5.0,
                EvaluatorScore = 5.0,
                RatingScore = 10.0,
                IsDeleted = true
            });

            await context.SaveChangesAsync();

            var service = BuildService(context);
            var processed = await service.AggregateMonthAsync(year, month, CancellationToken.None);

            processed.Should().Be(1);

            var summaries = await context.MonthlyRatingSummaries.ToListAsync();
            summaries.Should().HaveCount(1);
            summaries[0].TasksEvaluated.Should().Be(1);
            summaries[0].AverageFinalScore.Should().Be(8.0); // Only the active task
        }
    }
}
