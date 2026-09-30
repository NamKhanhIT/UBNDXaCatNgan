using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Infrastructure.Services;

public sealed class WorkflowNotificationDeliveryService(IServiceScopeFactory scopes, ILogger<WorkflowNotificationDeliveryService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(10));
        do
        {
            try
            {
                await DeliverPendingAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception exception) { logger.LogWarning(exception, "Chưa gửi được thông báo chờ xử lý; sẽ thử lại."); }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public async Task DeliverPendingAsync(CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IApplicationDbContext>();
        var dispatcher = scope.ServiceProvider.GetRequiredService<INotificationDispatcher>();
        var pending = await db.Notifications.Where(n => !n.IsDeleted && n.RequiresRealtimeDelivery)
            .OrderBy(n => n.CreatedAt).ThenBy(n => n.Id).Take(100).ToListAsync(ct);
        foreach (var item in pending)
        {
            try { await dispatcher.DispatchAsync(item, ct); }
            catch (Exception exception) when (!ct.IsCancellationRequested)
            {
                logger.LogWarning(exception, "Chưa gửi được thông báo {NotificationId}; sẽ thử lại.", item.Id);
            }
        }
    }
}
