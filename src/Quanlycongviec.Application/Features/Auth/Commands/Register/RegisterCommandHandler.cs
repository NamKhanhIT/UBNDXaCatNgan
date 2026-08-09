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
        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly IJwtTokenService _jwtTokenService;

        public RegisterCommandHandler(
            IApplicationDbContext context,
            IPasswordHasher passwordHasher,
            IJwtTokenService jwtTokenService)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _jwtTokenService = jwtTokenService;
        }

        public async Task<AuthResponseDto> Handle(RegisterCommand request, CancellationToken cancellationToken)
        {
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == request.Username || u.Email == request.Email, cancellationToken);

            if (existingUser != null)
            {
                throw new InvalidOperationException("Username hooc Email da ton tai trong he thong.");
            }

            var role = await _context.Roles
                .FirstOrDefaultAsync(r => r.Code == request.InitialRoleCode, cancellationToken);

            if (role == null)
            {
                role = new Role
                {
                    Name = request.InitialRoleCode == "BiThu" ? "Bí thư Đảng ủy" :
                           request.InitialRoleCode == "ChuTichUBND" ? "Chủ tịch UBND" : "Chuyên viên",
                    Code = request.InitialRoleCode,
                    Description = "Role tự động tạo khi đăng ký"
                };
                _context.Roles.Add(role);
                await _context.SaveChangesAsync(cancellationToken);
            }

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
                Token = token
            };
        }
    }
}
