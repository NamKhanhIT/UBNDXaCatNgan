namespace Quanlycongviec.Application.Common.Options
{
    public class SmsOptions
    {
        public const string SectionName = "SmsGateway";

        /// <summary>
        /// Địa chỉ HTTP REST API của Android SMS Gateway hoặc Webhook Gateway cục bộ
        /// Ví dụ: "http://192.168.1.50:8080/v1/sms/send" hoặc để trống nếu chạy Simulator
        /// </summary>
        public string? GatewayUrl { get; set; }

        /// <summary>
        /// API Key / Token xác thực với Android SMS Gateway (nếu có cấu hình bảo mật)
        /// </summary>
        public string? ApiKey { get; set; }

        /// <summary>
        /// Tên định danh người gửi trong tin nhắn SMS
        /// </summary>
        public string SenderName { get; set; } = "UBND CAP XA";

        /// <summary>
        /// Bật chế độ Trình mô phỏng SMS ảo (Simulator) khi chưa kết nối phần cứng Android Gateway
        /// </summary>
        public bool EnableSimulator { get; set; } = true;
    }
}
