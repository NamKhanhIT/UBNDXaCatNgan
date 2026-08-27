using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    public class MfaEnableCommandHandler : IRequestHandler<MfaEnableCommand, bool>
    {
        private readonly IApplicationDbContext _context;
        private readonly ITotpService _totpService;

        public MfaEnableCommandHandler(IApplicationDbContext context, ITotpService totpService)
        {
            _context = context;
            _totpService = totpService;
        }

        public async Task<bool> Handle(MfaEnableCommand request, CancellationToken cancellationToken)
        {
            var user = await _context.Users.FindAsync(new object[] { request.UserId }, cancellationToken);
            if (user == null)
            {
                throw new KeyNotFoundException("Không tìm thấy người dùng.");
            }

            if (user.MfaEnabled)
            {
                throw new InvalidOperationException("Tài khoản đã bật xác thực 2 yếu tố từ trước.");
            }

            // ── Kênh EMAIL: bật MFA thuần email, không cần ứng dụng Authenticator ──
            // Mã đã được gửi trước đó qua /Auth/mfa/email-code (context session)
            if (string.Equals(request.Channel, "email", StringComparison.OrdinalIgnoreCase))
            {
                if (!EmailOtpHelper.IsValid(user, request.Code))
                {
                    throw new InvalidOperationException(
                        "Mã OTP email không hợp lệ hoặc đã hết hạn (hiệu lực 5 phút). Vui lòng yêu cầu mã mới.");
                }

                EmailOtpHelper.Consume(user);   // one-time
                user.MfaSecret = null;          // không có secret TOTP — đăng nhập sau dùng kênh email
                user.MfaEnabled = true;
                await _context.SaveChangesAsync(cancellationToken);
                return true;
            }

            // ── Kênh TOTP (Authenticator) — nguyên trạng ──
            if (string.IsNullOrWhiteSpace(request.Secret) || string.IsNullOrWhiteSpace(request.Code))
            {
                throw new InvalidOperationException("Thiếu secret hoặc mã OTP.");
            }

            // Bắt buộc xác minh mã OTP đầu tiên trước khi kích hoạt
            if (!_totpService.Validate(request.Secret, request.Code))
            {
                throw new InvalidOperationException("Mã OTP không hợp lệ. Vui lòng kiểm tra lại đồng hồ thiết bị và thử lại.");
            }

            user.MfaSecret = request.Secret.Trim();
            user.MfaEnabled = true;
            await _context.SaveChangesAsync(cancellationToken);

            return true;
        }
    }
}