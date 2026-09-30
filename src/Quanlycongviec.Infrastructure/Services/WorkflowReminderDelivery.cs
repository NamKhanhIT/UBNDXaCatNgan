using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Infrastructure.Services;

/// <summary>A durable reminder may outlive the responsibility it was queued for.</summary>
internal static class WorkflowReminderDelivery
{
    public static async Task<bool> IsCurrentAsync(IApplicationDbContext db, Notification notification, CancellationToken ct)
    {
        var marker = await db.ReminderLogs.AsNoTracking().FirstOrDefaultAsync(r => r.Id == notification.Id, ct);
        if (marker == null) return true; // Ordinary activity notifications remain historical evidence.
        if (!await db.Users.AnyAsync(u => u.Id == notification.UserId && !u.IsDeleted, ct)) return false;
        if (marker.TaskItemId.HasValue)
        {
            var task = await db.TaskItems.AsNoTracking().FirstOrDefaultAsync(t => t.Id == marker.TaskItemId && !t.IsDeleted, ct);
            if (task == null || task.Status is TaskStatusEnum.Completed or TaskStatusEnum.Cancelled) return false;
            if (marker.ReminderType.StartsWith("Escalation:"))
                return task.Status is TaskStatusEnum.Todo or TaskStatusEnum.InProgress
                    && task.Priority == TaskPriority.Urgent && notification.UserId == task.AssignerId
                    && marker.ReminderType == $"Escalation:{task.AssignerId}:{task.DueDate?.Ticks}";
            var review = marker.ReminderType.StartsWith("PendingReview:");
            if (review ? task.Status != TaskStatusEnum.InReview || task.ReviewerId != notification.UserId || task.AssigneeId == notification.UserId
                : task.Status is not (TaskStatusEnum.Todo or TaskStatusEnum.InProgress) || task.AssigneeId != notification.UserId) return false;
            var round = await db.TaskSubmissions.AsNoTracking().Where(s => s.TaskItemId == task.Id && !s.IsDeleted)
                .OrderByDescending(s => s.CreatedAt).ThenByDescending(s => s.Id).Select(s => new { s.Id, s.Decision }).FirstOrDefaultAsync(ct);
            if (review && round?.Decision != "Pending") return false;
            return marker.ReminderType.Contains($":{notification.UserId}:{round?.Id.ToString("N") ?? "initial"}:{task.DueDate?.Ticks}:");
        }
        if (marker.CalendarEventId.HasValue)
        {
            var evt = await db.CalendarEvents.AsNoTracking().FirstOrDefaultAsync(e => e.Id == marker.CalendarEventId && !e.IsDeleted, ct);
            if (evt == null || !marker.ReminderType.StartsWith($"EventReminder:{evt.Id}:{evt.Version}:{evt.StartDateTime.Ticks}:")) return false;
            return evt.OrganizerId == notification.UserId || await db.EventParticipants.AnyAsync(p => p.EventId == evt.Id && !p.IsDeleted && p.UserId == notification.UserId, ct);
        }
        return true;
    }
}
