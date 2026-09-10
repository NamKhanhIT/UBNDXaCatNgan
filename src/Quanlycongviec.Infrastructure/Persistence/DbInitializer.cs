using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Infrastructure.Persistence
{
    // Bộ nạp dữ liệu khởi tạo CSDL chuẩn cho dự án UBND Cấp Xã
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
                    try
                    {
                        await context.Database.ExecuteSqlRawAsync(@"
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""NotificationPreferences"" text;
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""AppearancePreferences"" text;
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""WorkProfileJson"" text;
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""PhoneNumberConfirmed"" boolean DEFAULT FALSE;
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""PhoneOtpHash"" text;
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""PhoneOtpExpiry"" timestamp with time zone;
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""PhoneOtpSentUtc"" timestamp with time zone;
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""PhoneOtpFailedCount"" integer DEFAULT 0;
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""EmailChangeNewEmail"" text;
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""EmailChangeOtpHash"" text;
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""EmailChangeOtpExpiry"" timestamp with time zone;
                            ALTER TABLE ""Users"" ADD COLUMN IF NOT EXISTS ""EmailChangeOtpSentUtc"" timestamp with time zone;
                            ALTER TABLE ""TaskItems"" ADD COLUMN IF NOT EXISTS ""Requirements"" text;
                            ALTER TABLE ""InboxDocuments"" ADD COLUMN IF NOT EXISTS ""ReceivedByUserId"" uuid;

                            CREATE INDEX IF NOT EXISTS ""IX_InboxDocuments_IsDeleted_IsUrgent_ReceivedDate"" ON ""InboxDocuments"" (""IsDeleted"", ""IsUrgent"" DESC, ""ReceivedDate"" DESC);
                            CREATE INDEX IF NOT EXISTS ""IX_InboxDocuments_IsDeleted_IsScheduled_ReceivedDate"" ON ""InboxDocuments"" (""IsDeleted"", ""IsScheduled"", ""ReceivedDate"" DESC);
                            CREATE INDEX IF NOT EXISTS ""IX_InboxDocuments_IsDeleted_Category"" ON ""InboxDocuments"" (""IsDeleted"", ""Category"");
                            CREATE INDEX IF NOT EXISTS ""IX_InboxDocuments_IsDeleted_AiProcessingStatus"" ON ""InboxDocuments"" (""IsDeleted"", ""AiProcessingStatus"");
                            CREATE INDEX IF NOT EXISTS ""IX_OutgoingDocuments_IsDeleted_DraftedAt"" ON ""OutgoingDocuments"" (""IsDeleted"", ""DraftedAt"" DESC);
                            CREATE INDEX IF NOT EXISTS ""IX_OutgoingDocuments_IsDeleted_Status_DraftedAt"" ON ""OutgoingDocuments"" (""IsDeleted"", ""Status"", ""DraftedAt"" DESC);
                            CREATE INDEX IF NOT EXISTS ""IX_TaskItems_IsDeleted_CreatedAt"" ON ""TaskItems"" (""IsDeleted"", ""CreatedAt"" DESC);
                            CREATE INDEX IF NOT EXISTS ""IX_TaskItems_IsDeleted_Status_CreatedAt"" ON ""TaskItems"" (""IsDeleted"", ""Status"", ""CreatedAt"" DESC);
                        ");
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning("Không thể chạy auto-alter columns Users: {Message}", ex.Message);
                    }
                }
                else
                {
                    await context.Database.EnsureCreatedAsync();
                }


                // Kiểm tra xem database đã được seed chưa (nếu không force)
                if (!force && await context.Users.AnyAsync(u => u.Email == "admin@ubnd.gov.vn" || u.Username == "admin"))
                {
                    logger.LogInformation("Cơ sở dữ liệu đã có dữ liệu khởi tạo. Bỏ qua chạy seed SQL.");
                    return;
                }

                // Tìm và nạp file SQL khởi tạo
                var sqlPaths = new[]
                {
                    Path.Combine(AppContext.BaseDirectory, "scripts", "database", "seed_database.sql"),
                    Path.Combine(AppContext.BaseDirectory, "scripts", "seed_database.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "scripts", "database", "seed_database.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "scripts", "seed_database.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "scripts", "database", "seed_database.sql"),
                    Path.Combine(Directory.GetCurrentDirectory(), "..", "scripts", "seed_database.sql")
                };

                var foundPath = sqlPaths.FirstOrDefault(File.Exists);
                if (foundPath != null)
                {
                    if (context.Database.IsRelational())
                    {
                        try
                        {
                            await context.Database.ExecuteSqlRawAsync("SET client_encoding = 'UTF8';");
                        }
                        catch
                        {
                            // Bỏ qua nếu DB provider không phải PostgreSQL
                        }
                    }

                    var sql = await File.ReadAllTextAsync(foundPath, System.Text.Encoding.UTF8);
                    await context.Database.ExecuteSqlRawAsync(sql);
                    logger.LogInformation("Đã nạp bộ dữ liệu chuẩn thành công từ file SQL: {Path}", foundPath);

                    // ── BẢO MẬT (Audit A5): Xử lý mật khẩu khởi tạo và bắt buộc đổi mật khẩu ──
                    var hasher = serviceProvider.GetRequiredService<IPasswordHasher>();
                    var seedPassword = Environment.GetEnvironmentVariable("SEED_PASSWORD");
                    if (string.IsNullOrWhiteSpace(seedPassword))
                    {
                        throw new InvalidOperationException("SEED_PASSWORD must be configured before applying seed data.");
                    }
                    var users = await context.Users.ToListAsync();

                    var newHash = hasher.HashPassword(seedPassword);
                    foreach (var u in users) u.PasswordHash = newHash;
                    logger.LogInformation("Đã thiết lập mật khẩu khởi tạo an toàn cho {Count} tài khoản (Mật khẩu mặc định yêu cầu đổi lần đầu).", users.Count);

                    foreach (var u in users) u.MustChangePassword = true;
                    await context.SaveChangesAsync();
                    logger.LogInformation("Đã bật cờ ép đổi mật khẩu lần đầu cho {Count} tài khoản khởi tạo.", users.Count);
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
