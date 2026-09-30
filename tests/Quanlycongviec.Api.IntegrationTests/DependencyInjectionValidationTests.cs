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
    public class DependencyInjectionValidationTests
    {
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
