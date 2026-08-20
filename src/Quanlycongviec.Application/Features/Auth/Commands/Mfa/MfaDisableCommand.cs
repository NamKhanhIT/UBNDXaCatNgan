using System;
using MediatR;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    /// <summary>
    /// Tắt MFA — yêu cầu mã OTP hiện tại để xác nhận chủ tài khoản.
    /// </summary>
    public class MfaDisableCommand : IRequest<bool>
    {
        public Guid UserId { get; set; }
        public string Code { get; set; } = string.Empty;
    }
}