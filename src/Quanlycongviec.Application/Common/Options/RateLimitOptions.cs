namespace Quanlycongviec.Application.Common.Options
{
    /// <summary>
    /// Cấu hình Rate Limiting — chống brute-force đăng nhập và spam/DoS.
    /// Section: "RateLimit"
    /// </summary>
    public class RateLimitOptions
    {
        public const string SectionName = "RateLimit";

        /// <summary>Giới hạn số lần đăng nhập/đăng ký thất bại trong cửa sổ thời gian (mỗi IP)</summary>
        public int LoginPermitLimit { get; set; } = 10;

        /// <summary>Cửa sổ thời gian cho giới hạn đăng nhập (phút)</summary>
        public int LoginWindowMinutes { get; set; } = 5;

        /// <summary>Giới hạn yêu cầu chung mỗi phút (mỗi IP) cho toàn API</summary>
        public int GlobalPermitLimit { get; set; } = 120;
    }
}