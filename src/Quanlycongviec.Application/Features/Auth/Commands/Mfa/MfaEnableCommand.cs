using System;
using MediatR;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    // Bước 2 bật MFA: Xác nhận mã OTP đầu tiên để kích hoạt (channel: totp | email)
    public class MfaEnableCommand : IRequest<bool>
    {
        public Guid UserId { get; set; }
        public string Secret { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;

        // Kênh xác thực: "totp" (mặc định) | "email"
        public string Channel { get; set; } = "totp";
    }
}