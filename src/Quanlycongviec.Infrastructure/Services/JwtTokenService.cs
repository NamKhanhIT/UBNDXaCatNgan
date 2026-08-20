using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Infrastructure.Services
{
    public class JwtTokenService : IJwtTokenService
    {
        private readonly IConfiguration _configuration;

        public JwtTokenService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public string GenerateToken(User user, string activeRole, IEnumerable<string> allRoles, int rankLevel = 5)
        {
            var secretKey = _configuration["Jwt:Secret"]
                ?? throw new InvalidOperationException(
                    "Jwt:Secret chưa được cấu hình. Không thể sinh JWT token. " +
                    "Vui lòng đặt trong appsettings hoặc dotnet user-secrets.");

            var issuer = _configuration["Jwt:Issuer"] ?? "UBNDXaCatNganApi";
            var audience = _configuration["Jwt:Audience"] ?? "UBNDXaCatNganClient";

            // Access token thời hạn ngắn (mặc định 30 phút) — giảm rủi ro khi token bị lộ
            var accessTokenMinutes = int.TryParse(_configuration["Jwt:AccessTokenMinutes"], out var minutes)
                ? minutes
                : 30;

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim("FullName", user.FullName),
                new Claim("ActiveRole", activeRole),
                new Claim("RankLevel", rankLevel.ToString())
            };

            foreach (var role in allRoles)
            {
                claims.Add(new Claim(ClaimTypes.Role, role));
            }

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(accessTokenMinutes),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public string GenerateRefreshToken()
        {
            var bytes = new byte[64];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            return Convert.ToBase64String(bytes);
        }

        public string HashRefreshToken(string rawToken)
        {
            var bytes = Encoding.UTF8.GetBytes(rawToken);
            var hash = SHA256.HashData(bytes);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        public string GenerateMfaToken(Guid userId)
        {
            var secretKey = _configuration["Jwt:Secret"]
                ?? throw new InvalidOperationException(
                    "Jwt:Secret chưa được cấu hình. Không thể sinh MFA token.");

            var issuer = _configuration["Jwt:Issuer"] ?? "UBNDXaCatNganApi";
            var audience = _configuration["Jwt:Audience"] ?? "UBNDXaCatNganClient";

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim("Purpose", "mfa")
            };

            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(5),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public bool TryValidateMfaToken(string mfaToken, out Guid userId)
        {
            userId = Guid.Empty;

            var secretKey = _configuration["Jwt:Secret"]
                ?? throw new InvalidOperationException(
                    "Jwt:Secret chưa được cấu hình. Không thể xác thực MFA token.");

            var issuer = _configuration["Jwt:Issuer"] ?? "UBNDXaCatNganApi";
            var audience = _configuration["Jwt:Audience"] ?? "UBNDXaCatNganClient";

            var tokenHandler = new JwtSecurityTokenHandler();
            var validationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = issuer,
                ValidAudience = audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
                ClockSkew = TimeSpan.FromMinutes(1)
            };

            try
            {
                var principal = tokenHandler.ValidateToken(mfaToken, validationParameters, out _);

                // Bắt buộc claim Purpose = mfa (chống dùng access token thay thế)
                var purpose = principal.FindFirst("Purpose")?.Value;
                if (!string.Equals(purpose, "mfa", StringComparison.Ordinal))
                {
                    return false;
                }

                var userIdStr = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

                return Guid.TryParse(userIdStr, out userId);
            }
            catch
            {
                return false;
            }
        }
    }
}
