using System;
using MediatR;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    // Tắt MFA: Yêu cầu mã OTP hiện tại để xác nhận (channel: totp | email)
    public class MfaDisableCommand : IRequest<bool>
    {
        public Guid UserId { get; set; }
        public string Code { get; set; } = string.Empty;

        // Kênh xác thực: "totp" (mặc định) | "email"
        public string Channel { get; set; } = "totp";
    }
}