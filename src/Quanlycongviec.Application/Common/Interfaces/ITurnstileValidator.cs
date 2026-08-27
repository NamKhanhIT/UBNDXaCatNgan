using System.Threading;
using System.Threading.Tasks;

namespace Quanlycongviec.Application.Common.Interfaces
{
    // BẢO MẬT (Audit P4B): Interface xác minh Cloudflare Turnstile chống bot cho endpoint công khai
    public interface ITurnstileValidator
    {
        // Xác minh token Turnstile qua siteverify (fail-closed khi đã cấu hình)
        Task<bool> ValidateAsync(string? turnstileToken, string? remoteIp, CancellationToken cancellationToken);
    }
}
