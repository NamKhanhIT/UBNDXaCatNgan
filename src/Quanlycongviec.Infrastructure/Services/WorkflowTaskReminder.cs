using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;

namespace Quanlycongviec.Infrastructure.Services;

/// <summary>Persists the reminder and delivery outbox together for a specific responsibility and round.</summary>
public static class WorkflowTaskReminder
{
    public static async Task SendAsync(ApplicationDbContext db, INotificationDispatcher dispatcher,
        TaskItem task, DateTime now, int repeatHours, string kind, NotificationType type,
        string title, string message, CancellationToken ct)
    {
        var review = task.Status == TaskStatusEnum.InReview;
        if (!review && task.Status != TaskStatusEnum.Todo && task.Status != TaskStatusEnum.InProgress) return;
        var recipient = review ? task.ReviewerId : task.AssigneeId;
        if (!recipient.HasValue || (review && recipient == task.AssigneeId)
            || !await db.Users.AnyAsync(u => u.Id == recipient && !u.IsDeleted, ct)) return;
        var submission = await db.TaskSubmissions.Where(s => s.TaskItemId == task.Id && !s.IsDeleted)
            .OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id)
            .Select(s => new { s.Id, s.Decision }).FirstOrDefaultAsync(ct);
        if (review && submission?.Decision != "Pending") return;
        var round = submission?.Id.ToString("N") ?? "initial";
        var period = kind is "Overdue" or "PendingReview"
            ? ((long)(now - DateTime.UnixEpoch).TotalHours / Math.Clamp(repeatHours, 1, 168)).ToString()
            : "once";
        var key = $"{kind}:{recipient}:{round}:{task.DueDate?.Ticks}:{period}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"task-reminder:{task.Id}:{key}"));
        var id = new Guid(hash.AsSpan(0, 16));
        if (await db.ReminderLogs.AnyAsync(r => r.Id == id, ct)) return;
        var marker = new ReminderLog { Id = id, TaskItemId = task.Id, UserId = recipient,
            ReminderType = key, SentAt = now };
        var notification = new Notification { Id = id, UserId = recipient.Value, TaskItemId = task.Id,
            Type = type, Channel = NotificationChannel.InApp, Title = title, Message = message,
            SentAt = now, RequiresRealtimeDelivery = true };
        db.ReminderLogs.Add(marker);
        db.Notifications.Add(notification);
        // Compete with status/reviewer/deadline changes so an obsolete scan cannot enqueue a reminder.
        db.Entry(task).Property(t => t.Version).IsModified = true;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException)
        {
            db.Entry(marker).State = EntityState.Detached;
            db.Entry(notification).State = EntityState.Detached;
            db.Entry(task).State = EntityState.Detached;
            return;
        }
        try { await dispatcher.DispatchAsync(notification, ct); }
        catch (Exception) when (!ct.IsCancellationRequested)
        {
            // The delivery worker retries the durable notification independently of the scan period.
        }
    }
}
