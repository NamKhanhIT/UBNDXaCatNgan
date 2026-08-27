using MediatR;

namespace Quanlycongviec.Application.Features.Auth.Commands.RefreshToken
{
    // Thu hồi refresh token khi đăng xuất
    public class RevokeRefreshTokenCommand : IRequest
    {
        public RevokeRefreshTokenCommand(string refreshToken)
        {
            RefreshToken = refreshToken;
        }

        public string RefreshToken { get; }
    }
}