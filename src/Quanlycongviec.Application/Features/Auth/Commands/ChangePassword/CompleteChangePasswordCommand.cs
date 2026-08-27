using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Security;
using Quanlycongviec.Application.Features.Auth.DTOs;

namespace Quanlycongviec.Application.Features.Auth.Commands.ChangePassword
{
    public record CompleteChangePasswordCommand(
        Guid UserId,
        string ChangePasswordToken,
        string NewPassword) : IRequest<AuthResponseDto>;

    public class CompleteChangePasswordCommandHandler : IRequestHandler<CompleteChangePasswordCommand, AuthResponseDto>
    {
        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IRefreshTokenService _refreshTokenService;
        private readonly ILogger<CompleteChangePasswordCommandHandler> _logger;

        public CompleteChangePasswordCommandHandler(
            IApplicationDbContext context,
            IPasswordHasher passwordHasher,
            IJwtTokenService jwtTokenService,
            IRefreshTokenService refreshTokenService,
            ILogger<CompleteChangePasswordCommandHandler> logger)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _jwtTokenService = jwtTokenService;
            _refreshTokenService = refreshTokenService;
            _logger = logger;
        }

        public async Task<AuthResponseDto> Handle(CompleteChangePasswordCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.ChangePasswordToken) ||
                string.IsNullOrWhiteSpace(request.NewPassword))
            {
                throw new InvalidOperationException("Vui lòng cung cấp đầy đủ thông tin xác thực và mật khẩu mới.");
            }

            // 1. Kiểm tra tiêu chuẩn độ mạnh mật khẩu theo PasswordPolicy
            var (isValid, passwordError) = PasswordPolicy.Validate(request.NewPassword);
            if (!isValid)
            {
                throw new InvalidOperationException(passwordError ?? "Mật khẩu mới không đáp ứng tiêu chuẩn an toàn thông tin.");
            }

            // 2. Xác thực ChangePasswordToken (Purpose = reset, 5 phút)
            if (!_jwtTokenService.TryValidateResetToken(request.ChangePasswordToken, out var tokenUserId))
            {
                throw new InvalidOperationException("Phiên xác thực đổi mật khẩu đã hết hạn hoặc không hợp lệ. Vui lòng thực hiện lại từ Bước 1.");
            }

            if (request.UserId != Guid.Empty && tokenUserId != request.UserId)
            {
                throw new UnauthorizedAccessException("Mã xác thực không thuộc về tài khoản hiện tại.");
            }

            var user = await _context.Users
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Department)
                .FirstOrDefaultAsync(u => u.Id == tokenUserId, cancellationToken);

            if (user == null)
            {
                throw new UnauthorizedAccessException("Tài khoản không còn tồn tại.");
            }

            // 3. Cập nhật mật khẩu mới và dọn dẹp các trường OTP
            user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
            user.MustChangePassword = false;
            user.PasswordResetOtp = null;
            user.PasswordResetOtpExpiry = null;
            user.OtpFailedCount = 0;
            user.OtpLockedUntil = null;

            await _context.SaveChangesAsync(cancellationToken);

            // 4. Thu hồi toàn bộ refresh token cũ trên các thiết bị khác & cấp mới cho phiên hiện tại
            await _refreshTokenService.RevokeAllForUserAsync(user.Id, cancellationToken);
            var newRefreshToken = await _refreshTokenService.CreateAsync(user.Id, cancellationToken);

            var roles = user.UserRoles.Select(ur => ur.Role.Code).ToList();
            if (!roles.Any()) roles.Add("ChuyenVien");
            var activeRole = string.IsNullOrEmpty(user.ActiveRoleCode) ? roles.First() : user.ActiveRoleCode;
            var activeUserRole = user.UserRoles.FirstOrDefault(ur => ur.Role.Code == activeRole);
            int rankLevel = activeUserRole?.Role.RankLevel ?? 5;
            var token = _jwtTokenService.GenerateToken(user, activeRole, roles, rankLevel);

            _logger.LogInformation("[ChangePassword] {Username} đã hoàn tất đổi mật khẩu thành công qua quy trình 2 bước.", user.Username);

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
