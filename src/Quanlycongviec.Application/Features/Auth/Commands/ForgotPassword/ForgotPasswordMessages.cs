namespace Quanlycongviec.Application.Features.Auth.Commands.ForgotPassword
{
    // BẢO MẬT (Audit H4): Thông điệp lỗi chung cho luồng quên mật khẩu chống user enumeration
    internal static class ForgotPasswordMessages
    {
        public const string InputIncomplete = "Vui lòng cung cấp đầy đủ thông tin theo yêu cầu.";
        public const string PasswordTooShort = "Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.";
        public const string ResetFailedGeneric =
            "Không thể đặt lại mật khẩu với thông tin đã cung cấp. Vui lòng kiểm tra lại hoặc yêu cầu mã xác thực mới.";
    }
}
