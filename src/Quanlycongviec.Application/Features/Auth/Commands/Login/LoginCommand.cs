using MediatR;
using Quanlycongviec.Application.Features.Auth.DTOs;

namespace Quanlycongviec.Application.Features.Auth.Commands.Login
{
    public record LoginCommand(
        string Username,
        string Password
    ) : IRequest<AuthResponseDto>;
}
