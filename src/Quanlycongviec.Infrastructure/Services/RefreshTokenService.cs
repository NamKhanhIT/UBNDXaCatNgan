using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Infrastructure.Services
{
    public class RefreshTokenService : IRefreshTokenService
    {
        private readonly IApplicationDbContext _context;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly IConfiguration _configuration;

        public RefreshTokenService(
            IApplicationDbContext context,
            IJwtTokenService jwtTokenService,
            IConfiguration configuration)
        {
            _context = context;
            _jwtTokenService = jwtTokenService;
            _configuration = configuration;
        }

        public async Task<string> CreateAsync(Guid userId, CancellationToken cancellationToken)
        {
            // Thời hạn refresh token (mặc định 7 ngày)
            var refreshTokenDays = int.TryParse(_configuration["Jwt:RefreshTokenDays"], out var days)
                ? days
                : 7;

            var rawToken = _jwtTokenService.GenerateRefreshToken();
            var tokenHash = _jwtTokenService.HashRefreshToken(rawToken);

            _context.RefreshTokens.Add(new RefreshToken
            {
                UserId = userId,
                TokenHash = tokenHash,
                ExpiresUtc = DateTime.UtcNow.AddDays(refreshTokenDays),
                CreatedUtc = DateTime.UtcNow
            });

            await _context.SaveChangesAsync(cancellationToken);
            return rawToken;
        }

        public async Task<RefreshToken?> FindValidAsync(string rawToken, CancellationToken cancellationToken)
        {
            var tokenHash = _jwtTokenService.HashRefreshToken(rawToken);

            return await _context.RefreshTokens
                .FirstOrDefaultAsync(t =>
                    t.TokenHash == tokenHash &&
                    t.RevokedUtc == null &&
                    t.ExpiresUtc > DateTime.UtcNow,
                    cancellationToken);
        }

        public async Task RevokeAsync(string? rawToken, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(rawToken)) return;

            var tokenHash = _jwtTokenService.HashRefreshToken(rawToken);
            var token = await _context.RefreshTokens
                .FirstOrDefaultAsync(t => t.TokenHash == tokenHash, cancellationToken);

            if (token != null && token.RevokedUtc == null)
            {
                token.RevokedUtc = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        public async Task RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken)
        {
            var activeTokens = await _context.RefreshTokens
                .Where(t => t.UserId == userId && t.RevokedUtc == null)
                .ToListAsync(cancellationToken);

            if (activeTokens.Count == 0) return;

            var now = DateTime.UtcNow;
            foreach (var token in activeTokens)
            {
                token.RevokedUtc = now;
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task RevokeOtherSessionsForUserAsync(Guid userId, string? currentRawToken, CancellationToken cancellationToken)
        {
            var currentHash = !string.IsNullOrEmpty(currentRawToken) ? _jwtTokenService.HashRefreshToken(currentRawToken) : null;

            var otherActiveTokens = await _context.RefreshTokens
                .Where(t => t.UserId == userId && t.RevokedUtc == null && (currentHash == null || t.TokenHash != currentHash))
                .ToListAsync(cancellationToken);

            if (otherActiveTokens.Count == 0) return;

            var now = DateTime.UtcNow;
            foreach (var token in otherActiveTokens)
            {
                token.RevokedUtc = now;
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        // BẢO MẬT (Audit M4): Xoay vòng refresh token nguyên tử và phát hiện tái sử dụng token đã thu hồi
        public async Task<string> RotateAsync(Guid userId, string rawOldToken, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(rawOldToken))
            {
                throw new UnauthorizedAccessException("Phiên làm việc không hợp lệ.");
            }

            var oldHash = _jwtTokenService.HashRefreshToken(rawOldToken);
            var now = DateTime.UtcNow;

            try
            {
                // Tạo cặp token mới và cập nhật revoke nguyên tử trong 1 lệnh UPDATE
                var rawNew = _jwtTokenService.GenerateRefreshToken();
                var newHash = _jwtTokenService.HashRefreshToken(rawNew);

                var affected = await _context.RefreshTokens
                    .Where(t => t.TokenHash == oldHash && t.RevokedUtc == null)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(x => x.RevokedUtc, now)
                        .SetProperty(x => x.ReplacedByTokenHash, newHash), cancellationToken);

                if (affected == 0)
                {
                    // Phát hiện tái sử dụng token đã thu hồi -> thu hồi toàn bộ phiên của người dùng
                    await RevokeAllForUserAsync(userId, cancellationToken);
                    throw new UnauthorizedAccessException(
                        "Phát hiện phiên bất thường. Toàn bộ phiên đã được thu hồi — vui lòng đăng nhập lại.");
                }

                return await InsertNewTokenAsync(userId, rawNew, newHash, cancellationToken);
            }
            catch (UnauthorizedAccessException)
            {
                throw;
            }
            catch (Exception ex) when (ex is NotSupportedException || ex is InvalidOperationException)
            {
                // Fallback cho DbContext provider không hỗ trợ ExecuteUpdate (ví dụ InMemory)
                var legacy = await _context.RefreshTokens
                    .FirstOrDefaultAsync(t => t.TokenHash == oldHash && t.RevokedUtc == null, cancellationToken);

                if (legacy == null)
                {
                    await RevokeAllForUserAsync(userId, cancellationToken);
                    throw new UnauthorizedAccessException(
                        "Phát hiện phiên bất thường. Toàn bộ phiên đã được thu hồi — vui lòng đăng nhập lại.");
                }

                var rawNew = _jwtTokenService.GenerateRefreshToken();
                var newHash = _jwtTokenService.HashRefreshToken(rawNew);
                legacy.RevokedUtc = now;
                legacy.ReplacedByTokenHash = newHash;
                _context.RefreshTokens.Add(new RefreshToken
                {
                    UserId = userId,
                    TokenHash = newHash,
                    ExpiresUtc = now.AddDays(GetRefreshTokenDays()),
                    CreatedUtc = now
                });
                await _context.SaveChangesAsync(cancellationToken);
                return rawNew;
            }
        }

        private async Task<string> InsertNewTokenAsync(Guid userId, string rawNew, string newHash, CancellationToken cancellationToken)
        {
            _context.RefreshTokens.Add(new RefreshToken
            {
                UserId = userId,
                TokenHash = newHash,
                ExpiresUtc = DateTime.UtcNow.AddDays(GetRefreshTokenDays()),
                CreatedUtc = DateTime.UtcNow
            });
            await _context.SaveChangesAsync(cancellationToken);
            return rawNew;
        }

        private int GetRefreshTokenDays()
        {
            return int.TryParse(_configuration["Jwt:RefreshTokenDays"], out var days) ? days : 7;
        }
    }
}