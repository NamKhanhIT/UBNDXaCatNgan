using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Users.Commands.Phone;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Users
{
    public class PhoneVerificationWorkflowTests
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<ISmsNotificationService> _smsServiceMock;

        public PhoneVerificationWorkflowTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            _context = new ApplicationDbContext(options);

            _smsServiceMock = new Mock<ISmsNotificationService>();
        }

        [Fact]
        public async Task SendPhoneOtp_WithInvalidPhone_ShouldFail()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "canbo_phone",
                FullName = "Nguyễn Văn D"
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var handler = new SendPhoneVerificationOtpCommandHandler(
                _context,
                _smsServiceMock.Object,
                NullLogger<SendPhoneVerificationOtpCommandHandler>.Instance
            );

            // Act
            var result = await handler.Handle(
                new SendPhoneVerificationOtpCommand(user.Id, "12345"),
                CancellationToken.None
            );

            // Assert
            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Số điện thoại phải gồm đúng 10 chữ số");
        }

        [Fact]
        public async Task SendPhoneOtp_WithValidPhone_ShouldSendSmsAndSaveOtpHash()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "canbo_phone2",
                FullName = "Nguyễn Văn E"
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _smsServiceMock.Setup(s => s.SendOtpSmsAsync("0912345678", It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var handler = new SendPhoneVerificationOtpCommandHandler(
                _context,
                _smsServiceMock.Object,
                NullLogger<SendPhoneVerificationOtpCommandHandler>.Instance
            );

            // Act
            var result = await handler.Handle(
                new SendPhoneVerificationOtpCommand(user.Id, "0912345678"),
                CancellationToken.None
            );

            // Assert
            result.Success.Should().BeTrue();
            result.Message.Should().Contain("Mã xác thực OTP đã được gửi đến số điện thoại");

            var updatedUser = await _context.Users.FindAsync(user.Id);
            updatedUser!.ZaloPhoneNumber.Should().Be("0912345678");
            updatedUser.PhoneOtpHash.Should().NotBeNullOrEmpty();
            updatedUser.PhoneOtpExpiry.Should().BeAfter(DateTime.UtcNow);
        }

        [Fact]
        public async Task VerifyPhoneOtp_WithCorrectOtp_ShouldConfirmPhone()
        {
            // Arrange
            string otp = "654321";
            string otpHash = HashSha256(otp);

            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "canbo_phone3",
                FullName = "Nguyễn Văn F",
                ZaloPhoneNumber = "0987654321",
                PhoneNumberConfirmed = false,
                PhoneOtpHash = otpHash,
                PhoneOtpExpiry = DateTime.UtcNow.AddMinutes(5)
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var handler = new VerifyPhoneOtpCommandHandler(
                _context,
                NullLogger<VerifyPhoneOtpCommandHandler>.Instance
            );

            // Act
            var result = await handler.Handle(
                new VerifyPhoneOtpCommand(user.Id, "0987654321", "654321"),
                CancellationToken.None
            );

            // Assert
            result.Success.Should().BeTrue();
            result.ConfirmedPhoneNumber.Should().Be("0987654321");

            var updatedUser = await _context.Users.FindAsync(user.Id);
            updatedUser!.PhoneNumberConfirmed.Should().BeTrue();
            updatedUser.PhoneOtpHash.Should().BeNull();
        }

        private static string HashSha256(string input)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input));
            var sb = new StringBuilder();
            foreach (var b in bytes) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }
    }
}
