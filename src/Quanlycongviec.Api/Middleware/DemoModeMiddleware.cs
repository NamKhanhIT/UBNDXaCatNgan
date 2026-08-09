using System;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace Quanlycongviec.Api.Middleware
{
    public class DemoModeMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IConfiguration _configuration;

        public DemoModeMiddleware(RequestDelegate next, IConfiguration configuration)
        {
            _next = next;
            _configuration = configuration;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var origin = context.Request.Headers["Origin"].ToString().ToLowerInvariant();
            var host = context.Request.Host.Value.ToLowerInvariant();
            var xForwardedHost = context.Request.Headers["X-Forwarded-Host"].ToString().ToLowerInvariant();

            // Tự động phát hiện nếu truy cập từ Cloudflare Tunnel / Localtunnel
            var isTunnelAccess = origin.Contains("trycloudflare.com") || origin.Contains("loca.lt")
                              || host.Contains("trycloudflare.com") || host.Contains("loca.lt")
                              || xForwardedHost.Contains("trycloudflare.com") || xForwardedHost.Contains("loca.lt");

            // Kiểm tra header X-Demo-Mode từ Localhost
            var isLocalDemoRequested = context.Request.Headers["X-Demo-Mode"].ToString().Equals("true", StringComparison.OrdinalIgnoreCase);
            var isGlobalReadOnly = _configuration.GetValue<bool>("DemoMode:ReadOnlyMode");

            var method = context.Request.Method.ToUpperInvariant();
            var path = context.Request.Path.Value?.ToLowerInvariant() ?? string.Empty;
            var isWriteMethod = method == "POST" || method == "PUT" || method == "DELETE" || method == "PATCH";
            var isBypassedAuthEndpoint = path.EndsWith("/auth/login") 
                || path.EndsWith("/auth/logout") 
                || path.EndsWith("/auth/switch-context")
                || path.StartsWith("/hubs");

            if (isWriteMethod && !isBypassedAuthEndpoint)
            {
                if (isTunnelAccess)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json; charset=utf-8";

                    var responsePayload = new
                    {
                        success = false,
                        message = "Đây là sản phẩm thử nghiệm. Vui lòng không chỉnh sửa!"
                    };

                    await context.Response.WriteAsync(JsonSerializer.Serialize(responsePayload));
                    return;
                }
                else if (isLocalDemoRequested || isGlobalReadOnly)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    context.Response.ContentType = "application/json; charset=utf-8";

                    var responsePayload = new
                    {
                        success = false,
                        message = "Localhost đang bật Chế độ Demo (Read-Only). Vui lòng tắt công tắc Demo ở góc trên nếu bạn muốn ghi dữ liệu thật vào PostgreSQL."
                    };

                    await context.Response.WriteAsync(JsonSerializer.Serialize(responsePayload));
                    return;
                }
            }

            await _next(context);
        }
    }
}
