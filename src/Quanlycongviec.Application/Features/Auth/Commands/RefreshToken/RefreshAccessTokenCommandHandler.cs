using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.DTOs;

namespace Quanlycongviec.Application.Features.Auth.Commands.RefreshToken
{
    public class RefreshAccessTokenCommandHandler : IRequestHandler<RefreshAccessTokenCommand, AuthResponseDto>
    {
        private readonly IApplicationDbContext _context;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IRefreshTokenService _refreshTokenService;

        public RefreshAccessTokenCommandHandler(
            IApplicationDbContext context,
            IJwtTokenService jwtTokenService,
            IRefreshTokenService refreshTokenService)
        {
            _context = context;
            _jwtTokenService = jwtTokenService;
            _refreshTokenService = refreshTokenService;
        }

        public async Task<AuthResponseDto> Handle(RefreshAccessTokenCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.RefreshToken))
            {
                throw new UnauthorizedAccessException("Thiếu refresh token.");
            }

            // Xác thực token cũ — phải còn hiệu lực (chưa thu hồi, chưa hết hạn)
            var storedToken = await _refreshTokenService.FindValidAsync(request.RefreshToken, cancellationToken);
            if (storedToken == null)
            {
                throw new UnauthorizedAccessException("Refresh token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
            }

            var user = await _context.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Department)
                .FirstOrDefaultAsync(u => u.Id == storedToken.UserId, cancellationToken);

            if (user == null)
            {
                throw new UnauthorizedAccessException("Tài khoản không còn tồn tại.");
            }

            var roles = user.UserRoles.Select(ur => ur.Role.Code).ToList();
            if (!roles.Any())
            {
                roles.Add("ChuyenVien");
            }

            var activeRole = string.IsNullOrEmpty(user.ActiveRoleCode) ? roles.First() : user.ActiveRoleCode;
            var activeUserRole = user.UserRoles.FirstOrDefault(ur => ur.Role.Code == activeRole);
            int rankLevel = activeUserRole?.Role.RankLevel ?? 5;

            // Xoay vòng: thu hồi token cũ, cấp token mới
            await _refreshTokenService.RevokeAsync(request.RefreshToken, cancellationToken);
            var newRefreshToken = await _refreshTokenService.CreateAsync(user.Id, cancellationToken);

            var token = _jwtTokenService.GenerateToken(user, activeRole, roles, rankLevel);

            return new AuthResponseDto
            {
                UserId = user.Id,
                Username = user.Username,
                FullName = user.FullName,
                Email = user.Email,
                ActiveRole = activeRole,
                AvailableRoles = user.UserRoles.Select(ur => new UserRoleDto
                {
                    RoleCode = ur.Role.Code,
                    RoleName = ur.Role.Name,
                    DepartmentName = ur.Department?.Name,
                    IsPrimary = ur.IsPrimary
                }).ToList(),
                Token = token,
                RefreshToken = newRefreshToken,
                MfaEnabled = user.MfaEnabled
            };
        }
    }
}