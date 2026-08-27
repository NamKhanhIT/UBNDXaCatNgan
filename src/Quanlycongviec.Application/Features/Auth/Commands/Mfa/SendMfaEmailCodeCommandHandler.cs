using System;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    public class SendMfaEmailCodeCommandHandler : IRequestHandler<SendMfaEmailCodeCommand, SendMfaEmailCodeResult>
    {
        private readonly IApplicationDbContext _context;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IEmailService _emailService;
        private readonly ILogger<SendMfaEmailCodeCommandHandler> _logger;

        public SendMfaEmailCodeCommandHandler(
            IApplicationDbContext context,
            IJwtTokenService jwtTokenService,
            IEmailService emailService,
            ILogger<SendMfaEmailCodeCommandHandler> logger)
        {
            _context = context;
            _jwtTokenService = jwtTokenService;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task<SendMfaEmailCodeResult> Handle(SendMfaEmailCodeCommand request, CancellationToken cancellationToken)
        {
            // 1. Xác định người dùng: ưu tiên mfaToken (luồng đăng nhập), fallback session
            Guid userId;
            if (!string.IsNullOrWhiteSpace(request.MfaToken))
            {
                if (!_jwtTokenService.TryValidateMfaToken(request.MfaToken, out userId))
                {
                    throw new UnauthorizedAccessException("Phiên xác thực đã hết hạn. Vui lòng đăng nhập lại.");
                }
            }
            else
            {
                if (request.SessionUserId == Guid.Empty)
                {
                    throw new UnauthorizedAccessException("Yêu cầu không hợp lệ — cần phiên đăng nhập hoặc mã xác thực trung gian.");
                }
                userId = request.SessionUserId;
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
                ?? throw new UnauthorizedAccessException("Tài khoản không còn tồn tại.");

            // 2. Kênh email: Trong luồng đăng nhập (dùng MfaToken) bắt buộc tài khoản đã bật MFA.
            // Trong luồng Cài đặt / Bật MFA (dùng SessionUserId), cho phép gửi mã để kích hoạt.
            if (!string.IsNullOrWhiteSpace(request.MfaToken) && !user.MfaEnabled)
            {
                throw new InvalidOperationException("Tài khoản chưa bật xác thực 2 yếu tố.");
            }

            var toEmail = !string.IsNullOrWhiteSpace(user.Email) ? user.Email : user.Username;

            // 3. Cooldown chống spam/bomb email: 60s giữa hai lần gửi cho cùng một user
            var remaining = EmailOtpHelper.RemainingCooldownSeconds(user);
            if (remaining > 0)
            {
                throw new InvalidOperationException($"Vui lòng chờ {remaining} giây nữa để yêu cầu mã mới.");
            }

            // 4. Sinh OTP 6 số → chỉ lưu SHA-256 hash (không plaintext)
            var otp = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
            var sent = await _emailService.SendMfaOtpAsync(toEmail, user.FullName, otp, cancellationToken);

            if (!sent)
            {
                // Không persist gì khi gửi thất bại → người dùng được thử lại ngay,
                // đồng thời nhận hướng dẫn chuyển sang kênh Authenticator
                throw new InvalidOperationException(
                    "Hệ thống chưa gửi được email (chưa cấu hình SMTP hoặc lỗi kết nối). Vui lòng dùng ứng dụng Authenticator hoặc liên hệ Quản trị viên.");
            }

            // Chỉ ghi nhận sau khi gửi thành công — SentUtc là gốc của cooldown
            user.MfaEmailOtpHash = EmailOtpHelper.HashCode(otp);
            user.MfaEmailOtpExpiry = DateTime.UtcNow.AddMinutes(EmailOtpHelper.LifetimeMinutes);
            user.MfaEmailOtpSentUtc = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);

            // BẢO MẬT (H1): log mask, không bao giờ in mã nguyên vẹn
            _logger.LogInformation(
                "[MFA-Email] Đã gửi mã OTP kênh email cho {Username} tới {MaskedEmail} - Mã: ***{Last3}",
                user.Username, EmailOtpHelper.MaskEmail(toEmail), otp[^3..]);

            return new SendMfaEmailCodeResult
            {
                CooldownSeconds = EmailOtpHelper.ResendCooldownSeconds,
                MaskedEmail = EmailOtpHelper.MaskEmail(toEmail)
            };
        }
    }
}