using System;
using System.Threading;
using System.Threading.Tasks;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface IWebPushNotificationService
    {
        /// <summary>
        /// Lấy VAPID Public Key để gửi cho Frontend đăng ký PushManager
        /// </summary>
        string GetVapidPublicKey();

        /// <summary>
        /// Gửi thông báo Web Push tới tất cả các thiết bị đang hoạt động của 1 người dùng
        /// </summary>
        Task<bool> SendNotificationAsync(Guid userId, string title, string message, string? url = null, object? data = null, CancellationToken cancellationToken = default);

        /// <summary>
        /// Gửi thông báo Web Push tới toàn bộ cán bộ công chức có đăng ký
        /// </summary>
        Task<int> SendNotificationToAllAsync(string title, string message, string? url = null, CancellationToken cancellationToken = default);

        /// <summary>
        /// Gửi 1 thông báo đẩy thử nghiệm tới 1 thiết bị cụ thể (dựa vào endpoint)
        /// </summary>
        Task<bool> SendTestNotificationAsync(Guid userId, string endpoint, CancellationToken cancellationToken = default);
    }
}
