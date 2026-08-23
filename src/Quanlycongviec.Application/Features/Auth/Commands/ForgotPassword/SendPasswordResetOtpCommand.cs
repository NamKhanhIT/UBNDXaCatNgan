using System;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword
{
    public record SendPasswordResetOtpCommand(string Email) : IRequest<bool>;

    public class SendPasswordResetOtpCommandHandler : IRequestHandler<SendPasswordResetOtpCommand, bool>
    {
        private readonly IApplicationDbContext _context;
        private readonly IEmailService _emailService;
        private readonly ILogger<SendPasswordResetOtpCommandHandler> _logger;

        public SendPasswordResetOtpCommandHandler(
            IApplicationDbContext context,
            IEmailService emailService,
            ILogger<SendPasswordResetOtpCommandHandler> logger)
        {
            _context = context;
            _emailService = emailService;
            _logger = logger;
        }

        public async Task<bool> Handle(SendPasswordResetOtpCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Email))
            {
                throw new InvalidOperationException("Vui lòng cung cấp địa chỉ email công vụ.");
            }

            var cleanEmail = request.Email.Trim().ToLowerInvariant();
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Email.ToLower() == cleanEmail || u.Username.ToLower() == cleanEmail, cancellationToken);

            if (user == null)
            {
                // Anti-enumeration: Vẫn trả về true để tránh rò rỉ danh sách tài khoản
                _logger.LogWarning("[ForgotPassword] Yêu cầu đặt lại mật khẩu cho email không tồn tại: {Email}", request.Email);
                return true;
            }

            // Sinh mã OTP 6 chữ số ngẫu nhiên an toàn
            var otp = RandomNumberGenerator.GetInt32(100000, 999999).ToString();
            user.PasswordResetOtp = otp;
            user.PasswordResetOtpExpiry = DateTime.UtcNow.AddMinutes(10);

            await _context.SaveChangesAsync(cancellationToken);

            // Gửi email
            var toEmail = !string.IsNullOrWhiteSpace(user.Email) ? user.Email : request.Email;
            var sent = await _emailService.SendPasswordResetOtpAsync(toEmail, user.FullName, otp, cancellationToken);

            _logger.LogInformation("[ForgotPassword] Đã tạo mã OTP khôi phục cho {Username} ({Email}) - Mã: {Otp} (Sent: {Sent})", user.Username, toEmail, otp, sent);
            return true;
        }
    }
}
