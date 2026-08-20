using System;
using MediatR;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    /// <summary>
    /// Bước 2: Xác nhận mã OTP đầu tiên và bật MFA cho tài khoản.
    /// </summary>
    public class MfaEnableCommand : IRequest<bool>
    {
        public Guid UserId { get; set; }
        public string Secret { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
    }
}