using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Common.Services
{
    /// <summary>
    /// Dịch vụ TOTP (RFC 6238) — xác thực 2 yếu tố bằng ứng dụng Authenticator
    /// (Google Authenticator / Ente Auth / Aegis / Microsoft Authenticator).
    /// Tự triển khai HMAC-SHA1 + Base32, không phụ thuộc thư viện ngoài.
    /// Tích hợp Constant-Time comparison chống Timing Attack.
    /// </summary>
    public class TotpService : ITotpService
    {
        private static readonly DateTime UnixEpoch = new(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        private const int StepSeconds = 30;
        private const int Digits = 6;

        /// <summary>Sinh secret Base32 ngẫu nhiên (32 bytes = 256 bits → ~56 ký tự)</summary>
        public string GenerateSecret() => GenerateSecretInternal();

        public static string GenerateSecretInternal()
        {
            var bytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            return Base32Encode(bytes);
        }

        /// <summary>Tạo URI otpauth:// để quét mã QR trong app Authenticator</summary>
        public string GetProvisioningUri(string secret, string accountName, string issuer = "UBND Xa Cat Ngan")
            => GetProvisioningUriInternal(secret, accountName, issuer);

        public static string GetProvisioningUriInternal(string secret, string accountName, string issuer = "UBND Xa Cat Ngan")
        {
            var cleanAccount = string.IsNullOrWhiteSpace(accountName) ? "CanBoUBND" : accountName.Trim();
            var cleanIssuer = string.IsNullOrWhiteSpace(issuer) ? "UBND Xa Cat Ngan" : issuer.Trim();
            var label = Uri.EscapeDataString($"{cleanIssuer}:{cleanAccount}");
            return $"otpauth://totp/{label}?secret={secret.Trim()}&issuer={Uri.EscapeDataString(cleanIssuer)}&digits={Digits}&period={StepSeconds}";
        }

        /// <summary>
        /// Kiểm tra mã OTP 6 chữ số theo secret, cho phép lệch ±1 bước (30 giây) để bù trôi đồng hồ.
        /// Sử dụng so sánh Constant-Time chống Timing Attack.
        /// </summary>
        public bool Validate(string secret, string code, DateTime? utcNow = null)
            => ValidateInternal(secret, code, utcNow);

        public static bool ValidateInternal(string secret, string code, DateTime? utcNow = null)
        {
            if (string.IsNullOrWhiteSpace(secret) || string.IsNullOrWhiteSpace(code))
            {
                return false;
            }

            var trimmedCode = code.Trim();
            if (trimmedCode.Length != Digits || !int.TryParse(trimmedCode, out _))
            {
                return false;
            }

            var now = utcNow ?? DateTime.UtcNow;
            var counter = (long)(now - UnixEpoch).TotalSeconds / StepSeconds;
            var userBytes = Encoding.UTF8.GetBytes(trimmedCode);

            for (long offset = -1; offset <= 1; offset++)
            {
                var computedStr = ComputeExactCode(secret, counter + offset);
                var expectedBytes = Encoding.UTF8.GetBytes(computedStr);

                if (CryptographicOperations.FixedTimeEquals(expectedBytes, userBytes))
                {
                    return true;
                }
            }

            return false;
        }

        public static string ComputeExactCode(string secret, long counter)
        {
            var code = ComputeCode(secret, counter);
            return code < 0 ? "" : code.ToString("D6");
        }

        private static int ComputeCode(string secret, long counter)
        {
            var secretBytes = Base32Decode(secret);
            if (secretBytes.Length == 0) return -1;

            var counterBytes = new byte[8];
            for (int i = 7; i >= 0; i--)
            {
                counterBytes[i] = (byte)(counter & 0xFF);
                counter >>= 8;
            }

            using var hmac = new HMACSHA1(secretBytes);
            var hash = hmac.ComputeHash(counterBytes);

            // Dynamic truncation (RFC 4226 §5.3)
            int offset = hash[hash.Length - 1] & 0x0F;
            int binaryCode =
                ((hash[offset] & 0x7F) << 24) |
                ((hash[offset + 1] & 0xFF) << 16) |
                ((hash[offset + 2] & 0xFF) << 8) |
                (hash[offset + 3] & 0xFF);

            return binaryCode % (int)Math.Pow(10, Digits);
        }

        private static string Base32Encode(byte[] data)
        {
            const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
            var sb = new StringBuilder((int)Math.Ceiling(data.Length * 8 / 5.0));

            int buffer = 0;
            int bitsLeft = 0;

            foreach (var b in data)
            {
                buffer = (buffer << 8) | b;
                bitsLeft += 8;

                while (bitsLeft >= 5)
                {
                    sb.Append(alphabet[(buffer >> (bitsLeft - 5)) & 0x1F]);
                    bitsLeft -= 5;
                }
            }

            if (bitsLeft > 0)
            {
                sb.Append(alphabet[(buffer << (5 - bitsLeft)) & 0x1F]);
            }

            return sb.ToString();
        }

        private static byte[] Base32Decode(string input)
        {
            const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
            var cleaned = input.Trim().ToUpperInvariant().Replace(" ", "").Replace("-", "");

            int buffer = 0;
            int bitsLeft = 0;
            var result = new List<byte>();

            foreach (var c in cleaned)
            {
                int value = alphabet.IndexOf(c);
                if (value < 0) continue;

                buffer = (buffer << 5) | value;
                bitsLeft += 5;

                if (bitsLeft >= 8)
                {
                    result.Add((byte)((buffer >> (bitsLeft - 8)) & 0xFF));
                    bitsLeft -= 8;
                }
            }

            return result.ToArray();
        }
    }
}