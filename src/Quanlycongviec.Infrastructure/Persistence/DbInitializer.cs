using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Infrastructure.Persistence
{
    public static class DbInitializer
    {
        public static async Task SeedAsync(IServiceProvider serviceProvider)
        {
            var logger = serviceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DbInitializer");
            var context = serviceProvider.GetRequiredService<ApplicationDbContext>();
            var passwordHasher = serviceProvider.GetRequiredService<IPasswordHasher>();

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

                await SeedDepartments(context, logger);
                await SeedRoles(context, logger);
                await SeedUsers(context, passwordHasher, logger);
                await SeedTasks(context, logger);
                await SeedInboxDocuments(context, logger);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Lỗi khi seed dữ liệu khởi tạo.");
                throw;
            }
        }

        private static async Task SeedDepartments(ApplicationDbContext context, ILogger logger)
        {
            if (await context.Departments.AnyAsync()) return;

            var departments = new[]
            {
                new Department { Id = Guid.Parse("10000000-0000-0000-0000-000000000001"), Name = "Văn phòng HĐND & UBND", Code = "VAN_PHONG" },
                new Department { Id = Guid.Parse("10000000-0000-0000-0000-000000000002"), Name = "Phòng Kinh tế - Hạ tầng & Đô thị", Code = "KINH_TE" },
                new Department { Id = Guid.Parse("10000000-0000-0000-0000-000000000003"), Name = "Phòng Văn hóa - Xã hội", Code = "VAN_HOA_XA_HOI" },
                new Department { Id = Guid.Parse("10000000-0000-0000-0000-000000000004"), Name = "Trung tâm Phục vụ Hành chính công", Code = "HANH_CHINH_CONG" },
                new Department { Id = Guid.Parse("10000000-0000-0000-0000-000000000005"), Name = "Khối Đảng - HĐND - UBMTTQ", Code = "KHOI_DANG_DOAN_THE" }
            };

            context.Departments.AddRange(departments);
            await context.SaveChangesAsync();
            logger.LogInformation("Đã seed {Count} phòng ban.", departments.Length);
        }

        private static async Task SeedRoles(ApplicationDbContext context, ILogger logger)
        {
            if (await context.Roles.AnyAsync()) return;

            var roles = new[]
            {
                new Role { Id = Guid.Parse("20000000-0000-0000-0000-000000000001"), Name = "Bí thư Đảng ủy", Code = "BiThuDU", Description = "Bí thư Đảng ủy xã — lãnh đạo cao nhất về Đảng", RankLevel = 1 },
                new Role { Id = Guid.Parse("20000000-0000-0000-0000-000000000002"), Name = "Chủ tịch UBND", Code = "ChuTichUBND", Description = "Chủ tịch UBND xã — điều hành hành chính", RankLevel = 1 },
                new Role { Id = Guid.Parse("20000000-0000-0000-0000-000000000003"), Name = "Chủ tịch HĐND", Code = "ChuTichHDND", Description = "Chủ tịch HĐND xã", RankLevel = 1 },
                new Role { Id = Guid.Parse("20000000-0000-0000-0000-000000000004"), Name = "Phó Chủ tịch UBND (Chánh VP)", Code = "PhoChuTichUBND_ChanhVP", Description = "Phó Chủ tịch UBND kiêm Chánh VP", RankLevel = 2 },
                new Role { Id = Guid.Parse("20000000-0000-0000-0000-000000000005"), Name = "Phó Chủ tịch UBND (GĐ TTPHCC)", Code = "PhoChuTichUBND_TTPHCC", Description = "Phó Chủ tịch UBND kiêm Giám đốc TTPHCC", RankLevel = 2 },
                new Role { Id = Guid.Parse("20000000-0000-0000-0000-000000000006"), Name = "Trưởng phòng", Code = "TruongPhong", Description = "Trưởng phòng/ban chuyên môn", RankLevel = 3 },
                new Role { Id = Guid.Parse("20000000-0000-0000-0000-000000000007"), Name = "Phó Trưởng phòng", Code = "PhoPhong", Description = "Phó Trưởng phòng/ban chuyên môn", RankLevel = 4 },
                new Role { Id = Guid.Parse("20000000-0000-0000-0000-000000000008"), Name = "Chuyên viên", Code = "ChuyenVien", Description = "Chuyên viên / Cán bộ nghiệp vụ", RankLevel = 5 }
            };

            context.Roles.AddRange(roles);
            await context.SaveChangesAsync();
            logger.LogInformation("Đã seed {Count} vai trò.", roles.Length);
        }

        private static async Task SeedUsers(ApplicationDbContext context, IPasswordHasher passwordHasher, ILogger logger)
        {
            if (await context.Users.AnyAsync(u => u.Email == "admin@catngan.gov.vn")) return;

            var defaultPassword = passwordHasher.HashPassword("catngan2026");
            var deptVP = Guid.Parse("10000000-0000-0000-0000-000000000001");
            var deptKT = Guid.Parse("10000000-0000-0000-0000-000000000002");
            var deptVH = Guid.Parse("10000000-0000-0000-0000-000000000003");
            var deptHCC = Guid.Parse("10000000-0000-0000-0000-000000000004");
            var deptDang = Guid.Parse("10000000-0000-0000-0000-000000000005");

            var usersData = new[]
            {
                new { Id = Guid.Parse("A0000000-0000-0000-0000-000000000001"), Username = "admin", FullName = "Nguyễn Đình Hùng", Email = "admin@catngan.gov.vn", Dept = deptVP, RoleCode = "ChuTichUBND" },
                new { Id = Guid.Parse("A0000000-0000-0000-0000-000000000002"), Username = "bithu", FullName = "Phan Văn Hà", Email = "bithu@catngan.gov.vn", Dept = deptDang, RoleCode = "BiThuDU" },
                new { Id = Guid.Parse("A0000000-0000-0000-0000-000000000003"), Username = "pct_vp", FullName = "Nguyễn Văn Hoàng", Email = "pct_vp@catngan.gov.vn", Dept = deptVP, RoleCode = "PhoChuTichUBND_ChanhVP" },
                new { Id = Guid.Parse("A0000000-0000-0000-0000-000000000004"), Username = "tp_kt", FullName = "Lê Văn Tùng", Email = "tp_kt@catngan.gov.vn", Dept = deptKT, RoleCode = "TruongPhong" },
                new { Id = Guid.Parse("A0000000-0000-0000-0000-000000000005"), Username = "tp_vh", FullName = "Trần Thị Mai", Email = "tp_vh@catngan.gov.vn", Dept = deptVH, RoleCode = "TruongPhong" },
                new { Id = Guid.Parse("A0000000-0000-0000-0000-000000000006"), Username = "nam", FullName = "Nguyễn Văn Nam", Email = "nam@catngan.gov.vn", Dept = deptKT, RoleCode = "ChuyenVien" },
                new { Id = Guid.Parse("A0000000-0000-0000-0000-000000000007"), Username = "thu", FullName = "Hoàng Thị Thu", Email = "thu@catngan.gov.vn", Dept = deptVP, RoleCode = "ChuyenVien" },
                new { Id = Guid.Parse("A0000000-0000-0000-0000-000000000008"), Username = "duc", FullName = "Phạm Văn Đức", Email = "duc@catngan.gov.vn", Dept = deptHCC, RoleCode = "ChuyenVien" }
            };

            var rolesMap = await context.Roles.ToDictionaryAsync(r => r.Code, r => r.Id);

            foreach (var item in usersData)
            {
                var user = new User
                {
                    Id = item.Id,
                    Username = item.Username,
                    FullName = item.FullName,
                    Email = item.Email,
                    PasswordHash = defaultPassword,
                    PrimaryDepartmentId = item.Dept,
                    ActiveRoleCode = item.RoleCode
                };
                context.Users.Add(user);

                if (rolesMap.TryGetValue(item.RoleCode, out var roleId))
                {
                    context.UserRoles.Add(new UserRole
                    {
                        UserId = item.Id,
                        RoleId = roleId,
                        DepartmentId = item.Dept,
                        IsPrimary = true
                    });
                }

                context.WorkloadCapacities.Add(new WorkloadCapacity
                {
                    UserId = item.Id,
                    WeeklyMaxHours = 40.0,
                    CurrentAssignedHours = item.RoleCode == "ChuyenVien" ? 28.0 : 15.0
                });
            }

            await context.SaveChangesAsync();
            logger.LogInformation("Đã seed {Count} người dùng demo chuẩn.", usersData.Length);
        }

        private static async Task SeedTasks(ApplicationDbContext context, ILogger logger)
        {
            if (await context.TaskItems.AnyAsync())
            {
                var projTask = await context.TaskItems.FirstOrDefaultAsync(t => t.Id == Guid.Parse("d2db6439-0e64-4497-bcf4-7cebe9eb2a9b"));
                if (projTask != null && (projTask.Type != TaskType.Project || projTask.Status == TaskStatusEnum.InReview))
                {
                    projTask.Type = TaskType.Project;
                    projTask.Status = TaskStatusEnum.InProgress;
                    await context.SaveChangesAsync();
                }
                return;
            }

            var adminId = Guid.Parse("A0000000-0000-0000-0000-000000000001");
            var biThuId = Guid.Parse("A0000000-0000-0000-0000-000000000002");
            var pctHoangId = Guid.Parse("A0000000-0000-0000-0000-000000000003");
            var tpTungId = Guid.Parse("A0000000-0000-0000-0000-000000000004");
            var tpMaiId = Guid.Parse("A0000000-0000-0000-0000-000000000005");
            var namId = Guid.Parse("A0000000-0000-0000-0000-000000000006");
            var thuId = Guid.Parse("A0000000-0000-0000-0000-000000000007");
            var ducId = Guid.Parse("A0000000-0000-0000-0000-000000000008");

            var deptVP = Guid.Parse("10000000-0000-0000-0000-000000000001");
            var deptKT = Guid.Parse("10000000-0000-0000-0000-000000000002");
            var deptVH = Guid.Parse("10000000-0000-0000-0000-000000000003");
            var deptHCC = Guid.Parse("10000000-0000-0000-0000-000000000004");

            var now = DateTime.UtcNow;

            var tasks = new[]
            {
                new TaskItem
                {
                    Title = "Rà soát hiện trạng sử dụng đất nông nghiệp xóm Cát Nam",
                    Description = "Kiểm tra ranh giới, trích đo hiện trạng sử dụng đất lập phương án quản lý.",
                    AssignerId = adminId,
                    AssigneeId = namId,
                    DepartmentId = deptKT,
                    Priority = TaskPriority.Urgent,
                    Status = TaskStatusEnum.InProgress,
                    Type = TaskType.BAU,
                    EstimatedEffortHours = 12.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(1), DateTimeKind.Utc)
                },
                new TaskItem
                {
                    Title = "Giải quyết hồ sơ cấp GCNQSDĐ tồn đọng đợt 2",
                    Description = "Tổng hợp 15 hồ sơ cấp đổi sổ đỏ đợt 2 trình Lãnh đạo UBND xã phê duyệt.",
                    AssignerId = tpTungId,
                    AssigneeId = namId,
                    DepartmentId = deptKT,
                    Priority = TaskPriority.High,
                    Status = TaskStatusEnum.InReview,
                    Type = TaskType.BAU,
                    EstimatedEffortHours = 8.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(2), DateTimeKind.Utc)
                },
                new TaskItem
                {
                    Title = "Tổ chức Hội nghị tiếp xúc cử tri HĐND xã khóa XVIII",
                    Description = "Chuẩn bị ma két, giấy mời, hội trường và tài liệu phục vụ tiếp xúc cử tri.",
                    AssignerId = pctHoangId,
                    AssigneeId = thuId,
                    DepartmentId = deptVP,
                    Priority = TaskPriority.Medium,
                    Status = TaskStatusEnum.InProgress,
                    Type = TaskType.BAU,
                    EstimatedEffortHours = 6.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(3), DateTimeKind.Utc)
                },
                new TaskItem
                {
                    Title = "Tiếp nhận và số hóa hồ sơ thủ tục hành chính tại TTPHCC",
                    Description = "Hoàn thành 100% việc scan và cập nhật hồ sơ một cửa lên hệ thống Cổng DVC.",
                    AssignerId = adminId,
                    AssigneeId = ducId,
                    DepartmentId = deptHCC,
                    Priority = TaskPriority.High,
                    Status = TaskStatusEnum.Completed,
                    Type = TaskType.BAU,
                    EstimatedEffortHours = 16.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(-1), DateTimeKind.Utc),
                    RatingScore = 9.5
                },
                new TaskItem
                {
                    Title = "Xây dựng Kế hoạch chủ động ứng phó thiên tai mùa mưa bão",
                    Description = "Rà soát trọng điểm xung yếu đê điều, hồ đập trên địa bàn xã.",
                    AssignerId = adminId,
                    AssigneeId = tpTungId,
                    DepartmentId = deptKT,
                    Priority = TaskPriority.Urgent,
                    Status = TaskStatusEnum.InProgress,
                    Type = TaskType.Project,
                    EstimatedEffortHours = 10.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(1), DateTimeKind.Utc)
                },
                new TaskItem
                {
                    Title = "Kiểm tra vệ sinh an toàn thực phẩm tại các chợ dân sinh",
                    Description = "Phối hợp Trạm Y tế kiểm tra định kỳ các hộ kinh doanh thực phẩm.",
                    AssignerId = adminId,
                    AssigneeId = tpMaiId,
                    DepartmentId = deptVH,
                    Priority = TaskPriority.Medium,
                    Status = TaskStatusEnum.Completed,
                    Type = TaskType.BAU,
                    EstimatedEffortHours = 8.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(-2), DateTimeKind.Utc),
                    RatingScore = 9.0
                },
                new TaskItem
                {
                    Title = "Rà soát các hộ nghèo, hộ cận nghèo nhận hỗ trợ nhà ở đợt 3",
                    Description = "Lập danh sách thẩm định hộ nghèo khó khăn về nhà ở trình HĐND thông qua.",
                    AssignerId = biThuId,
                    AssigneeId = tpMaiId,
                    DepartmentId = deptVH,
                    Priority = TaskPriority.High,
                    Status = TaskStatusEnum.InProgress,
                    Type = TaskType.AdHoc,
                    EstimatedEffortHours = 14.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(4), DateTimeKind.Utc)
                },
                new TaskItem
                {
                    Title = "Triển khai chiến dịch tiêm chủng mở rộng đợt 3/2026",
                    Description = "Lập danh sách trẻ em trong độ tuổi tiêm chủng gửi Trạm Y tế xã.",
                    AssignerId = pctHoangId,
                    AssigneeId = tpMaiId,
                    DepartmentId = deptVH,
                    Priority = TaskPriority.Medium,
                    Status = TaskStatusEnum.Todo,
                    Type = TaskType.BAU,
                    EstimatedEffortHours = 6.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(5), DateTimeKind.Utc)
                },
                new TaskItem
                {
                    Title = "Giải quyết khiếu nại tranh chấp ranh giới đất đai xóm 4",
                    Description = "Tổ chức hòa giải tại cơ sở đối với vụ việc tranh chấp mốc giới giữa 2 hộ gia đình.",
                    AssignerId = tpTungId,
                    AssigneeId = namId,
                    DepartmentId = deptKT,
                    Priority = TaskPriority.High,
                    Status = TaskStatusEnum.Cancelled,
                    Type = TaskType.AdHoc,
                    EstimatedEffortHours = 8.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(2), DateTimeKind.Utc),
                    RejectionReason = "Báo cáo xác minh thiếu sơ đồ hiện trạng chi tiết, yêu cầu chuyên viên đo đạc lại mốc giới."
                },
                new TaskItem
                {
                    Title = "Tổ chức họp Giao ban Đầu tuần toàn thể Cán bộ công chức xã",
                    Description = "Tổng hợp nội dung báo cáo tiến độ tuần trước và dự thảo lịch công tác tuần mới.",
                    AssignerId = adminId,
                    AssigneeId = thuId,
                    DepartmentId = deptVP,
                    Priority = TaskPriority.High,
                    Status = TaskStatusEnum.Todo,
                    Type = TaskType.BAU,
                    EstimatedEffortHours = 4.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(1), DateTimeKind.Utc)
                },
                new TaskItem
                {
                    Title = "Tổng hợp báo cáo giải ngân vốn đầu tư công quý III",
                    Description = "Báo cáo chi tiết tiến độ thi công 3 dự án hạ tầng giao thông nông thôn.",
                    AssignerId = adminId,
                    AssigneeId = tpTungId,
                    DepartmentId = deptKT,
                    Priority = TaskPriority.Urgent,
                    Status = TaskStatusEnum.InReview,
                    Type = TaskType.BAU,
                    EstimatedEffortHours = 12.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(2), DateTimeKind.Utc)
                },
                new TaskItem
                {
                    Title = "Rà soát trang thiết bị hệ thống Truyền thanh thông minh xã",
                    Description = "Kiểm tra hoạt động 12 cụm loa truyền thanh ứng dụng công nghệ thông tin viễn thông.",
                    AssignerId = pctHoangId,
                    AssigneeId = tpMaiId,
                    DepartmentId = deptVH,
                    Priority = TaskPriority.Low,
                    Status = TaskStatusEnum.Todo,
                    Type = TaskType.BAU,
                    EstimatedEffortHours = 5.0,
                    DueDate = DateTime.SpecifyKind(now.AddDays(7), DateTimeKind.Utc)
                }
            };

            context.TaskItems.AddRange(tasks);
            await context.SaveChangesAsync();

            // Seed thêm audit logs ban đầu
            foreach (var t in tasks)
            {
                context.AuditLogs.Add(new AuditLog
                {
                    UserId = t.AssignerId,
                    ActingRole = "Assigner",
                    Action = "CreateTask",
                    EntityName = "TaskItem",
                    EntityId = t.Id.ToString(),
                    Details = $"Khởi tạo nhiệm vụ [{t.Title}]"
                });
            }
            await context.SaveChangesAsync();

            await context.SaveChangesAsync();

            logger.LogInformation("Đã seed {Count} nhiệm vụ demo thực tế.", tasks.Length);
            await SeedSubTasks(context, tasks, logger);
            await SeedInboxDocuments(context, logger);
        }

        private static async Task SeedSubTasks(ApplicationDbContext context, TaskItem[] tasks, ILogger logger)
        {
            if (await context.SubTasks.AnyAsync()) return;

            var subTasksList = new List<SubTask>();
            foreach (var t in tasks)
            {
                subTasksList.Add(new SubTask { TaskItemId = t.Id, Title = "Kiểm tra thực địa và thu thập thông tin", IsCompleted = true });
                subTasksList.Add(new SubTask { TaskItemId = t.Id, Title = "Lập biên bản làm việc chuyên môn", IsCompleted = true });
                subTasksList.Add(new SubTask { TaskItemId = t.Id, Title = "Soạn thảo dự thảo tờ trình / báo cáo", IsCompleted = t.Status == TaskStatusEnum.Completed || t.Status == TaskStatusEnum.InReview });
                subTasksList.Add(new SubTask { TaskItemId = t.Id, Title = "Trình Lãnh đạo UBND xã phê duyệt", IsCompleted = t.Status == TaskStatusEnum.Completed });
            }

            context.SubTasks.AddRange(subTasksList);
            await context.SaveChangesAsync();
            logger.LogInformation("Đã seed {Count} công việc con (SubTasks) mẫu.", subTasksList.Count);
        }

        private static async Task SeedInboxDocuments(ApplicationDbContext context, ILogger logger)
        {
            if (await context.InboxDocuments.AnyAsync()) return;

            var docs = new[]
            {
                new InboxDocument
                {
                    Id = Guid.Parse("D0000000-0000-0000-0000-000000000001"),
                    DocumentNumber = "88/UBND-VP",
                    Subject = "Yêu cầu Phòng Địa chính phối hợp kiểm tra hiện trạng sử dụng đất khu vực cầu Cát Ngạn",
                    Category = "Chỉ đạo",
                    Sender = "UBND Huyện",
                    ReceivedDate = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-1), DateTimeKind.Utc),
                    IsUrgent = true,
                    IsScheduled = false
                },
                new InboxDocument
                {
                    Id = Guid.Parse("D0000000-0000-0000-0000-000000000002"),
                    DocumentNumber = "102/TB-UBND",
                    Subject = "Báo cáo rà soát hiện trạng các công trình thủy lợi phục vụ tưới tiêu sản xuất vụ Mùa 2026",
                    Category = "Báo cáo",
                    Sender = "Sở Nông nghiệp & PTNT",
                    ReceivedDate = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-2), DateTimeKind.Utc),
                    IsUrgent = false,
                    IsScheduled = false
                },
                new InboxDocument
                {
                    Id = Guid.Parse("D0000000-0000-0000-0000-000000000003"),
                    DocumentNumber = "45/CV-STC",
                    Subject = "Hướng dẫn công tác lập dự toán ngân sách nhà nước năm 2027 cấp xã",
                    Category = "Công văn",
                    Sender = "Sở Tài chính",
                    ReceivedDate = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-3), DateTimeKind.Utc),
                    IsUrgent = false,
                    IsScheduled = false,
                    Channel = InboxChannel.Internal
                },
                new InboxDocument
                {
                    Id = Guid.Parse("D0000000-0000-0000-0000-000000000004"),
                    DocumentNumber = "15/TTr-TTPHCC",
                    Subject = "Tờ trình nâng cấp trang thiết bị CNTT tại Trung tâm Phục vụ Hành chính công xã Cát Ngạn",
                    Category = "Tờ trình",
                    Sender = "Trung tâm Phục vụ Hành chính công",
                    ReceivedDate = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-5), DateTimeKind.Utc),
                    IsUrgent = true,
                    IsScheduled = false,
                    Channel = InboxChannel.Internal
                },
                new InboxDocument
                {
                    Id = Guid.Parse("D0000000-0000-0000-0000-000000000005"),
                    DocumentNumber = "67/KH-UBND",
                    Subject = "Kế hoạch tổ chức các hoạt động kỷ niệm Ngày Cách mạng tháng Tám và Quốc khánh 2/9",
                    Category = "Kế hoạch",
                    Sender = "Phòng Văn hóa - Xã hội",
                    ReceivedDate = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-4), DateTimeKind.Utc),
                    IsUrgent = false,
                    IsScheduled = false,
                    Channel = InboxChannel.Internal
                },
                // ── Hồ sơ TTHC công dân (PublicService) ──
                new InboxDocument
                {
                    Id = Guid.Parse("D0000000-0000-0000-0000-000000000006"),
                    DocumentNumber = "TTHC-2026-001",
                    Subject = "Đăng ký khai sinh cho con — Công dân Nguyễn Thị Lan",
                    Category = "Hồ sơ TTHC",
                    Sender = "Trung tâm Phục vụ Hành chính công",
                    ReceivedDate = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(-1), DateTimeKind.Utc),
                    IsUrgent = false,
                    IsScheduled = false,
                    Channel = InboxChannel.PublicService,
                    CitizenName = "Nguyễn Thị Lan",
                    CitizenPhone = "0912345678",
                    ServiceCode = "DK-001"
                },
                new InboxDocument
                {
                    Id = Guid.Parse("D0000000-0000-0000-0000-000000000007"),
                    DocumentNumber = "TTHC-2026-002",
                    Subject = "Cấp giấy phép xây dựng nhà ở riêng lẻ — Công dân Trần Văn Bình",
                    Category = "Hồ sơ TTHC",
                    Sender = "Trung tâm Phục vụ Hành chính công",
                    ReceivedDate = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-8), DateTimeKind.Utc),
                    IsUrgent = false,
                    IsScheduled = false,
                    Channel = InboxChannel.PublicService,
                    CitizenName = "Trần Văn Bình",
                    CitizenPhone = "0987654321",
                    ServiceCode = "XD-003"
                },
                new InboxDocument
                {
                    Id = Guid.Parse("D0000000-0000-0000-0000-000000000008"),
                    DocumentNumber = "TTHC-2026-003",
                    Subject = "Xác nhận tình trạng hôn nhân — Công dân Lê Hoàng Anh",
                    Category = "Hồ sơ TTHC",
                    Sender = "Trung tâm Phục vụ Hành chính công",
                    ReceivedDate = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(-2), DateTimeKind.Utc),
                    IsUrgent = true,
                    IsScheduled = false,
                    Channel = InboxChannel.PublicService,
                    CitizenName = "Lê Hoàng Anh",
                    CitizenPhone = "0366789012",
                    ServiceCode = "HN-002"
                }
            };

            context.InboxDocuments.AddRange(docs);
            await context.SaveChangesAsync();
            logger.LogInformation("Đã seed {Count} văn bản (Internal + TTHC công dân).", docs.Length);
        }
    }
}

