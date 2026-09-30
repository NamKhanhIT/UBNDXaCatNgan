using System;
using System.Collections.Generic;
using FluentAssertions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Quanlycongviec.Application;
using Quanlycongviec.Infrastructure;
using Xunit;

namespace Quanlycongviec.Api.IntegrationTests
{
    public class DependencyInjectionConfigurationTests
    {
        /// <summary>
        /// BẢO MẬT (Audit 04-09-2026): Khi ConnectionStrings:DefaultConnection không được cấu hình
        /// trong môi trường production (DemoMode=false), việc resolve DbContext phải từ chối rõ ràng
        /// thay vì kết nối với mật khẩu placeholder.
        /// </summary>
        [Fact]
        public void AddInfrastructure_ShouldThrow_WhenDefaultConnectionMissing_AndNotDemoMode()
        {
            // AddInMemoryCollection can override existing values, but the in-memory collection
            // is checked BEFORE the disk-based appsettings.json. To make the throw fire, we
            // configure the connection string to be null/empty explicitly.
            var builder = WebApplication.CreateEmptyBuilder(new WebApplicationOptions());
            builder.WebHost.UseKestrel();
            // Explicitly blank out the connection string at the highest priority
            builder.Configuration["ConnectionStrings:DefaultConnection"] = string.Empty;

            builder.Services.AddControllers();
            builder.Services.AddApplication();
            // AddInfrastructure phải throw InvalidOperationException ngay khi đăng ký (không lazy)
            Action act = () => builder.Services.AddInfrastructure(builder.Configuration);

            act.Should().Throw<InvalidOperationException>(
                "Application must refuse to register DbContext with a hardcoded fallback connection string in production mode");
        }

        [Fact]
        public void AddInfrastructure_ShouldNotThrow_WhenConnectionStringProvided()
        {
            var builder = WebApplication.CreateEmptyBuilder(new WebApplicationOptions());
            builder.WebHost.UseKestrel();
            builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Jwt:Secret", "ThisIsASecretKeyForTestingPurposesOnly1234567890!" },
                { "ConnectionStrings:DefaultConnection", "Host=localhost;Database=test;Username=postgres;Password=postgres" },
                { "DemoMode:Enabled", "false" },
                { "DemoMode:UseInMemoryDatabase", "false" }
            });

            builder.Services.AddControllers();
            builder.Services.AddApplication();
            Action act = () => builder.Services.AddInfrastructure(builder.Configuration);
            act.Should().NotThrow("valid connection string should allow AddInfrastructure to succeed");
        }

        [Fact]
        public void DependencyInjection_WebApplicationBuilder_ShouldBuildSuccessfully()
        {
            var builder = WebApplication.CreateEmptyBuilder(new WebApplicationOptions());
            builder.WebHost.UseKestrel();
            builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Jwt:Secret", "ThisIsASecretKeyForTestingPurposesOnly1234567890!" },
                { "ConnectionStrings:DefaultConnection", "Host=localhost;Database=test;Username=postgres;Password=postgres" }
            });

            builder.Services.AddControllers();
            builder.Services.AddApplication();
            builder.Services.AddInfrastructure(builder.Configuration);

            var app = builder.Build();
            app.Should().NotBeNull();
        }
    }
}
