using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.Commands.Mfa;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Auth
{
    public class MfaCommandHandlerTests
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<ITotpService> _totpServiceMock;
        private readonly Mock<IJwtTokenService> _jwtTokenServiceMock;
        private readonly Mock<IRefreshTokenService> _refreshTokenServiceMock;

        public MfaCommandHandlerTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
            _totpServiceMock = new Mock<ITotpService>();
            _jwtTokenServiceMock = new Mock<IJwtTokenService>();
            _refreshTokenServiceMock = new Mock<IRefreshTokenService>();
        }

        [Fact]
        public async Task MfaSetup_ShouldReturnGeneratedSecretAndUri()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "chutich",
                Email = "chutich@ubnd.gov.vn",
                FullName = "Nguyen Dinh Hung"
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _totpServiceMock.Setup(t => t.GenerateSecret()).Returns("JBSWY3DPEHPK3PXP");
            _totpServiceMock.Setup(t => t.GetProvisioningUri("JBSWY3DPEHPK3PXP", "chutich@ubnd.gov.vn", "KHM Software"))
                .Returns("otpauth://totp/KHM%20Software:chutich@ubnd.gov.vn?secret=JBSWY3DPEHPK3PXP");

            var handler = new MfaSetupCommandHandler(_context, _totpServiceMock.Object);

            // Act
            var result = await handler.Handle(new MfaSetupCommand(user.Id), CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Secret.Should().Be("JBSWY3DPEHPK3PXP");
            result.ProvisioningUri.Should().Contain("JBSWY3DPEHPK3PXP");
        }

        [Fact]
        public async Task MfaEnable_WithValidOtp_ShouldEnableMfaAndSaveSecret()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "chutich",
                Email = "chutich@ubnd.gov.vn",
                MfaEnabled = false
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _totpServiceMock.Setup(t => t.Validate("JBSWY3DPEHPK3PXP", "123456", null)).Returns(true);

            var handler = new MfaEnableCommandHandler(_context, _totpServiceMock.Object);
            var command = new MfaEnableCommand
            {
                UserId = user.Id,
                Secret = "JBSWY3DPEHPK3PXP",
                Code = "123456"
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            var updatedUser = await _context.Users.FindAsync(user.Id);
            updatedUser!.MfaEnabled.Should().BeTrue();
            updatedUser.MfaSecret.Should().Be("JBSWY3DPEHPK3PXP");
        }

        [Fact]
        public async Task MfaEnable_WithInvalidOtp_ShouldThrowException()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "chutich",
                MfaEnabled = false
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _totpServiceMock.Setup(t => t.Validate(It.IsAny<string>(), It.IsAny<string>(), null)).Returns(false);

            var handler = new MfaEnableCommandHandler(_context, _totpServiceMock.Object);
            var command = new MfaEnableCommand
            {
                UserId = user.Id,
                Secret = "JBSWY3DPEHPK3PXP",
                Code = "999999"
            };

            // Act & Assert
            await Assert.ThrowsAsync<InvalidOperationException>(() => handler.Handle(command, CancellationToken.None));
        }

        [Fact]
        public async Task VerifyMfaLogin_WithValidMfaTokenAndOtp_ShouldReturnAuthResponseWithTokens()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "chutich",
                FullName = "Nguyen Dinh Hung",
                Email = "chutich@ubnd.gov.vn",
                MfaEnabled = true,
                MfaSecret = "JBSWY3DPEHPK3PXP",
                ActiveRoleCode = "ChuTichUBND"
            };
            var role = new Role { Id = Guid.NewGuid(), Code = "ChuTichUBND", Name = "Chủ tịch UBND", RankLevel = 1 };
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id, Role = role, IsPrimary = true });

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var userId = user.Id;
            _jwtTokenServiceMock.Setup(j => j.TryValidateMfaToken("valid_mfa_token", out userId)).Returns(true);

            // BẢO MẬT (H5): mock TryValidate gán timestep > LastUsedTotpCounter(=0)
            // để mô phỏng mã TOTP hợp lệ CHƯA được tiêu thụ.
            long unusedTimestep = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30 + 1;
            _totpServiceMock.Setup(t => t.TryValidate("JBSWY3DPEHPK3PXP", "123456", out unusedTimestep, It.IsAny<DateTime?>())).Returns(true);
            _jwtTokenServiceMock.Setup(j => j.GenerateToken(user, "ChuTichUBND", It.IsAny<IEnumerable<string>>(), 1)).Returns("new_access_token");
            _refreshTokenServiceMock.Setup(r => r.CreateAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync("new_refresh_token");

            var handler = new VerifyMfaLoginCommandHandler(
                _context,
                _jwtTokenServiceMock.Object,
                _refreshTokenServiceMock.Object,
                _totpServiceMock.Object,
                Microsoft.Extensions.Logging.Abstractions.NullLogger<VerifyMfaLoginCommandHandler>.Instance);

            var command = new VerifyMfaLoginCommand
            {
                MfaToken = "valid_mfa_token",
                Code = "123456"
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Token.Should().Be("new_access_token");
            result.RefreshToken.Should().Be("new_refresh_token");
            result.MfaEnabled.Should().BeTrue();
        }

        [Fact]
        public async Task VerifyMfaLogin_WithInvalidMfaToken_ShouldThrowUnauthorized()
        {
            // Arrange
            var fakeId = Guid.Empty;
            _jwtTokenServiceMock.Setup(j => j.TryValidateMfaToken("expired_token", out fakeId)).Returns(false);

            var handler = new VerifyMfaLoginCommandHandler(
                _context,
                _jwtTokenServiceMock.Object,
                _refreshTokenServiceMock.Object,
                _totpServiceMock.Object,
                Microsoft.Extensions.Logging.Abstractions.NullLogger<VerifyMfaLoginCommandHandler>.Instance);

            var command = new VerifyMfaLoginCommand
            {
                MfaToken = "expired_token",
                Code = "123456"
            };

            // Act & Assert
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => handler.Handle(command, CancellationToken.None));
        }

        [Fact]
        public async Task MfaDisable_WithValidOtp_ShouldDisableMfaAndClearSecret()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "chutich",
                MfaEnabled = true,
                MfaSecret = "JBSWY3DPEHPK3PXP"
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _totpServiceMock.Setup(t => t.Validate("JBSWY3DPEHPK3PXP", "123456", null)).Returns(true);

            var handler = new MfaDisableCommandHandler(_context, _totpServiceMock.Object);
            var command = new MfaDisableCommand
            {
                UserId = user.Id,
                Code = "123456"
            };

            // Act
            var result = await handler.Handle(command, CancellationToken.None);

            // Assert
            result.Should().BeTrue();
            var updatedUser = await _context.Users.FindAsync(user.Id);
            updatedUser!.MfaEnabled.Should().BeFalse();
            updatedUser.MfaSecret.Should().BeNull();
        }

        // ═══════════════════════════════════════════════════════════
        // ĐỢT 3 — MFA KÊNH EMAIL (Audit Đợt 3)
        // ═══════════════════════════════════════════════════════════

        private static string Sha256Hex(string input)
        {
            using var sha = System.Security.Cryptography.SHA256.Create();
            var bytes = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(input.Trim()));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        [Fact]
        public async Task EmailOtp_SendCode_WhenEnabled_ShouldPersistHashAndReturnCooldown()
        {
            var user = new User { Id = Guid.NewGuid(), Username = "chutich", Email = "chutich@ubnd.gov.vn", MfaEnabled = true };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var emailServiceMock = new Mock<IEmailService>();
            emailServiceMock.Setup(e => e.SendMfaOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var loggerMock = new Mock<Microsoft.Extensions.Logging.ILogger<SendMfaEmailCodeCommandHandler>>();
            var handler = new SendMfaEmailCodeCommandHandler(_context, _jwtTokenServiceMock.Object, emailServiceMock.Object, loggerMock.Object);

            var result = await handler.Handle(new SendMfaEmailCodeCommand { SessionUserId = user.Id }, CancellationToken.None);

            result.CooldownSeconds.Should().Be(60);
            result.MaskedEmail.Should().Contain("*****").And.Contain("@ubnd.gov.vn");

            var updated = await _context.Users.FindAsync(user.Id);
            updated!.MfaEmailOtpHash.Should().NotBeNullOrEmpty("phải lưu SHA-256 hash thay vì plaintext");
            updated.MfaEmailOtpHash.Should().NotMatchRegex("^[0-9]{6}$");
            updated.MfaEmailOtpExpiry.Should().NotBeNull();
            updated.MfaEmailOtpSentUtc.Should().NotBeNull();
        }

        [Fact]
        public async Task EmailOtp_SendCode_WithinCooldown_ShouldReject()
        {
            var user = new User { Id = Guid.NewGuid(), Username = "chutich", Email = "chutich@ubnd.gov.vn", MfaEnabled = true, MfaEmailOtpSentUtc = DateTime.UtcNow };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var emailServiceMock = new Mock<IEmailService>();
            var loggerMock = new Mock<Microsoft.Extensions.Logging.ILogger<SendMfaEmailCodeCommandHandler>>();
            var handler = new SendMfaEmailCodeCommandHandler(_context, _jwtTokenServiceMock.Object, emailServiceMock.Object, loggerMock.Object);

            var act = async () => await handler.Handle(new SendMfaEmailCodeCommand { SessionUserId = user.Id }, CancellationToken.None);

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(act);
            ex.Message.Should().Contain("chờ").And.Contain("giây");
            // Không được gửi mail khi đang cooldown
            emailServiceMock.Verify(e => e.SendMfaOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        }

        [Fact]
        public async Task EmailOtp_SendCode_WhenSmtpFails_ShouldThrowAndNotPersist()
        {
            var user = new User { Id = Guid.NewGuid(), Username = "chutich", Email = "chutich@ubnd.gov.vn", MfaEnabled = true };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var emailServiceMock = new Mock<IEmailService>();
            emailServiceMock.Setup(e => e.SendMfaOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(false); // L1 fix: SMTP thất bại trả false thật

            var loggerMock = new Mock<Microsoft.Extensions.Logging.ILogger<SendMfaEmailCodeCommandHandler>>();
            var handler = new SendMfaEmailCodeCommandHandler(_context, _jwtTokenServiceMock.Object, emailServiceMock.Object, loggerMock.Object);

            var act = async () => await handler.Handle(new SendMfaEmailCodeCommand { SessionUserId = user.Id }, CancellationToken.None);

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(act);
            ex.Message.Should().Contain("Authenticator");

            var updated = await _context.Users.FindAsync(user.Id);
            updated!.MfaEmailOtpHash.Should().BeNull("gửi thất bại thì không persist gì — cho phép thử lại ngay");
            updated.MfaEmailOtpSentUtc.Should().BeNull();
        }

        [Fact]
        public async Task MfaEnable_ViaEmailChannel_WithValidCode_ShouldEnableWithoutSecret()
        {
            var otp = "654321";
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "chutich",
                MfaEnabled = false,
                MfaEmailOtpHash = Sha256Hex(otp),
                MfaEmailOtpExpiry = DateTime.UtcNow.AddMinutes(5)
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var handler = new MfaEnableCommandHandler(_context, _totpServiceMock.Object);
            var command = new MfaEnableCommand { UserId = user.Id, Code = otp, Channel = "email" };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Should().BeTrue();
            var updated = await _context.Users.FindAsync(user.Id);
            updated!.MfaEnabled.Should().BeTrue();
            updated.MfaSecret.Should().BeNull("bật thuần email không cần secret TOTP");
            updated.MfaEmailOtpHash.Should().BeNull("mã dùng một lần phải bị tiêu thụ");
        }

        [Fact]
        public async Task MfaEnable_ViaEmailChannel_WithWrongCode_ShouldThrow()
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "chutich",
                MfaEnabled = false,
                MfaEmailOtpHash = Sha256Hex("111111"),
                MfaEmailOtpExpiry = DateTime.UtcNow.AddMinutes(5)
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var handler = new MfaEnableCommandHandler(_context, _totpServiceMock.Object);
            var command = new MfaEnableCommand { UserId = user.Id, Code = "999999", Channel = "email" };

            var act = async () => await handler.Handle(command, CancellationToken.None);

            await Assert.ThrowsAsync<InvalidOperationException>(act);
            (await _context.Users.FindAsync(user.Id))!.MfaEnabled.Should().BeFalse();
        }

        [Fact]
        public async Task VerifyMfaLogin_ViaEmailChannel_ValidCode_ShouldIssueTokensAndConsume()
        {
            var otp = "246810";
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "chutich",
                Email = "chutich@ubnd.gov.vn",
                FullName = "Chu Tich",
                ActiveRoleCode = "ChuTichUBND",
                MfaEnabled = true,
                MfaEmailOtpHash = Sha256Hex(otp),
                MfaEmailOtpExpiry = DateTime.UtcNow.AddMinutes(4)
            };
            var role = new Role { Code = "ChuTichUBND", Name = "Chủ tịch UBND", RankLevel = 1 };
            _context.Roles.Add(role);
            user.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id, Role = role, IsPrimary = true });
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            // Moq: truyền trực tiếp biến out — giá trị này được gán cho tham số out khi mock gọi
            Guid resolvedUserId = user.Id;
            _jwtTokenServiceMock
                .Setup(x => x.TryValidateMfaToken(It.IsAny<string>(), out resolvedUserId))
                .Returns(true);
            _jwtTokenServiceMock.Setup(x => x.GenerateToken(It.IsAny<User>(), It.IsAny<string>(), It.IsAny<IEnumerable<string>>(), It.IsAny<int>()))
                .Returns("access_token_sample");
            _refreshTokenServiceMock.Setup(r => r.CreateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync("refresh_token_sample");

            var handler = new VerifyMfaLoginCommandHandler(_context, _jwtTokenServiceMock.Object, _refreshTokenServiceMock.Object, _totpServiceMock.Object, Microsoft.Extensions.Logging.Abstractions.NullLogger<VerifyMfaLoginCommandHandler>.Instance);
            var command = new VerifyMfaLoginCommand { MfaToken = "any-valid-mfa-token", Code = otp, Channel = "email" };

            var result = await handler.Handle(command, CancellationToken.None);

            result.Token.Should().Be("access_token_sample");
            result.RefreshToken.Should().Be("refresh_token_sample");
            result.MfaRequired.Should().BeFalse();
            result.MfaEnabled.Should().BeTrue();

            var updated = await _context.Users.FindAsync(user.Id);
            updated!.MfaEmailOtpHash.Should().BeNull("mã OTP email là one-time — dùng rồi phải tiêu thụ");
        }

        [Fact]
        public async Task VerifyMfaLogin_ViaTotpChannel_WhenAccountIsEmailOnly_ShouldGuideToEmail()
        {
            // Tài khoản bật MFA thuần email (không secret) mà cố dùng kênh Authenticator
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "chutich",
                MfaEnabled = true,
                MfaSecret = null // thuần email
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            Guid resolvedUserId = user.Id;
            _jwtTokenServiceMock
                .Setup(x => x.TryValidateMfaToken(It.IsAny<string>(), out resolvedUserId))
                .Returns(true);

            var handler = new VerifyMfaLoginCommandHandler(_context, _jwtTokenServiceMock.Object, _refreshTokenServiceMock.Object, _totpServiceMock.Object, Microsoft.Extensions.Logging.Abstractions.NullLogger<VerifyMfaLoginCommandHandler>.Instance);
            var command = new VerifyMfaLoginCommand { MfaToken = "token", Code = "123456", Channel = "totp" };

            var act = async () => await handler.Handle(command, CancellationToken.None);

            var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(act);
            ex.Message.Should().Contain("Email");
        }
    }
}
