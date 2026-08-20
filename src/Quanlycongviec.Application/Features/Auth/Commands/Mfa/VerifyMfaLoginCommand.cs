using MediatR;
using Quanlycongviec.Application.Features.Auth.DTOs;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    /// <summary>
    /// Hoàn tất đăng nhập 2 bước: xác thực mã OTP (sau khi đã qua bước mật khẩu).
    /// </summary>
    public class VerifyMfaLoginCommand : IRequest<AuthResponseDto>
    {
        public string MfaToken { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
    }
}