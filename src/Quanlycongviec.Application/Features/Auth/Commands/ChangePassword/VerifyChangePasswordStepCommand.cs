using System;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.Commands.Mfa;

namespace Quanlycongviec.Application.Features.Auth.Commands.ChangePassword
{
    public record VerifyChangePasswordStepResult(bool Success, string? ChangePasswordToken, string? Message);

    public record VerifyChangePasswordStepCommand(
        Guid UserId,
        string CurrentPassword,
        string OtpCode,
        string Method) : IRequest<VerifyChangePasswordStepResult>;

    public class VerifyChangePasswordStepCommandHandler : IRequestHandler<VerifyChangePasswordStepCommand, VerifyChangePasswordStepResult>
    {
        private const int MaxOtpAttempts = 5;
        private const int OtpLockoutMinutes = 15;

        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly ITotpService _totpService;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly ILogger<VerifyChangePasswordStepCommandHandler> _logger;

        public VerifyChangePasswordStepCommandHandler(
            IApplicationDbContext context,
            IPasswordHasher passwordHasher,
            ITotpService totpService,
            IJwtTokenService jwtTokenService,
            ILogger<VerifyChangePasswordStepCommandHandler> logger)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _totpService = totpService;
            _jwtTokenService = jwtTokenService;
            _logger = logger;
        }

        public async Task<VerifyChangePasswordStepResult> Handle(VerifyChangePasswordStepCommand request, CancellationToken cancellationToken)
        {
            if (request.UserId == Guid.Empty)
            {
                throw new UnauthorizedAccessException("Phiên đăng nhập không hợp lệ.");
            }

            if (string.IsNullOrWhiteSpace(request.CurrentPassword))
            {
                throw new InvalidOperationException("Vui lòng nhập mật khẩu hiện tại.");
            }

            if (string.IsNullOrWhiteSpace(request.OtpCode))
            {
                throw new InvalidOperationException("Vui lòng nhập mã xác thực 6 chữ số.");
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
            if (user == null)
            {
                throw new UnauthorizedAccessException("Tài khoản không còn tồn tại.");
            }

            // 1. Xác minh mật khẩu hiện tại
            if (!_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            {
                _logger.LogWarning("[ChangePassword] Mật khẩu hiện tại sai cho {Username}", user.Username);
                throw new InvalidOperationException("Mật khẩu hiện tại không chính xác.");
            }

            // 2. Xác minh mã OTP tùy theo phương thức (TOTP Authenticator hoặc Email OTP)
            var cleanMethod = (request.Method ?? "email").Trim().ToLowerInvariant();

            if (cleanMethod == "totp")
            {
                if (!user.MfaEnabled || string.IsNullOrWhiteSpace(user.MfaSecret))
                {
                    throw new InvalidOperationException("Tài khoản chưa kích hoạt phương thức xác thực Authenticator.");
                }

                if (!_totpService.Validate(user.MfaSecret, request.OtpCode.Trim()))
                {
                    _logger.LogWarning("[ChangePassword] Mã Authenticator sai cho {Username}", user.Username);
                    throw new InvalidOperationException("Mã xác thực 2 bước (Authenticator) không chính xác.");
                }
            }
            else
            {
                // Kênh Email OTP
                if (user.OtpLockedUntil.HasValue && user.OtpLockedUntil.Value > DateTime.UtcNow)
                {
                    throw new InvalidOperationException("Tài khoản đang bị tạm khóa xác thực do nhập sai nhiều lần. Vui lòng thử lại sau.");
                }

                if (string.IsNullOrWhiteSpace(user.PasswordResetOtp) || user.PasswordResetOtpExpiry == null)
                {
                    throw new InvalidOperationException("Mã xác thực OTP chưa được gửi hoặc đã hết hạn. Vui lòng nhấn 'Gửi mã' để nhận mã mới.");
                }

                if (user.PasswordResetOtpExpiry < DateTime.UtcNow)
                {
                    throw new InvalidOperationException("Mã xác thực OTP đã hết hạn. Vui lòng nhấn 'Gửi mã' để nhận mã mới.");
                }

                var incomingHash = EmailOtpHelper.HashCode(request.OtpCode.Trim());
                var storedHash = user.PasswordResetOtp;
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
                        "[ChangePassword] Xác minh OTP đổi mật khẩu thất bại lần {Attempt} cho {Username}",
                        user.OtpFailedCount, user.Username);

                    throw new InvalidOperationException("Mã xác thực OTP không chính xác.");
                }
            }

            // Cấp ChangePasswordToken (thời hạn 5 phút)
            var token = _jwtTokenService.GenerateResetToken(user.Id);
            _logger.LogInformation("[ChangePassword] Xác minh Bước 1 thành công cho {Username} — cấp change password token", user.Username);

            return new VerifyChangePasswordStepResult(true, token, "Xác thực danh tính thành công. Vui lòng thiết lập mật khẩu mới.");
        }
    }
}
