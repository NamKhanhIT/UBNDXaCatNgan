using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
        private readonly Microsoft.Extensions.Logging.ILogger<VerifyMfaLoginCommandHandler> _logger;

        public VerifyMfaLoginCommandHandler(
            IApplicationDbContext context,
            IJwtTokenService jwtTokenService,
            IRefreshTokenService refreshTokenService,
            ITotpService totpService,
            Microsoft.Extensions.Logging.ILogger<VerifyMfaLoginCommandHandler> logger)
        {
            _context = context;
            _jwtTokenService = jwtTokenService;
            _refreshTokenService = refreshTokenService;
            _totpService = totpService;
            _logger = logger;
        }

        public async Task<AuthResponseDto> Handle(VerifyMfaLoginCommand request, CancellationToken cancellationToken)
        {
            // 1. Kiểm tra MFA token tạm thời (Purpose=mfa, 5 phút)
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

            if (!user.MfaEnabled)
            {
                throw new UnauthorizedAccessException("Tài khoản chưa bật xác thực 2 yếu tố.");
            }

            // 2. Xác minh mã OTP/TOTP theo kênh hoặc tự động nhận diện
            bool isEmailValid = EmailOtpHelper.IsValid(user, request.Code);
            bool isTotpValid = false;
            long usedCounter = 0;

            if (!string.IsNullOrEmpty(user.MfaSecret))
            {
                isTotpValid = _totpService.TryValidate(user.MfaSecret, request.Code, out usedCounter)
                    && usedCounter > user.LastUsedTotpCounter;
            }

            if (string.Equals(request.Channel, "email", StringComparison.OrdinalIgnoreCase))
            {
                if (!isEmailValid)
                {
                    throw new UnauthorizedAccessException(
                        "Mã OTP email không hợp lệ hoặc đã hết hạn (hiệu lực 5 phút). Vui lòng yêu cầu mã mới.");
                }

                EmailOtpHelper.Consume(user);
                await _context.SaveChangesAsync(cancellationToken);
            }
            else if (string.Equals(request.Channel, "totp", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrEmpty(user.MfaSecret))
                {
                    throw new UnauthorizedAccessException(
                        "Tài khoản này chỉ hỗ trợ xác thực qua Email công vụ. Vui lòng chọn kênh Email để nhận mã OTP.");
                }

                if (!isTotpValid)
                {
                    throw new UnauthorizedAccessException("Mã OTP Authenticator không hợp lệ hoặc đã hết hạn.");
                }

                user.LastUsedTotpCounter = usedCounter;
                await _context.SaveChangesAsync(cancellationToken);
            }
            else
            {
                // Tự động thử cả 2 kênh
                if (isEmailValid)
                {
                    EmailOtpHelper.Consume(user);
                    await _context.SaveChangesAsync(cancellationToken);
                }
                else if (isTotpValid)
                {
                    user.LastUsedTotpCounter = usedCounter;
                    await _context.SaveChangesAsync(cancellationToken);
                }
                else
                {
                    throw new UnauthorizedAccessException("Mã OTP không hợp lệ hoặc đã hết hạn.");
                }
            }

            // 3. Cấp token phiên đầy đủ
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
                MfaEnabled = true,
                MustChangePassword = user.MustChangePassword
            };
        }
    }
}