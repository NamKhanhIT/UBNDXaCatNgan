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
    }
}