using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Auth.Commands.RefreshToken
{
    public class RevokeRefreshTokenCommandHandler : IRequestHandler<RevokeRefreshTokenCommand>
    {
        private readonly IRefreshTokenService _refreshTokenService;

        public RevokeRefreshTokenCommandHandler(IRefreshTokenService refreshTokenService)
        {
            _refreshTokenService = refreshTokenService;
        }

        public async Task Handle(RevokeRefreshTokenCommand request, CancellationToken cancellationToken)
        {
            await _refreshTokenService.RevokeAsync(request.RefreshToken, cancellationToken);
        }
    }
}