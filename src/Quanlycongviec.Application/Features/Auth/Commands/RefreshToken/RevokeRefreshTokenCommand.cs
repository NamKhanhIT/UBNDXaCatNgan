using MediatR;

namespace Quanlycongviec.Application.Features.Auth.Commands.RefreshToken
{
    /// <summary>
    /// Thu hồi refresh token khi đăng xuất.
    /// </summary>
    public class RevokeRefreshTokenCommand : IRequest
    {
        public RevokeRefreshTokenCommand(string refreshToken)
        {
            RefreshToken = refreshToken;
        }

        public string RefreshToken { get; }
    }
}