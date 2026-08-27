using System.Threading;
using System.Threading.Tasks;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface ISmsNotificationService
    {
        /// <summary>
        /// Gửi tin nhắn SMS thông báo công vụ đến số điện thoại cán bộ (iOS / Android)
        /// </summary>
        Task<bool> SendSmsAsync(string phoneNumber, string message, CancellationToken cancellationToken = default);

        /// <summary>
        /// Gửi mã xác thực OTP 6 số qua tin nhắn SMS
        /// </summary>
        Task<bool> SendOtpSmsAsync(string phoneNumber, string otpCode, CancellationToken cancellationToken = default);

        /// <summary>
        /// Gửi tin nhắn SMS nhắc việc / hạn xử lý văn bản khẩn
        /// </summary>
        Task<bool> SendTaskReminderSmsAsync(string phoneNumber, string taskTitle, string deadlineFormatted, CancellationToken cancellationToken = default);

        /// <summary>
        /// Trạng thái kết nối SMS Gateway hiện tại (Android Gateway / GSM Modem / Simulator)
        /// </summary>
        string GetGatewayStatus();
    }
}
