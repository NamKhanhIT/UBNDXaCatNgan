using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.AI
{
    public class RichSeedDatasetTests
    {
        private readonly ApplicationDbContext _context;

        public RichSeedDatasetTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        private string FindWorkspaceRoot()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                if (File.Exists(Path.Combine(dir.FullName, "scripts", "seed_database.sql")))
                {
                    return dir.FullName;
                }
                dir = dir.Parent;
            }
            return Directory.GetCurrentDirectory();
        }

        [Fact]
        public void SeedDatabaseSql_FileExistsAndIsNotEmpty()
        {
            // Arrange
            var workspaceRoot = FindWorkspaceRoot();
            var sqlPath = Path.Combine(workspaceRoot, "scripts", "seed_database.sql");

            // Act & Assert
            File.Exists(sqlPath).Should().BeTrue($"File seed_database.sql phải tồn tại tại: {sqlPath}");
            var content = File.ReadAllText(sqlPath);
            content.Should().NotBeNullOrWhiteSpace();
            content.Length.Should().BeGreaterThan(10000, "File seed phải chứa lượng dữ liệu mẫu phong phú");
        }

        [Fact]
        public void PhysicalSampleDocuments_MustExistOnDisk()
        {
            // Arrange: Danh sách tệp mẫu vật lý bắt buộc có trên máy chủ
            var expectedFiles = new[]
            {
                "sample_gm_so_ket_dang.pdf",
                "sample_chi_dao_thien_tai.pdf",
                "sample_kiem_tra_dat_dai.pdf",
                "sample_bc_thuy_loi.pdf",
                "sample_tthc_khai_sinh.pdf"
            };

            var workspaceRoot = FindWorkspaceRoot();
            var sqlPath = Path.Combine(workspaceRoot, "scripts", "seed_database.sql");
            var uploadsPath = Path.Combine(workspaceRoot, "uploads", "documents");

            // Act & Assert: các tệp mẫu phải được tham chiếu trong seed script
            File.Exists(sqlPath).Should().BeTrue($"File seed_database.sql phải tồn tại tại: {sqlPath}");
            var sqlContent = File.ReadAllText(sqlPath);
            foreach (var file in expectedFiles)
            {
                sqlContent.Should().Contain($"uploads/documents/{file}");
            }

            // Trên CI có thể không mount dữ liệu mẫu vật lý, chỉ kiểm tra khi thư mục thực sự tồn tại
            if (!Directory.Exists(uploadsPath))
            {
                var isCi = string.Equals(Environment.GetEnvironmentVariable("CI"), "true", StringComparison.OrdinalIgnoreCase);
                isCi.Should().BeTrue($"Thư mục uploads/documents phải tồn tại tại: {uploadsPath} khi không chạy CI.");
                return;
            }

            foreach (var file in expectedFiles)
            {
                var filePath = Path.Combine(uploadsPath, file);
                File.Exists(filePath).Should().BeTrue($"Tệp mẫu vật lý '{file}' phải tồn tại trên đĩa để tránh lỗi 404.");
                new FileInfo(filePath).Length.Should().BeGreaterThan(100, $"Tệp '{file}' phải có dung lượng thực tế.");
            }
        }

        [Fact]
        public async Task RichSeedDataset_AllEntitiesStructure_ShouldBeValidAndConsistent()
        {
            // Arrange: Khởi tạo dữ liệu mẫu tương đương với seed_database.sql
            var deptVp = new Department { Id = Guid.Parse("10000000-0000-0000-0000-000000000001"), Name = "Văn phòng HĐND & UBND", Code = "VAN_PHONG" };
            var deptKt = new Department { Id = Guid.Parse("10000000-0000-0000-0000-000000000002"), Name = "Phòng Kinh tế - Hạ tầng & Đô thị", Code = "KINH_TE" };
            var deptVh = new Department { Id = Guid.Parse("10000000-0000-0000-0000-000000000003"), Name = "Phòng Văn hóa - Xã hội", Code = "VAN_HOA_XA_HOI" };
            var deptHcc = new Department { Id = Guid.Parse("10000000-0000-0000-0000-000000000004"), Name = "Trung tâm Phục vụ Hành chính công", Code = "HANH_CHINH_CONG" };
            var deptDang = new Department { Id = Guid.Parse("10000000-0000-0000-0000-000000000005"), Name = "Khối Đảng - HĐND - UBMTTQ", Code = "KHOI_DANG_DOAN_THE" };

            _context.Departments.AddRange(deptVp, deptKt, deptVh, deptHcc, deptDang);

            // Users with rich profiles
            var adminUser = new User
            {
                Id = Guid.Parse("a0000000-0000-0000-0000-000000000001"),
                Username = "admin",
                FullName = "Nguyễn Đình Hùng",
                Email = "admin@catngan.gov.vn",
                PrimaryDepartmentId = deptVp.Id,
                ActiveRoleCode = "ChuTichUBND",
                Expertise = "Quản lý nhà nước, Điều hành chung",
                YearsOfExperience = 15
            };

            var maiUser = new User
            {
                Id = Guid.Parse("a0000000-0000-0000-0000-000000000005"),
                Username = "tp_vh",
                FullName = "Trần Thị Mai",
                Email = "tp_vh@catngan.gov.vn",
                PrimaryDepartmentId = deptVh.Id,
                ActiveRoleCode = "TruongPhong",
                Expertise = "Đất đai, Tài nguyên môi trường, Quy hoạch",
                YearsOfExperience = 8
            };

            var namUser = new User
            {
                Id = Guid.Parse("a0000000-0000-0000-0000-000000000006"),
                Username = "nam",
                FullName = "Nguyễn Văn Nam",
                Email = "nam@catngan.gov.vn",
                PrimaryDepartmentId = deptKt.Id,
                ActiveRoleCode = "ChuyenVien",
                Expertise = "Địa chính, Xây dựng, TTHC",
                YearsOfExperience = 4
            };

            _context.Users.AddRange(adminUser, maiUser, namUser);

            // 5 AI Category documents
            var docMeeting = new InboxDocument
            {
                Id = Guid.NewGuid(),
                DocumentNumber = "12/GM-HU",
                Subject = "Giấy mời dự Hội nghị sơ kết công tác xây dựng Đảng",
                AiCategory = "MeetingInvitation",
                AiTitle = "Hội nghị sơ kết công tác Đảng 6 tháng đầu năm 2026",
                AiConfidenceScore = 0.95,
                AiEventStartDateTime = DateTime.UtcNow.AddDays(2),
                AiProcessingStatus = "Analyzed"
            };

            var docDirective = new InboxDocument
            {
                Id = Guid.NewGuid(),
                DocumentNumber = "124/UBND-VP",
                Subject = "Chỉ đạo khẩn: Phòng chống thiên tai mùa mưa bão",
                AiCategory = "SuperiorDirective",
                AiTitle = "Chỉ đạo khẩn phòng chống thiên tai 2026",
                AiConfidenceScore = 0.94,
                AiExtractedDeadline = DateTime.UtcNow.AddDays(5),
                AiProcessingStatus = "Analyzed"
            };

            var docLowConfidence = new InboxDocument
            {
                Id = Guid.NewGuid(),
                DocumentNumber = "19/STNMT-VP",
                Subject = "Kết luận thanh tra đất đai (Scan mờ)",
                AiCategory = "SuperiorDirective",
                AiTitle = "Kết luận thanh tra đất công ích 5%",
                AiConfidenceScore = 0.48, // < 0.6
                AiProcessingStatus = "Analyzed"
            };

            var docPastDeadline = new InboxDocument
            {
                Id = Guid.NewGuid(),
                DocumentNumber = "42/SNN-CCTY",
                Subject = "Đôn đốc báo cáo tổng đàn gia súc",
                AiCategory = "SuperiorDirective",
                AiExtractedDeadline = DateTime.UtcNow.AddDays(-3), // Past date
                AiConfidenceScore = 0.82,
                AiProcessingStatus = "Analyzed"
            };

            var docTask = new InboxDocument
            {
                Id = Guid.NewGuid(),
                DocumentNumber = "88/CV-UBND",
                Subject = "Yêu cầu kiểm tra hiện trạng đất đai cầu Cát Ngạn",
                AiCategory = "TaskAssignmentDown",
                AiConfidenceScore = 0.93,
                AiProcessingStatus = "Analyzed"
            };

            var docReport = new InboxDocument
            {
                Id = Guid.NewGuid(),
                DocumentNumber = "102/BC-SNN",
                Subject = "Báo cáo hiện trạng công trình thủy lợi",
                AiCategory = "ReportSubmissionUp",
                AiConfidenceScore = 0.89,
                AiProcessingStatus = "Analyzed"
            };

            var docOther = new InboxDocument
            {
                Id = Guid.NewGuid(),
                DocumentNumber = "TTHC-2026-001",
                Subject = "Đăng ký khai sinh — Nguyễn Thị Lan",
                AiCategory = "Other",
                AiConfidenceScore = 0.97,
                AiProcessingStatus = "Analyzed"
            };

            var docPending = new InboxDocument
            {
                Id = Guid.NewGuid(),
                DocumentNumber = "188/CV-STTTT",
                Subject = "Hướng dẫn triển khai Đề án chuyển đổi số",
                AiProcessingStatus = "Pending"
            };

            _context.InboxDocuments.AddRange(docMeeting, docDirective, docLowConfidence, docPastDeadline, docTask, docReport, docOther, docPending);

            // Task and SubTasks
            var task1 = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Rà soát đất nông nghiệp",
                AssignerId = adminUser.Id,
                AssigneeId = namUser.Id,
                DepartmentId = deptKt.Id,
                Status = TaskStatusEnum.InProgress,
                ProgressPercentage = 75
            };
            _context.TaskItems.Add(task1);

            var sub1 = new SubTask { Id = Guid.NewGuid(), TaskItemId = task1.Id, Title = "Kiểm tra bản đồ", IsCompleted = true };
            var sub2 = new SubTask { Id = Guid.NewGuid(), TaskItemId = task1.Id, Title = "Khảo sát thực địa", IsCompleted = true };
            var sub3 = new SubTask { Id = Guid.NewGuid(), TaskItemId = task1.Id, Title = "Lập biên bản", IsCompleted = true };
            var sub4 = new SubTask { Id = Guid.NewGuid(), TaskItemId = task1.Id, Title = "Trình lãnh đạo", IsCompleted = false };
            _context.SubTasks.AddRange(sub1, sub2, sub3, sub4);

            await _context.SaveChangesAsync();

            // Assert
            var departmentsCount = await _context.Departments.CountAsync();
            departmentsCount.Should().Be(5);

            var users = await _context.Users.ToListAsync();
            users.Should().HaveCount(3);
            users.Should().OnlyContain(u => u.YearsOfExperience > 0 && !string.IsNullOrWhiteSpace(u.Expertise));

            var docs = await _context.InboxDocuments.ToListAsync();
            docs.Should().HaveCount(8);
            docs.Should().Contain(d => d.AiCategory == "MeetingInvitation");
            docs.Should().Contain(d => d.AiCategory == "SuperiorDirective");
            docs.Should().Contain(d => d.AiCategory == "TaskAssignmentDown");
            docs.Should().Contain(d => d.AiCategory == "ReportSubmissionUp");
            docs.Should().Contain(d => d.AiCategory == "Other");
            docs.Should().Contain(d => d.AiConfidenceScore < 0.6);
            docs.Should().Contain(d => d.AiExtractedDeadline < DateTime.UtcNow);
            docs.Should().Contain(d => d.AiProcessingStatus == "Pending");

            var subTasks = await _context.SubTasks.Where(s => s.TaskItemId == task1.Id).ToListAsync();
            subTasks.Should().HaveCount(4);
            subTasks.Count(s => s.IsCompleted).Should().Be(3);
        }
    }
}
