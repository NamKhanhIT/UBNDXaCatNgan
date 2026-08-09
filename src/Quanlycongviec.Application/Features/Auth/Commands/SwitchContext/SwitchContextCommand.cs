using System;
using MediatR;
using Quanlycongviec.Application.Features.Auth.DTOs;

namespace Quanlycongviec.Application.Features.Auth.Commands.SwitchContext
{
    public record SwitchContextCommand(
        Guid UserId,
        string TargetRoleCode
    ) : IRequest<AuthResponseDto>;
}
