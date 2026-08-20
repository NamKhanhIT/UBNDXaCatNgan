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
                Email = "chutich@catngan.gov.vn",
                FullName = "Nguyen Dinh Hung"
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _totpServiceMock.Setup(t => t.GenerateSecret()).Returns("JBSWY3DPEHPK3PXP");
            _totpServiceMock.Setup(t => t.GetProvisioningUri("JBSWY3DPEHPK3PXP", "chutich@catngan.gov.vn", "UBND Xa Cat Ngan"))
                .Returns("otpauth://totp/UBND%20Xa%20Cat%20Ngan:chutich@catngan.gov.vn?secret=JBSWY3DPEHPK3PXP");

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
                Email = "chutich@catngan.gov.vn",
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
                Email = "chutich@catngan.gov.vn",
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
            _totpServiceMock.Setup(t => t.Validate("JBSWY3DPEHPK3PXP", "123456", null)).Returns(true);
            _jwtTokenServiceMock.Setup(j => j.GenerateToken(user, "ChuTichUBND", It.IsAny<IEnumerable<string>>(), 1)).Returns("new_access_token");
            _refreshTokenServiceMock.Setup(r => r.CreateAsync(user.Id, It.IsAny<CancellationToken>())).ReturnsAsync("new_refresh_token");

            var handler = new VerifyMfaLoginCommandHandler(
                _context,
                _jwtTokenServiceMock.Object,
                _refreshTokenServiceMock.Object,
                _totpServiceMock.Object);

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
                _totpServiceMock.Object);

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
    }
}
