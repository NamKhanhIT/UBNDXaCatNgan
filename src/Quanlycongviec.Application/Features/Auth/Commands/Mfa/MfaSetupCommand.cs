using System;
using MediatR;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    /// <summary>
    /// Bước 1: Sinh secret TOTP mới + URI quét QR (CHƯA lưu — chờ xác nhận mã OTP đầu tiên).
    /// </summary>
    public class MfaSetupCommand : IRequest<MfaSetupResult>
    {
        public MfaSetupCommand(Guid userId)
        {
            UserId = userId;
        }

        public Guid UserId { get; }
    }

    public class MfaSetupResult
    {
        public string Secret { get; set; } = string.Empty;
        public string ProvisioningUri { get; set; } = string.Empty;
    }
}