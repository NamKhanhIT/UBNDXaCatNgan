using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;

namespace Quanlycongviec.Infrastructure.Services
{
    // BẢO MẬT (Audit P4B): Xác minh Cloudflare Turnstile token qua siteverify (fail-closed)
    public class TurnstileValidator : ITurnstileValidator
    {
        private const string SiteVerifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

        private readonly HttpClient _httpClient;
        private readonly TurnstileOptions _options;
        private readonly ILogger<TurnstileValidator> _logger;

        public TurnstileValidator(
            HttpClient httpClient,
            IOptions<TurnstileOptions> options,
            ILogger<TurnstileValidator> logger)
        {
            _httpClient = httpClient;
            _options = options.Value;
            _logger = logger;
        }

        public async Task<bool> ValidateAsync(string? turnstileToken, string? remoteIp, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(_options.SecretKey))
            {
                // Dev-mode: chưa cấu hình — không cản trở, nhưng nhắc mỗi lần để đừng quên bật production.
                _logger.LogWarning(
                    "[Turnstile] Chưa cấu hình SecretKey — bỏ qua kiểm tra chống bot cho request này.");
                return true;
            }

            if (string.IsNullOrWhiteSpace(turnstileToken))
            {
                return false;
            }

            try
            {
                using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeoutCts.CancelAfter(TimeSpan.FromSeconds(5));

                using var content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["secret"] = _options.SecretKey,
                    ["response"] = turnstileToken!,
                    ["remoteip"] = remoteIp ?? string.Empty
                });

                using var response = await _httpClient.PostAsync(SiteVerifyUrl, content, timeoutCts.Token);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("[Turnstile] siteverify trả HTTP {StatusCode}", (int)response.StatusCode);
                    return false;
                }

                using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(timeoutCts.Token));
                var success = doc.RootElement.TryGetProperty("success", out var successEl) && successEl.ValueKind == JsonValueKind.True;

                if (!success)
                {
                    var codes = doc.RootElement.TryGetProperty("error-codes", out var codesEl)
                        ? codesEl.ToString()
                        : "n/a";
                    _logger.LogWarning("[Turnstile] Xác minh thất bại — error-codes: {Codes}", codes);
                }

                return success;
            }
            catch (Exception ex) when (ex is HttpRequestException || ex is TaskCanceledException || ex is JsonException)
            {
                // Fail-closed khi đã cấu hình: Cloudflare unreachable thì từ chối thay vì mở cửa.
                _logger.LogError(ex, "[Turnstile] Lỗi kết nối/xử lý khi gọi siteverify — coi như thất bại.");
                return false;
            }
        }
    }
}
