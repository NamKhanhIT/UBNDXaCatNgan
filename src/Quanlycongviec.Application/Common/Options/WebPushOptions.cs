namespace Quanlycongviec.Application.Common.Options
{
    public class WebPushOptions
    {
        public const string SectionName = "WebPush";

        // VAPID Public Key (expose to frontend clients)
        public string PublicKey { get; set; } = string.Empty;

        // VAPID Private Key (kept strictly on server)
        public string PrivateKey { get; set; } = string.Empty;

        // VAPID Subject (mailto: or URL contact)
        public string Subject { get; set; } = "mailto:admin@ubnd.gov.vn";
    }

    public class DailyDigestOptions
    {
        public const string SectionName = "DailyDigest";

        /// <summary>
        /// Bật/tắt tính năng tóm tắt công việc mỗi ngày
        /// </summary>
        public bool Enabled { get; set; } = true;

        /// <summary>
        /// Giờ gửi tóm tắt (mặc định 7h sáng)
        /// </summary>
        public int Hour { get; set; } = 7;

        /// <summary>
        /// Phút gửi tóm tắt (mặc định 30 phút -> 07:30)
        /// </summary>
        public int Minute { get; set; } = 00;
    }
}
