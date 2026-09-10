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
            var subject = "[KHM Software] Mã xác thực khôi phục mật khẩu";

            var htmlBody = BuildOfficialOtpEmail(
                fullName,
                "Hệ thống vừa tiếp nhận yêu cầu khôi phục mật khẩu truy cập tài khoản công vụ của Anh/Chị",
                otpCode,
                "Mã có hiệu lực trong vòng <strong>10 phút</strong>",
                "Nếu Anh/Chị không thực hiện yêu cầu trên, đề nghị bỏ qua email này và phản hồi kịp thời cho Ban Quản trị Hệ thống để rà soát an toàn thông tin.");

            // Nếu cấu hình SMTP có Host hợp lệ thì gửi qua SmtpClient thật
            if (!string.IsNullOrWhiteSpace(_options.Host) && !string.IsNullOrWhiteSpace(_options.Username))
            {
                var sent = await SendEmailAsync(toEmail, subject, htmlBody, cancellationToken);
                if (sent) return true;
            }

            // BẢO MẬT (Audit 04-09-2026): Khi SMTP chưa cấu hình, KHÔNG ghi OTP ra log để tránh lộ mã
            // cho bất kỳ ai đọc được stdout/server logs. Caller sẽ nhận `false` và xử lý thất bại.
            _logger.LogWarning(
                "[SmtpEmailService] SMTP chưa cấu hình — không thể gửi '{Subject}' tới {ToEmail}. Cấu hình section Smtp (Brevo/Gmail) trong ENV để kích hoạt gửi OTP thực sự.",
                subject, toEmail);

            return false;
        }

        public async Task<bool> SendMfaOtpAsync(string toEmail, string fullName, string otpCode, CancellationToken cancellationToken = default)
        {
            var subject = "[KHM Software] Mã xác thực đăng nhập hai yếu tố";

            var htmlBody = BuildOfficialOtpEmail(
                fullName,
                "Hệ thống vừa tiếp nhận yêu cầu xác thực đăng nhập hai yếu tố của Anh/Chị",
                otpCode,
                "Mã có hiệu lực trong vòng <strong>05 phút</strong> và chỉ sử dụng một lần",
                "Nếu không phải Anh/Chị đang thực hiện đăng nhập, tài khoản vẫn an toàn — đề nghị bỏ qua email này và phản hồi kịp thời cho Ban Quản trị Hệ thống để rà soát an toàn thông tin.");

            // Nếu cấu hình SMTP có Host hợp lệ thì gửi qua SmtpClient thật
            if (!string.IsNullOrWhiteSpace(_options.Host) && !string.IsNullOrWhiteSpace(_options.Username))
            {
                var sent = await SendEmailAsync(toEmail, subject, htmlBody, cancellationToken);
                if (sent) return true;
            }

            // BẢO MẬT (Audit 04-09-2026): KHÔNG log raw OTP. Trả `false` để caller xử lý thất bại.
            _logger.LogWarning(
                "[SmtpEmailService] SMTP chưa cấu hình — không thể gửi OTP MFA tới {ToEmail}. Cấu hình section Smtp (Brevo/Gmail) trong ENV để kích hoạt gửi thực sự.",
                toEmail);

            return false;
        }

        public async Task<bool> SendEmailChangeOtpAsync(string toEmail, string fullName, string otpCode, CancellationToken cancellationToken = default)
        {
            var subject = "[KHM Software] Mã xác thực cập nhật địa chỉ email công vụ";

            var htmlBody = BuildOfficialOtpEmail(
                fullName,
                "Hệ thống vừa tiếp nhận yêu cầu cập nhật địa chỉ email công vụ của Anh/Chị",
                otpCode,
                "Mã có hiệu lực trong vòng <strong>05 phút</strong> và chỉ sử dụng một lần",
                "Nếu Anh/Chị không thực hiện yêu cầu này, đề nghị bỏ qua email và thông báo cho Ban Quản trị Hệ thống để rà soát an toàn thông tin.");

            if (!string.IsNullOrWhiteSpace(_options.Host) && !string.IsNullOrWhiteSpace(_options.Username))
            {
                var sent = await SendEmailAsync(toEmail, subject, htmlBody, cancellationToken);
                if (sent) return true;
            }

            // BẢO MẬT (Audit 04-09-2026): KHÔNG log raw OTP. Trả `false` để caller xử lý thất bại.
            _logger.LogWarning(
                "[SmtpEmailService] SMTP chưa cấu hình — không thể gửi OTP đổi email tới {ToEmail}. Cấu hình section Smtp (Brevo/Gmail) trong ENV để kích hoạt gửi thực sự.",
                toEmail);

            return false;
        }

        private static string FormatVietnamTimestamp()
        {
            var vnNow = DateTime.UtcNow.AddHours(7);
            return $"{vnNow.Hour} giờ {vnNow.Minute:D2} phút ngày {vnNow.Day} tháng {vnNow.Month} năm {vnNow.Year}";
        }

        private static string BuildOfficialOtpEmail(
            string fullName,
            string contextSentence,
            string otpCode,
            string validityHtml,
            string notYouSentence)
        {
            var greetingName = string.IsNullOrWhiteSpace(fullName)
                ? string.Empty
                : $" <strong>{System.Net.WebUtility.HtmlEncode(fullName)}</strong>";
            var timestamp = FormatVietnamTimestamp();

            return $@"
                <!DOCTYPE html>
                <html lang=""vi"">
                <head>
                    <meta charset=""UTF-8"">
                    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
                </head>
                <body style=""font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #eef2f7; margin: 0; padding: 24px; color: #1e293b;"">
                    <div style=""max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 4px; overflow: hidden; border: 1px solid #d3dce8;"">
                        <div style=""background-color: #1e3a8a; padding: 26px 24px; text-align: center; color: #ffffff;"">
                            <h2 style=""margin: 0; font-size: 17px; text-transform: uppercase; letter-spacing: 2px; color: #ffffff;"">HỆ THỐNG QUẢN LÝ CÔNG VIỆC</h2>
                            <p style=""margin: 7px 0 0 0; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #c7d7f0;"">Phát triển bởi KHM Software</p>
                        </div>
                        <div style=""padding: 30px 28px;"">
                            <p style=""font-size: 15px; line-height: 1.6; margin: 0 0 14px 0;"">Kính gửi Anh/Chị{greetingName},</p>
                            <p style=""font-size: 14px; line-height: 1.7; color: #334155; margin: 0 0 22px 0;"">
                                {contextSentence} lúc <strong>{timestamp}</strong>. Vui lòng sử dụng mã xác thực dưới đây để hoàn tất thao tác:
                            </p>
                            <div style=""background-color: #f8fafc; border: 2px solid #cbd5e1; border-radius: 6px; padding: 20px; text-align: center; margin: 0 0 22px 0;"">
                                <span style=""display: block; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #64748b; margin-bottom: 8px;"">MÃ XÁC THỰC</span>
                                <span style=""font-family: Consolas, 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 10px; color: #1e3a8a;"">{otpCode}</span>
                                <p style=""margin: 10px 0 0 0; font-size: 12px; color: #64748b;"">{validityHtml}</p>
                            </div>
                            <div style=""background-color: #fff7ed; border-left: 4px solid #c2410c; padding: 13px 16px; margin: 0 0 20px 0;"">
                                <p style=""font-size: 13px; line-height: 1.65; color: #7c2d12; margin: 0;"">
                                    <strong>Lưu ý an toàn:</strong> Anh/Chị tuyệt đối không cung cấp mã này cho bất kỳ ai, kể cả người tự xưng là cán bộ kỹ thuật của hệ thống.
                                </p>
                            </div>
                            <p style=""font-size: 13px; line-height: 1.7; color: #475569; margin: 0 0 24px 0;"">{notYouSentence}</p>
                            <p style=""font-size: 14px; line-height: 1.6; margin: 0;"">Trân trọng,</p>
                            <p style=""font-size: 14px; font-weight: 700; letter-spacing: 0.5px; margin: 4px 0 0 0;"">BAN QUẢN TRỊ HỆ THỐNG</p>
                        </div>
                        <div style=""background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 14px 24px; text-align: center; font-size: 12px; color: #94a3b8;"">
                            <p style=""margin: 0;"">Hệ Thống Quản Lý Công Việc • KHM Software © 2026</p>
                            <p style=""margin: 4px 0 0 0;"">Email được gửi tự động — vui lòng không trả lời trực tiếp email này.</p>
                        </div>
                    </div>
                </body>
                </html>";
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
                    // BẢO MẬT (Audit L1): Báo thất bại khi gửi email lỗi thay vì trả true giả lập
                    return false;
                }
            }

            // BẢO MẬT (Audit L1): Chưa cấu hình SMTP -> báo thất bại rõ ràng để caller xử lý
            _logger.LogWarning(
                "[SmtpEmailService] Chưa cấu hình SMTP Host — không thể gửi '{Subject}' tới {ToEmail}. Hãy cấu hình section Smtp (Brevo/Gmail) trong biến môi trường.",
                subject, toEmail);
            return false;
        }
    }
}
