using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Users.Commands.Phone
{
    public record SendPhoneVerificationOtpCommand(
        Guid UserId,
        string PhoneNumber
    ) : IRequest<SendPhoneVerificationOtpResult>;

    public record SendPhoneVerificationOtpResult(
        bool Success,
        string? Error,
        string? Message,
        int CooldownSeconds
    );

    public class SendPhoneVerificationOtpCommandHandler : IRequestHandler<SendPhoneVerificationOtpCommand, SendPhoneVerificationOtpResult>
    {
        private readonly IApplicationDbContext _context;
        private readonly ISmsNotificationService _smsService;
        private readonly ILogger<SendPhoneVerificationOtpCommandHandler> _logger;

        public SendPhoneVerificationOtpCommandHandler(
            IApplicationDbContext context,
            ISmsNotificationService smsService,
            ILogger<SendPhoneVerificationOtpCommandHandler> logger)
        {
            _context = context;
            _smsService = smsService;
            _logger = logger;
        }

        public async Task<SendPhoneVerificationOtpResult> Handle(SendPhoneVerificationOtpCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.PhoneNumber))
            {
                return new SendPhoneVerificationOtpResult(false, "Số điện thoại không được để trống.", null, 0);
            }

            string cleanPhone = request.PhoneNumber.Trim().Replace(" ", "").Replace("-", "");
            if (!Regex.IsMatch(cleanPhone, @"^0\d{9}$"))
            {
                return new SendPhoneVerificationOtpResult(false, "Số điện thoại phải gồm đúng 10 chữ số và bắt đầu bằng số 0 (Ví dụ: 0912345678).", null, 0);
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
            if (user == null)
            {
                return new SendPhoneVerificationOtpResult(false, "Không tìm thấy thông tin tài khoản người dùng.", null, 0);
            }

            // 1. Kiểm tra Cooldown 60s
            if (user.PhoneOtpSentUtc.HasValue)
            {
                var elapsed = DateTime.UtcNow - user.PhoneOtpSentUtc.Value;
                if (elapsed < TimeSpan.FromSeconds(60))
                {
                    int remain = (int)(60 - elapsed.TotalSeconds);
                    return new SendPhoneVerificationOtpResult(false, $"Vui lòng đợi {remain} giây trước khi gửi lại mã OTP SMS.", null, remain);
                }
            }

            // 2. Sinh mã OTP 6 chữ số
            string otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            string otpHash = HashSha256(otp);

            user.ZaloPhoneNumber = cleanPhone;
            user.PhoneOtpHash = otpHash;
            user.PhoneOtpExpiry = DateTime.UtcNow.AddMinutes(5);
            user.PhoneOtpSentUtc = DateTime.UtcNow;
            user.PhoneOtpFailedCount = 0;

            await _context.SaveChangesAsync(cancellationToken);

            // 3. Gửi mã OTP qua SMS Gateway
            bool sent = await _smsService.SendOtpSmsAsync(cleanPhone, otp, cancellationToken);
            string maskedPhone = cleanPhone.Length >= 7 ? cleanPhone[..3] + "****" + cleanPhone[^3..] : "***";
            _logger.LogInformation("Đã kích hoạt gửi SMS OTP xác nhận số điện thoại {Phone} cho UserId {UserId} (Status={Sent})",
                maskedPhone, user.Id, sent);

            return new SendPhoneVerificationOtpResult(true, null, $"Mã xác thực OTP đã được gửi đến số điện thoại {maskedPhone}. Vui lòng kiểm tra tin nhắn SMS.", 60);
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
