using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Auth.DTOs;

namespace Quanlycongviec.Application.Features.Auth.Commands.ChangePassword
{
    // BẢO MẬT (Audit A5): Đổi mật khẩu cho tài khoản đã đăng nhập (buộc đổi lần đầu hoặc chủ động).
    public record ChangePasswordCommand(
        Guid UserId,
        string CurrentPassword,
        string NewPassword) : IRequest<AuthResponseDto>;

    public class ChangePasswordCommandHandler : IRequestHandler<ChangePasswordCommand, AuthResponseDto>
    {
        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IRefreshTokenService _refreshTokenService;
        private readonly ILogger<ChangePasswordCommandHandler> _logger;

        public ChangePasswordCommandHandler(
            IApplicationDbContext context,
            IPasswordHasher passwordHasher,
            IJwtTokenService jwtTokenService,
            IRefreshTokenService refreshTokenService,
            ILogger<ChangePasswordCommandHandler> logger)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _jwtTokenService = jwtTokenService;
            _refreshTokenService = refreshTokenService;
            _logger = logger;
        }

        public async Task<AuthResponseDto> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.CurrentPassword) ||
                string.IsNullOrWhiteSpace(request.NewPassword))
            {
                throw new InvalidOperationException("Vui lòng cung cấp đầy đủ mật khẩu hiện tại và mật khẩu mới.");
            }

            var (isValid, passwordError) = Quanlycongviec.Application.Common.Security.PasswordPolicy.Validate(request.NewPassword);
            if (!isValid)
            {
                throw new InvalidOperationException(passwordError ?? "Mật khẩu mới không đáp ứng tiêu chuẩn bảo mật.");
            }

            var user = await _context.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Department)
                .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

            if (user == null)
            {
                throw new UnauthorizedAccessException("Tài khoản không còn tồn tại.");
            }

            // Xác minh mật khẩu hiện tại — chống chiếm phiên đổi hộ mật khẩu
            if (!_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            {
                _logger.LogWarning("[ChangePassword] Mật khẩu hiện tại sai cho {Username}", user.Username);
                throw new InvalidOperationException("Mật khẩu hiện tại không chính xác.");
            }

            var wasForcedChange = user.MustChangePassword;

            // Cập nhật hash mới và gỡ cờ bắt buộc đổi mật khẩu
            user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
            user.MustChangePassword = false;

            await _context.SaveChangesAsync(cancellationToken);

            // BẢO MẬT (Audit H6): Thu hồi toàn bộ refresh token cũ trước khi cấp token mới
            await _refreshTokenService.RevokeAllForUserAsync(user.Id, cancellationToken);
            var newRefreshToken = await _refreshTokenService.CreateAsync(user.Id, cancellationToken);

            var roles = user.UserRoles.Select(ur => ur.Role.Code).ToList();
            if (!roles.Any()) roles.Add("ChuyenVien");
            var activeRole = string.IsNullOrEmpty(user.ActiveRoleCode) ? roles.First() : user.ActiveRoleCode;
            var activeUserRole = user.UserRoles.FirstOrDefault(ur => ur.Role.Code == activeRole);
            int rankLevel = activeUserRole?.Role.RankLevel ?? 5;
            var token = _jwtTokenService.GenerateToken(user, activeRole, roles, rankLevel);

            _logger.LogInformation(
                "[ChangePassword] {Username} đã đổi mật khẩu thành công{Forced}.",
                user.Username, wasForcedChange ? " (hoàn tất bước xác minh bắt buộc)" : "");

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
                MfaEnabled = user.MfaEnabled,
                MustChangePassword = false
            };
        }
    }
}
