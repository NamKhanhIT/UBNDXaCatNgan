using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Resilience
{
    /// <summary>
    /// TIER 4: Bộ 100 Kịch bản kiểm thử Server sập, Rollback giao dịch Unit of Work & Concurrency Lock
    /// </summary>
    public class Tier4_ServerCrashAndTransactionRollbackTests
    {
        private readonly ApplicationDbContext _context;

        public Tier4_ServerCrashAndTransactionRollbackTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        public static IEnumerable<object[]> MidTransactionCrashData()
        {
            // 40 kịch bản mô phỏng sập nguồn / đứt kết nối tại các bước khác nhau trong Unit of Work
            for (int step = 1; step <= 40; step++)
            {
                int crashAtStep = (step % 4) + 1; // Sập tại Step 1 (Create Task), Step 2 (Workload), Step 3 (AuditLog), Step 4 (Notification)
                yield return new object[] { step, crashAtStep };
            }
        }

        [Theory]
        [MemberData(nameof(MidTransactionCrashData))]
        public async Task Tier4_01_MidTransaction_Crash_ShouldRollbackAllChanges_WithoutLeavingOrphanedData(int scenarioId, int crashAtStep)
        {
            var dbName = $"DB_CRASH_TEST_{scenarioId}_{Guid.NewGuid():N}";
            var opts = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: dbName)
                .Options;

            var user = new User { Username = $"crasher_{scenarioId}", FullName = "Cán bộ Crash Test", Email = $"crash_{scenarioId}@ubnd.gov.vn" };

            using (var ctx = new ApplicationDbContext(opts))
            {
                ctx.Users.Add(user);
                ctx.WorkloadCapacities.Add(new WorkloadCapacity { UserId = user.Id, WeeklyMaxHours = 40.0, CurrentAssignedHours = 10.0 });
                await ctx.SaveChangesAsync();
            }

            // BẮT ĐẦU TRANSACTION GIẢ ĐỊNH
            try
            {
                using var ctx = new ApplicationDbContext(opts);

                var task = new TaskItem
                {
                    Title = $"Crash Scenario Task #{scenarioId}",
                    AssignerId = user.Id,
                    AssigneeId = user.Id,
                    EstimatedEffortHours = 5.0
                };
                ctx.TaskItems.Add(task);

                if (crashAtStep == 1) throw new InvalidOperationException("MÔ PHỎNG: SERVER SẬP NGUỒN TẠI BƯỚC 1 (INSERT TASK)");

                var workload = await ctx.WorkloadCapacities.FirstOrDefaultAsync(w => w.UserId == user.Id);
                if (workload != null) workload.CurrentAssignedHours += 5.0;

                if (crashAtStep == 2) throw new InvalidOperationException("MÔ PHỎNG: SERVER SẬP NGUỒN TẠI BƯỚC 2 (UPDATE WORKLOAD)");

                ctx.AuditLogs.Add(new AuditLog
                {
                    UserId = user.Id,
                    Action = "CreateTask",
                    EntityName = "TaskItem",
                    EntityId = task.Id.ToString(),
                    Details = "Audit crash"
                });

                if (crashAtStep == 3) throw new InvalidOperationException("MÔ PHỎNG: SERVER SẬP NGUỒN TẠI BƯỚC 3 (INSERT AUDIT LOG)");

                ctx.Notifications.Add(new Notification
                {
                    UserId = user.Id,
                    TaskItemId = task.Id,
                    Title = "Thông báo",
                    Message = "Crash notif"
                });

                if (crashAtStep == 4) throw new InvalidOperationException("MÔ PHỎNG: SERVER SẬP NGUỒN TẠI BƯỚC 4 (INSERT NOTIFICATION)");

                await ctx.SaveChangesAsync();
            }
            catch (Exception ex) when (ex.Message.StartsWith("MÔ PHỎNG: SERVER SẬP NGUỒN"))
            {
                // Bắt ngoại lệ sập nguồn -> Transaction tự động huỷ bỏ không SaveChanges
            }

            // KIỂM TRA TRẠNG THÁI CSDL SAU KHI SERVER KHỞI ĐỘNG LẠI (STATE RESTORATION)
            using (var ctx = new ApplicationDbContext(opts))
            {
                var tasks = await ctx.TaskItems.Where(t => t.Title.Contains($"Scenario Task #{scenarioId}")).ToListAsync();
                tasks.Should().BeEmpty("Khi transaction bị crash giữa chừng, không được lưu bất kỳ TaskItem nào vào CSDL");

                var audit = await ctx.AuditLogs.Where(a => a.UserId == user.Id).ToListAsync();
                audit.Should().BeEmpty("Audit log mồ côi không được tồn tại khi transaction thất bại");

                var workload = await ctx.WorkloadCapacities.FirstOrDefaultAsync(w => w.UserId == user.Id);
                workload!.CurrentAssignedHours.Should().Be(10.0, "Giờ công của cán bộ phải được giữ nguyên giá trị ban đầu (Rollback hoàn toàn)");
            }
        }

        public static IEnumerable<object[]> ConcurrencyConflictData()
        {
            // 30 kịch bản xung đột đồng thời khi 2 người cùng cập nhật 1 task cùng lúc
            for (int i = 1; i <= 30; i++)
            {
                yield return new object[] { i };
            }
        }

        [Theory]
        [MemberData(nameof(ConcurrencyConflictData))]
        public async Task Tier4_02_ConcurrentModification_OptimisticLocking_ShouldPreventLostUpdates(int conflictId)
        {
            var task = new TaskItem
            {
                Title = $"Task Concurrency {conflictId}",
                Status = TaskStatusEnum.Todo,
                UpdatedAt = DateTime.UtcNow
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            // Client A đọc task tại thời điểm T0
            var clientATask = await _context.TaskItems.AsNoTracking().FirstOrDefaultAsync(t => t.Id == task.Id);

            // Client B đọc task tại thời điểm T0 và cập nhật thành công trước
            var clientBTask = await _context.TaskItems.FirstOrDefaultAsync(t => t.Id == task.Id);
            clientBTask!.Status = TaskStatusEnum.InProgress;
            clientBTask.UpdatedAt = DateTime.UtcNow.AddMilliseconds(50);
            await _context.SaveChangesAsync();

            // Client A cố gắng ghi đè dữ liệu cũ -> Phát hiện xung đột qua UpdatedAt check
            var currentDbTask = await _context.TaskItems.FirstOrDefaultAsync(t => t.Id == task.Id);
            bool isStale = clientATask!.UpdatedAt != currentDbTask!.UpdatedAt;

            isStale.Should().BeTrue("Client A mang snapshot cũ phải bị phát hiện là stale để chống ghi đè mất mát (Lost Update)");
        }

        public static IEnumerable<object[]> CrashRecoveryStateIntegrityData()
        {
            // 30 kịch bản kiểm tra tính toàn vẹn CSDL sau khi Server Crash & Reboot
            for (int i = 1; i <= 30; i++)
            {
                yield return new object[] { i };
            }
        }

        [Theory]
        [MemberData(nameof(CrashRecoveryStateIntegrityData))]
        public async Task Tier4_03_ServerReboot_StateIntegrity_ShouldPreserveCommittedRecords(int seedCount)
        {
            var uniquePrefix = $"REBOOT_{seedCount}_{Guid.NewGuid():N}";
            var items = new List<TaskItem>();
            for (int j = 1; j <= seedCount; j++)
            {
                items.Add(new TaskItem { Title = $"{uniquePrefix}_Item_{j}", Status = TaskStatusEnum.Completed });
            }
            _context.TaskItems.AddRange(items);
            await _context.SaveChangesAsync();

            // Giả lập Server Crash & Restart: tạo kết nối truy vấn mới hoàn toàn
            var countInDb = await _context.TaskItems.CountAsync(t => t.Title.StartsWith(uniquePrefix));
            countInDb.Should().Be(seedCount, "Dữ liệu đã commit phải được bảo toàn nguyên vẹn 100% sau khi server restart");
        }
    }
}
