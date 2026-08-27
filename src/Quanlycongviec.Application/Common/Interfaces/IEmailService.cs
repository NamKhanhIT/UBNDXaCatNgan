using System.Threading;
using System.Threading.Tasks;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface IEmailService
    {
        Task<bool> SendPasswordResetOtpAsync(string toEmail, string fullName, string otpCode, CancellationToken cancellationToken = default);

        // BẢO MẬT (Audit Đợt 3): Gửi mã OTP xác thực 2 yếu tố qua email công vụ
        Task<bool> SendMfaOtpAsync(string toEmail, string fullName, string otpCode, CancellationToken cancellationToken = default);

        // Xác thực đổi Email công vụ (Sử dụng mẫu email chính thức chuẩn hóa)
        Task<bool> SendEmailChangeOtpAsync(string toEmail, string fullName, string otpCode, CancellationToken cancellationToken = default);

        Task<bool> SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default);
    }
}
