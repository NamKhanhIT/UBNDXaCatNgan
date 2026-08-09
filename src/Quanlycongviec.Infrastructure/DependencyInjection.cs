using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;

namespace Quanlycongviec.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            // ── Database Configuration (PostgreSQL / Demo In-Memory DB) ──
            var isDemoMode = configuration.GetValue<bool>("DemoMode:Enabled");
            var useInMemoryDb = configuration.GetValue<bool>("DemoMode:UseInMemoryDatabase", true);

            if (isDemoMode && useInMemoryDb)
            {
                services.AddDbContext<ApplicationDbContext>(options =>
                    options.UseInMemoryDatabase("UbndXaCatNganDemoDb"));
            }
            else
            {
                var connectionString = configuration.GetConnectionString("DefaultConnection")
                    ?? "Host=localhost;Port=5432;Database=ubndxacatngan;Username=postgres;Password=CHANGE_ME_VIA_USER_SECRETS";

                services.AddDbContext<ApplicationDbContext>(options =>
                    options.UseNpgsql(connectionString));
            }

            services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());
            services.AddScoped<IPasswordHasher, PasswordHasher>();
            services.AddScoped<IJwtTokenService, JwtTokenService>();
            services.AddScoped<IZaloNotificationService, ZaloNotificationService>();

            // ── SignalR Real-Time ──
            services.AddSignalR();
            services.AddSingleton<Microsoft.AspNetCore.SignalR.IUserIdProvider, CustomUserIdProvider>();

            // ── Background Reminder Service ──
            services.AddHostedService<TaskReminderBackgroundService>();

            // ── JWT Authentication ──
            var jwtSecret = configuration["Jwt:Secret"]
                ?? throw new InvalidOperationException(
                    "Jwt:Secret chưa được cấu hình. Vui lòng đặt trong appsettings hoặc dotnet user-secrets. " +
                    "Ứng dụng từ chối khởi động khi thiếu secret.");

            var jwtIssuer = configuration["Jwt:Issuer"] ?? "UBNDXaCatNganApi";
            var jwtAudience = configuration["Jwt:Audience"] ?? "UBNDXaCatNganClient";

            services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = jwtIssuer,
                    ValidAudience = jwtAudience,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
                    ClockSkew = TimeSpan.FromMinutes(1)
                };

                // Đọc JWT từ: 1) Authorization: Bearer (mobile/remote), 2) Cookie (desktop), 3) Query string (SignalR)
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;

                        // Nếu là SignalR hub request và có query token
                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                        {
                            context.Token = accessToken;
                        }
                        // Authorization: Bearer <token> — ưu tiên cho mobile/remote (không dùng cookie)
                        else if (context.Request.Headers.TryGetValue("Authorization", out var authHeader))
                        {
                            var headerVal = authHeader.ToString();
                            if (headerVal.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                            {
                                context.Token = headerVal.Substring("Bearer ".Length).Trim();
                            }
                        }
                        // Cookie fallback cho desktop localhost
                        else if (context.Request.Cookies.TryGetValue("access_token", out var cookieToken))
                        {
                            context.Token = cookieToken;
                        }
                        return Task.CompletedTask;
                    }
                };
            });

            // ── Authorization Policies ──
            services.AddAuthorization(options =>
            {
                // RankLevel ≤ 2: Lãnh đạo cao nhất + Phó Chủ tịch
                options.AddPolicy("LeaderOnly", policy =>
                    policy.RequireAssertion(context =>
                    {
                        var rankClaim = context.User.FindFirst("RankLevel")?.Value;
                        return int.TryParse(rankClaim, out var rank) && rank <= 2;
                    }));

                // RankLevel ≤ 3: Trưởng phòng trở lên (được giao việc)
                options.AddPolicy("ManagerPlus", policy =>
                    policy.RequireAssertion(context =>
                    {
                        var rankClaim = context.User.FindFirst("RankLevel")?.Value;
                        return int.TryParse(rankClaim, out var rank) && rank <= 3;
                    }));
            });

            return services;
        }
    }
}
