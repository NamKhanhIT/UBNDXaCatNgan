namespace Quanlycongviec.Application.Common.Options
{
    /// <summary>
    /// BẢO MẬT (Audit Đợt 4 - P4B): cấu hình Cloudflare Turnstile chống bot.
    /// SectionName = "Turnstile". SecretKey là KHÓA BÍ MẬT — chỉ đặt qua
    /// appsettings local / user-secrets / biến môi trường, không commit.
    /// </summary>
    public class TurnstileOptions
    {
        public const string SectionName = "Turnstile";

        public string SecretKey { get; set; } = string.Empty;
    }
}
