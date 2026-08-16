using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Hubs;
using Quanlycongviec.Infrastructure.Persistence;

namespace Quanlycongviec.Infrastructure.Services
{
    public class TaskReminderBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<TaskReminderBackgroundService> _logger;
        private readonly IConfiguration _configuration;

        public TaskReminderBackgroundService(
            IServiceProvider serviceProvider,
            ILogger<TaskReminderBackgroundService> logger,
            IConfiguration configuration)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _configuration = configuration;
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
                var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<NotificationHub>>();
                var zaloService = scope.ServiceProvider.GetService<IZaloNotificationService>();
                var webPushService = scope.ServiceProvider.GetService<IWebPushNotificationService>();

                var nowUtc = DateTime.UtcNow;

                // Lấy các task đang mở (chưa completed) có DueDate
                var openTasks = await context.TaskItems
                    .Include(t => t.Assigner)
                    .Include(t => t.Assignee)
                    .Where(t => t.Status != TaskStatusEnum.Completed && t.DueDate.HasValue)
                    .ToListAsync(cancellationToken);

                foreach (var task in openTasks)
                {
                    var dueDateUtc = task.DueDate!.Value.ToUniversalTime();
                    var timeUntilDue = dueDateUtc - nowUtc;

                    // 1. Nhắc nhở trước hạn 3 ngày & 1 ngày
                    if (timeUntilDue > TimeSpan.Zero && timeUntilDue <= TimeSpan.FromDays(3))
                    {
                        string reminderType = timeUntilDue <= TimeSpan.FromDays(1) ? "BeforeDeadline1d" : "BeforeDeadline3d";
                        var typeEnum = timeUntilDue <= TimeSpan.FromDays(1) ? NotificationType.BeforeDeadline1d : NotificationType.BeforeDeadline3d;

                        await TrySendReminderAsync(
                            context, hubContext, zaloService, webPushService, task, reminderType,
                            typeEnum,
                            $"Nhắc việc sắp tới hạn ({task.Title})",
                            $"Công việc [{task.Title}] sẽ hết hạn trong vòng {(timeUntilDue.TotalHours <= 24 ? "1 ngày" : "3 ngày")}. Vui lòng kiểm tra tiến độ.",
                            notifyAssigner: true, notifyAssignee: true, cancellationToken);
                    }

                    // 2. Nhắc nhở quá hạn
                    if (nowUtc > dueDateUtc)
                    {
                        await TrySendReminderAsync(
                            context, hubContext, zaloService, webPushService, task, "Overdue",
                            NotificationType.Overdue,
                            $"CẢNH BÁO TRỄ HẠN: {task.Title}",
                            $"Công việc [{task.Title}] đã quá hạn từ ngày {task.DueDate:dd/MM/yyyy HH:mm}. Cần xử lý ngay!",
                            notifyAssigner: true, notifyAssignee: true, cancellationToken);
                    }

                    // 3. Leo thang công việc khẩn (Urgent + Quá hạn + chưa Leo thang)
                    if (task.Priority == TaskPriority.Urgent && nowUtc > dueDateUtc && !task.IsEscalated)
                    {
                        await HandleEscalationAsync(context, hubContext, zaloService, webPushService, task, cancellationToken);
                    }
                }

                // 4. Quét & Gửi nhắc nhở Sự kiện Lịch (CalendarEvent)
                await ProcessEventRemindersAsync(context, hubContext, zaloService, webPushService, nowUtc, cancellationToken);

                // 5. Tổng hợp định kỳ sáng thứ Hai (Asia/Ho_Chi_Minh)
                await ProcessWeeklySummaryAsync(context, hubContext, zaloService, webPushService, nowUtc, cancellationToken);

