using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using WebPush;

namespace Quanlycongviec.Infrastructure.Services
{
    public class WebPushNotificationService : IWebPushNotificationService
    {
        private readonly ApplicationDbContext _context;
        private readonly WebPushOptions _options;
        private readonly ILogger<WebPushNotificationService> _logger;
        private readonly VapidDetails _vapidDetails;

        public WebPushNotificationService(
            ApplicationDbContext context,
            IOptions<WebPushOptions> options,
            IConfiguration configuration,
            ILogger<WebPushNotificationService> logger)
        {
            _context = context;
            _logger = logger;
            _options = options.Value ?? new WebPushOptions();

            // Đọc thêm từ configuration nếu options rỗng
            var pubKey = string.IsNullOrWhiteSpace(_options.PublicKey)
                ? configuration["WebPush:PublicKey"] ?? "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"
                : _options.PublicKey;

            var privKey = string.IsNullOrWhiteSpace(_options.PrivateKey)
                ? configuration["WebPush:PrivateKey"] ?? "UU224Yug2No0EP8v5Y34q9_75yYc5-j_rP90xYk2-K0"
                : _options.PrivateKey;

            var subject = string.IsNullOrWhiteSpace(_options.Subject)
                ? configuration["WebPush:Subject"] ?? "mailto:admin@catngan.gov.vn"
                : _options.Subject;

            _vapidDetails = new VapidDetails(subject, pubKey, privKey);
        }

        public string GetVapidPublicKey()
        {
            return _vapidDetails.PublicKey;
        }

        public async Task<bool> SendNotificationAsync(
            Guid userId,
            string title,
            string message,
            string? url = null,
            object? data = null,
            CancellationToken cancellationToken = default)
        {
            var activeSubscriptions = await _context.PushSubscriptions
                .Where(s => s.UserId == userId && s.IsActive)
                .ToListAsync(cancellationToken);

            if (!activeSubscriptions.Any())
            {
                _logger.LogDebug("Người dùng {UserId} chưa có thiết bị đăng ký nhận thông báo Web Push.", userId);
                return false;
            }

            var payloadObject = new
            {
                title,
                body = message,
                icon = "/icons/icon-192x192.png",
                badge = "/icons/badge-72x72.png",
                data = new
                {
                    url = url ?? "/",
                    extra = data
                }
            };

            var payloadJson = JsonSerializer.Serialize(payloadObject);
            var client = new WebPushClient();
            var successCount = 0;
            var expiredSubscriptions = new List<Domain.Entities.PushSubscription>();

            foreach (var sub in activeSubscriptions)
            {
                try
                {
                    var pushSub = new WebPush.PushSubscription(sub.Endpoint, sub.P256dhKey, sub.AuthKey);
                    await client.SendNotificationAsync(pushSub, payloadJson, _vapidDetails, cancellationToken);
                    sub.LastUsedAt = DateTime.UtcNow;
                    successCount++;
                }
                catch (WebPushException ex)
                {
                    _logger.LogWarning("Lỗi khi gửi Web Push tới endpoint {Endpoint}: {StatusCode} - {Message}",
                        sub.Endpoint, ex.StatusCode, ex.Message);

                    // HTTP 410 Gone hoặc 404 Not Found: subscription đã hết hạn hoặc bị hủy
                    if (ex.StatusCode == System.Net.HttpStatusCode.Gone ||
                        ex.StatusCode == System.Net.HttpStatusCode.NotFound)
                    {
                        expiredSubscriptions.Add(sub);
                    }
                }
                catch (WebPush.Model.InvalidEncryptionDetailsException ex)
                {
                    _logger.LogWarning(ex, "Subscription có khóa mã hóa không hợp lệ: {Endpoint}. Vô hiệu hóa subscription này.", sub.Endpoint);
                    expiredSubscriptions.Add(sub);
                }
                catch (FormatException ex)
                {
                    _logger.LogWarning(ex, "Khóa P256DH hoặc Auth không đúng định dạng: {Endpoint}. Vô hiệu hóa subscription này.", sub.Endpoint);
                    expiredSubscriptions.Add(sub);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Lỗi không xác định khi gửi Web Push tới endpoint {Endpoint}", sub.Endpoint);
                }
            }

            // Dọn dẹp các subscription đã hết hạn
            if (expiredSubscriptions.Any())
            {
                foreach (var exp in expiredSubscriptions)
                {
                    exp.IsActive = false;
                }
                _logger.LogInformation("Đã vô hiệu hóa {Count} subscription hết hạn của người dùng {UserId}.", expiredSubscriptions.Count, userId);
            }

            await _context.SaveChangesAsync(cancellationToken);
            return successCount > 0;
        }

        public async Task<int> SendNotificationToAllAsync(
            string title,
            string message,
            string? url = null,
            CancellationToken cancellationToken = default)
        {
            var userIds = await _context.PushSubscriptions
                .Where(s => s.IsActive)
                .Select(s => s.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            var totalSent = 0;
            foreach (var userId in userIds)
            {
                var ok = await SendNotificationAsync(userId, title, message, url, null, cancellationToken);
                if (ok) totalSent++;
            }

            return totalSent;
        }

        public async Task<bool> SendTestNotificationAsync(
            Guid userId,
            string endpoint,
            CancellationToken cancellationToken = default)
        {
            var sub = await _context.PushSubscriptions
                .FirstOrDefaultAsync(s => s.UserId == userId && s.Endpoint == endpoint && s.IsActive, cancellationToken);

            if (sub == null)
            {
                return false;
            }

            var payloadObject = new
            {
                title = "UBND Xã Cát Ngạn - Thông Báo Thử Nghiệm",
                body = $"Thông báo đẩy Web Push hoạt động hoàn hảo trên thiết bị ({sub.DeviceLabel ?? "Thiết bị này"}) lúc {DateTime.Now:HH:mm:ss dd/MM/yyyy}!",
                icon = "/icons/icon-192x192.png",
                badge = "/icons/badge-72x72.png",
                data = new
                {
                    url = "/"
                }
            };

            var payloadJson = JsonSerializer.Serialize(payloadObject);
            var client = new WebPushClient();

            try
            {
                var pushSub = new WebPush.PushSubscription(sub.Endpoint, sub.P256dhKey, sub.AuthKey);
                await client.SendNotificationAsync(pushSub, payloadJson, _vapidDetails, cancellationToken);
                sub.LastUsedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync(cancellationToken);
                return true;
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi gửi thông báo thử nghiệm tới endpoint {Endpoint}", endpoint);
                return false;
            }
        }
    }
}
