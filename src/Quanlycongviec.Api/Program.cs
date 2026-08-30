using System.Text.Encodings.Web;
using System.Text.Json.Serialization;
using System.Text.Unicode;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.OpenApi.Models;
using Quanlycongviec.Application;
using Quanlycongviec.Infrastructure;
using Quanlycongviec.Infrastructure.Hubs;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Api.Middleware;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;

Console.OutputEncoding = System.Text.Encoding.UTF8;
Console.InputEncoding = System.Text.Encoding.UTF8;

var builder = WebApplication.CreateBuilder(args);

// Options setup
builder.Services.Configure<RatingRevisionOptions>(builder.Configuration.GetSection(RatingRevisionOptions.SectionName));

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);
    });
builder.Services.AddEndpointsApiExplorer();

// Rate Limiting — chống brute-force đăng nhập & phòng thủ DoS
var rateLimitOptions = builder.Configuration.GetSection(RateLimitOptions.SectionName).Get<RateLimitOptions>() ?? new RateLimitOptions();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            "{\"success\":false,\"message\":\"Quá nhiều yêu cầu. Vui lòng thử lại sau.\"}", cancellationToken);
    };

    // BẢO MẬT (Audit M1): Giới hạn đăng nhập theo UserId (nếu đã xác thực) hoặc Client IP
    options.AddPolicy("LoginLimiter", httpContext =>
    {
        var userId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var partitionKey = httpContext.User.Identity?.IsAuthenticated == true && userId != null
            ? $"u:{userId}"
            : $"ip:{httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: partitionKey,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = rateLimitOptions.LoginPermitLimit,
                Window = TimeSpan.FromMinutes(rateLimitOptions.LoginWindowMinutes),
                QueueLimit = 0
            });
    });

    // BẢO MẬT (Audit M1): Giới hạn tải chung toàn bộ API theo UserId hoặc Client IP
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var userId = httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var key = httpContext.User.Identity?.IsAuthenticated == true && userId != null
            ? $"u:{userId}"
            : $"ip:{httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown"}";

        return RateLimitPartition.GetFixedWindowLimiter(
            key,
            _ => new FixedWindowRateLimiterOptions
            {
                AutoReplenishment = true,
                PermitLimit = rateLimitOptions.GlobalPermitLimit,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
    });
});
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "KHM Work Management API",
        Version = "v1",
        Description = "Hệ Thống Quản Lý Công Việc — API quản lý giao việc, lưu trữ văn bản và đánh giá năng lực cán bộ/nhân sự (phát triển bởi KHM Software)"
    });

    // Hỗ trợ test JWT trong Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "Nhập token JWT: Bearer {token}",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

// Đăng ký Application & Infrastructure theo Clean Architecture
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// BẢO MẬT (Audit H7): Whitelist CORS từ cấu hình (AllowCredentials cho cookie auth)
var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? string.Empty)
    .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .Select(o => o.TrimEnd('/'))
    .ToHashSet(StringComparer.OrdinalIgnoreCase);

builder.Services.AddCors(options =>
{
    options.AddPolicy("WebClient", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
        {
            if (string.IsNullOrEmpty(origin)) return false;

            if (builder.Environment.IsDevelopment())
            {
                var devHost = new Uri(origin).Host;
                if (devHost == "localhost" || devHost == "127.0.0.1") return true;
            }

            return allowedOrigins.Contains(origin.TrimEnd('/'));
        })
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials();
    });
});

// BẢO MẬT (Audit M1): Đọc header X-Forwarded-* từ reverse proxy cục bộ để lấy đúng IP client
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

var app = builder.Build();

app.UseForwardedHeaders();

// Seed dữ liệu mẫu (5 phòng ban + roles + admin)
using (var scope = app.Services.CreateScope())
{
    await DbInitializer.SeedAsync(scope.ServiceProvider);
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "KHM Work API v1");
    });
}
else
{
    app.UseHsts();
}

// BẢO MẬT (Audit D4): Header an toàn tối thiểu phía API chống MIME-sniffing & framing
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    await next();
});

// Middleware xử lý ngoại lệ tập trung trả HTTP JSON chuẩn
app.UseMiddleware<ApiExceptionHandlingMiddleware>();

app.UseRateLimiter();
app.UseCors("WebClient");
app.UseMiddleware<DemoModeMiddleware>();
app.UseHttpsRedirection();
app.UseAuthentication();

// BẢO MẬT (Audit A5): Chặn truy cập nghiệp vụ khi tài khoản còn cờ MustChangePassword
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true &&
        string.Equals(context.User.FindFirst("MustChangePassword")?.Value, "true", StringComparison.OrdinalIgnoreCase))
    {
        var path = context.Request.Path;
        var isAuthArea = path.StartsWithSegments("/api/v1/Auth") || path.StartsWithSegments("/hubs");
        if (!isAuthArea)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(
                "{\"success\":false,\"error\":\"Tài khoản bắt buộc phải đổi mật khẩu trước khi sử dụng hệ thống.\",\"code\":\"must_change_password\"}");
            return;
        }
    }
    await next();
});

app.UseAuthorization();

app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");

app.Run();

