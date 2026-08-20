using System;

namespace Quanlycongviec.Application.Common.Interfaces
{
    /// <summary>
    /// Giao diện dịch vụ TOTP (RFC 6238) — xác thực 2 yếu tố Google Authenticator / Aegis / Ente Auth.
    /// </summary>
    public interface ITotpService
    {
        /// <summary>Sinh secret Base32 ngẫu nhiên (32 bytes = 256-bit entropy)</summary>
        string GenerateSecret();

        /// <summary>Tạo URI otpauth:// để quét mã QR trong app Authenticator</summary>
        string GetProvisioningUri(string secret, string accountName, string issuer = "UBND Xa Cat Ngan");

        /// <summary>
        /// Kiểm tra mã OTP 6 chữ số theo secret, cho phép lệch ±1 bước (30 giây) để bù trôi đồng hồ.
        /// Sử dụng so sánh Constant-Time chống Timing Attack.
        /// </summary>
        bool Validate(string secret, string code, DateTime? utcNow = null);
    }
}
