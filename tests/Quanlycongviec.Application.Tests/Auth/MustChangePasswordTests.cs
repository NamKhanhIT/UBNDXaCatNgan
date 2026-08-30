using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.Commands.ChangePassword;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Auth
{
    // =====================================================================
    // BẢO MẬT (Audit Đợt 4 - A5): Ép đổi mật khẩu lần đầu với tài khoản khởi tạo.
    //   CP  - Endpoint đổi mật khẩu: sai mật khẩu cũ bị chặn, đúng thì gỡ cờ
    //         + thu hồi phiên cũ + cấp cặp token sạch
    //   CLM - JWT phải nhúng claim MustChangePassword đúng trạng thái cờ
    // =====================================================================
    public class MustChangePasswordTests : IDisposable
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<IPasswordHasher> _hasher = new();
        private readonly Mock<IRefreshTokenService> _refresh = new();

        public MustChangePasswordTests()
        {
            _context = new ApplicationDbContext(
                new DbContextOptionsBuilder<ApplicationDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options);

            _hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("new-hash-from-test");
            _hasher.Setup(h => h.VerifyPassword(It.IsAny<string>(), It.IsAny<string>()))
                   .Returns((string input, string stored) => stored == "seeded-hash" && input == "ubndxa2026");
            _refresh.Setup(r => r.CreateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync("fresh-refresh-token");
            _refresh.Setup(r => r.RevokeAllForUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                    .Returns(Task.CompletedTask);
        }

        public void Dispose() => _context.Dispose();

        private User SeedUser(bool mustChange)
        {
            var role = new Role { Id = Guid.NewGuid(), Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "canbo_seed",
                FullName = "Cán Bộ Khởi Tạo",
                Email = "canbo_seed@example.gov.vn",
                PasswordHash = "seeded-hash",
                ActiveRoleCode = "ChuyenVien",
                MustChangePassword = mustChange,
                MfaEnabled = false
            };
            _context.Roles.Add(role);
            _context.Users.Add(user);
            _context.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id, IsPrimary = true });
            _context.SaveChanges();
            return user;
        }

        private ChangePasswordCommandHandler BuildHandler(IJwtTokenService jwt) =>
            new(_context, _hasher.Object, jwt, _refresh.Object,
                NullLogger<ChangePasswordCommandHandler>.Instance);

        [Fact]
        public async Task CP_Wrong_Current_Password_Is_Rejected()
        {
            var user = SeedUser(mustChange: true);
            var jwt = BuildRealJwtService();
            var handler = BuildHandler(jwt);

            var act = async () => await handler.Handle(
                new ChangePasswordCommand(user.Id, "mat-khau-sai", "MatKhau@Moi1"), CancellationToken.None);

            var ex = await act.Should().ThrowAsync<InvalidOperationException>();
            ex.Which.Message.Should().Contain("không chính xác");

            (await _context.Users.AsNoTracking().FirstAsync(u => u.Id == user.Id))
                .MustChangePassword.Should().BeTrue("thất bại không được gỡ cờ ép đổi");
        }

        [Fact]
        public async Task CP_Correct_Password_Clears_Flag_Revokes_Old_And_Issues_Fresh_Tokens()
        {
            var user = SeedUser(mustChange: true);
            var jwt = BuildRealJwtService();
            var handler = BuildHandler(jwt);

            var result = await handler.Handle(
                new ChangePasswordCommand(user.Id, "ubndxa2026", "MatKhau@Moi1"), CancellationToken.None);

            result.MustChangePassword.Should().BeFalse("đổi thành công phải gỡ cờ ngay trong response");
            result.Token.Should().NotBeNullOrWhiteSpace();
            result.RefreshToken.Should().Be("fresh-refresh-token");

            _refresh.Verify(r => r.RevokeAllForUserAsync(user.Id, It.IsAny<CancellationToken>()),
                Times.Once, "phải thu hồi toàn bộ phiên cũ theo pattern H6");

            // Thứ tự an toàn: revoke TRƯỚC rồi mới cấp token mới
            _refresh.Invocations.Count(i => i.Method.Name == "CreateAsync").Should().Be(1);

            var stored = await _context.Users.AsNoTracking().FirstAsync(u => u.Id == user.Id);
            stored.PasswordHash.Should().Be("new-hash-from-test");
            stored.MustChangePassword.Should().BeFalse();
        }

        [Fact]
        public void CLM_Jwt_Embeds_MustChangePassword_Claim_Exactly_When_Flag_Set()
        {
            var jwt = BuildRealJwtService();
            var handler = new JwtSecurityTokenHandler();

            var flagged = SeedUser(mustChange: true);
            var flaggedToken = jwt.GenerateToken(flagged, "ChuyenVien", new[] { "ChuyenVien" }, 5);
            handler.ReadJwtToken(flaggedToken).Claims
                .Should().Contain(c => c.Type == "MustChangePassword" && c.Value == "true",
                    "gate middleware dựa vào claim này để chặn API nghiệp vụ");

            var normal = SeedUser(mustChange: false);
            var normalToken = jwt.GenerateToken(normal, "ChuyenVien", new[] { "ChuyenVien" }, 5);
            handler.ReadJwtToken(normalToken).Claims
                .Should().NotContain(c => c.Type == "MustChangePassword",
                    "tài khoản thường không được mang claim gây chặn oan");
        }

        private static IJwtTokenService BuildRealJwtService()
        {
            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:Secret"] = "unit-test-secret-key-must-be-at-least-32-chars!!",
                    ["Jwt:Issuer"] = "TestIssuer",
                    ["Jwt:Audience"] = "TestAudience"
                })
                .Build();
            return new JwtTokenService(configuration);
        }
    }
}
