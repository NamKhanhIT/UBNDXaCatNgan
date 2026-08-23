using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword
{
    public record ResetPasswordWithOtpCommand(string Email, string OtpCode, string NewPassword) : IRequest<bool>;

    public class ResetPasswordWithOtpCommandHandler : IRequestHandler<ResetPasswordWithOtpCommand, bool>
    {
        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly ILogger<ResetPasswordWithOtpCommandHandler> _logger;

        public ResetPasswordWithOtpCommandHandler(
            IApplicationDbContext context,
            IPasswordHasher passwordHasher,
            ILogger<ResetPasswordWithOtpCommandHandler> logger)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _logger = logger;
        }

        public async Task<bool> Handle(ResetPasswordWithOtpCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.OtpCode) || string.IsNullOrWhiteSpace(request.NewPassword))
            {
                throw new InvalidOperationException("Vui lòng cung cấp đầy đủ thông tin: Email, mã OTP và mật khẩu mới.");
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
                throw new InvalidOperationException("Mã xác thực không hợp lệ hoặc tài khoản không tồn tại.");
            }

            if (string.IsNullOrWhiteSpace(user.PasswordResetOtp) || user.PasswordResetOtpExpiry == null)
            {
                throw new InvalidOperationException("Không tìm thấy yêu cầu đặt lại mật khẩu. Vui lòng yêu cầu mã xác thực mới.");
            }

            if (user.PasswordResetOtpExpiry < DateTime.UtcNow)
            {
                throw new InvalidOperationException("Mã xác thực OTP đã hết hạn (hiệu lực 10 phút). Vui lòng yêu cầu mã mới.");
            }

            if (user.PasswordResetOtp != request.OtpCode.Trim())
            {
                throw new InvalidOperationException("Mã xác thực OTP không chính xác.");
            }

            // Đặt lại mật khẩu thành công
            user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
            user.PasswordResetOtp = null;
            user.PasswordResetOtpExpiry = null;

            await _context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("[ForgotPassword] Đã đặt lại mật khẩu thành công bằng OTP cho tài khoản {Username}", user.Username);

            return true;
        }
    }
}
