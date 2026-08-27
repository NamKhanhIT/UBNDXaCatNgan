using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword
{
    // BẢO MẬT (Audit Đợt 4): Bước 3 quên mật khẩu qua Authenticator — đổi mật khẩu bằng ResetToken
    public record ResetPasswordWithMfaCommand(string ResetToken, string NewPassword) : IRequest<bool>;

    public class ResetPasswordWithMfaCommandHandler : IRequestHandler<ResetPasswordWithMfaCommand, bool>
    {
        private readonly IApplicationDbContext _context;
        private readonly IPasswordHasher _passwordHasher;
        private readonly IRefreshTokenService _refreshTokenService;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly ILogger<ResetPasswordWithMfaCommandHandler> _logger;

        public ResetPasswordWithMfaCommandHandler(
            IApplicationDbContext context,
            IPasswordHasher passwordHasher,
            IRefreshTokenService refreshTokenService,
            IJwtTokenService jwtTokenService,
            ILogger<ResetPasswordWithMfaCommandHandler> logger)
        {
            _context = context;
            _passwordHasher = passwordHasher;
            _refreshTokenService = refreshTokenService;
            _jwtTokenService = jwtTokenService;
            _logger = logger;
        }

        public async Task<bool> Handle(ResetPasswordWithMfaCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.ResetToken) || string.IsNullOrWhiteSpace(request.NewPassword))
            {
                throw new InvalidOperationException(ForgotPasswordMessages.InputIncomplete);
            }

            var (isValid, passwordError) = Quanlycongviec.Application.Common.Security.PasswordPolicy.Validate(request.NewPassword);
            if (!isValid)
            {
                throw new InvalidOperationException(passwordError ?? ForgotPasswordMessages.PasswordTooShort);
            }

            // BẢO MẬT (Audit Đợt 4): Chỉ chấp nhận token có Purpose=reset và còn hạn
            if (!_jwtTokenService.TryValidateResetToken(request.ResetToken, out var userId))
            {
                throw new InvalidOperationException(ForgotPasswordMessages.ResetFailedGeneric);
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

            if (user == null)
            {
                throw new InvalidOperationException(ForgotPasswordMessages.ResetFailedGeneric);
            }

            // Kiểm tra tài khoản phải đang bật MFA
            if (!user.MfaEnabled || string.IsNullOrWhiteSpace(user.MfaSecret))
            {
                throw new InvalidOperationException(ForgotPasswordMessages.ResetFailedGeneric);
            }

            user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
            user.PasswordResetOtp = null;
            user.PasswordResetOtpExpiry = null;

            await _context.SaveChangesAsync(cancellationToken);

            // BẢO MẬT (Audit H6): Thu hồi toàn bộ refresh token cũ của tài khoản
            await _refreshTokenService.RevokeAllForUserAsync(user.Id, cancellationToken);

            _logger.LogInformation("[ForgotPassword] Đã đặt lại mật khẩu thành công bằng Authenticator 2 bước cho tài khoản {Username}", user.Username);

            return true;
        }
    }
}
