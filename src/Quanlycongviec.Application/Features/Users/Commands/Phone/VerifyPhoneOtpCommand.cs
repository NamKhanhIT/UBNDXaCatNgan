using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Users.Commands.Phone
{
    public record VerifyPhoneOtpCommand(
        Guid UserId,
        string PhoneNumber,
        string OtpCode
    ) : IRequest<VerifyPhoneOtpResult>;

    public record VerifyPhoneOtpResult(
        bool Success,
        string? Error,
        string? Message,
        string? ConfirmedPhoneNumber
    );

    public class VerifyPhoneOtpCommandHandler : IRequestHandler<VerifyPhoneOtpCommand, VerifyPhoneOtpResult>
    {
        private readonly IApplicationDbContext _context;
        private readonly ILogger<VerifyPhoneOtpCommandHandler> _logger;

        public VerifyPhoneOtpCommandHandler(
            IApplicationDbContext context,
            ILogger<VerifyPhoneOtpCommandHandler> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<VerifyPhoneOtpResult> Handle(VerifyPhoneOtpCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.OtpCode) || request.OtpCode.Trim().Length != 6)
            {
                return new VerifyPhoneOtpResult(false, "Vui lòng nhập đầy đủ 6 chữ số mã xác thực OTP từ tin nhắn SMS.", null, null);
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
            if (user == null)
            {
                return new VerifyPhoneOtpResult(false, "Không tìm thấy thông tin tài khoản người dùng.", null, null);
            }

            if (string.IsNullOrEmpty(user.PhoneOtpHash))
            {
                return new VerifyPhoneOtpResult(false, "Không có mã OTP SMS nào đang chờ xác nhận. Vui lòng bấm 'Gửi mã xác thực'.", null, null);
            }

            if (!user.PhoneOtpExpiry.HasValue || user.PhoneOtpExpiry.Value < DateTime.UtcNow)
            {
                return new VerifyPhoneOtpResult(false, "Mã xác thực OTP SMS đã hết hạn (quá 5 phút). Vui lòng yêu cầu gửi mã mới.", null, null);
            }

            if (user.PhoneOtpFailedCount >= 5)
            {
                return new VerifyPhoneOtpResult(false, "Đồng chí đã nhập sai OTP quá 5 lần liên tiếp. Vui lòng yêu cầu gửi lại mã mới.", null, null);
            }

            string inputHash = HashSha256(request.OtpCode.Trim());
            if (!string.Equals(user.PhoneOtpHash, inputHash, StringComparison.OrdinalIgnoreCase))
            {
                user.PhoneOtpFailedCount++;
                await _context.SaveChangesAsync(cancellationToken);
                int remaining = Math.Max(0, 5 - user.PhoneOtpFailedCount);
                return new VerifyPhoneOtpResult(false, $"Mã xác thực OTP không chính xác. Đồng chí còn {remaining} lần thử.", null, null);
            }

            // Xác thực thành công
            string cleanPhone = request.PhoneNumber.Trim().Replace(" ", "").Replace("-", "");
            user.ZaloPhoneNumber = cleanPhone;
            user.PhoneNumberConfirmed = true;
            user.PhoneOtpHash = null;
            user.PhoneOtpExpiry = null;
            user.PhoneOtpSentUtc = null;
            user.PhoneOtpFailedCount = 0;

            await _context.SaveChangesAsync(cancellationToken);

            string maskedPhone = cleanPhone.Length >= 7 ? cleanPhone[..3] + "****" + cleanPhone[^3..] : "***";
            _logger.LogInformation("UserId {UserId} ({Username}) đã xác thực số điện thoại SMS thành công: {Phone}",
                user.Id, user.Username, maskedPhone);

            return new VerifyPhoneOtpResult(true, null, "Xác thực số điện thoại qua tin nhắn SMS thành công!", cleanPhone);
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
