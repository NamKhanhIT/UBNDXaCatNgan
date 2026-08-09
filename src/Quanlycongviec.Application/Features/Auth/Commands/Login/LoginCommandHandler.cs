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
        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly IJwtTokenService _jwtTokenService;

        public LoginCommandHandler(
            IApplicationDbContext context,
            IPasswordHasher passwordHasher,
            IJwtTokenService jwtTokenService)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _jwtTokenService = jwtTokenService;
        }

        public async Task<AuthResponseDto> Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Department)
                .FirstOrDefaultAsync(u => u.Username == request.Username || u.Email == request.Username, cancellationToken);

            if (user == null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
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
                Token = token
            };
        }
    }
}
