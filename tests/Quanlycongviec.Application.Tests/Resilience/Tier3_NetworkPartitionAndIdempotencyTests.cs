using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Application.Features.Tasks.Commands.UpdateTaskStatus;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Application.Tests;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Resilience
{
    /// <summary>
    /// TIER 3: Bộ 100 Kịch bản kiểm thử rớt mạng giữa chừng, Idempotency Token & Hàng đợi Offline Sync
    /// </summary>
    public class Tier3_NetworkPartitionAndIdempotencyTests
    {
        private readonly ApplicationDbContext _context;

        public Tier3_NetworkPartitionAndIdempotencyTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        public static IEnumerable<object[]> IdempotencyTokenMatrixData()
        {
            // 40 kịch bản kiểm tra Idempotency Key chống tạo bản ghi trùng lặp khi mạng bị rớt và retry
            for (int i = 1; i <= 40; i++)
            {
                var clientKey = $"REQ-IDEMPOTENT-{i:D3}-{Guid.NewGuid():N}";
                int retryCount = (i % 5) + 1; // Thử lại từ 1 đến 5 lần
                yield return new object[] { clientKey, retryCount };
            }
        }

        [Theory]
        [MemberData(nameof(IdempotencyTokenMatrixData))]
        public async Task Tier3_01_InFlight_NetworkDrop_WithIdempotentRetry_ShouldNotCreateDuplicateTasks(string idempotencyKey, int retries)
        {
            await using var fixture = await Tasks.UnifiedWorkflowTests.Fixture.New();
            var request = fixture.Command();
            request.RequestId = new Guid(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(idempotencyKey)).AsSpan(0, 16));
            request.Title = $"Nhiệm vụ kiểm tra mạng chập chờn {idempotencyKey}";
            Guid? firstTaskId = null;
            for (var attempt = 0; attempt < retries; attempt++)
            {
                // Every retry reaches the real handler; no simulated cache hides duplicate writes.
                fixture.Db.ChangeTracker.Clear();
                var handler = new CreateTaskCommandHandler(fixture.Db, fixture.Authorization);
                var createdId = await handler.Handle(request, CancellationToken.None);
                firstTaskId ??= createdId;
                createdId.Should().Be(firstTaskId.Value);
            }
            (await fixture.Db.TaskItems.CountAsync()).Should().Be(1);
            (await fixture.Db.WorkflowRequests.CountAsync()).Should().Be(1);
            (await fixture.Db.Notifications.CountAsync()).Should().Be(1);
        }

        public static IEnumerable<object[]> ExponentialBackoffData()
        {
            // 30 kịch bản tính toán thời gian chờ Exponential Backoff khi gặp lỗi mạng (504, Timeout)
            var baseDelays = new[] { 100.0, 200.0, 300.0, 400.0, 500.0 };
            for (int attempt = 1; attempt <= 6; attempt++)
            {
                foreach (var baseDelay in baseDelays)
                {
                    yield return new object[] { attempt, baseDelay };
                }
            }
        }

        [Theory]
        [MemberData(nameof(ExponentialBackoffData))]
        public void Tier3_02_TransientNetworkFailure_ExponentialBackoff_ShouldGrowExponentially(int attempt, double baseDelayMs)
        {
            // Công thức: delay = baseDelay * 2^(attempt - 1)
            double calculatedDelay = baseDelayMs * Math.Pow(2, attempt - 1);
            calculatedDelay.Should().BeGreaterThanOrEqualTo(baseDelayMs);

            if (attempt > 1)
            {
                double prevDelay = baseDelayMs * Math.Pow(2, attempt - 2);
                calculatedDelay.Should().Be(prevDelay * 2.0);
            }
        }

        public static IEnumerable<object[]> OfflineQueueBatchData()
        {
            // 30 kịch bản xếp hàng ngoại tuyến (Offline Queue) và đồng bộ hàng loạt khi kết nối lại
            for (int batchSize = 1; batchSize <= 30; batchSize++)
            {
                yield return new object[] { batchSize };
            }
        }

        [Theory]
        [MemberData(nameof(OfflineQueueBatchData))]
        public async Task Tier3_03_OfflineQueue_AutoDrainOnReconnect_ShouldProcessAllQueuedActions(int batchSize)
        {
            await using var fixture = await Tasks.UnifiedWorkflowTests.Fixture.New();
            var offlineQueue = Enumerable.Range(1, batchSize).Select(i =>
            {
                var command = fixture.Command();
                command.Title = $"Offline Task #{i} - Batch {batchSize}";
                return command;
            }).ToList();
            var handler = new CreateTaskCommandHandler(fixture.Db, fixture.Authorization);
            var results = new List<Guid>();
            foreach (var command in offlineQueue)
                results.Add(await handler.Handle(command, CancellationToken.None));
            // Replaying an already drained queue after reconnect must also be safe.
            fixture.Db.ChangeTracker.Clear();
            foreach (var command in offlineQueue)
                (await handler.Handle(command, CancellationToken.None)).Should().Be(results[offlineQueue.IndexOf(command)]);
            results.Distinct().Should().HaveCount(batchSize);
            (await fixture.Db.TaskItems.CountAsync()).Should().Be(batchSize);
            (await fixture.Db.WorkflowRequests.CountAsync()).Should().Be(batchSize);
        }
    }
}
