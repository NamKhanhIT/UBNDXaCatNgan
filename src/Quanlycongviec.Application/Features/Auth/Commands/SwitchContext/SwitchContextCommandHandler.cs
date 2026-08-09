using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.DTOs;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Features.Auth.Commands.SwitchContext
{
    public class SwitchContextCommandHandler : IRequestHandler<SwitchContextCommand, AuthResponseDto>
    {
        private readonly IApplicationDbContext _context;
        private readonly IJwtTokenService _jwtTokenService;

        public SwitchContextCommandHandler(
            IApplicationDbContext context,
            IJwtTokenService jwtTokenService)
        {
            _context = context;
            _jwtTokenService = jwtTokenService;
        }

        public async Task<AuthResponseDto> Handle(SwitchContextCommand request, CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Department)
                .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

            if (user == null)
            {
                throw new KeyNotFoundException("Không tìm thấy người dùng.");
            }

            var hasRole = user.UserRoles.Any(ur => ur.Role.Code == request.TargetRoleCode);
            if (!hasRole)
            {
                throw new InvalidOperationException($"Cán bộ không nắm giữ vai trò kiêm nhiệm [{request.TargetRoleCode}].");
            }

            user.ActiveRoleCode = request.TargetRoleCode;
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = user.Id,
                Username = user.Username,
                ActingRole = request.TargetRoleCode,
                Action = "SwitchContext",
                EntityName = "User",
                EntityId = user.Id.ToString(),
                Details = $"Chuyển đổi ngữ cảnh sang vai trò [{request.TargetRoleCode}]"
            });

            await _context.SaveChangesAsync(cancellationToken);

            var roles = user.UserRoles.Select(ur => ur.Role.Code).ToList();
            var targetUserRole = user.UserRoles.FirstOrDefault(ur => ur.Role.Code == request.TargetRoleCode);
            int rankLevel = targetUserRole?.Role.RankLevel ?? 5;
            var token = _jwtTokenService.GenerateToken(user, request.TargetRoleCode, roles, rankLevel);

            return new AuthResponseDto
            {
                UserId = user.Id,
                Username = user.Username,
                FullName = user.FullName,
                Email = user.Email,
                ActiveRole = request.TargetRoleCode,
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
