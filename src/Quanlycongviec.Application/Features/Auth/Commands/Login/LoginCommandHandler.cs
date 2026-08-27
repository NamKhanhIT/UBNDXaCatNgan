using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.DTOs;

namespace Quanlycongviec.Application.Features.Auth.Commands.Login
{
    public class LoginCommandHandler : IRequestHandler<LoginCommand, AuthResponseDto>
    {
        // BẢO MẬT (Audit M10): Dummy bcrypt hash dùng verify khi user không tồn tại để cân bằng timing
        private const string DummyBcryptHash =
            "$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IRefreshTokenService _refreshTokenService;

        public LoginCommandHandler(
            IApplicationDbContext context,
            IPasswordHasher passwordHasher,
            IJwtTokenService jwtTokenService,
            IRefreshTokenService refreshTokenService)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _jwtTokenService = jwtTokenService;
            _refreshTokenService = refreshTokenService;
        }

        public async Task<AuthResponseDto> Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Department)
                .FirstOrDefaultAsync(u => u.Username == request.Username || u.Email == request.Username, cancellationToken);

            // BẢO MẬT (Audit M10): Chống timing attack — luôn verify dummy hash khi user không tồn tại
            if (user == null)
            {
                _passwordHasher.VerifyPassword(request.Password, DummyBcryptHash);
                throw new UnauthorizedAccessException("Tên đăng nhập hoặc mật khẩu không chính xác.");
            }

            if (!_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
            {
                throw new UnauthorizedAccessException("Tên đăng nhập hoặc mật khẩu không chính xác.");
            }

            var roles = user.UserRoles.Select(ur => ur.Role.Code).ToList();
            if (!roles.Any())
            {
                roles.Add("ChuyenVien");
            }

            string activeRole = string.IsNullOrEmpty(user.ActiveRoleCode) ? roles.First() : user.ActiveRoleCode;

            // Lấy RankLevel của vai trò đang hoạt động
            var activeUserRole = user.UserRoles.FirstOrDefault(ur => ur.Role.Code == activeRole);
            int rankLevel = activeUserRole?.Role.RankLevel ?? 5;

            // Người dùng đã bật MFA → chỉ cấp token MFA tạm thời, buộc xác thực OTP
            if (user.MfaEnabled)
            {
                return new AuthResponseDto
                {
                    UserId = user.Id,
                    Username = user.Username,
                    FullName = user.FullName,
                    Email = user.Email,
                    ActiveRole = activeRole,
                    MfaRequired = true,
                    MfaToken = _jwtTokenService.GenerateMfaToken(user.Id),
                    MfaEnabled = true,
                    MustChangePassword = user.MustChangePassword
                };
            }

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
                MfaEnabled = user.MfaEnabled,
                MustChangePassword = user.MustChangePassword
            };
        }
    }
}
