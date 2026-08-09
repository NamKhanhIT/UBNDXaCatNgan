using MediatR;
using Quanlycongviec.Application.Features.Auth.DTOs;

namespace Quanlycongviec.Application.Features.Auth.Commands.Register
{
    public record RegisterCommand(
        string Username,
        string FullName,
        string Email,
        string Password,
        string InitialRoleCode = "ChuyenVien"
    ) : IRequest<AuthResponseDto>;
}
