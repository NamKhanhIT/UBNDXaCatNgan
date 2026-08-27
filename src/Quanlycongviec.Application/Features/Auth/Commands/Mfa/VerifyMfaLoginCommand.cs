using MediatR;
using Quanlycongviec.Application.Features.Auth.DTOs;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    // Xác thực mã OTP/TOTP hoàn tất đăng nhập 2 bước (channel: totp | email)
    public class VerifyMfaLoginCommand : IRequest<AuthResponseDto>
    {
        public string MfaToken { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;

        // Kênh xác thực: "totp" | "email" | "" (tự động thử cả 2)
        public string Channel { get; set; } = string.Empty;
    }
}