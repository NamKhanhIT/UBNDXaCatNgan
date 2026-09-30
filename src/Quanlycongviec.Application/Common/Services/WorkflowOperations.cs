using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Common.Services;

public sealed class WorkflowConflictException(string message) : InvalidOperationException(message);

public sealed class WorkflowOperations(IApplicationDbContext db, INotificationDispatcher? dispatcher = null)
{
    public static string Fingerprint(string operation, object payload) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(operation + JsonSerializer.Serialize(payload))));

    public async Task<Guid?> ReplayAsync(Guid userId, Guid requestId, string fingerprint, CancellationToken ct)
    {
        if (requestId == Guid.Empty) throw new ArgumentException("Thiếu mã yêu cầu. Vui lòng tải lại biểu mẫu.");
        var receipt = await db.WorkflowRequests.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId && x.RequestId == requestId, ct);
        if (receipt == null) return null;
        if (receipt.Fingerprint != fingerprint) throw new WorkflowConflictException("Mã yêu cầu đã được dùng cho nội dung khác. Vui lòng kiểm tra và gửi lại.");
        return receipt.ResultId;
    }

    public async Task<Guid> CommitAsync(Guid userId, Guid requestId, string fingerprint, Guid resultId, CancellationToken ct)
    {
        db.WorkflowRequests.Add(new WorkflowRequest { UserId = userId, RequestId = requestId, Fingerprint = fingerprint, ResultId = resultId });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            // A concurrent retry may have committed the same receipt. SaveChanges is atomic.
            if (db is DbContext context) context.ChangeTracker.Clear();
            var replay = await ReplayAsync(userId, requestId, fingerprint, ct);
            if (replay.HasValue) return replay.Value;
            throw;
        }
        return resultId;
    }

    public static void CheckVersion(Guid actual, Guid? expected)
    {
        if (!expected.HasValue || actual != expected.Value)
            throw new WorkflowConflictException("Dữ liệu đã thay đổi hoặc thiếu phiên bản. Vui lòng tải lại chi tiết trước khi xác nhận.");
    }

    public static DateTime Utc(DateTime value)
    {
        if (value.Kind != DateTimeKind.Utc)
            throw new ArgumentException("Thời gian phải có múi giờ. Vui lòng xác nhận ngày, giờ Việt Nam trên biểu mẫu.");
        return value;
    }

    public void Audit(Guid userId, string action, string entity, Guid id, string details)
    {
        db.AuditLogs.Add(new AuditLog { UserId = userId, Action = action, EntityName = entity, EntityId = id.ToString(), Details = details });
        db.ActivityLogs.Add(new ActivityLog { UserId = userId, ActionType = action, TargetEntityType = entity, TargetEntityId = id.ToString(), Summary = details });
    }

    public Notification Notify(Guid userId, string title, string message, Guid? taskId = null, Guid? documentId = null)
    {
        var notification = new Notification { UserId = userId, TaskItemId = taskId, InboxDocumentId = documentId,
            Type = NotificationType.Comment, Title = title, Message = message, SentAt = DateTime.UtcNow, RequiresRealtimeDelivery = true };
        db.Notifications.Add(notification);
        return notification;
    }

    public async Task PublishAsync(IEnumerable<Notification> notifications, CancellationToken ct)
    {
        if (dispatcher == null) return;
        foreach (var notification in notifications)
        {
            if (!await db.Notifications.AnyAsync(n => n.Id == notification.Id, ct)) continue;
            try { await dispatcher.DispatchAsync(notification, ct); }
            catch (Exception) when (!ct.IsCancellationRequested)
            {
                // Durable notification remains pending; the delivery worker retries it.
            }
        }
    }
}
