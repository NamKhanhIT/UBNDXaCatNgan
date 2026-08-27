using System.Reflection;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Quanlycongviec.Application.Common.Behaviors;

namespace Quanlycongviec.Application
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddApplication(this IServiceCollection services)
        {
            var assembly = Assembly.GetExecutingAssembly();

            services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(assembly));
            services.AddValidatorsFromAssembly(assembly);

            // BẢO MẬT (Audit H8): kích hoạt FluentValidation trong MediatR pipeline —
            // validators trước đây là dead code vì không có behavior nào chạy chúng.
            services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

            services.AddAutoMapper(assembly);
            services.AddSingleton<Quanlycongviec.Application.Common.Interfaces.ITotpService, Quanlycongviec.Application.Common.Services.TotpService>();

            return services;
        }
    }
}
