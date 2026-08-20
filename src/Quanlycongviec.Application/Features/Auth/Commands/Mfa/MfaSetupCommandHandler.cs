using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    public class MfaSetupCommandHandler : IRequestHandler<MfaSetupCommand, MfaSetupResult>
    {
        private readonly IApplicationDbContext _context;
        private readonly ITotpService _totpService;

        public MfaSetupCommandHandler(IApplicationDbContext context, ITotpService totpService)
        {
            _context = context;
            _totpService = totpService;
        }

        public async Task<MfaSetupResult> Handle(MfaSetupCommand request, CancellationToken cancellationToken)
        {
            var user = await _context.Users.FindAsync(new object[] { request.UserId }, cancellationToken);
            if (user == null)
            {
                throw new KeyNotFoundException("Không tìm thấy người dùng.");
            }

            var secret = _totpService.GenerateSecret();
            var accountName = !string.IsNullOrWhiteSpace(user.Email) ? user.Email : user.Username;
            var provisioningUri = _totpService.GetProvisioningUri(secret, accountName, "UBND Xa Cat Ngan");

            return new MfaSetupResult
            {
                Secret = secret,
                ProvisioningUri = provisioningUri
            };
        }
    }
}