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
                var zaloService = scope.ServiceProvider.GetRequiredService<IZaloNotificationService>();

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
                            context, hubContext, zaloService, task, reminderType,
                            typeEnum,
                            $"Nhắc việc sắp tới hạn ({task.Title})",
                            $"Công việc [{task.Title}] sẽ hết hạn trong vòng {(timeUntilDue.TotalHours <= 24 ? "1 ngày" : "3 ngày")}. Vui lòng kiểm tra tiến độ.",
                            notifyAssigner: true, notifyAssignee: true, cancellationToken);
                    }

                    // 2. Nhắc nhở quá hạn
                    if (nowUtc > dueDateUtc)
                    {
                        await TrySendReminderAsync(
                            context, hubContext, zaloService, task, "Overdue",
                            NotificationType.Overdue,
                            $"CẢNH BÁO TRỄ HẠN: {task.Title}",
                            $"Công việc [{task.Title}] đã quá hạn từ ngày {task.DueDate:dd/MM/yyyy HH:mm}. Cần xử lý ngay!",
                            notifyAssigner: true, notifyAssignee: true, cancellationToken);
                    }

                    // 3. Leo thang công việc khẩn (Urgent + Quá hạn + chưa Leo thang)
                    if (task.Priority == TaskPriority.Urgent && nowUtc > dueDateUtc && !task.IsEscalated)
                    {
                        await HandleEscalationAsync(context, hubContext, zaloService, task, cancellationToken);
                    }
                }

                // 4. Tổng hợp định kỳ sáng thứ Hai (Asia/Ho_Chi_Minh)
                await ProcessWeeklySummaryAsync(context, hubContext, zaloService, nowUtc, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi khi xử lý vòng lặp nhắc việc tự động.");
            }
        }

        private async Task TrySendReminderAsync(
            ApplicationDbContext context,
            IHubContext<NotificationHub> hubContext,
            IZaloNotificationService zaloService,
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

                // Zalo ZNS fallback nếu có sđt
                var user = await context.Users.FindAsync(new object[] { userId }, cancellationToken);
                if (user != null && !string.IsNullOrWhiteSpace(user.ZaloPhoneNumber))
                {
                    await zaloService.SendZnsAsync(user.ZaloPhoneNumber, "REMINDER_TEMPLATE", new { title, message });
                }
            }
        }

        private async Task HandleEscalationAsync(
            ApplicationDbContext context,
            IHubContext<NotificationHub> hubContext,
            IZaloNotificationService zaloService,
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
                    Title = $"🚨 LEO THANG CÔNG VIỆC KHẨN TRỄ HẠN: {task.Title}",
                    Message = $"Nhiệm vụ KHẨN KẤP [{task.Title}] đã trễ hạn và được tự động leo thang tới Lãnh đạo quản lý trực tiếp.",
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                };

                context.Notifications.Add(notification);
                await context.SaveChangesAsync(cancellationToken);

                await BroadcastNotificationAsync(hubContext, userId, notification);
            }
        }

        private async Task ProcessWeeklySummaryAsync(
            ApplicationDbContext context,
            IHubContext<NotificationHub> hubContext,
            IZaloNotificationService zaloService,
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
                    Title = $"📋 Tóm tắt công việc thường xuyên (BAU) tuần {calendarWeek}",
                    Message = $"Đồng chí hiện có {taskCount} nhiệm vụ thường xuyên (BAU) cần tập trung hoàn thành trong tuần này.",
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                };

                context.Notifications.Add(notification);
                await context.SaveChangesAsync(cancellationToken);

                await BroadcastNotificationAsync(hubContext, userId, notification);
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
