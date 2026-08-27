using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Api.IntegrationTests
{
    // =====================================================================
    // BẢO MẬT (Audit Đợt 4 - M4): Xoay vòng refresh token nguyên tử
    // + phát hiện tái sử dụng (reuse-detection) khóa toàn bộ phiên.
    // =====================================================================
    public class RefreshTokenRotationTests : IDisposable
    {
        private readonly ApplicationDbContext _context;
        private readonly RefreshTokenService _service;

        public RefreshTokenRotationTests()
        {
            _context = new ApplicationDbContext(
                new DbContextOptionsBuilder<ApplicationDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options);

            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new System.Collections.Generic.Dictionary<string, string?>
                {
                    ["Jwt:Secret"] = "unit-test-secret-key-must-be-at-least-32-chars!!",
                    ["Jwt:Issuer"] = "TestIssuer",
                    ["Jwt:Audience"] = "TestAudience"
                })
                .Build();

            _service = new RefreshTokenService(_context, new JwtTokenService(configuration), configuration);
        }

        public void Dispose() => _context.Dispose();

        [Fact]
        public async Task Rotate_HappyPath_RevokesOld_LinksNew_IssuesUsableToken()
        {
            var userId = Guid.NewGuid();
            var rawOld = await _service.CreateAsync(userId, CancellationToken.None);

            var rawNew = await _service.RotateAsync(userId, rawOld, CancellationToken.None);

            rawNew.Should().NotBeNullOrWhiteSpace();
            rawNew.Should().NotBe(rawOld, "token mới phải khác token cũ");

            var oldRow = await _context.RefreshTokens.AsNoTracking()
                .SingleAsync(t => t.TokenHash == Hash(rawOld));
            oldRow.RevokedUtc.Should().NotBeNull("token cũ phải bị revoke");
            oldRow.ReplacedByTokenHash.Should().Be(
                Hash(rawNew),
                "ReplacedByTokenHash phải ghi nhận chuỗi xoay vòng — field tồn tại từ trước nhưng chưa từng được dùng");

            // Token mới phải usable qua FindValidAsync
            var found = await _service.FindValidAsync(rawNew, CancellationToken.None);
            found.Should().NotBeNull();
        }

        [Fact]
        public async Task Rotate_ReusingRotatedToken_RevokesEverything_And_Throws()
        {
            var userId = Guid.NewGuid();
            var rawFirst = await _service.CreateAsync(userId, CancellationToken.None);
            await _service.CreateAsync(userId, CancellationToken.None); // phiên thứ hai của cùng user

            var rawSecond = await _service.RotateAsync(userId, rawFirst, CancellationToken.None);

            // Kẻ xấu tái sử dụng token ĐÃ XOAY → phải nổ và mất toàn bộ phiên
            Func<Task> reuse = () => _service.RotateAsync(userId, rawFirst, CancellationToken.None);
            await reuse.Should().ThrowAsync<UnauthorizedAccessException>(
                "tái sử dụng token đã xoay là dấu hiệu bị đánh cắp — bắt buộc từ chối");

            var all = await _context.RefreshTokens.AsNoTracking().Where(t => t.UserId == userId).ToListAsync();
            all.Should().OnlyContain(t => t.RevokedUtc != null,
                "reuse-detection phải thu hồi TOÀN BỘ phiên của tài khoản");

            // Cả token vừa cấp ở lần xoay hợp lệ cũng bị thu hồi theo chính sách an toàn
            (await _service.FindValidAsync(rawSecond, CancellationToken.None)).Should().BeNull();
        }

        private static string Hash(string raw)
        {
            var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(raw));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }
    }
}
