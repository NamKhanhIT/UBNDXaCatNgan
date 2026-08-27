using System;
using System.Collections.Generic;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface IJwtTokenService
    {
        string GenerateToken(User user, string activeRole, IEnumerable<string> allRoles, int rankLevel = 5);

        // Sinh refresh token thô ngẫu nhiên dùng 1 lần
        string GenerateRefreshToken();

        // Băm refresh token bằng SHA-256 (hex) để lưu database
        string HashRefreshToken(string rawToken);

        // Sinh MFA token tạm thời (5 phút, Purpose=mfa) sau khi mật khẩu đúng
        string GenerateMfaToken(Guid userId);

        // Kiểm tra MFA token hợp lệ (Purpose=mfa, chữ ký, hạn)
        bool TryValidateMfaToken(string mfaToken, out Guid userId);

        // BẢO MẬT (Audit Đợt 4): Sinh ResetToken tạm thời (5 phút, Purpose=reset) sau khi OTP/TOTP đúng
        string GenerateResetToken(Guid userId);

        // Kiểm tra ResetToken hợp lệ (Purpose=reset, chữ ký, hạn)
        bool TryValidateResetToken(string resetToken, out Guid userId);
    }
}
