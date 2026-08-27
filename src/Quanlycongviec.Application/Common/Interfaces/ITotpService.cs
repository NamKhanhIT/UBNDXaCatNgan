using System;

namespace Quanlycongviec.Application.Common.Interfaces
{
    // Giao diện dịch vụ TOTP (RFC 6238) — xác thực 2 yếu tố Authenticator
    public interface ITotpService
    {
        // Sinh secret Base32 ngẫu nhiên (32 bytes = 256-bit entropy)
        string GenerateSecret();

        // Tạo URI otpauth:// để quét mã QR trong app Authenticator
        string GetProvisioningUri(string secret, string accountName, string issuer = "KHM Software");

        // Kiểm tra mã OTP 6 chữ số (cho phép lệch ±1 bước, so sánh constant-time)
        bool Validate(string secret, string code, DateTime? utcNow = null);

        // BẢO MẬT (Audit H5): Xác minh TOTP và trả timestep để chống replay trong cửa sổ 30s
        bool TryValidate(string secret, string code, out long usedCounter, DateTime? utcNow = null);
    }
}
