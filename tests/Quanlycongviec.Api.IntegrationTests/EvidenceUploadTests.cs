using System;
using System.IO;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Api.Controllers;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Api.IntegrationTests
{
    /// <summary>
    /// 07-09-2026: Integration tests cho evidence upload endpoint
    /// POST /api/v1/Reports/grad/evidence/upload
    /// </summary>
    public class EvidenceUploadTests
    {
        private readonly ApplicationDbContext _context;
        private readonly ReportsController _controller;
        private readonly Guid _leaderUserId = Guid.NewGuid();
        private readonly Guid _staffUserId = Guid.NewGuid();

        public EvidenceUploadTests()
        {
            var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(dbOptions);
            _controller = new ReportsController(null!, _context);
        }

        private void SetLeaderUser()
        {
            var role = new Role { Id = Guid.NewGuid(), Name = "Leader", Code = "L", RankLevel = 1 };
            var user = new User
            {
                Id = _leaderUserId,
                Username = $"u_{_leaderUserId:N}",
                FullName = $"Leader {_leaderUserId}",
                Email = $"{_leaderUserId}@test.local"
            };
            user.UserRoles.Add(new UserRole { User = user, Role = role, DepartmentId = Guid.NewGuid() });
            _context.Roles.Add(role);
            _context.Users.Add(user);
            _context.SaveChanges();

            var leader = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, _leaderUserId.ToString()),
                new Claim("RankLevel", "1")
            }, "TestAuth"));

            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = leader }
            };
        }

        private static IFormFile CreateFakeFile(string fileName, byte[] content)
        {
            var ms = new MemoryStream(content);
            var mock = new Mock<IFormFile>();
            mock.Setup(f => f.FileName).Returns(fileName);
            mock.Setup(f => f.Length).Returns(content.Length);
            mock.Setup(f => f.OpenReadStream()).Returns(ms);
            // CopyToAsync nop — file không thực sự ghi đĩa trong test
            mock.Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
            return mock.Object;
        }

        // ── Test 1: Upload file PDF hợp lệ → 200, attachmentId hợp lệ ─────────

        [Fact]
        public async Task UploadEvidence_ValidPdf_ReturnsAttachmentId()
        {
            SetLeaderUser();

            // Valid PDF magic bytes: %PDF-
            byte[] pdfContent = new byte[1024];
            pdfContent[0] = 0x25; // %
            pdfContent[1] = 0x50; // P
            pdfContent[2] = 0x44; // D
            pdfContent[3] = 0x46; // F
            pdfContent[4] = 0x2D; // -

            var file = CreateFakeFile("bienban.pdf", pdfContent);

            var result = await _controller.UploadEvidence(file, CancellationToken.None);

            result.Should().BeOfType<OkObjectResult>();
            var ok = (OkObjectResult)result;
            ok.Value.Should().NotBeNull();

            // Parse JSON response để lấy attachmentId
            var json = System.Text.Json.JsonSerializer.Serialize(ok.Value);
            var doc = System.Text.Json.JsonDocument.Parse(json);
            string? attachmentIdStr = null;
            if (doc.RootElement.TryGetProperty("data", out var dataProp))
            {
                attachmentIdStr = dataProp.GetString();
            }

            attachmentIdStr.Should().NotBeNullOrEmpty();
            Guid.Parse(attachmentIdStr!).Should().NotBe(Guid.Empty);

            // Verify DB record
            var attachment = await _context.DocumentAttachments
                .FirstOrDefaultAsync(a => a.Id.ToString() == attachmentIdStr);
            attachment.Should().NotBeNull();
            attachment!.TargetType.Should().Be("EvaluationEvidence");
            attachment.DocumentId.Should().Be(Guid.Empty);
            attachment.UploadedByUserId.Should().Be(_leaderUserId);
            attachment.OriginalFileName.Should().Be("bienban.pdf");
            attachment.FileSize.Should().Be(1024);
            attachment.AttachmentType.Should().Be("Evidence");
        }

        // ── Test 2: Upload file rỗng (0 byte) → 400 ────────────────────────

        [Fact]
        public async Task UploadEvidence_EmptyFile_ReturnsBadRequest()
        {
            SetLeaderUser();
            var file = CreateFakeFile("empty.pdf", Array.Empty<byte>());

            var result = await _controller.UploadEvidence(file, CancellationToken.None);

            result.Should().BeOfType<BadRequestObjectResult>();
            var bad = (BadRequestObjectResult)result;
            bad.Value.Should().NotBeNull();
            var json = System.Text.Json.JsonSerializer.Serialize(bad.Value);
            var decoded = System.Text.RegularExpressions.Regex.Unescape(json);
            decoded.Should().Contain("rỗng");
        }

        // ── Test 3: Upload file >10MB → 400 ──────────────────────────────

        [Fact]
        public async Task UploadEvidence_TooLargeFile_ReturnsBadRequest()
        {
            SetLeaderUser();

            // File 15MB
            byte[] largeContent = new byte[15 * 1024 * 1024];
            largeContent[0] = 0x25;
            var file = CreateFakeFile("large.pdf", largeContent);

            var result = await _controller.UploadEvidence(file, CancellationToken.None);

            result.Should().BeOfType<BadRequestObjectResult>();
            var bad = (BadRequestObjectResult)result;
            bad.Value.Should().NotBeNull();
            // Kiểm tra decoded message
            var json = System.Text.Json.JsonSerializer.Serialize(bad.Value);
            var decoded = System.Text.RegularExpressions.Regex.Unescape(json);
            decoded.Should().Contain("vượt quá dung lượng");
        }

        // ── Test 4: Upload file .exe (extension không trong allowlist) → 400 ──

        [Fact]
        public async Task UploadEvidence_UnsupportedExtension_ReturnsBadRequest()
        {
            SetLeaderUser();
            byte[] content = new byte[100];
            var file = CreateFakeFile("malware.exe", content);

            var result = await _controller.UploadEvidence(file, CancellationToken.None);

            result.Should().BeOfType<BadRequestObjectResult>();
            var bad = (BadRequestObjectResult)result;
            bad.Value.Should().NotBeNull();
            var json = System.Text.Json.JsonSerializer.Serialize(bad.Value);
            var decoded = System.Text.RegularExpressions.Regex.Unescape(json);
            decoded.Should().Contain("không được hỗ trợ");
        }

        // ── Test 5: Upload file PNG hợp lệ → success ────────────────────

        [Fact]
        public async Task UploadEvidence_ValidPng_ReturnsAttachmentId()
        {
            SetLeaderUser();

            // Valid PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
            byte[] pngContent = new byte[512];
            pngContent[0] = 0x89;
            pngContent[1] = 0x50;
            pngContent[2] = 0x4E;
            pngContent[3] = 0x47;
            pngContent[4] = 0x0D;
            pngContent[5] = 0x0A;
            pngContent[6] = 0x1A;
            pngContent[7] = 0x0A;

            var file = CreateFakeFile("chungchi.png", pngContent);

            var result = await _controller.UploadEvidence(file, CancellationToken.None);

            result.Should().BeOfType<OkObjectResult>();
        }

        // ── Test 6: Staff rank=5 → Forbid ─────────────────────────────────

        [Fact]
        public async Task UploadEvidence_StaffRank_ReturnsForbid()
        {
            // Staff claims — không cần DB setup vì Forbid() xảy ra trước khi truy cập DB
            var staff = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, _staffUserId.ToString()),
                new Claim("RankLevel", "5")
            }, "TestAuth"));
            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = staff }
            };

            byte[] content = new byte[100];
            content[0] = 0x25;
            var file = CreateFakeFile("test.pdf", content);

            var result = await _controller.UploadEvidence(file, CancellationToken.None);

            result.Should().BeOfType<ForbidResult>();
        }
    }
}
