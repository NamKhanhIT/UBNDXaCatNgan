using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Users.Commands.ChangeEmail
{
    public record RequestChangeEmailCommand(
        Guid UserId,
        string CurrentPassword,
        string NewEmail
    ) : IRequest<RequestChangeEmailResult>;

    public record RequestChangeEmailResult(
        bool Success,
        string? Error,
        string? Message,
        int CooldownSeconds
    );

    public class RequestChangeEmailCommandHandler : IRequestHandler<RequestChangeEmailCommand, RequestChangeEmailResult>
    {
        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly IEmailService _emailService;
        private readonly ILogger<RequestChangeEmailCommandHandler> _logger;

        public RequestChangeEmailCommandHandler(
            IApplicationDbContext context,
            IPasswordHasher passwordHasher,
            IEmailService emailService,
            ILogger<RequestChangeEmailCommandHandler> logger)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task<RequestChangeEmailResult> Handle(RequestChangeEmailCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.NewEmail) || !request.NewEmail.Contains("@"))
            {
                return new RequestChangeEmailResult(false, "Địa chỉ email mới không đúng định dạng.", null, 0);
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
            if (user == null)
            {
                return new RequestChangeEmailResult(false, "Không tìm thấy thông tin tài khoản người dùng.", null, 0);
            }

            // 1. Xác thực mật khẩu hiện tại của cán bộ
            if (!_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            {
                return new RequestChangeEmailResult(false, "Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại.", null, 0);
            }

            string cleanNewEmail = request.NewEmail.Trim().ToLower();
            if (string.Equals(user.Email?.Trim().ToLower(), cleanNewEmail, StringComparison.OrdinalIgnoreCase))
            {
                return new RequestChangeEmailResult(false, "Địa chỉ email mới trùng với email hiện tại của tài khoản.", null, 0);
            }

            // 2. Kiểm tra xem email mới đã được tài khoản khác sử dụng chưa
            var existingWithEmail = await _context.Users
                .AnyAsync(u => u.Id != user.Id && u.Email.ToLower() == cleanNewEmail, cancellationToken);
            if (existingWithEmail)
            {
                return new RequestChangeEmailResult(false, "Địa chỉ email này đã được sử dụng bởi một tài khoản khác trong hệ thống.", null, 0);
            }

            // 3. Kiểm tra Cooldown 60s
            if (user.EmailChangeOtpSentUtc.HasValue)
            {
                var elapsed = DateTime.UtcNow - user.EmailChangeOtpSentUtc.Value;
                if (elapsed < TimeSpan.FromSeconds(60))
                {
                    int remain = (int)(60 - elapsed.TotalSeconds);
                    return new RequestChangeEmailResult(false, $"Vui lòng đợi {remain} giây trước khi yêu cầu gửi lại mã OTP.", null, remain);
                }
            }

            // 4. Sinh mã OTP 6 số ngẫu nhiên bảo mật
            string otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
            string otpHash = HashSha256(otp);

            user.EmailChangeNewEmail = cleanNewEmail;
            user.EmailChangeOtpHash = otpHash;
            user.EmailChangeOtpExpiry = DateTime.UtcNow.AddMinutes(5);
            user.EmailChangeOtpSentUtc = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);

            // 5. Gửi Email chứa mã OTP kích hoạt đến địa chỉ Email mới bằng mẫu email chuẩn hóa
            string maskedEmail = cleanNewEmail.Contains('@') ? cleanNewEmail[..2] + "****@" + cleanNewEmail.Split('@')[1] : "***";
            try
            {
                await _emailService.SendEmailChangeOtpAsync(cleanNewEmail, user.FullName, otp, cancellationToken);
                _logger.LogInformation("Đã gửi OTP đổi email thành công tới {Email} cho UserId {UserId}", maskedEmail, user.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Lỗi gửi email OTP tới {Email}: {Message}", maskedEmail, ex.Message);
            }

            return new RequestChangeEmailResult(true, null, $"Mã xác thực OTP 6 số đã được gửi đến email '{maskedEmail}'. Vui lòng kiểm tra hòm thư.", 60);
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
