using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Hubs;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Notifications
{
    public class TaskReminderBackgroundServiceTests
    {
        private readonly DbContextOptions<ApplicationDbContext> _dbOptions;

        public TaskReminderBackgroundServiceTests()
        {
            _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
        }

        private IServiceProvider CreateServiceProvider(ApplicationDbContext context, INotificationDispatcher? dispatcher = null)
        {
            var services = new ServiceCollection();
            services.AddSingleton(context);

            var dispatcherMock = new Mock<INotificationDispatcher>();
            dispatcherMock
                .Setup(d => d.DispatchAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
                .Returns<Notification, CancellationToken>(async (notif, ct) =>
                {
                    context.Notifications.Add(notif);
                    await context.SaveChangesAsync(ct);
                });
            services.AddSingleton(dispatcher ?? dispatcherMock.Object);
            
            var hubContextMock = new Mock<IHubContext<NotificationHub>>();
            var clientsMock = new Mock<IHubClients>();
            var clientProxyMock = new Mock<IClientProxy>();
            clientsMock.Setup(c => c.User(It.IsAny<string>())).Returns(clientProxyMock.Object);
            hubContextMock.Setup(h => h.Clients).Returns(clientsMock.Object);
            services.AddSingleton(hubContextMock.Object);

            var zaloServiceMock = new Mock<IZaloNotificationService>();
            services.AddSingleton(zaloServiceMock.Object);

            var webPushServiceMock = new Mock<IWebPushNotificationService>();
            services.AddSingleton(webPushServiceMock.Object);

            return services.BuildServiceProvider();
        }

        [Fact]
        public async Task ProcessRemindersAsync_ShouldNotSendDuplicateReminders_WhenScannedMultipleTimes()
        {
            // Arrange
            using var context = new ApplicationDbContext(_dbOptions);

            var assigner = new User { Id = Guid.NewGuid(), Username = "chutich", Email = "chutich@ubnd.gov.vn" };
            var assignee = new User { Id = Guid.NewGuid(), Username = "canbo1", Email = "canbo1@ubnd.gov.vn" };
            context.Users.AddRange(assigner, assignee);

            var overdueTask = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Báo cáo thu ngân sách trễ hạn",
                Description = "Quá hạn 1 ngày",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                Status = TaskStatusEnum.InProgress,
                Priority = TaskPriority.High,
                Type = TaskType.BAU,
                DueDate = DateTime.UtcNow.AddDays(-1),
                EstimatedEffortHours = 8.0
            };
            context.TaskItems.Add(overdueTask);
            await context.SaveChangesAsync();

            var serviceProvider = CreateServiceProvider(context);
            var configuration = new ConfigurationBuilder().Build();
            var service = new TaskReminderBackgroundService(serviceProvider, NullLogger<TaskReminderBackgroundService>.Instance, configuration);

            // Act 1: Lần quét đầu tiên
            await service.ProcessRemindersAsync(CancellationToken.None);

            // Assert 1: Đã tạo ReminderLog cho Overdue
            var logCountFirst = await context.ReminderLogs.CountAsync(r => r.TaskItemId == overdueTask.Id && r.ReminderType == "Overdue");
            logCountFirst.Should().Be(1);

            var notificationsFirst = await context.Notifications.CountAsync(n => n.TaskItemId == overdueTask.Id);
            notificationsFirst.Should().BeGreaterThan(0);

            // Act 2: Lần quét thứ hai (giả lập vòng lặp kế tiếp)
            await service.ProcessRemindersAsync(CancellationToken.None);

            // Assert 2: Không được tạo thêm ReminderLog hay Notification trùng lặp
            var logCountSecond = await context.ReminderLogs.CountAsync(r => r.TaskItemId == overdueTask.Id && r.ReminderType == "Overdue");
            logCountSecond.Should().Be(1);

            var notificationsSecond = await context.Notifications.CountAsync(n => n.TaskItemId == overdueTask.Id);
            notificationsSecond.Should().Be(notificationsFirst);
        }

        [Fact]
        public async Task HandleEscalation_ShouldSetIsEscalatedTrue_OnlyOnceForUrgentOverdueTask()
        {
            // Arrange
            using var context = new ApplicationDbContext(_dbOptions);

            var dept = new Department { Id = Guid.NewGuid(), Name = "Văn phòng HĐND & UBND", Code = "VAN_PHONG" };
            var assigner = new User { Id = Guid.NewGuid(), Username = "chutich", Email = "chutich@ubnd.gov.vn" };
            var assignee = new User { Id = Guid.NewGuid(), Username = "canbo1", Email = "canbo1@ubnd.gov.vn" };
            context.Departments.Add(dept);
            context.Users.AddRange(assigner, assignee);

            var urgentOverdueTask = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Chỉ đạo ứng phó bão lũ khẩn cấp",
                Description = "Giao khẩn cấp",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                DepartmentId = dept.Id,
                Status = TaskStatusEnum.InProgress,
                Priority = TaskPriority.Urgent,
                Type = TaskType.AdHoc,
                DueDate = DateTime.UtcNow.AddHours(-2),
                IsEscalated = false,
                EstimatedEffortHours = 4.0
            };
            context.TaskItems.Add(urgentOverdueTask);
            await context.SaveChangesAsync();

            var serviceProvider = CreateServiceProvider(context);
            var configuration = new ConfigurationBuilder().Build();
            var service = new TaskReminderBackgroundService(serviceProvider, NullLogger<TaskReminderBackgroundService>.Instance, configuration);

            // Act 1: Chạy leo thang lần 1
            await service.ProcessRemindersAsync(CancellationToken.None);

            // Assert 1: Task đã được set IsEscalated = true
            var taskInDb = await context.TaskItems.FindAsync(urgentOverdueTask.Id);
            taskInDb!.IsEscalated.Should().BeTrue();

            var escalationLogsCount1 = await context.ReminderLogs.CountAsync(r => r.TaskItemId == urgentOverdueTask.Id && r.ReminderType == "Escalation");
            escalationLogsCount1.Should().Be(1);

            // Act 2: Chạy quét lần 2
            await service.ProcessRemindersAsync(CancellationToken.None);

            // Assert 2: IsEscalated vẫn true, không tạo thêm log leo thang
            var escalationLogsCount2 = await context.ReminderLogs.CountAsync(r => r.TaskItemId == urgentOverdueTask.Id && r.ReminderType == "Escalation");
            escalationLogsCount2.Should().Be(1);
        }

        [Fact]
        public async Task ProcessRemindersAsync_ShouldUse48HourReminderInsteadOfThreeDayReminder()
        {
            using var context = new ApplicationDbContext(_dbOptions);
            var assigner = new User { Id = Guid.NewGuid(), Username = "reminder_assigner", Email = "reminder.assigner@test.local" };
            var assignee = new User { Id = Guid.NewGuid(), Username = "reminder_assignee", Email = "reminder.assignee@test.local" };
            context.Users.AddRange(assigner, assignee);
            var vnNow = DateTime.UtcNow;
            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "48 hour reminder",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                Status = TaskStatusEnum.InProgress,
                DueDate = vnNow.AddHours(46)
            };
            context.TaskItems.Add(task);
            await context.SaveChangesAsync();

            var service = new TaskReminderBackgroundService(
                CreateServiceProvider(context),
                NullLogger<TaskReminderBackgroundService>.Instance,
                new ConfigurationBuilder().Build());

            await service.ProcessRemindersAsync(CancellationToken.None);

            (await context.ReminderLogs.AnyAsync(r => r.TaskItemId == task.Id && r.ReminderType == "BeforeDeadline48h"))
                .Should().BeTrue();
            (await context.ReminderLogs.AnyAsync(r => r.TaskItemId == task.Id && r.ReminderType == "BeforeDeadline3d"))
                .Should().BeFalse();
        }

        [Fact]
        public async Task ProcessRemindersAsync_ShouldIgnoreDeletedTasks()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            using var context = new ApplicationDbContext(options);
            var assigner = new User { Id = Guid.NewGuid(), Username = "deleted_assigner", Email = "deleted.assigner@test.local" };
            var assignee = new User { Id = Guid.NewGuid(), Username = "deleted_assignee", Email = "deleted.assignee@test.local" };
            context.Users.AddRange(assigner, assignee);
            var vnNow = DateTime.UtcNow.AddHours(7);
            var deletedTask = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Deleted task",
                AssignerId = assigner.Id,
                AssigneeId = assignee.Id,
                Status = TaskStatusEnum.InProgress,
                DueDate = vnNow.AddHours(20),
                IsDeleted = true
            };
            context.TaskItems.Add(deletedTask);
            await context.SaveChangesAsync();

            var service = new TaskReminderBackgroundService(
                CreateServiceProvider(context),
                NullLogger<TaskReminderBackgroundService>.Instance,
                new ConfigurationBuilder().Build());

            await service.ProcessRemindersAsync(CancellationToken.None);

            (await context.ReminderLogs.AnyAsync(r => r.TaskItemId == deletedTask.Id))
                .Should().BeFalse();
        }

        private sealed class TestClock : TimeProvider
        {
            public DateTimeOffset Now { get; set; } = new(2026, 9, 11, 3, 0, 0, TimeSpan.Zero);
            public override DateTimeOffset GetUtcNow() => Now;
        }

        [Fact]
        public async Task FailedDelivery_ShouldRetryAfterRestart_WithoutDuplicatingSavedNotifications()
        {
            using var context = new ApplicationDbContext(_dbOptions);
            var clock = new TestClock();
            var leader = new User { Username = "retry_leader", Email = "retry.leader@test.local" };
            var staff = new User { Username = "retry_staff", Email = "retry.staff@test.local" };
            context.Users.AddRange(leader, staff);
            var task = new TaskItem
            {
                Title = "Retry",
                AssignerId = leader.Id,
                AssigneeId = staff.Id,
                DueDate = clock.Now.UtcDateTime.AddHours(-1),
                Status = TaskStatusEnum.InProgress
            };
            context.TaskItems.Add(task);
            await context.SaveChangesAsync();
            var real = new NotificationDispatcherService(context, Mock.Of<IRealtimePublisherService>(), Mock.Of<IWebPushNotificationService>());
            var failOnce = true;
            var dispatcher = new Mock<INotificationDispatcher>();
            dispatcher.Setup(d => d.DispatchAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>()))
                .Returns<Notification, CancellationToken>(async (notification, ct) =>
                {
                    if (notification.UserId == leader.Id && failOnce)
                    {
                        failOnce = false;
                        throw new InvalidOperationException("Temporary persistence failure");
                    }
                    await real.DispatchAsync(notification, ct);
                });
            var config = new ConfigurationBuilder().Build();
            await new TaskReminderBackgroundService(CreateServiceProvider(context, dispatcher.Object),
                NullLogger<TaskReminderBackgroundService>.Instance, config, clock).ProcessRemindersAsync();
            (await context.Notifications.CountAsync()).Should().Be(1);
            (await context.ReminderLogs.SingleAsync()).SentAt.Should().Be(DateTime.UnixEpoch);
            context.ChangeTracker.Clear();
            await new TaskReminderBackgroundService(CreateServiceProvider(context, dispatcher.Object),
                NullLogger<TaskReminderBackgroundService>.Instance, config, clock).ProcessRemindersAsync();
            (await context.Notifications.CountAsync()).Should().Be(2);
            (await context.ReminderLogs.SingleAsync()).SentAt.Should().Be(clock.Now.UtcDateTime);
        }

        [Fact]
        public async Task ReviewWithoutDeadline_ShouldNotifyLeader_WhileTwelveHourReminderUsesUtc()
        {
            using var context = new ApplicationDbContext(_dbOptions);
            var clock = new TestClock();
            var leader = new User { Username = "utc_leader", Email = "utc.leader@test.local" };
            var staff = new User { Username = "utc_staff", Email = "utc.staff@test.local" };
            context.Users.AddRange(leader, staff);
            var review = new TaskItem { Title = "No deadline review", AssignerId = leader.Id, AssigneeId = staff.Id, Status = TaskStatusEnum.InReview };
            var due = new TaskItem
            {
                Title = "Twelve hours",
                AssignerId = leader.Id,
                AssigneeId = staff.Id,
                DueDate = clock.Now.UtcDateTime.AddHours(10),
                Status = TaskStatusEnum.InProgress
            };
            context.TaskItems.AddRange(review, due);
            await context.SaveChangesAsync();
            await new TaskReminderBackgroundService(CreateServiceProvider(context), NullLogger<TaskReminderBackgroundService>.Instance,
                new ConfigurationBuilder().Build(), clock).ProcessRemindersAsync();
            (await context.Notifications.SingleAsync(n => n.TaskItemId == review.Id)).UserId.Should().Be(leader.Id);
            (await context.ReminderLogs.SingleAsync(r => r.TaskItemId == due.Id)).ReminderType.Should().Be("BeforeDeadline12h");
            (await context.Notifications.AnyAsync(n => n.Type == NotificationType.Overdue)).Should().BeFalse();
        }

        [Fact]
        public async Task RecurringReminder_ShouldRepeatAfterInterval_StopAfterAcceptance_AndNotifyReviewerOnly()
        {
            using var context = new ApplicationDbContext(_dbOptions);
            var clock = new TestClock();
            var assigner = new User { Username = "leader", Email = "leader@test.local" };
            var assignee = new User { Username = "staff", Email = "staff@test.local" };
            context.Users.AddRange(assigner, assignee);
            var task = new TaskItem { Title = "Review cycle", AssignerId = assigner.Id, AssigneeId = assignee.Id, DueDate = clock.Now.UtcDateTime.AddHours(-1), Status = TaskStatusEnum.InProgress };
            var cancelled = new TaskItem { Title = "Cancelled", AssignerId = assigner.Id, AssigneeId = assignee.Id, DueDate = task.DueDate, Status = TaskStatusEnum.Cancelled };
            context.TaskItems.AddRange(task, cancelled);
            await context.SaveChangesAsync();
            var config = new ConfigurationBuilder().AddInMemoryCollection(new[] { new System.Collections.Generic.KeyValuePair<string, string?>("DailyDigest:Enabled", "false") }).Build();
            var service = new TaskReminderBackgroundService(CreateServiceProvider(context), NullLogger<TaskReminderBackgroundService>.Instance, config, clock);
            await service.ProcessRemindersAsync();
            (await context.Notifications.CountAsync(n => n.TaskItemId == task.Id)).Should().Be(2);
            (await context.Notifications.CountAsync(n => n.TaskItemId == cancelled.Id)).Should().Be(0);
            await service.ProcessRemindersAsync();
            (await context.Notifications.CountAsync(n => n.TaskItemId == task.Id)).Should().Be(2);
            clock.Now = clock.Now.AddHours(25);
            await service.ProcessRemindersAsync();
            (await context.Notifications.CountAsync(n => n.TaskItemId == task.Id)).Should().Be(4);
            task.Status = TaskStatusEnum.InReview;
            await context.SaveChangesAsync();
            await service.ProcessRemindersAsync();
            (await context.Notifications.CountAsync(n => n.TaskItemId == task.Id)).Should().Be(5);
            (await context.Notifications.Where(n => n.Title.StartsWith("Chờ nghiệm thu")).SingleAsync()).UserId.Should().Be(assigner.Id);
            task.Status = TaskStatusEnum.Completed;
            await context.SaveChangesAsync();
            clock.Now = clock.Now.AddHours(25);
            await service.ProcessRemindersAsync();
            (await context.Notifications.CountAsync(n => n.TaskItemId == task.Id)).Should().Be(5);
        }
    }
}
