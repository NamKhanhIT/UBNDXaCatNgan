using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Auth.Commands.RefreshToken
{
    public class RevokeOtherSessionsCommand : IRequest<bool>
    {
        public RevokeOtherSessionsCommand(Guid userId, string? currentRefreshToken = null)
        {
            UserId = userId;
            CurrentRefreshToken = currentRefreshToken;
        }

        public Guid UserId { get; }
        public string? CurrentRefreshToken { get; }
    }

    public class RevokeOtherSessionsCommandHandler : IRequestHandler<RevokeOtherSessionsCommand, bool>
    {
        private readonly IRefreshTokenService _refreshTokenService;

        public RevokeOtherSessionsCommandHandler(IRefreshTokenService refreshTokenService)
        {
            _refreshTokenService = refreshTokenService;
        }

        public async Task<bool> Handle(RevokeOtherSessionsCommand request, CancellationToken cancellationToken)
        {
            await _refreshTokenService.RevokeOtherSessionsForUserAsync(request.UserId, request.CurrentRefreshToken, cancellationToken);
            return true;
        }
    }
}
