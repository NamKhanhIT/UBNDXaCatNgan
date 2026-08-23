using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword
{
    public record ResetPasswordWithMfaCommand(string Email, string MfaCode, string NewPassword) : IRequest<bool>;

    public class ResetPasswordWithMfaCommandHandler : IRequestHandler<ResetPasswordWithMfaCommand, bool>
    {
        private readonly IApplicationDbContext _context;
        private readonly ITotpService _totpService;
        private readonly IPasswordHasher _passwordHasher;
        private readonly ILogger<ResetPasswordWithMfaCommandHandler> _logger;

        public ResetPasswordWithMfaCommandHandler(
            IApplicationDbContext context,
            ITotpService totpService,
            IPasswordHasher passwordHasher,
            ILogger<ResetPasswordWithMfaCommandHandler> logger)
        {
            _context = context;
            _totpService = totpService;
            _passwordHasher = passwordHasher;
            _logger = logger;
        }

        public async Task<bool> Handle(ResetPasswordWithMfaCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.MfaCode) || string.IsNullOrWhiteSpace(request.NewPassword))
            {
                throw new InvalidOperationException("Vui lòng cung cấp đầy đủ thông tin: Email, mã xác thực 2 bước và mật khẩu mới.");
            }

            if (request.NewPassword.Length < 6)
            {
                throw new InvalidOperationException("Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.");
            }

            var cleanEmail = request.Email.Trim().ToLowerInvariant();
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == cleanEmail || u.Username.ToLower() == cleanEmail, cancellationToken);

            if (user == null)
            {
                throw new InvalidOperationException("Tài khoản không tồn tại trong hệ thống.");
            }

            if (!user.MfaEnabled || string.IsNullOrWhiteSpace(user.MfaSecret))
            {
                throw new InvalidOperationException("Tài khoản này chưa kích hoạt tính năng Xác thực 2 bước. Vui lòng sử dụng phương thức nhận mã OTP qua Email.");
            }

            // Kiểm tra mã TOTP Authenticator
            var isValidMfa = _totpService.Validate(user.MfaSecret, request.MfaCode.Trim());
            if (!isValidMfa)
            {
                throw new InvalidOperationException("Mã xác thực 2 bước từ ứng dụng Authenticator không chính xác hoặc đã hết hạn.");
            }

            // Đặt lại mật khẩu thành công
            user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
            user.PasswordResetOtp = null;
            user.PasswordResetOtpExpiry = null;

            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("[ForgotPassword] Đã đặt lại mật khẩu thành công bằng Authenticator 2 bước cho tài khoản {Username}", user.Username);

            return true;
        }
    }
}
