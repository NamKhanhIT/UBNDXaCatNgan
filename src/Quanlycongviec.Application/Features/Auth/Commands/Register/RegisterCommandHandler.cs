using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.DTOs;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Features.Auth.Commands.Register
{
    public class RegisterCommandHandler : IRequestHandler<RegisterCommand, AuthResponseDto>
    {
        // BẢO MẬT (Audit C2): Whitelist vai trò được phép cấp cho tài khoản tự đăng ký
        private static readonly HashSet<string> AllowedRoleCodes = new(StringComparer.Ordinal)
        {
            "ChuyenVien",
            "PhoPhong"
        };

        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IRefreshTokenService _refreshTokenService;

        public RegisterCommandHandler(
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

        public async Task<AuthResponseDto> Handle(RegisterCommand request, CancellationToken cancellationToken)
        {
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == request.Username || u.Email == request.Email, cancellationToken);

            if (existingUser != null)
            {
                throw new InvalidOperationException("Tên đăng nhập hoặc email đã tồn tại trong hệ thống.");
            }

            // BẢO MẬT (Audit C2): Từ chối vai trò ngoài whitelist để ngăn tự nâng quyền lãnh đạo
            if (string.IsNullOrWhiteSpace(request.InitialRoleCode) ||
                !AllowedRoleCodes.Contains(request.InitialRoleCode))
            {
                throw new InvalidOperationException(
                    "Vai trò không hợp lệ. Chỉ được cấp các vai trò: Chuyên viên, Phó trưởng phòng. Vai trò lãnh đạo phải do Quản trị viên gán trực tiếp trong cơ sở dữ liệu.");
            }

            var role = await _context.Roles
                .FirstOrDefaultAsync(r => r.Code == request.InitialRoleCode, cancellationToken)
                ?? throw new InvalidOperationException($"Vai trò [{request.InitialRoleCode}] chưa được khởi tạo trong hệ thống.");

            var user = new User
            {
                Username = request.Username,
                FullName = request.FullName,
                Email = request.Email,
                PasswordHash = _passwordHasher.HashPassword(request.Password),
                ActiveRoleCode = role.Code
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync(cancellationToken);

            var userRole = new UserRole
            {
                UserId = user.Id,
                RoleId = role.Id,
                IsPrimary = true
            };

            _context.UserRoles.Add(userRole);
            _context.WorkloadCapacities.Add(new WorkloadCapacity { UserId = user.Id, WeeklyMaxHours = 40.0 });
            await _context.SaveChangesAsync(cancellationToken);

            var token = _jwtTokenService.GenerateToken(user, role.Code, new[] { role.Code }, role.RankLevel);
            var refreshToken = await _refreshTokenService.CreateAsync(user.Id, cancellationToken);

            return new AuthResponseDto
            {
                UserId = user.Id,
                Username = user.Username,
                FullName = user.FullName,
                Email = user.Email,
                ActiveRole = role.Code,
                AvailableRoles = new List<UserRoleDto>
                {
                    new UserRoleDto { RoleCode = role.Code, RoleName = role.Name, IsPrimary = true }
                },
                Token = token,
                RefreshToken = refreshToken,
                MfaEnabled = false
            };
        }
    }
}
