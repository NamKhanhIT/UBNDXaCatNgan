using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using FluentValidation;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Quanlycongviec.Api.Middleware
{
    /// <summary>
    /// BẢO MẬT (Audit Đợt 2 - Mục 0): ánh xạ ngoại lệ nghiệp vụ sang HTTP response sạch.
    /// Trước đây request fail FluentValidation (sau khi kích hoạt ValidationBehavior)
    /// ném ngoại lệ không được xử lý → client nhận HTTP 500 và có thể lộ stack trace.
    /// Generic Exception luôn được sanitize — không bao giờ trả chi tiết nội bộ ra ngoài.
    /// </summary>
    public class ApiExceptionHandlingMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ApiExceptionHandlingMiddleware> _logger;
        private readonly IHostEnvironment _environment;

        public ApiExceptionHandlingMiddleware(
            RequestDelegate next,
            ILogger<ApiExceptionHandlingMiddleware> logger,
            IHostEnvironment environment)
        {
            _next = next;
            _logger = logger;
            _environment = environment;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception exception)
            {
                await HandleExceptionAsync(context, exception);
            }
        }

        private async Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            var (statusCode, message) = exception switch
            {
                // Lỗi validation FluentValidation — gom danh sách message rõ ràng cho client
                ValidationException validationEx => (StatusCodes.Status400BadRequest,
                    string.Join("; ", validationEx.Errors
                        .Select(e => e.ErrorMessage)
                        .Where(m => !string.IsNullOrWhiteSpace(m))
                        .Distinct())),

                // Xác thực thất bại (sai mật khẩu, token hết hạn...)
                UnauthorizedAccessException => (StatusCodes.Status401Unauthorized,
                    string.IsNullOrWhiteSpace(exception.Message) ? "Xác thực không thành công." : exception.Message),

                // Không tìm thấy tài nguyên
                KeyNotFoundException => (StatusCodes.Status404NotFound,
                    string.IsNullOrWhiteSpace(exception.Message) ? "Không tìm thấy dữ liệu." : exception.Message),

                // Vi phạm quy tắc nghiệp vụ
                InvalidOperationException => (StatusCodes.Status400BadRequest,
                    string.IsNullOrWhiteSpace(exception.Message) ? "Yêu cầu không hợp lệ." : exception.Message),

                // Còn lại — KHÔNG BAO GIỜ lộ chi tiết exception nội bộ ra ngoài
                _ => (StatusCodes.Status500InternalServerError,
                    "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau hoặc liên hệ Quản trị viên.")
            };

            if (statusCode >= 500)
            {
                _logger.LogError(exception,
                    "Ngoại lệ chưa xử lý trên {Method} {Path}: {Message}",
                    context.Request.Method, context.Request.Path, exception.Message);
            }
            else
            {
                _logger.LogWarning(
                    "Yêu cầu bị từ chối ({StatusCode}) trên {Method} {Path}: {Message}",
                    statusCode, context.Request.Method, context.Request.Path, exception.Message);
            }

            if (context.Response.HasStarted)
            {
                // Response đã bắt đầu ghi — không thể thay đổi status code nữa
                throw exception;
            }

            context.Response.Clear();
            context.Response.StatusCode = statusCode;
            context.Response.ContentType = "application/json; charset=utf-8";

            var payload = JsonSerializer.Serialize(new { success = false, error = message });
            await context.Response.WriteAsync(payload);
        }
    }
}