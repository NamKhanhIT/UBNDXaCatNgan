using System.Text.RegularExpressions;

namespace Quanlycongviec.Application.Common.Security
{
    // BẢO MẬT: Quy chuẩn độ phức tạp của mật khẩu cho hệ thống UBND Cấp Xã
    public static class PasswordPolicy
    {
        public const int MinimumLength = 8;

        public static (bool IsValid, string? Error) Validate(string? password)
        {
            if (string.IsNullOrWhiteSpace(password))
            {
                return (false, "Vui lòng nhập mật khẩu mới.");
            }

            if (password.Length < MinimumLength)
            {
                return (false, $"Mật khẩu mới phải có độ dài tối thiểu {MinimumLength} ký tự.");
            }

            if (!Regex.IsMatch(password, @"[A-Z]"))
            {
                return (false, "Mật khẩu mới phải chứa ít nhất 1 chữ cái in hoa (A-Z).");
            }

            if (!Regex.IsMatch(password, @"[0-9]"))
            {
                return (false, "Mật khẩu mới phải chứa ít nhất 1 chữ số (0-9).");
            }

            if (!Regex.IsMatch(password, @"[!@#$%^&*()_+\-=\[\]{};':""\\|,.<>\/?~`]"))
            {
                return (false, "Mật khẩu mới phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*...).");
            }

            return (true, null);
        }
    }
}
