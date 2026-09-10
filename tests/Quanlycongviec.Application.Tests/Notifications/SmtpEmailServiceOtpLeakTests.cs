using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Notifications
{
    public class SmtpEmailServiceOtpLeakTests
    {
        private sealed class CapturingLogger<T> : ILogger<T>
        {
            public List<(LogLevel Level, string Message)> Entries { get; } = new();

            public IDisposable BeginScope<TState>(TState state) where TState : notnull => new NoopScope();
            public bool IsEnabled(LogLevel logLevel) => true;
            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
                Exception? exception, Func<TState, Exception?, string> formatter)
            {
                Entries.Add((logLevel, formatter(state, exception)));
            }

            private sealed class NoopScope : IDisposable
            {
                public void Dispose() { }
            }
        }

        private static SmtpEmailService BuildService(CapturingLogger<SmtpEmailService> logger, SmtpOptions? options = null)
        {
            options ??= new SmtpOptions
            {
                // Empty host/username => unconfigured branch
                Host = string.Empty,
                Username = string.Empty,
                Port = 587,
                EnableSsl = true,
                SenderEmail = "no-reply@example.test",
                SenderName = "Test"
            };
            var opts = Options.Create(options);
            return new SmtpEmailService(opts, logger);
        }

        [Fact]
        public async Task SendPasswordResetOtpAsync_ShouldNotContainRawOtp_WhenSmtpUnconfigured()
        {
            var logger = new CapturingLogger<SmtpEmailService>();
            var svc = BuildService(logger);

            var rawOtp = "RESETOTP12345";
            var result = await svc.SendPasswordResetOtpAsync("user1@test.local", "Nguyen Van A", rawOtp, CancellationToken.None);

            result.Should().BeFalse("khi SMTP chưa cấu hình phải trả về false để caller xử lý thất bại");
            var allLogText = string.Join("\n", logger.Entries.Select(e => e.Message));
            allLogText.Should().NotContain(rawOtp, "OTP tuyệt đối không được log ra stdout/server logs");
        }

        [Fact]
        public async Task SendMfaOtpAsync_ShouldNotContainRawOtp_WhenSmtpUnconfigured()
        {
            var logger = new CapturingLogger<SmtpEmailService>();
            var svc = BuildService(logger);

            var rawOtp = "MFAOTP99887";
            var result = await svc.SendMfaOtpAsync("user2@test.local", "Tran Thi B", rawOtp, CancellationToken.None);

            result.Should().BeFalse();
            var allLogText = string.Join("\n", logger.Entries.Select(e => e.Message));
            allLogText.Should().NotContain(rawOtp);
        }

        [Fact]
        public async Task SendEmailChangeOtpAsync_ShouldNotContainRawOtp_WhenSmtpUnconfigured()
        {
            var logger = new CapturingLogger<SmtpEmailService>();
            var svc = BuildService(logger);

            var rawOtp = "ECHANGEOTP77665";
            var result = await svc.SendEmailChangeOtpAsync("user3@test.local", "Le Van C", rawOtp, CancellationToken.None);

            result.Should().BeFalse();
            var allLogText = string.Join("\n", logger.Entries.Select(e => e.Message));
            allLogText.Should().NotContain(rawOtp);
        }

        [Fact]
        public async Task SendAllOtpMethods_ShouldLogWarningLevel_WhenSmtpUnconfigured()
        {
            var logger = new CapturingLogger<SmtpEmailService>();
            var svc = BuildService(logger);

            await svc.SendPasswordResetOtpAsync("u@test.local", "U", "OTP1", CancellationToken.None);
            await svc.SendMfaOtpAsync("u@test.local", "U", "OTP2", CancellationToken.None);
            await svc.SendEmailChangeOtpAsync("u@test.local", "U", "OTP3", CancellationToken.None);

            // Mỗi OTP method phải log Warning (không phải Information)
            logger.Entries.Should().Contain(e => e.Level == LogLevel.Warning);
        }
    }
}
