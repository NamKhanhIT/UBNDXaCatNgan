using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.Commands.ChangePassword;
using Quanlycongviec.Application.Features.Auth.Commands.Mfa;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Auth
{
    // ================================================================================================
    // BỘ KIỂM THỬ TỰ ĐỘNG (UNIT TESTS): QUY TRÌNH ĐỔI MẬT KHẨU 2 BƯỚC BẢO MẬT
    // - File này chỉ phục vụ việc chạy lệnh 'dotnet test' để tự động rà soát lỗi logic code trước khi deploy.
    // - Kiểm tra độc lập trên cơ sở dữ liệu ảo (In-Memory Database) cho TẤT CẢ các vai trò và tài khoản khác nhau.
    // - Hệ thống thực tế (API & Web) áp dụng đồng nhất cho 100% cán bộ, công chức thuộc UBND Cấp Xã.
    // ================================================================================================
    public class ChangePasswordWorkflowTests : IDisposable
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<IPasswordHasher> _hasher = new();
        private readonly Mock<IRefreshTokenService> _refresh = new();
        private readonly Mock<IEmailService> _emailService = new();
        private readonly Mock<ITotpService> _totpService = new();
        private readonly IJwtTokenService _jwt;

        public ChangePasswordWorkflowTests()
        {
            _context = new ApplicationDbContext(
                new DbContextOptionsBuilder<ApplicationDbContext>()
                    .UseInMemoryDatabase(Guid.NewGuid().ToString())
                    .Options);

            _hasher.Setup(h => h.HashPassword(It.IsAny<string>())).Returns("new-hashed-pw");
            _hasher.Setup(h => h.VerifyPassword(It.IsAny<string>(), It.IsAny<string>()))
                   .Returns((string input, string stored) => stored == "current-hash" && input == "CorrectCurrentPass123!");
            _refresh.Setup(r => r.CreateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync("fresh-refresh-token");
            _refresh.Setup(r => r.RevokeAllForUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                    .Returns(Task.CompletedTask);
            _emailService.Setup(e => e.SendPasswordResetOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                         .ReturnsAsync(true);
            _totpService.Setup(t => t.Validate(It.IsAny<string>(), "123456", It.IsAny<DateTime?>())).Returns(true);

            var inMemoryConfig = new Dictionary<string, string?>
            {
                ["Jwt:Secret"] = "ThisIsASecretKeyForJwtTokenServiceMustBeLongEnough1234567890",
                ["Jwt:Key"] = "ThisIsASecretKeyForJwtTokenServiceMustBeLongEnough1234567890",
                ["Jwt:Issuer"] = "Quanlycongviec.Test",
                ["Jwt:Audience"] = "Quanlycongviec.Test",
                ["Jwt:DurationInMinutes"] = "60"
            };
            var config = new ConfigurationBuilder().AddInMemoryCollection(inMemoryConfig).Build();
            _jwt = new JwtTokenService(config);
        }

        public void Dispose() => _context.Dispose();

        // Khởi tạo tài khoản mẫu với nhiều vai trò khác nhau (Chủ tịch, Bí thư, Trưởng phòng, Chuyên viên)
        private User SeedUser(string username, string fullName, string email, string roleCode, int rankLevel, bool mfaEnabled)
        {
            var role = new Role { Id = Guid.NewGuid(), Name = roleCode, Code = roleCode, RankLevel = rankLevel };
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = username,
                FullName = fullName,
                Email = email,
                PasswordHash = "current-hash",
                ActiveRoleCode = roleCode,
                MustChangePassword = false,
                MfaEnabled = mfaEnabled,
                MfaSecret = mfaEnabled ? "JBSWY3DPEHPK3PXP" : null
            };
            _context.Roles.Add(role);
            _context.Users.Add(user);
            _context.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id, IsPrimary = true });
            _context.SaveChanges();
            return user;
        }

        [Theory]
        [InlineData("chutich_ubnd", "Chủ Tịch UBND Xã", "chutich@catngan.gov.vn", "ChuTichUBND", 1, true)]
        [InlineData("bithu_du", "Bí Thư Đảng Ủy", "bithu@catngan.gov.vn", "BiThuDU", 1, false)]
        [InlineData("truongphong_tc", "Trưởng Phòng Tài Chính", "truongphong@catngan.gov.vn", "TruongPhong", 3, true)]
        [InlineData("chuyenvien_dc", "Chuyên Viên Địa Chính", "chuyenvien@catngan.gov.vn", "ChuyenVien", 5, false)]
        public async Task SendOtp_AppliesToAnyUserRole_GeneratesOtp_And_DispatchesEmail(
            string username, string fullName, string email, string roleCode, int rankLevel, bool mfaEnabled)
        {
            var user = SeedUser(username, fullName, email, roleCode, rankLevel, mfaEnabled);
            var handler = new SendChangePasswordOtpCommandHandler(_context, _emailService.Object, NullLogger<SendChangePasswordOtpCommandHandler>.Instance);

            var res = await handler.Handle(new SendChangePasswordOtpCommand(user.Id), CancellationToken.None);

            res.Should().BeTrue();
            var updatedUser = await _context.Users.FindAsync(user.Id);
            updatedUser!.PasswordResetOtp.Should().NotBeNullOrEmpty();
            updatedUser.PasswordResetOtpExpiry.Should().BeAfter(DateTime.UtcNow);
        }

        [Theory]
        [InlineData("chutich_ubnd", "Chủ Tịch UBND Xã", "chutich@catngan.gov.vn", "ChuTichUBND", 1, true)]
        [InlineData("chuyenvien_dc", "Chuyên Viên Địa Chính", "chuyenvien@catngan.gov.vn", "ChuyenVien", 5, false)]
        public async Task VerifyStep1_WrongPassword_ThrowsException_ForAnyUser(
            string username, string fullName, string email, string roleCode, int rankLevel, bool mfaEnabled)
        {
            var user = SeedUser(username, fullName, email, roleCode, rankLevel, mfaEnabled);
            var handler = new VerifyChangePasswordStepCommandHandler(_context, _hasher.Object, _totpService.Object, _jwt, NullLogger<VerifyChangePasswordStepCommandHandler>.Instance);

            var act = () => handler.Handle(new VerifyChangePasswordStepCommand(user.Id, "WrongPass", "123456", "totp"), CancellationToken.None);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("*Mật khẩu hiện tại không chính xác*");
        }

        [Theory]
        [InlineData("chutich_ubnd", "Chủ Tịch UBND Xã", "chutich@catngan.gov.vn", "ChuTichUBND", 1, true)]
        [InlineData("truongphong_tc", "Trưởng Phòng Tài Chính", "truongphong@catngan.gov.vn", "TruongPhong", 3, true)]
        public async Task VerifyStep1_CorrectPasswordAndTotp_ReturnsToken_ForMfaUsers(
            string username, string fullName, string email, string roleCode, int rankLevel, bool mfaEnabled)
        {
            var user = SeedUser(username, fullName, email, roleCode, rankLevel, mfaEnabled);
            var handler = new VerifyChangePasswordStepCommandHandler(_context, _hasher.Object, _totpService.Object, _jwt, NullLogger<VerifyChangePasswordStepCommandHandler>.Instance);

            var res = await handler.Handle(new VerifyChangePasswordStepCommand(user.Id, "CorrectCurrentPass123!", "123456", "totp"), CancellationToken.None);

            res.Success.Should().BeTrue();
            res.ChangePasswordToken.Should().NotBeNullOrEmpty();
            _jwt.TryValidateResetToken(res.ChangePasswordToken!, out var tokenUserId).Should().BeTrue();
            tokenUserId.Should().Be(user.Id);
        }

        [Theory]
        [InlineData("chutich_ubnd", "Chủ Tịch UBND Xã", "chutich@catngan.gov.vn", "ChuTichUBND", 1, true)]
        [InlineData("chuyenvien_dc", "Chuyên Viên Địa Chính", "chuyenvien@catngan.gov.vn", "ChuyenVien", 5, false)]
        public async Task VerifyStep1_CorrectPasswordAndEmailOtp_ReturnsToken_ForAnyUser(
            string username, string fullName, string email, string roleCode, int rankLevel, bool mfaEnabled)
        {
            var user = SeedUser(username, fullName, email, roleCode, rankLevel, mfaEnabled);
            user.PasswordResetOtp = EmailOtpHelper.HashCode("654321");
            user.PasswordResetOtpExpiry = DateTime.UtcNow.AddMinutes(10);
            await _context.SaveChangesAsync();

            var handler = new VerifyChangePasswordStepCommandHandler(_context, _hasher.Object, _totpService.Object, _jwt, NullLogger<VerifyChangePasswordStepCommandHandler>.Instance);

            var res = await handler.Handle(new VerifyChangePasswordStepCommand(user.Id, "CorrectCurrentPass123!", "654321", "email"), CancellationToken.None);

            res.Success.Should().BeTrue();
            res.ChangePasswordToken.Should().NotBeNullOrEmpty();
        }

        [Theory]
        [InlineData("chutich_ubnd", "Chủ Tịch UBND Xã", "chutich@catngan.gov.vn", "ChuTichUBND", 1, true)]
        [InlineData("bithu_du", "Bí Thư Đảng Ủy", "bithu@catngan.gov.vn", "BiThuDU", 1, false)]
        public async Task CompleteChangePassword_WeakPassword_ThrowsException_ForAnyUser(
            string username, string fullName, string email, string roleCode, int rankLevel, bool mfaEnabled)
        {
            var user = SeedUser(username, fullName, email, roleCode, rankLevel, mfaEnabled);
            var token = _jwt.GenerateResetToken(user.Id);
            var handler = new CompleteChangePasswordCommandHandler(_context, _hasher.Object, _jwt, _refresh.Object, NullLogger<CompleteChangePasswordCommandHandler>.Instance);

            var act = () => handler.Handle(new CompleteChangePasswordCommand(user.Id, token, "weak123"), CancellationToken.None);

            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("*Mật khẩu mới phải*");
        }

        [Theory]
        [InlineData("chutich_ubnd", "Chủ Tịch UBND Xã", "chutich@catngan.gov.vn", "ChuTichUBND", 1, true)]
        [InlineData("bithu_du", "Bí Thư Đảng Ủy", "bithu@catngan.gov.vn", "BiThuDU", 1, false)]
        [InlineData("truongphong_tc", "Trưởng Phòng Tài Chính", "truongphong@catngan.gov.vn", "TruongPhong", 3, true)]
        [InlineData("chuyenvien_dc", "Chuyên Viên Địa Chính", "chuyenvien@catngan.gov.vn", "ChuyenVien", 5, false)]
        public async Task CompleteChangePassword_ValidStrongPassword_UpdatesHashAndClearsOtp_ForAnyUser(
            string username, string fullName, string email, string roleCode, int rankLevel, bool mfaEnabled)
        {
            var user = SeedUser(username, fullName, email, roleCode, rankLevel, mfaEnabled);
            user.PasswordResetOtp = "some-otp";
            user.PasswordResetOtpExpiry = DateTime.UtcNow.AddMinutes(5);
            await _context.SaveChangesAsync();

            var token = _jwt.GenerateResetToken(user.Id);
            var handler = new CompleteChangePasswordCommandHandler(_context, _hasher.Object, _jwt, _refresh.Object, NullLogger<CompleteChangePasswordCommandHandler>.Instance);

            var res = await handler.Handle(new CompleteChangePasswordCommand(user.Id, token, "StrongPass@2026!"), CancellationToken.None);

            res.Should().NotBeNull();
            res.UserId.Should().Be(user.Id);
            res.Token.Should().NotBeNullOrEmpty();
            res.RefreshToken.Should().NotBeNullOrEmpty();

            var updatedUser = await _context.Users.FindAsync(user.Id);
            updatedUser!.PasswordHash.Should().Be("new-hashed-pw");
            updatedUser.PasswordResetOtp.Should().BeNull();
            updatedUser.PasswordResetOtpExpiry.Should().BeNull();
            _refresh.Verify(r => r.RevokeAllForUserAsync(user.Id, It.IsAny<CancellationToken>()), Times.Once);
        }
    }
}
