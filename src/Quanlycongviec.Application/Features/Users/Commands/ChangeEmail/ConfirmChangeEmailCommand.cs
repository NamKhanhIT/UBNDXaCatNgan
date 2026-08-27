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
    public record ConfirmChangeEmailCommand(
        Guid UserId,
        string OtpCode
    ) : IRequest<ConfirmChangeEmailResult>;

    public record ConfirmChangeEmailResult(
        bool Success,
        string? Error,
        string? Message,
        string? NewEmail
    );

    public class ConfirmChangeEmailCommandHandler : IRequestHandler<ConfirmChangeEmailCommand, ConfirmChangeEmailResult>
    {
        private readonly IApplicationDbContext _context;
        private readonly ILogger<ConfirmChangeEmailCommandHandler> _logger;

        public ConfirmChangeEmailCommandHandler(
            IApplicationDbContext context,
            ILogger<ConfirmChangeEmailCommandHandler> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<ConfirmChangeEmailResult> Handle(ConfirmChangeEmailCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.OtpCode) || request.OtpCode.Trim().Length != 6)
            {
                return new ConfirmChangeEmailResult(false, "Vui lòng nhập đúng 6 chữ số mã xác thực OTP.", null, null);
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
            if (user == null)
            {
                return new ConfirmChangeEmailResult(false, "Không tìm thấy thông tin tài khoản người dùng.", null, null);
            }

            if (string.IsNullOrEmpty(user.EmailChangeNewEmail) || string.IsNullOrEmpty(user.EmailChangeOtpHash))
            {
                return new ConfirmChangeEmailResult(false, "Không có yêu cầu đổi email nào đang chờ xác nhận. Vui lòng gửi lại yêu cầu.", null, null);
            }

            if (!user.EmailChangeOtpExpiry.HasValue || user.EmailChangeOtpExpiry.Value < DateTime.UtcNow)
            {
                return new ConfirmChangeEmailResult(false, "Mã xác thực OTP đã hết hạn (quá 5 phút). Vui lòng yêu cầu gửi lại mã mới.", null, null);
            }

            string inputHash = HashSha256(request.OtpCode.Trim());
            if (!string.Equals(user.EmailChangeOtpHash, inputHash, StringComparison.OrdinalIgnoreCase))
            {
                return new ConfirmChangeEmailResult(false, "Mã xác thực OTP không chính xác. Vui lòng kiểm tra lại.", null, null);
            }

            // Cập nhật email chính thức
            string updatedEmail = user.EmailChangeNewEmail;
            user.Email = updatedEmail;
            user.EmailChangeNewEmail = null;
            user.EmailChangeOtpHash = null;
            user.EmailChangeOtpExpiry = null;
            user.EmailChangeOtpSentUtc = null;

            await _context.SaveChangesAsync(cancellationToken);

            string maskedNewEmail = updatedEmail.Contains('@') ? updatedEmail[..2] + "****@" + updatedEmail.Split('@')[1] : "***";
            _logger.LogInformation("UserId {UserId} ({Username}) đã đổi Email công vụ thành công sang {NewEmail}",
                user.Id, user.Username, maskedNewEmail);

            return new ConfirmChangeEmailResult(true, null, "Đã cập nhật địa chỉ Email công vụ thành công!", updatedEmail);
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
