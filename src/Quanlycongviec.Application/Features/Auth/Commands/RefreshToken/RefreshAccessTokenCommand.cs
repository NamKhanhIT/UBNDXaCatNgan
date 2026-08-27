using System;
using MediatR;
using Quanlycongviec.Application.Features.Auth.DTOs;

namespace Quanlycongviec.Application.Features.Auth.Commands.RefreshToken
{
    // Dùng refresh token hợp lệ để cấp lại access token và xoay vòng refresh token mới
    public class RefreshAccessTokenCommand : IRequest<AuthResponseDto>
    {
        public string RefreshToken { get; set; } = string.Empty;
    }
}