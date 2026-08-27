using System;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.Commands.Mfa;

namespace Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword
{
    // BẢO MẬT (Audit Đợt 4): Kết quả bước 2 — cấp ResetToken (5 phút) khi xác minh mã đúng
    public record VerifyResetCodeResult(bool Success, string? ResetToken);

    public record VerifyResetOtpCommand(string Email, string OtpCode) : IRequest<VerifyResetCodeResult>;

    public record VerifyResetMfaCommand(string Email, string MfaCode) : IRequest<VerifyResetCodeResult>;

    // Bước 2 luồng Email: Xác minh OTP và cấp ResetToken (chống brute-force theo H3)
    public class VerifyResetOtpCommandHandler : IRequestHandler<VerifyResetOtpCommand, VerifyResetCodeResult>
    {
        private const int MaxOtpAttempts = 5;
        private const int OtpLockoutMinutes = 15;

        private readonly IApplicationDbContext _context;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly ILogger<VerifyResetOtpCommandHandler> _logger;

        public VerifyResetOtpCommandHandler(
            IApplicationDbContext context,
            IJwtTokenService jwtTokenService,
            ILogger<VerifyResetOtpCommandHandler> logger)
        {
            _context = context;
            _jwtTokenService = jwtTokenService;
            _logger = logger;
        }

        public async Task<VerifyResetCodeResult> Handle(VerifyResetOtpCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.OtpCode))
            {
                throw new InvalidOperationException(ForgotPasswordMessages.InputIncomplete);
            }

            var cleanEmail = request.Email.Trim().ToLowerInvariant();
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == cleanEmail || u.Username.ToLower() == cleanEmail, cancellationToken);

            if (user == null)
            {
                throw new InvalidOperationException(ForgotPasswordMessages.ResetFailedGeneric);
            }

            if (user.OtpLockedUntil.HasValue && user.OtpLockedUntil.Value > DateTime.UtcNow)
            {
                throw new InvalidOperationException(ForgotPasswordMessages.ResetFailedGeneric);
            }

            if (string.IsNullOrWhiteSpace(user.PasswordResetOtp) || user.PasswordResetOtpExpiry == null)
            {
                throw new InvalidOperationException(ForgotPasswordMessages.ResetFailedGeneric);
            }

            if (user.PasswordResetOtpExpiry < DateTime.UtcNow)
            {
                throw new InvalidOperationException(ForgotPasswordMessages.ResetFailedGeneric);
            }

            // BẢO MẬT (Audit M3): So sánh SHA-256 hash bằng FixedTimeEquals chống timing attack
            var incomingHash = EmailOtpHelper.HashCode(request.OtpCode);
            var storedHash = user.PasswordResetOtp!;
            var isMatch = CryptographicOperations.FixedTimeEquals(
                System.Text.Encoding.UTF8.GetBytes(incomingHash),
                System.Text.Encoding.UTF8.GetBytes(storedHash));

            if (!isMatch)
            {
                user.OtpFailedCount++;
                if (user.OtpFailedCount >= MaxOtpAttempts)
                {
                    user.OtpLockedUntil = DateTime.UtcNow.AddMinutes(OtpLockoutMinutes);
                }
                await _context.SaveChangesAsync(cancellationToken);

                _logger.LogWarning(
                    "[ForgotPassword] Xác minh OTP thất bại lần thứ {Attempt} cho {Username} (Locked: {Locked})",
                    user.OtpFailedCount, user.Username, user.OtpLockedUntil);

                throw new InvalidOperationException(ForgotPasswordMessages.ResetFailedGeneric);
            }

            _logger.LogInformation(
                "[ForgotPassword] Xác minh OTP thành công cho {Username} — cấp reset token",
                user.Username);

            return new VerifyResetCodeResult(true, _jwtTokenService.GenerateResetToken(user.Id));
        }
    }

    // Bước 2 luồng Authenticator (MFA): Xác minh mã TOTP và cấp ResetToken
    public class VerifyResetMfaCommandHandler : IRequestHandler<VerifyResetMfaCommand, VerifyResetCodeResult>
    {
        private readonly IApplicationDbContext _context;
        private readonly ITotpService _totpService;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly ILogger<VerifyResetMfaCommandHandler> _logger;

        public VerifyResetMfaCommandHandler(
            IApplicationDbContext context,
            ITotpService totpService,
            IJwtTokenService jwtTokenService,
            ILogger<VerifyResetMfaCommandHandler> logger)
        {
            _context = context;
            _totpService = totpService;
            _jwtTokenService = jwtTokenService;
            _logger = logger;
        }

        public async Task<VerifyResetCodeResult> Handle(VerifyResetMfaCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.MfaCode))
            {
                throw new InvalidOperationException(ForgotPasswordMessages.InputIncomplete);
            }

            var cleanEmail = request.Email.Trim().ToLowerInvariant();
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == cleanEmail || u.Username.ToLower() == cleanEmail, cancellationToken);

            if (user == null)
            {
                throw new InvalidOperationException(ForgotPasswordMessages.ResetFailedGeneric);
            }

            if (!user.MfaEnabled || string.IsNullOrWhiteSpace(user.MfaSecret))
            {
                throw new InvalidOperationException(ForgotPasswordMessages.ResetFailedGeneric);
            }

            if (!_totpService.Validate(user.MfaSecret, request.MfaCode.Trim()))
            {
                _logger.LogWarning("[ForgotPassword] Xác minh MFA thất bại cho {Username}", user.Username);
                throw new InvalidOperationException(ForgotPasswordMessages.ResetFailedGeneric);
            }

            _logger.LogInformation(
                "[ForgotPassword] Xác minh MFA thành công cho {Username} — cấp reset token",
                user.Username);

            return new VerifyResetCodeResult(true, _jwtTokenService.GenerateResetToken(user.Id));
        }
    }
}
