using System;
using MediatR;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    // Bước 1 bật MFA: Sinh secret TOTP mới + URI quét mã QR
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