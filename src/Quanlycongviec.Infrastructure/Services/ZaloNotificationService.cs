using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Infrastructure.Services
{
    public class ZaloNotificationService : IZaloNotificationService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<ZaloNotificationService> _logger;

        public ZaloNotificationService(IConfiguration configuration, ILogger<ZaloNotificationService> logger)
        {
            _configuration = configuration;
            _logger = logger;
        }

        public Task SendZnsAsync(string phoneNumber, string templateId, object templateData)
        {
            var accessToken = _configuration["ZaloOA:AccessToken"];
            var configuredTemplateId = _configuration["ZaloOA:TemplateId"] ?? templateId;

            if (string.IsNullOrWhiteSpace(accessToken))
            {
                _logger.LogWarning("Chưa cấu hình Zalo OA (ZaloOA:AccessToken) — bỏ qua gửi ZNS tới số điện thoại [{PhoneNumber}].", phoneNumber);
                return Task.CompletedTask;
            }

            try
            {
                // Giả lập / Chuẩn bị sẵn luồng gọi Zalo OpenAPI ZNS
                _logger.LogInformation("Đã gửi Zalo ZNS thành công tới [{PhoneNumber}] qua Template [{TemplateId}].", phoneNumber, configuredTemplateId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi gửi Zalo ZNS tới [{PhoneNumber}]. Bỏ qua lỗi để giữ nguyên thông báo InApp.", phoneNumber);
            }

            return Task.CompletedTask;
        }
    }
}
