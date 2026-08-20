using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.DTOs;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    public class VerifyMfaLoginCommandHandler : IRequestHandler<VerifyMfaLoginCommand, AuthResponseDto>
    {
        private readonly IApplicationDbContext _context;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IRefreshTokenService _refreshTokenService;
        private readonly ITotpService _totpService;

        public VerifyMfaLoginCommandHandler(
            IApplicationDbContext context,
            IJwtTokenService jwtTokenService,
            IRefreshTokenService refreshTokenService,
            ITotpService totpService)
        {
            _context = context;
            _jwtTokenService = jwtTokenService;
            _refreshTokenService = refreshTokenService;
            _totpService = totpService;
        }

        public async Task<AuthResponseDto> Handle(VerifyMfaLoginCommand request, CancellationToken cancellationToken)
        {
            // 1. Kiểm tra token MFA (phải là token Purpose=mfa do login cấp, còn hạn 5 phút)
            if (!_jwtTokenService.TryValidateMfaToken(request.MfaToken, out var userId))
            {
                throw new UnauthorizedAccessException("Phiên xác thực đã hết hạn. Vui lòng đăng nhập lại.");
            }

            var user = await _context.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Department)
                .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

            if (user == null)
            {
                throw new UnauthorizedAccessException("Tài khoản không còn tồn tại.");
            }

            if (!user.MfaEnabled || string.IsNullOrEmpty(user.MfaSecret))
            {
                throw new UnauthorizedAccessException("Tài khoản chưa bật xác thực 2 yếu tố.");
            }

            // 2. Xác minh mã OTP (Constant-Time)
            if (!_totpService.Validate(user.MfaSecret, request.Code))
            {
                throw new UnauthorizedAccessException("Mã OTP không hợp lệ hoặc đã hết hạn.");
            }

            // 3. Cấp token đầy đủ như đăng nhập bình thường
            var roles = user.UserRoles.Select(ur => ur.Role.Code).ToList();
            if (!roles.Any())
            {
                roles.Add("ChuyenVien");
            }

            var activeRole = string.IsNullOrEmpty(user.ActiveRoleCode) ? roles.First() : user.ActiveRoleCode;
            var activeUserRole = user.UserRoles.FirstOrDefault(ur => ur.Role.Code == activeRole);
            int rankLevel = activeUserRole?.Role.RankLevel ?? 5;

            var token = _jwtTokenService.GenerateToken(user, activeRole, roles, rankLevel);
            var refreshToken = await _refreshTokenService.CreateAsync(user.Id, cancellationToken);

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
                RefreshToken = refreshToken,
                MfaEnabled = true
            };
        }
    }
}