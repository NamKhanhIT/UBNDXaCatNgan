using System;
using System.Collections.Generic;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface IJwtTokenService
    {
        string GenerateToken(User user, string activeRole, IEnumerable<string> allRoles, int rankLevel = 5);

        /// <summary>Sinh refresh token thô (ngẫu nhiên, dùng 1 lần)</summary>
        string GenerateRefreshToken();

        /// <summary>Băm refresh token bằng SHA-256 (hex) — chỉ lưu hash vào database</summary>
        string HashRefreshToken(string rawToken);

        /// <summary>
        /// Sinh token chuyên dụng cho bước xác thực MFA (ngắn hạn 5 phút, có claim Purpose=mfa).
        /// Dùng để đảm bảo người gửi mã OTP đã vượt qua bước kiểm tra mật khẩu.
        /// </summary>
        string GenerateMfaToken(Guid userId);

        /// <summary>Kiểm tra MFA token còn hợp lệ (chữ ký, hạn, Purpose=mfa). Trả về userId nếu hợp lệ.</summary>
        bool TryValidateMfaToken(string mfaToken, out Guid userId);
    }
}
