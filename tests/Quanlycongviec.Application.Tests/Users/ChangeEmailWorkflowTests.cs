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
using Quanlycongviec.Application.Features.Users.Commands.ChangeEmail;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Users
{
    public class ChangeEmailWorkflowTests
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<IPasswordHasher> _passwordHasherMock;
        private readonly Mock<IEmailService> _emailServiceMock;

        public ChangeEmailWorkflowTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            _context = new ApplicationDbContext(options);

            _passwordHasherMock = new Mock<IPasswordHasher>();
            _emailServiceMock = new Mock<IEmailService>();
        }

        [Fact]
        public async Task RequestChangeEmail_WithWrongPassword_ShouldFail()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "canbo1",
                FullName = "Nguyễn Văn A",
                Email = "old@catngan.gov.vn",
                PasswordHash = "hashed_pass"
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _passwordHasherMock.Setup(p => p.VerifyPassword("wrong_pass", "hashed_pass")).Returns(false);

            var handler = new RequestChangeEmailCommandHandler(
                _context,
                _passwordHasherMock.Object,
                _emailServiceMock.Object,
                NullLogger<RequestChangeEmailCommandHandler>.Instance
            );

            // Act
            var result = await handler.Handle(
                new RequestChangeEmailCommand(user.Id, "wrong_pass", "new@catngan.gov.vn"),
                CancellationToken.None
            );

            // Assert
            result.Success.Should().BeFalse();
            result.Error.Should().Contain("Mật khẩu hiện tại không chính xác");
        }

        [Fact]
        public async Task RequestChangeEmail_WithValidData_ShouldSendOtpAndReturnSuccess()
        {
            // Arrange
            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "canbo2",
                FullName = "Trần Thị B",
                Email = "old@catngan.gov.vn",
                PasswordHash = "hashed_pass"
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            _passwordHasherMock.Setup(p => p.VerifyPassword("correct_pass", "hashed_pass")).Returns(true);
            _emailServiceMock.Setup(e => e.SendEmailChangeOtpAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            var handler = new RequestChangeEmailCommandHandler(
                _context,
                _passwordHasherMock.Object,
                _emailServiceMock.Object,
                NullLogger<RequestChangeEmailCommandHandler>.Instance
            );

            // Act
            var result = await handler.Handle(
                new RequestChangeEmailCommand(user.Id, "correct_pass", "new@catngan.gov.vn"),
                CancellationToken.None
            );

            // Assert
            result.Success.Should().BeTrue();
            result.Message.Should().Contain("Mã xác thực OTP 6 số đã được gửi");

            var updatedUser = await _context.Users.FindAsync(user.Id);
            updatedUser!.EmailChangeNewEmail.Should().Be("new@catngan.gov.vn");
            updatedUser.EmailChangeOtpHash.Should().NotBeNullOrEmpty();
            updatedUser.EmailChangeOtpExpiry.Should().BeAfter(DateTime.UtcNow);
        }

        [Fact]
        public async Task ConfirmChangeEmail_WithValidOtp_ShouldUpdateEmailInDb()
        {
            // Arrange
            string rawOtp = "123456";
            string otpHash = HashSha256(rawOtp);

            var user = new User
            {
                Id = Guid.NewGuid(),
                Username = "canbo3",
                FullName = "Lê Văn C",
                Email = "old@catngan.gov.vn",
                EmailChangeNewEmail = "new_verified@catngan.gov.vn",
                EmailChangeOtpHash = otpHash,
                EmailChangeOtpExpiry = DateTime.UtcNow.AddMinutes(5)
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            var handler = new ConfirmChangeEmailCommandHandler(
                _context,
                NullLogger<ConfirmChangeEmailCommandHandler>.Instance
            );

            // Act
            var result = await handler.Handle(
                new ConfirmChangeEmailCommand(user.Id, "123456"),
                CancellationToken.None
            );

            // Assert
            result.Success.Should().BeTrue();
            result.NewEmail.Should().Be("new_verified@catngan.gov.vn");

            var updatedUser = await _context.Users.FindAsync(user.Id);
            updatedUser!.Email.Should().Be("new_verified@catngan.gov.vn");
            updatedUser.EmailChangeNewEmail.Should().BeNull();
            updatedUser.EmailChangeOtpHash.Should().BeNull();
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
