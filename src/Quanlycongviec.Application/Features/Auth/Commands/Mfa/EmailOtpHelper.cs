using System;
using System.Security.Cryptography;
using System.Text;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    // BẢO MẬT (Audit Đợt 3): Tiện ích quản lý mã OTP Email (SHA-256 hash, constant-time so sánh, one-time consume)
    public static class EmailOtpHelper
    {
        public const int LifetimeMinutes = 5;
        public const int ResendCooldownSeconds = 60;

        public static string HashCode(string otpCode)
        {
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(otpCode.Trim()));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        // Kiểm tra mã nhập vào khớp hash đang lưu và còn hạn (không tiêu thụ mã)
        public static bool IsValid(User user, string otpCode)
        {
            if (user == null ||
                string.IsNullOrWhiteSpace(user.MfaEmailOtpHash) ||
                user.MfaEmailOtpExpiry == null ||
                string.IsNullOrWhiteSpace(otpCode))
            {
                return false;
            }

            if (user.MfaEmailOtpExpiry.Value < DateTime.UtcNow)
            {
                return false;
            }

            var incoming = HashCode(otpCode);
            var stored = user.MfaEmailOtpHash;

            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(incoming),
                Encoding.UTF8.GetBytes(stored));
        }

        // Tiêu thụ mã (one-time): xóa hash + expiry sau khi xác thực đúng
        public static void Consume(User user)
        {
            user.MfaEmailOtpHash = null;
            user.MfaEmailOtpExpiry = null;
        }

        // Thời gian chờ gửi lại mã OTP (giây)
        public static int RemainingCooldownSeconds(User user)
        {
            if (user?.MfaEmailOtpSentUtc == null) return 0;
            var elapsed = DateTime.UtcNow - user.MfaEmailOtpSentUtc.Value;
            var remaining = ResendCooldownSeconds - (int)elapsed.TotalSeconds;
            return remaining > 0 ? remaining : 0;
        }

        // Che địa chỉ email để hiển thị UI: h*****@ubnd.gov.vn
        public static string MaskEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return string.Empty;
            var at = email.IndexOf('@');
            if (at <= 0) return "***";
            var localPart = email.Substring(0, at);
            return $"{localPart[0]}*****{email.Substring(at)}";
        }
    }
}