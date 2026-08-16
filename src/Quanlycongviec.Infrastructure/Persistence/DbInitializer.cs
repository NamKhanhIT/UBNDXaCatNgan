using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Quanlycongviec.Infrastructure.Persistence
{
    /// <summary>
    /// Bộ nạp dữ liệu khởi tạo CSDL chuẩn cho dự án UBND Xã Cát Ngạn.
    /// Tách biệt dữ liệu mẫu sang file SQL độc lập (`scripts/seed_database.sql`)
    /// giúp dễ dàng scale, quản lý dữ liệu sạch và tối ưu bộ nhớ.
    /// </summary>
    public static class DbInitializer
    {
        public static async Task SeedAsync(IServiceProvider serviceProvider, bool force = false)
        {
            var logger = serviceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DbInitializer");
            var context = serviceProvider.GetRequiredService<ApplicationDbContext>();

            try
            {
                if (context.Database.IsRelational())
                {
                    await context.Database.MigrateAsync();
                }
                else
                {
                    await context.Database.EnsureCreatedAsync();
                }

                // Chuyển đổi dữ liệu đánh giá cũ theo thang 1-10 (nếu có) sang thang 100
                var legacyTasks = await context.TaskItems
                    .Where(t => t.RatingScore.HasValue && t.RatingScore.Value <= 10.0)
                    .ToListAsync();
                if (legacyTasks.Count > 0)
                {
                    foreach (var lt in legacyTasks)
                    {
                        if (lt.RatingScore.HasValue)
                        {
                            lt.RatingScore = lt.RatingScore.Value * 10.0;
                        }
                        lt.SystemScore = null;
                        lt.EvaluatorScore = null;
                    }
                    await context.SaveChangesAsync();
                    logger.LogInformation("Đã quy đổi {Count} nhiệm vụ có điểm thang 10 cũ sang thang 100.", legacyTasks.Count);
                }

                // Kiểm tra xem database đã được seed chưa (nếu không force)
                if (!force && await context.Users.AnyAsync(u => u.Email == "admin@catngan.gov.vn"))
                {
                    logger.LogInformation("Cơ sở dữ liệu đã có dữ liệu khởi tạo. Bỏ qua chạy seed SQL.");
                    return;
                }

                // Tìm và nạp file SQL khởi tạo
                var sqlPaths = new[]
                {
                    Path.Combine(AppContext.BaseDirectory, "scripts", "seed_database.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "scripts", "seed_database.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "scripts", "seed_database.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "scripts", "seed_database.sql")
                };

                string? foundPath = null;
                foreach (var p in sqlPaths)
                {
                    if (File.Exists(p))
                    {
                        foundPath = p;
                        break;
                    }
                }

                if (foundPath != null)
                {
                    var sql = await File.ReadAllTextAsync(foundPath);
                    await context.Database.ExecuteSqlRawAsync(sql);
                    logger.LogInformation("Đã nạp bộ dữ liệu chuẩn thành công từ file SQL: {Path}", foundPath);
                }
                else
                {
                    logger.LogWarning("Không tìm thấy file scripts/seed_database.sql tại các đường dẫn quy ước.");
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Lỗi khi nạp dữ liệu khởi tạo từ SQL.");
                throw;
            }
        }
    }
}
