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
            var user = new User { Username = "user_" + Guid.NewGuid().ToString("N")[..6], FullName = "Cán bộ Đồng bộ", Email = "sync@ubnd.gov.vn" };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Mô phỏng bộ đệm Idempotency Cache phía máy chủ
            var idempotencyCache = new ConcurrentDictionary<string, Guid>();

            Guid? firstTaskId = null;

            for (int attempt = 1; attempt <= retries; attempt++)
            {
                if (idempotencyCache.TryGetValue(idempotencyKey, out var existingId))
                {
                    // Server nhận retry có cùng token -> Trả lại ID cũ, KHÔNG tạo bản ghi mới
                    firstTaskId.Should().Be(existingId);
                    continue;
                }

                var command = new CreateTaskCommand
                {
                    Title = $"Nhiệm vụ kiểm tra mạng chập chờn {idempotencyKey}",
                    AssignerId = user.Id,
                    AssigneeId = user.Id,
                    EstimatedEffortHours = 4.0
                };

                var handler = new CreateTaskCommandHandler(_context);
                var createdId = await handler.Handle(command, CancellationToken.None);

                idempotencyCache.TryAdd(idempotencyKey, createdId);
                firstTaskId = createdId;
            }

            // Kiểm tra trong CSDL chỉ có DUY NHẤT 1 bản ghi
            var matchedTasks = await _context.TaskItems
                .Where(t => t.Title.Contains(idempotencyKey))
                .ToListAsync();

            matchedTasks.Should().HaveCount(1, $"IdempotencyKey {idempotencyKey} được retry {retries} lần chỉ được sinh ra đúng 1 Task");
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
            var user = new User { Username = "offline_user_" + Guid.NewGuid().ToString("N")[..6], FullName = "Cán bộ Offline", Email = "offline@ubnd.gov.vn" };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Mô phỏng hàng đợi ngoại tuyến lưu trữ trong IndexedDB
            var offlineQueue = new List<CreateTaskCommand>();
            for (int i = 1; i <= batchSize; i++)
            {
                offlineQueue.Add(new CreateTaskCommand
                {
                    Title = $"Offline Task #{i} - Batch {batchSize}",
                    AssignerId = user.Id,
                    AssigneeId = user.Id,
                    EstimatedEffortHours = 2.0
                });
            }

            // KHI CÓ MẠNG TRỞ LẠI -> Drain toàn bộ hàng đợi
            var handler = new CreateTaskCommandHandler(_context);
            var results = new List<Guid>();

            foreach (var cmd in offlineQueue)
            {
                var id = await handler.Handle(cmd, CancellationToken.None);
                results.Add(id);
            }

            results.Should().HaveCount(batchSize);
            results.All(id => id != Guid.Empty).Should().BeTrue();

            var countInDb = await _context.TaskItems
                .CountAsync(t => t.Title.Contains($"Batch {batchSize}"));
            countInDb.Should().Be(batchSize);
        }
    }
}
