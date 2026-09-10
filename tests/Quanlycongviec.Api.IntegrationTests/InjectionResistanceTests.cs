using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Quanlycongviec.Api.Controllers;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword;
using Quanlycongviec.Application.Features.Auth.Commands.Register;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Api.IntegrationTests
{
    // =====================================================================
    // BẢO MẬT (Audit Đợt 4): Suite chống chèn (SQLi/XSS/Path Traversal).
    // Chiến lược: EF Core parameterized là tuyến phòng thủ chính — test khẳng
    // định payload đi qua đường handler thật được lưu/ngắt như DỮ LIỆU, và
    // quét tĩnh đảm bảo không ai đưa raw SQL vào tầng Infrastructure.
    // =====================================================================
    public class InjectionResistanceTests
    {
        private static ApplicationDbContext NewContext() =>
            new(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

        private static Role SeedChuyenVienRole(ApplicationDbContext context)
        {
            var role = new Role
            {
                Id = Guid.NewGuid(),
                Name = "Chuyên viên",
                Code = "ChuyenVien",
                RankLevel = 5
            };
            context.Roles.Add(role);
            context.SaveChanges();
            return role;
        }

        private static RegisterCommandHandler BuildRegisterHandler(ApplicationDbContext context)
        {
            var passwordHasher = new Mock<IPasswordHasher>();
            passwordHasher.Setup(p => p.HashPassword(It.IsAny<string>())).Returns("hashed-payload");
            var jwt = new Mock<IJwtTokenService>();
            jwt.Setup(j => j.GenerateToken(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<System.Collections.Generic.IEnumerable<string>>(), It.IsAny<int>()))
               .Returns("jwt-token");
            var refresh = new Mock<IRefreshTokenService>();
            refresh.Setup(r => r.CreateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                   .ReturnsAsync("refresh-token");

            return new RegisterCommandHandler(context, passwordHasher.Object, jwt.Object, refresh.Object);
        }

        public static System.Collections.Generic.IEnumerable<object[]> HostilePayloads =>
            new System.Collections.Generic.List<object[]>
            {
                new object[] { "' OR '1'='1' --" },
                new object[] { "'; DROP TABLE Users;--" },
                new object[] { "admin'--" },
                new object[] { "1' UNION SELECT PasswordHash FROM Users--" },
                new object[] { "<script>alert('xss')</script>" },
                new object[] { "<img src=x onerror=alert(document.cookie)>" },
                new object[] { "\"><svg onload=alert(1)>" }
            };

        [Theory]
        [MemberData(nameof(HostilePayloads))]
        public async Task Register_HostilePayload_In_FullName_Is_Stored_As_Parameterized_Data(string payload)
        {
            // Payload phải đi qua đường handler THẬT và được đối xử như dữ liệu:
            // lưu nguyên vẹn (EF parameterized), không nổ exception, không hủy bảng.
            await using var context = NewContext();
            SeedChuyenVienRole(context);
            var handler = BuildRegisterHandler(context);

            var username = $"nv_{Math.Abs(payload.GetHashCode()):x8}";
            var act = async () => await handler.Handle(
                new RegisterCommand(username, payload, $"{username}@example.gov.vn", "MatKhau@123", "ChuyenVien"),
                CancellationToken.None);

            await act.Should().NotThrowAsync("payload chuỗi phải được tham số hóa, không bao giờ ghép vào SQL");

            var saved = await context.Users.AsNoTracking().FirstAsync(u => u.Username == username);
            saved.FullName.Should().Be(payload, "giá trị phải round-trip NGUYÊN VẸN như dữ liệu (không biến dạng, không thực thi)");

            // Payload "DROP TABLE" phải vô hại — bảng Users vẫn còn nguyên người dùng vừa tạo.
            (await context.Users.CountAsync()).Should().BeGreaterThanOrEqualTo(1);
        }

        [Fact]
        public async Task ForgotPassword_Nonexistent_Email_Must_Not_Reveal_Account_Existence()
        {
            await using var context = NewContext();
            var emailService = new Mock<IEmailService>();
            var logger = NullLogger<SendPasswordResetOtpCommandHandler>.Instance;
            var handler = new SendPasswordResetOtpCommandHandler(context, emailService.Object, logger);

            // Anti-enumeration (H4): email không tồn tại cũng phải trả true,
            // KHÔNG gửi mail, KHÔNG ném lỗi phân biệt.
            var result = await handler.Handle(
                new SendPasswordResetOtpCommand("khong-ton-tai@example.gov.vn"),
                CancellationToken.None);

            result.Should().BeTrue("luồng forgot-password phải trả kết quả đồng nhất chống enumeration");
            emailService.Verify(
                e => e.SendPasswordResetOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
                Times.Never,
                "tuyệt đối không gửi mail cho tài khoản không tồn tại");
        }

        [Theory]
        [InlineData("..'..\\..\\..\\Windows\\ubnd-evil")]
        [InlineData("..\\..\\ubnd-evil")]
        [InlineData("../../../../tmp/ubnd-evil.pdf")]
        public async Task Upload_PathTraversal_Filename_Must_Stay_Inside_Storage_Directory(string hostileName)
        {
            // BẢO MẬT (Đợt 4 - N1): tên file client-controlled bị nối trực tiếp vào
            // đường dẫn lưu ở FilesController.UploadFile → có thể vượt ra ngoài
            // uploads/documents. Test neo hành vi AN TOÀN mong muốn.
            var options = Options.Create(new FileUploadOptions
            {
                MaxFileSizeMB = 20,
                AllowedExtensions = "pdf,doc,docx,jpg,jpeg,png,xlsx"
            });
            await using var context = NewContext();
            var controller = new FilesController(
                context,
                new Mock<IOcrService>().Object,
                new Mock<IDocumentAiService>().Object,
                options,
                NullLogger<FilesController>.Instance,
                new AllowAllDocumentAccessService());

            var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
            }, "TestAuth"));
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = principal }
            };

            var safeExtName = hostileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)
                ? hostileName
                : hostileName + ".pdf";

            var fileMock = new Mock<IFormFile>();
            fileMock.Setup(f => f.FileName).Returns(safeExtName);
            fileMock.Setup(f => f.Length).Returns(64);
            fileMock.Setup(f => f.ContentType).Returns("application/pdf");
            fileMock.Setup(f => f.OpenReadStream())
                    .Returns(new MemoryStream(new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31 }));
            fileMock.Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
                    .Returns(Task.CompletedTask);

            var result = await controller.UploadFile(fileMock.Object, Guid.NewGuid());

            var ok = result as OkObjectResult;
            ok.Should().NotBeNull("file .pdf hợp lệ về extension phải vẫn upload được sau khi sanitize");

            var att = context.DocumentAttachments.AsEnumerable().Single();
            var expectedRoot = Path.GetFullPath(
                Path.Combine(Directory.GetCurrentDirectory(), "uploads", "documents"));
            var actualPath = Path.GetFullPath(att.FilePath!);

            actualPath.Should().StartWith(expectedRoot + Path.DirectorySeparatorChar,
                $"đường dẫn lưu phải nằm trong storage root. Tên client: '{safeExtName}'");

            att.FileName.Should().NotContain("..", "tên lưu trữ đã sanitize không được chứa thành phần điều hướng");

            // Dọn dẹp vật lý nếu test ghi file thật xuống đĩa.
            try { if (System.IO.File.Exists(actualPath)) System.IO.File.Delete(actualPath); } catch { /* best-effort */ }
        }

        [Fact]
        public void Static_No_Raw_Sql_Anywhere_In_Infrastructure()
        {
            // Rào chắn tĩnh: toàn dự án cấm ghép SQL thô — mọi truy vấn phải qua EF
            // (LINQ parameterized) hoặc stored procedure có review riêng.
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            DirectoryInfo? repoRoot = null;
            for (var i = 0; i < 12 && dir != null; i++)
            {
                if (System.IO.File.Exists(Path.Combine(dir.FullName, "Quanlycongviec.sln")))
                {
                    repoRoot = dir;
                    break;
                }
                dir = dir.Parent!;
            }

            repoRoot.Should().NotBeNull("không định vị được gốc repo (Quanlycongviec.sln) từ thư mục test");

            var srcDir = Path.Combine(repoRoot!.FullName, "src");
            Directory.Exists(srcDir).Should().BeTrue();

            var forbidden = new[] { "FromSqlRaw(", "ExecuteSqlRaw(", "SqlQueryRaw(" };
            var offenders =
                Directory.EnumerateFiles(srcDir, "*.cs", SearchOption.AllDirectories)
                    .Where(f => !f.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}")
                             && !f.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}"))
                    .SelectMany(f => System.IO.File.ReadAllLines(f)
                        .Select((line, idx) => new { File = f, Line = idx + 1, Text = line })
                        .Where(x => forbidden.Any(pat => x.Text.Contains(pat))))
                    .Select(x => $"{Path.GetRelativePath(repoRoot!.FullName, x.File)}:{x.Line}")
                    .ToList();

            offenders.Should().BeEmpty(
                "phát hiện dùng raw SQL — bắt buộc review bảo mật riêng hoặc chuyển sang LINQ: " +
                string.Join("; ", offenders));
        }
    }
}