                // 6. Bản tóm tắt nhắc việc mỗi ngày (Daily Digest lúc 07:30 sáng)
                await ProcessDailyDigestAsync(context, webPushService, nowUtc, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xử lý vòng lặp nhắc việc tự động.");
            }
        }

        private static string? _lastDailyDigestDate = null;

        private async Task ProcessDailyDigestAsync(
            ApplicationDbContext context,
            IWebPushNotificationService webPushService,
            DateTime nowUtc,
            CancellationToken cancellationToken)
        {
            var digestEnabled = _configuration.GetValue<bool>("DailyDigest:Enabled", true);
            if (!digestEnabled) return;

            // Giờ Việt Nam (UTC+7)
            var vnTime = nowUtc.AddHours(7);
            var todayStr = vnTime.ToString("yyyy-MM-dd");

            var targetHour = _configuration.GetValue<int>("DailyDigest:Hour", 7);
            var targetMinute = _configuration.GetValue<int>("DailyDigest:Minute", 30);

            // Kiểm tra khung giờ và chỉ chạy 1 lần trong ngày
            bool isTargetTime = (vnTime.Hour == targetHour && vnTime.Minute >= targetMinute) || (vnTime.Hour > targetHour && vnTime.Hour <= targetHour + 1);

            if (!isTargetTime || _lastDailyDigestDate == todayStr)
            {
                return;
            }

            _logger.LogInformation("Đang chạy tiến trình gửi Bản tóm tắt nhắc việc mỗi ngày (Daily Digest) cho ngày {Date}...", todayStr);

            // Lấy danh sách user IDs có subscription Web Push đang kích hoạt
            var userIdsWithPush = await context.PushSubscriptions
                .Where(s => s.IsActive)
                .Select(s => s.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            foreach (var userId in userIdsWithPush)
            {
                var userTasks = await context.TaskItems
                    .Where(t => t.AssigneeId == userId && t.Status != TaskStatusEnum.Completed)
                    .ToListAsync(cancellationToken);

                var pendingCount = userTasks.Count;
                var overdueCount = userTasks.Count(t => t.DueDate.HasValue && t.DueDate.Value.ToUniversalTime() < nowUtc);

                if (pendingCount > 0)
                {
                    string digestTitle = "Tóm Tắt Nhiệm Vụ Hôm Nay - UBND Xã Cát Ngạn";
                    string digestMessage = overdueCount > 0
                        ? $"Chào buổi sáng! Bạn có {pendingCount} việc cần xử lý hôm nay, trong đó có {overdueCount} việc quá hạn. Bấm để xem chi tiết."
                        : $"Chào buổi sáng! Bạn có {pendingCount} việc cần xử lý hôm nay. Chúc bạn một ngày làm việc hiệu quả!";

                    if (webPushService != null)
                    {
                        await webPushService.SendNotificationAsync(
                            userId,
                            digestTitle,
                            digestMessage,
                            "/",
                            new { type = "DailyDigest", pendingCount, overdueCount },
                            cancellationToken);
                    }
                }
            }

            _lastDailyDigestDate = todayStr;
        }

        private async Task TrySendReminderAsync(
            ApplicationDbContext context,
            IHubContext<NotificationHub> hubContext,
            IZaloNotificationService? zaloService,
            IWebPushNotificationService? webPushService,
            TaskItem task,
            string reminderType,
            NotificationType notificationType,
            string title,
            string message,
            bool notifyAssigner,
            bool notifyAssignee,
            CancellationToken cancellationToken)
        {
            // Kiểm tra DB unique constraint tránh gửi trùng
            bool exists = await context.ReminderLogs
                .AnyAsync(r => r.TaskItemId == task.Id && r.ReminderType == reminderType, cancellationToken);

            if (exists) return;

            var recipients = new HashSet<Guid>();
            if (notifyAssignee) recipients.Add(task.AssigneeId);
            if (notifyAssigner) recipients.Add(task.AssignerId);

            var reminderLog = new ReminderLog
            {
                TaskItemId = task.Id,
                ReminderType = reminderType,
                SentAt = DateTime.UtcNow
            };

            context.ReminderLogs.Add(reminderLog);

            try
            {
                await context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // Bắt lỗi Unique Constraint chặn trùng lặp cấp CSDL nếu race condition xảy ra
                context.Entry(reminderLog).State = EntityState.Detached;
                return;
            }

            foreach (var userId in recipients)
            {
                var notification = new Notification
                {
                    UserId = userId,
                    TaskItemId = task.Id,
                    Type = notificationType,
                    Channel = NotificationChannel.InApp,
                    Title = title,
                    Message = message,
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                };

                context.Notifications.Add(notification);
                await context.SaveChangesAsync(cancellationToken);

                // Real-time SignalR push
                await BroadcastNotificationAsync(hubContext, userId, notification);
                
                // Web Push song song
                if (webPushService != null)
                {
                    await webPushService.SendNotificationAsync(userId, title, message, "/", new { taskId = task.Id }, cancellationToken);
                }

                // Zalo ZNS fallback nếu có sđt
                if (zaloService != null)
                {
                    var user = await context.Users.FindAsync(new object[] { userId }, cancellationToken);
                    if (user != null && !string.IsNullOrWhiteSpace(user.ZaloPhoneNumber))
                    {
                        await zaloService.SendZnsAsync(user.ZaloPhoneNumber, "REMINDER_TEMPLATE", new { title, message });
                    }
                }
            }
        }

        private async Task HandleEscalationAsync(
            ApplicationDbContext context,
            IHubContext<NotificationHub> hubContext,
            IZaloNotificationService? zaloService,
            IWebPushNotificationService? webPushService,
            TaskItem task,
            CancellationToken cancellationToken)
        {
            // Kiểm tra xem đã leo thang chưa
            bool alreadyEscalatedLog = await context.ReminderLogs
                .AnyAsync(r => r.TaskItemId == task.Id && r.ReminderType == "Escalation", cancellationToken);

            if (alreadyEscalatedLog || task.IsEscalated) return;

            // Đánh dấu leo thang
            task.IsEscalated = true;

            var reminderLog = new ReminderLog
            {
                TaskItemId = task.Id,
                ReminderType = "Escalation",
                SentAt = DateTime.UtcNow
            };
            context.ReminderLogs.Add(reminderLog);

            try
            {
                await context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                context.Entry(reminderLog).State = EntityState.Detached;
                return;
            }

            var recipients = new HashSet<Guid> { task.AssignerId };

            // Tìm Trưởng phòng / Lãnh đạo cao nhất trong phòng ban của Task
            if (task.DepartmentId.HasValue)
            {
                var deptLeaders = await context.UserRoles
                    .Include(ur => ur.Role)
                    .Where(ur => ur.DepartmentId == task.DepartmentId.Value)
                    .OrderBy(ur => ur.Role.RankLevel)
                    .Select(ur => ur.UserId)
                    .ToListAsync(cancellationToken);

                if (deptLeaders.Any())
                {
                    recipients.Add(deptLeaders.First());
                }
            }

            // Nếu không xác định được trưởng phòng, gửi cho Lãnh đạo RankLevel <= 2
            if (recipients.Count == 1)
            {
                var leaders = await context.UserRoles
                    .Include(ur => ur.Role)
                    .Where(ur => ur.Role.RankLevel <= 2)
                    .Select(ur => ur.UserId)
                    .ToListAsync(cancellationToken);

                foreach (var lId in leaders) recipients.Add(lId);
            }

            foreach (var userId in recipients)
            {
                var notification = new Notification
                {
                    UserId = userId,
                    TaskItemId = task.Id,
                    Type = NotificationType.Escalation,
                    Channel = NotificationChannel.InApp,
                    Title = $"CÔNG VIỆC KHẨN TRỄ HẠN: {task.Title}",
                    Message = $"Nhiệm vụ KHẨN CẤP [{task.Title}] đã trễ hạn và được tự động leo thang tới Lãnh đạo quản lý trực tiếp.",
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                };

                context.Notifications.Add(notification);
                await context.SaveChangesAsync(cancellationToken);

                await BroadcastNotificationAsync(hubContext, userId, notification);
                if (webPushService != null)
                {
                    await webPushService.SendNotificationAsync(userId, notification.Title, notification.Message, "/", new { taskId = task.Id }, cancellationToken);
                }
            }
        }

        private async Task ProcessWeeklySummaryAsync(
            ApplicationDbContext context,
            IHubContext<NotificationHub> hubContext,
            IZaloNotificationService? zaloService,
            IWebPushNotificationService? webPushService,
            DateTime nowUtc,
            CancellationToken cancellationToken)
        {
            // Chuyển sang giờ Việt Nam (Asia/Ho_Chi_Minh hoặc SE Asia Standard Time)
            TimeZoneInfo vnTimeZone;
            try
            {
                vnTimeZone = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
            }
            catch
            {
                vnTimeZone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
            }

            var vnNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, vnTimeZone);

            // Chỉ chạy vào sáng thứ Hai
            if (vnNow.DayOfWeek != DayOfWeek.Monday) return;

            int calendarWeek = CultureInfo.CurrentCulture.Calendar.GetWeekOfYear(vnNow, CalendarWeekRule.FirstFourDayWeek, DayOfWeek.Monday);
            string weeklyKey = $"WeeklySummary_{vnNow.Year}_W{calendarWeek}";

            // Lấy tất cả user có BAU tasks đang mở
            var openBauTasks = await context.TaskItems
                .Where(t => t.Type == TaskType.BAU && t.Status != TaskStatusEnum.Completed)
                .ToListAsync(cancellationToken);

            var userTaskGroups = openBauTasks.GroupBy(t => t.AssigneeId);

            foreach (var group in userTaskGroups)
            {
                var userId = group.Key;
                bool alreadySent = await context.ReminderLogs
                    .AnyAsync(r => r.UserId == userId && r.ReminderType == weeklyKey, cancellationToken);

                if (alreadySent) continue;

                var reminderLog = new ReminderLog
                {
                    UserId = userId,
                    ReminderType = weeklyKey,
                    SentAt = DateTime.UtcNow
                };
                context.ReminderLogs.Add(reminderLog);

                try
                {
                    await context.SaveChangesAsync(cancellationToken);
                }
                catch (DbUpdateException)
                {
                    context.Entry(reminderLog).State = EntityState.Detached;
                    continue;
                }

                int taskCount = group.Count();
                var notification = new Notification
                {
                    UserId = userId,
                    Type = NotificationType.WeeklySummary,
                    Channel = NotificationChannel.InApp,
                    Title = $"Tóm tắt công việc thường xuyên tuần {calendarWeek}",
                    Message = $"Đồng chí hiện có {taskCount} nhiệm vụ thường xuyên cần tập trung hoàn thành trong tuần này.",
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                };

                context.Notifications.Add(notification);
                await context.SaveChangesAsync(cancellationToken);

                await BroadcastNotificationAsync(hubContext, userId, notification);
                if (webPushService != null)
                {
                    await webPushService.SendNotificationAsync(userId, notification.Title, notification.Message, "/", new { type = "WeeklySummary" }, cancellationToken);
                }
            }
        }

        private async Task ProcessEventRemindersAsync(
            ApplicationDbContext context,
            IHubContext<NotificationHub> hubContext,
            IZaloNotificationService? zaloService,
            IWebPushNotificationService? webPushService,
            DateTime nowUtc,
            CancellationToken cancellationToken)
        {
            var activeEvents = await context.CalendarEvents
                .Include(e => e.Participants)
                .Include(e => e.ReminderOffsets)
                .Where(e => !e.IsDeleted && e.EndDateTime >= nowUtc)
                .ToListAsync(cancellationToken);

            foreach (var evt in activeEvents)
            {
                var startUtc = evt.StartDateTime.ToUniversalTime();

                foreach (var offset in evt.ReminderOffsets)
                {
                    var triggerTime = startUtc.AddMinutes(-offset.MinutesBefore);

                    if (nowUtc >= triggerTime && nowUtc <= startUtc.AddMinutes(30))
                    {
                        string reminderType = $"EventReminder_{evt.Id}_{offset.MinutesBefore}m";

                        bool exists = await context.ReminderLogs
                            .AnyAsync(r => r.CalendarEventId == evt.Id && r.ReminderType == reminderType, cancellationToken);

                        if (exists) continue;

                        var reminderLog = new ReminderLog
                        {
                            CalendarEventId = evt.Id,
                            ReminderType = reminderType,
                            SentAt = DateTime.UtcNow
                        };
                        context.ReminderLogs.Add(reminderLog);

                        try
                        {
                            await context.SaveChangesAsync(cancellationToken);
                        }
                        catch (DbUpdateException)
                        {
                            context.Entry(reminderLog).State = EntityState.Detached;
                            continue;
                        }

                        // Danh sách người nhận: Ban tổ chức + Tất cả người tham gia
                        var recipients = new HashSet<Guid> { evt.OrganizerId };
                        foreach (var p in evt.Participants)
                        {
                            recipients.Add(p.UserId);
                        }

                        string timeText = offset.MinutesBefore >= 1440
                            ? $"{offset.MinutesBefore / 1440} ngày"
                            : offset.MinutesBefore >= 60
                                ? $"{offset.MinutesBefore / 60} giờ"
                                : $"{offset.MinutesBefore} phút";

                        string title = $"SẮP DIỄN RA SỰ KIỆN: {evt.Title}";
                        string message = $"Sự kiện [{evt.Title}] sẽ diễn ra trong vòng {timeText} tới ({evt.StartDateTime:dd/MM/yyyy HH:mm}). Địa điểm: {evt.Location ?? "UBND Xã"}.";

                        foreach (var userId in recipients)
                        {
                            var notification = new Notification
                            {
                                UserId = userId,
                                CalendarEventId = evt.Id,
                                Type = NotificationType.EventReminder,
                                Channel = NotificationChannel.InApp,
                                Title = title,
                                Message = message,
                                SentAt = DateTime.UtcNow,
                                IsRead = false
                            };

                            context.Notifications.Add(notification);
                            await context.SaveChangesAsync(cancellationToken);

                            await BroadcastNotificationAsync(hubContext, userId, notification);
                            if (webPushService != null)
                            {
                                await webPushService.SendNotificationAsync(userId, title, message, "/", new { calendarEventId = evt.Id }, cancellationToken);
                            }
                        }
                    }
                }
            }
        }

        private static async Task BroadcastNotificationAsync(
            IHubContext<NotificationHub> hubContext,
            Guid userId,
            Notification notification)
        {
            var dto = new
            {
                id = notification.Id,
                userId = notification.UserId,
                taskItemId = notification.TaskItemId,
                calendarEventId = notification.CalendarEventId,
                type = notification.Type.ToString(),
                channel = notification.Channel.ToString(),
                title = notification.Title,
                message = notification.Message,
                createdAt = notification.CreatedAt,
                isRead = notification.IsRead
            };

            await hubContext.Clients.User(userId.ToString()).SendAsync("ReceiveNotification", dto);
        }
    }
}
