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
    public record SendChangePasswordOtpCommand(Guid UserId) : IRequest<bool>;

    public class SendChangePasswordOtpCommandHandler : IRequestHandler<SendChangePasswordOtpCommand, bool>
    {
        private readonly IApplicationDbContext _context;
        private readonly IEmailService _emailService;
        private readonly ILogger<SendChangePasswordOtpCommandHandler> _logger;

        public SendChangePasswordOtpCommandHandler(
            IApplicationDbContext context,
            IEmailService emailService,
            ILogger<SendChangePasswordOtpCommandHandler> logger)
        {
            _context = context;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task<bool> Handle(SendChangePasswordOtpCommand request, CancellationToken cancellationToken)
        {
            if (request.UserId == Guid.Empty)
            {
                throw new UnauthorizedAccessException("Phiên đăng nhập không hợp lệ.");
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
            if (user == null)
            {
                throw new UnauthorizedAccessException("Tài khoản không còn tồn tại.");
            }

            var toEmail = !string.IsNullOrWhiteSpace(user.Email) ? user.Email : user.Username;
            if (string.IsNullOrWhiteSpace(toEmail) || !toEmail.Contains("@"))
            {
                throw new InvalidOperationException("Tài khoản chưa được cấu hình địa chỉ email công vụ hợp lệ.");
            }

            // Cooldown chống spam gửi mã OTP: 60s
            var remaining = EmailOtpHelper.RemainingCooldownSeconds(user);
            if (remaining > 0)
            {
                throw new InvalidOperationException($"Vui lòng chờ {remaining} giây nữa để yêu cầu mã xác thực mới.");
            }

            // Sinh mã OTP 6 chữ số ngẫu nhiên an toàn
            var otp = RandomNumberGenerator.GetInt32(100000, 999999).ToString();

            // BẢO MẬT (Audit M3): Chỉ lưu SHA-256 hash của OTP trong database
            user.PasswordResetOtp = EmailOtpHelper.HashCode(otp);
            user.PasswordResetOtpExpiry = DateTime.UtcNow.AddMinutes(10);
            user.MfaEmailOtpSentUtc = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);

            // Gửi email qua mẫu chuẩn hành chính BuildOfficialOtpEmail
            var sent = await _emailService.SendPasswordResetOtpAsync(toEmail, user.FullName, otp, cancellationToken);

            var maskedOtp = $"***{otp[^3..]}";
            _logger.LogInformation(
                "[ChangePassword] Đã tạo mã OTP đổi mật khẩu cho {Username} ({Email}) - Mã: {MaskedOtp} (Sent: {Sent})",
                user.Username, toEmail, maskedOtp, sent);

            return true;
        }
    }
}
