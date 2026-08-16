namespace Quanlycongviec.Application.Common.Options
{
    public class WebPushOptions
    {
        public const string SectionName = "WebPush";

        /// <summary>
        /// VAPID Public Key (expose to frontend clients)
        /// </summary>
        public string PublicKey { get; set; } = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

        /// <summary>
        /// VAPID Private Key (kept strictly on server)
        /// </summary>
        public string PrivateKey { get; set; } = "UU224Yug2No0EP8v5Y34q9_75yYc5-j_rP90xYk2-K0";

        /// <summary>
        /// VAPID Subject (mailto: or URL contact)
        /// </summary>
        public string Subject { get; set; } = "mailto:admin@catngan.gov.vn";
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
        public int Minute { get; set; } = 30;
    }
}
