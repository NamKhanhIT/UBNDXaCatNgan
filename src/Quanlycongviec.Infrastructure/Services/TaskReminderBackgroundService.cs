using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;

namespace Quanlycongviec.Infrastructure.Services
{
    public class TaskReminderBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<TaskReminderBackgroundService> _logger;
        private readonly IConfiguration _configuration;
        private readonly TimeProvider _clock;

        public TaskReminderBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<TaskReminderBackgroundService> logger,
            IConfiguration configuration,
            TimeProvider? clock = null)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _configuration = configuration;
            _clock = clock ?? TimeProvider.System;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            int intervalMinutes = _configuration.GetValue<int>("Reminder:IntervalMinutes", 15);
            if (intervalMinutes <= 0) intervalMinutes = 15;

            _logger.LogInformation("TaskReminderBackgroundService đã khởi động. Chu kỳ quét: {Interval} phút.", intervalMinutes);

            using var timer = new PeriodicTimer(TimeSpan.FromMinutes(intervalMinutes));

            // Thực thi ngay lần đầu tiên
            await ProcessRemindersAsync(stoppingToken);

            while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
            {
                await ProcessRemindersAsync(stoppingToken);
            }
        }

        public async Task ProcessRemindersAsync(CancellationToken cancellationToken = default)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                var dispatcher = scope.ServiceProvider.GetRequiredService<INotificationDispatcher>();
                var zaloService = scope.ServiceProvider.GetService<IZaloNotificationService>();

                var nowUtc = _clock.GetUtcNow().UtcDateTime;
                // Workflow timestamps are UTC; legacy values require an explicit per-record migration audit.
                var vnNow = nowUtc;

                // Lấy các task đang mở (chưa completed/cancelled) có DueDate hoặc đang chờ nghiệm thu
                var openTasks = await context.TaskItems
                    .Include(t => t.Assigner)
                    .Include(t => t.Assignee)
                    .Where(t => !t.IsDeleted && t.Status != TaskStatusEnum.Completed && t.Status != TaskStatusEnum.Cancelled && (t.DueDate.HasValue || t.Status == TaskStatusEnum.InReview))
                    .ToListAsync(cancellationToken);

                foreach (var task in openTasks)
                {
                    try
                    {
                        if (task.Status == TaskStatusEnum.InReview)
                        {
                            await TrySendReminderAsync(context, dispatcher, null, task, "PendingReview",
                                NotificationType.BeforeDeadline, $"Chờ nghiệm thu: {task.Title}",
                                $"Cán bộ đã nộp kết quả [{task.Title}]. Vui lòng xem và nghiệm thu hoặc yêu cầu chỉnh sửa.",
                                notifyAssigner: true, notifyAssignee: false, cancellationToken);
                            continue;
                        }

                        if (!task.DueDate.HasValue) continue;
                        var dueDateVn = task.DueDate.Value;
                        var timeUntilDue = dueDateVn - vnNow;

                        // 1. Các mốc nhắc trước hạn 48 giờ, 24 giờ và 12 giờ
                        if (timeUntilDue > TimeSpan.Zero && timeUntilDue <= TimeSpan.FromHours(48))
                        {
                            string reminderType = timeUntilDue <= TimeSpan.FromHours(12) ? "BeforeDeadline12h" : timeUntilDue <= TimeSpan.FromHours(24) ? "BeforeDeadline1d" : "BeforeDeadline48h";
                            var typeEnum = timeUntilDue <= TimeSpan.FromHours(12) ? NotificationType.BeforeDeadline : timeUntilDue <= TimeSpan.FromHours(24) ? NotificationType.BeforeDeadline1d : NotificationType.BeforeDeadline48h;

                            await TrySendReminderAsync(
                                context, dispatcher, zaloService, task, reminderType,
                                typeEnum,
                                $"Nhắc việc sắp tới hạn ({task.Title})",
                                $"Công việc [{task.Title}] sẽ hết hạn trong vòng {(timeUntilDue.TotalHours <= 12 ? "12 giờ" : timeUntilDue.TotalHours <= 24 ? "24 giờ" : "48 giờ")}. Vui lòng kiểm tra tiến độ.",
                                notifyAssigner: false, notifyAssignee: true, cancellationToken);
                        }

                        // 2. Nhắc nhở quá hạn
                        if (vnNow > dueDateVn)
                        {
                            await TrySendReminderAsync(
                                context, dispatcher, zaloService, task, "Overdue",
                                NotificationType.Overdue,
                                $"CẢNH BÁO TRỄ HẠN: {task.Title}",
                                $"Công việc [{task.Title}] đã quá hạn từ ngày {task.DueDate.Value.AddHours(7):HH:mm, dd-MM-yyyy}. Cần xử lý ngay!",
                                notifyAssigner: false, notifyAssignee: true, cancellationToken);
                        }

                        // 3. Leo thang công việc khẩn (Urgent + Quá hạn + chưa Leo thang)
                        if (task.Priority == TaskPriority.Urgent && vnNow > dueDateVn)
                        {
                            await HandleEscalationAsync(context, dispatcher, task, cancellationToken);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Lỗi khi xử lý nhắc việc cho task {TaskId}", task.Id);
                    }
                }

                // 4. Quét & Gửi nhắc nhở Sự kiện Lịch (CalendarEvent)
                await ProcessEventRemindersAsync(context, dispatcher, vnNow, cancellationToken);

                // 5. Tổng hợp định kỳ sáng thứ Hai (Asia/Ho_Chi_Minh)
                await ProcessWeeklySummaryAsync(context, dispatcher, nowUtc, cancellationToken);

                // 6. Bản tóm tắt nhắc việc mỗi ngày (Daily Digest lúc 07:30 sáng)
                await ProcessDailyDigestAsync(context, dispatcher, nowUtc, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xử lý vòng lặp nhắc việc tự động.");
            }
        }

        private async Task ProcessDailyDigestAsync(ApplicationDbContext context, INotificationDispatcher dispatcher,
            DateTime nowUtc, CancellationToken cancellationToken)
        {
            if (!_configuration.GetValue<bool>("DailyDigest:Enabled", true)) return;
            var local = nowUtc.AddHours(7);
            var target = TimeSpan.FromHours(Math.Clamp(_configuration.GetValue<int>("DailyDigest:Hour", 7), 0, 23))
                + TimeSpan.FromMinutes(Math.Clamp(_configuration.GetValue<int>("DailyDigest:Minute", 30), 0, 59));
            var window = TimeSpan.FromMinutes(Math.Clamp(_configuration.GetValue<int>("DailyDigest:WindowMinutes", 15), 1, 60));
            if (local.TimeOfDay < target || local.TimeOfDay >= target + window) return;
            var items = await context.TaskItems.AsNoTracking().Where(t => !t.IsDeleted
                && (t.Status == TaskStatusEnum.Todo || t.Status == TaskStatusEnum.InProgress || (t.Status == TaskStatusEnum.InReview && t.ReviewerId.HasValue)))
                .Select(t => new { Recipient = t.Status == TaskStatusEnum.InReview ? t.ReviewerId!.Value : t.AssigneeId, t.Status, t.DueDate })
                .ToListAsync(cancellationToken);
            var activeUsers = await context.Users.Where(u => !u.IsDeleted).Select(u => u.Id).ToListAsync(cancellationToken);
            foreach (var group in items.Where(t => activeUsers.Contains(t.Recipient)).GroupBy(t => t.Recipient))
            {
                var key = $"DailyDigest:{local:yyyyMMdd}:{group.Key}";
                var marker = new ReminderLog { Id = ReminderId(key), ReminderType = key, UserId = group.Key, SentAt = nowUtc };
                var overdue = group.Count(t => t.Status != TaskStatusEnum.InReview && t.DueDate < nowUtc);
                var review = group.Count(t => t.Status == TaskStatusEnum.InReview);
                var notification = new Notification { UserId = group.Key, Type = NotificationType.WeeklySummary,
                    Title = "Công việc đang đến lượt bạn",
                    Message = $"Bạn có {group.Count() - review} việc cần thực hiện ({overdue} việc quá hạn) và {review} kết quả cần nghiệm thu.",
                    SentAt = nowUtc };
                await DeliverReminderAsync(context, dispatcher, marker, new[] { notification }, cancellationToken);
            }
        }

        private async Task TrySendReminderAsync(
            ApplicationDbContext context,
            INotificationDispatcher dispatcher,
            IZaloNotificationService? zaloService,
            TaskItem task,
            string reminderType,
            NotificationType notificationType,
            string title,
            string message,
            bool notifyAssigner,
            bool notifyAssignee,
            CancellationToken cancellationToken)
        {
            await WorkflowTaskReminder.SendAsync(context, dispatcher, task, _clock.GetUtcNow().UtcDateTime,
                _configuration.GetValue<int>("Reminder:RepeatHours", 24), reminderType, notificationType,
                title, message, cancellationToken);
        }

        private static Guid ReminderId(string value)
        {
            var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value));
            return new Guid(hash.AsSpan(0, 16));
        }

        private async Task DeliverReminderAsync(ApplicationDbContext context, INotificationDispatcher dispatcher,
            ReminderLog marker, IEnumerable<Notification> notifications, CancellationToken cancellationToken)
        {
            if (await context.ReminderLogs.AnyAsync(r => r.Id == marker.Id, cancellationToken)) return;
            var pending = notifications.ToList();
            foreach (var notification in pending)
            {
                notification.Id = pending.Count == 1 ? marker.Id : ReminderId($"{marker.Id}:{notification.UserId}");
                notification.RequiresRealtimeDelivery = true;
                context.Notifications.Add(notification);
            }
            context.ReminderLogs.Add(marker);
            try { await context.SaveChangesAsync(cancellationToken); }
            catch (DbUpdateException)
            {
                context.Entry(marker).State = EntityState.Detached;
                foreach (var notification in pending) context.Entry(notification).State = EntityState.Detached;
                // A concurrent scan or changed object may win; the next scan reloads current state.
                throw;
            }
            foreach (var notification in pending)
            {
                try { await dispatcher.DispatchAsync(notification, cancellationToken); }
                catch (Exception) when (!cancellationToken.IsCancellationRequested)
                { /* Durable delivery worker owns retries; continue saving the other recipients. */ }
            }
        }

        private async Task HandleEscalationAsync(
            ApplicationDbContext context,
            INotificationDispatcher dispatcher,
            TaskItem task,
            CancellationToken cancellationToken)
        {
            if (!await context.Users.AnyAsync(u => u.Id == task.AssignerId && !u.IsDeleted, cancellationToken)) return;
            var key = $"Escalation:{task.AssignerId}:{task.DueDate?.Ticks}";
            var id = ReminderId($"{task.Id}:{key}");
            if (await context.ReminderLogs.AnyAsync(r => r.Id == id, cancellationToken)) return;
            // The named assigner owns escalation. A department label must never broadcast task data.
            task.IsEscalated = true;
            context.Entry(task).Property(t => t.Version).IsModified = true;
            var now = _clock.GetUtcNow().UtcDateTime;
            var marker = new ReminderLog { Id = id, TaskItemId = task.Id, UserId = task.AssignerId, ReminderType = key, SentAt = now };
            await DeliverReminderAsync(context, dispatcher, marker, new[] { new Notification
            {
                UserId = task.AssignerId, TaskItemId = task.Id, Type = NotificationType.Escalation,
                Title = $"CÔNG VIỆC KHẨN TRỄ HẠN: {task.Title}",
                Message = $"Công việc khẩn [{task.Title}] do bạn giao đã quá hạn. Vui lòng kiểm tra tiến độ.", SentAt = now
            } }, cancellationToken);
        }

        private async Task ProcessWeeklySummaryAsync(ApplicationDbContext context, INotificationDispatcher dispatcher,
            DateTime nowUtc, CancellationToken cancellationToken)
        {
            var local = nowUtc.AddHours(7);
            if (local.DayOfWeek != DayOfWeek.Monday || local.Hour != 7) return;
            var tasks = await context.TaskItems.AsNoTracking().Where(t => !t.IsDeleted && t.Type == TaskType.BAU
                && (t.Status == TaskStatusEnum.Todo || t.Status == TaskStatusEnum.InProgress))
                .Select(t => t.AssigneeId).ToListAsync(cancellationToken);
            var activeUsers = await context.Users.Where(u => !u.IsDeleted).Select(u => u.Id).ToListAsync(cancellationToken);
            foreach (var group in tasks.Where(activeUsers.Contains).GroupBy(id => id))
            {
                var key = $"WeeklySummary:{local:yyyyMMdd}:{group.Key}";
                var marker = new ReminderLog { Id = ReminderId(key), UserId = group.Key, ReminderType = key, SentAt = nowUtc };
                await DeliverReminderAsync(context, dispatcher, marker, new[] { new Notification
                {
                    UserId = group.Key, Type = NotificationType.WeeklySummary, Title = "Công việc thường xuyên trong tuần",
                    Message = $"Bạn có {group.Count()} công việc thường xuyên chưa hoàn thành.", SentAt = nowUtc
                } }, cancellationToken);
            }
        }

        private async Task ProcessEventRemindersAsync(ApplicationDbContext context, INotificationDispatcher dispatcher,
            DateTime nowUtc, CancellationToken cancellationToken)
        {
            var events = await context.CalendarEvents.Include(e => e.Participants).Include(e => e.ReminderOffsets)
                .Where(e => !e.IsDeleted && e.EndDateTime >= nowUtc).ToListAsync(cancellationToken);
            foreach (var evt in events)
            {
                foreach (var offset in evt.ReminderOffsets.Where(o => !o.IsDeleted && o.MinutesBefore >= 0))
                {
                    if (nowUtc < evt.StartDateTime.AddMinutes(-offset.MinutesBefore) || nowUtc > evt.StartDateTime.AddMinutes(30)) continue;
                    var recipients = evt.Participants.Where(p => !p.IsDeleted).Select(p => p.UserId).Append(evt.OrganizerId).Distinct().ToList();
                    recipients = await context.Users.Where(u => recipients.Contains(u.Id) && !u.IsDeleted).Select(u => u.Id).ToListAsync(cancellationToken);
                    foreach (var userId in recipients)
                    {
                        var key = $"EventReminder:{evt.Id}:{evt.Version}:{evt.StartDateTime.Ticks}:{offset.MinutesBefore}:{userId}";
                        var marker = new ReminderLog { Id = ReminderId(key), CalendarEventId = evt.Id, UserId = userId, ReminderType = key, SentAt = nowUtc };
                        context.Entry(evt).Property(e => e.Version).IsModified = true;
                        try
                        {
                            await DeliverReminderAsync(context, dispatcher, marker, new[] { new Notification
                            {
                                UserId = userId, CalendarEventId = evt.Id, Type = NotificationType.EventReminder,
                                Title = "Sắp diễn ra: " + evt.Title,
                                Message = $"Bắt đầu {evt.StartDateTime.AddHours(7):HH:mm, dd-MM-yyyy}. Địa điểm: {evt.Location ?? "Chưa xác định"}.", SentAt = nowUtc
                            } }, cancellationToken);
                        }
                        catch (DbUpdateException)
                        {
                            context.Entry(evt).State = EntityState.Detached;
                            break;
                        }
                    }
                }
            }
        }
    }
}
