using System;
using System.Net;
using System.Net.Mail;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;

namespace Quanlycongviec.Infrastructure.Services
{
    public class SmtpEmailService : IEmailService
    {
        private readonly SmtpOptions _options;
        private readonly ILogger<SmtpEmailService> _logger;

        public SmtpEmailService(
            IOptions<SmtpOptions> options,
            ILogger<SmtpEmailService> logger)
        {
            _options = options.Value;
            _logger = logger;
        }

        public async Task<bool> SendPasswordResetOtpAsync(string toEmail, string fullName, string otpCode, CancellationToken cancellationToken = default)
        {
            var subject = "Mã xác thực đặt lại mật khẩu - Hệ thống Quản lý Công việc UBND Cấp Xã";
            var displayName = string.IsNullOrWhiteSpace(fullName) ? "Đồng chí" : fullName;

            var htmlBody = $@"
<!DOCTYPE html>
<html lang=""vi"">
<head>
    <meta charset=""UTF-8"">
    <title>{subject}</title>
</head>
<body style=""font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 24px; color: #1e293b;"">
    <div style=""max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;"">
        <div style=""background: linear-gradient(135deg, #1e3a8a, #0f172a); padding: 28px 24px; text-align: center; color: #ffffff;"">
            <h2 style=""margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; color: #e2e8f0;"">ỦY BAN NHÂN DÂN CẤP XÃ</h2>
            <p style=""margin: 6px 0 0 0; font-size: 13px; color: #93c5fd; font-weight: 500;"">Hệ Thống Quản Lý & Điều Hành Công Việc</p>
        </div>
        <div style=""padding: 32px 24px;"">
            <p style=""font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;"">Kính gửi <strong>{displayName}</strong>,</p>
            <p style=""font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;"">
                Hệ thống nhận được yêu cầu khôi phục mật khẩu truy cập tài khoản công vụ của đồng chí. Vui lòng sử dụng mã xác thực OTP dưới đây để hoàn tất việc đặt lại mật khẩu:
            </p>
            <div style=""background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;"">
                <span style=""font-family: Consolas, 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #1d4ed8;"">{otpCode}</span>
                <p style=""margin: 8px 0 0 0; font-size: 12px; color: #64748b;"">Mã xác thực có hiệu lực trong vòng <strong>10 phút</strong></p>
            </div>
            <p style=""font-size: 13px; line-height: 1.5; color: #64748b; margin: 0 0 16px 0;"">
                Nếu đồng chí không thực hiện yêu cầu này, vui lòng bỏ qua email hoặc thông báo ngay cho Quản trị viên hệ thống để kiểm tra an toàn thông tin.
            </p>
        </div>
        <div style=""background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8;"">
            <p style=""margin: 0;"">© 2026 Bản quyền thuộc Ủy ban nhân dân Cấp Xã</p>
            <p style=""margin: 4px 0 0 0;"">Phát triển và bảo trợ kỹ thuật bởi KHM Software</p>
        </div>
    </div>
</body>
</html>";

            return await SendEmailAsync(toEmail, subject, htmlBody, cancellationToken);
        }

        public async Task<bool> SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(toEmail))
            {
                _logger.LogWarning("[SmtpEmailService] Địa chỉ email người nhận trống.");
                return false;
            }

            // Nếu cấu hình SMTP có Host hợp lệ thì gửi qua SmtpClient thật
            if (!string.IsNullOrWhiteSpace(_options.Host) && !string.IsNullOrWhiteSpace(_options.Username))
            {
                try
                {
                    using var message = new MailMessage
                    {
                        From = new MailAddress(
                            string.IsNullOrWhiteSpace(_options.SenderEmail) ? _options.Username : _options.SenderEmail,
                            _options.SenderName
                        ),
                        Subject = subject,
                        Body = htmlBody,
                        IsBodyHtml = true
                    };
                    message.To.Add(toEmail);

                    using var client = new SmtpClient(_options.Host, _options.Port)
                    {
                        EnableSsl = _options.EnableSsl,
                        Credentials = new NetworkCredential(_options.Username, _options.Password),
                        Timeout = 15000
                    };

                    await client.SendMailAsync(message, cancellationToken);
                    _logger.LogInformation("[SmtpEmailService] Đã gửi email thành công tới {ToEmail}", toEmail);
                    return true;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[SmtpEmailService] Gửi email qua SMTP thất bại tới {ToEmail}: {Message}", toEmail, ex.Message);
                    // Không ngắt luồng — ghi log an toàn và tiếp tục
                }
            }
            else
            {
                _logger.LogInformation("[SmtpEmailService] [Dev/Test Mode] Chưa cấu hình SMTP Host. Đã ghi nhận gửi email '{Subject}' tới {ToEmail}", subject, toEmail);
            }

            return true;
        }
    }
}
