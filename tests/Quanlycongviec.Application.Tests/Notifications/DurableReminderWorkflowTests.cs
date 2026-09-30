using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;

namespace Quanlycongviec.Application.Tests.Notifications;

public sealed class DurableReminderWorkflowTests
{
    [Theory]
    [InlineData("event")]
    [InlineData("daily")]
    [InlineData("weekly")]
    public async Task DeliveryOutage_AllRecipientsRemainDurable_AndRestartDoesNotDuplicate(string kind)
    {
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var leader = new User { Username = "leader", Email = "leader@example.invalid" };
        var officer = new User { Username = "officer", Email = "officer@example.invalid" };
        db.Users.AddRange(leader, officer);
        var now = kind == "weekly" ? new DateTimeOffset(2026, 10, 5, 0, 35, 0, TimeSpan.Zero) : new DateTimeOffset(2026, 10, 6, 0, 35, 0, TimeSpan.Zero);
        if (kind == "event")
        {
            var evt = new CalendarEvent { Title = "Lịch thử", OrganizerId = leader.Id, StartDateTime = now.UtcDateTime.AddMinutes(20), EndDateTime = now.UtcDateTime.AddHours(1) };
            evt.Participants.Add(new EventParticipant { UserId = officer.Id });
            evt.ReminderOffsets.Add(new EventReminderOffset { MinutesBefore = 30 });
            db.CalendarEvents.Add(evt);
        }
        else foreach (var user in new[] { leader, officer }) db.TaskItems.Add(new TaskItem { AssignerId = leader.Id, AssigneeId = user.Id,
            Title = "Chờ thực hiện", DueDate = now.UtcDateTime.AddDays(5), Type = TaskType.BAU });
        await db.SaveChangesAsync();
        var dispatcher = new Mock<INotificationDispatcher>();
        dispatcher.Setup(x => x.DispatchAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("Fixture transport unavailable"));
        var services = new ServiceCollection().AddSingleton(db).AddSingleton(dispatcher.Object).BuildServiceProvider();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["DailyDigest:Enabled"] = kind == "weekly" ? "false" : "true" }).Build();
        TaskReminderBackgroundService Service() => new(services, NullLogger<TaskReminderBackgroundService>.Instance, config, new FixedClock(now));
        await Service().ProcessRemindersAsync();
        Assert.Equal(2, await db.Notifications.CountAsync());
        Assert.All(await db.Notifications.ToListAsync(), n => Assert.True(n.RequiresRealtimeDelivery));
        Assert.Equal(new[] { leader.Id, officer.Id }.Order(), (await db.Notifications.Select(n => n.UserId).ToListAsync()).Order());
        db.ChangeTracker.Clear();
        await Service().ProcessRemindersAsync();
        Assert.Equal(2, await db.Notifications.CountAsync());
    }

    [Fact]
    public async Task RescheduledEvent_RemindsAgainForNewTime_OnlyCurrentParticipants()
    {
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner = new User { Username = "owner", Email = "owner@example.invalid" };
        var removed = new User { Username = "removed", Email = "removed@example.invalid" };
        db.Users.AddRange(owner, removed);
        var now = new DateTimeOffset(2026, 10, 6, 3, 0, 0, TimeSpan.Zero);
        var evt = new CalendarEvent { Title = "Thay giờ họp", OrganizerId = owner.Id, StartDateTime = now.UtcDateTime.AddMinutes(20), EndDateTime = now.UtcDateTime.AddHours(1) };
        var participant = new EventParticipant { UserId = removed.Id }; evt.Participants.Add(participant);
        evt.ReminderOffsets.Add(new EventReminderOffset { MinutesBefore = 30 });
        db.CalendarEvents.Add(evt); await db.SaveChangesAsync();
        var dispatcher = new NotificationDispatcherService(db, Mock.Of<IRealtimePublisherService>(), Mock.Of<IWebPushNotificationService>());
        var services = new ServiceCollection().AddSingleton(db).AddSingleton<INotificationDispatcher>(dispatcher).BuildServiceProvider();
        var clock = new FixedClock(now);
        var service = new TaskReminderBackgroundService(services, NullLogger<TaskReminderBackgroundService>.Instance, new ConfigurationBuilder().Build(), clock);
        await service.ProcessRemindersAsync();
        Assert.Equal(2, await db.Notifications.CountAsync());
        evt.StartDateTime = evt.StartDateTime.AddHours(1); evt.EndDateTime = evt.EndDateTime.AddHours(1); evt.Version = Guid.NewGuid();
        participant.IsDeleted = true; await db.SaveChangesAsync();
        clock.Now = clock.Now.AddHours(1);
        await service.ProcessRemindersAsync();
        Assert.Equal(3, await db.Notifications.CountAsync());
        Assert.Equal(1, await db.Notifications.CountAsync(n => n.UserId == removed.Id));
    }

    [Fact]
    public async Task UrgentEscalation_PersistsBeforeTransport_OnlyToResponsibleAssigner()
    {
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner = new User { Username = "owner" }; var officer = new User { Username = "officer" };
        var unrelatedLeader = new User { Username = "other" };
        var role = new Role { Code = "LEADER", RankLevel = 1 };
        unrelatedLeader.UserRoles.Add(new UserRole { User = unrelatedLeader, Role = role });
        db.Users.AddRange(owner, officer, unrelatedLeader);
        var now = new DateTimeOffset(2026, 10, 6, 3, 0, 0, TimeSpan.Zero);
        var task = new TaskItem { Title = "Khẩn", AssignerId = owner.Id, AssigneeId = officer.Id, Priority = TaskPriority.Urgent, DueDate = now.UtcDateTime.AddHours(-1) };
        db.TaskItems.Add(task); await db.SaveChangesAsync();
        var broken = new Mock<INotificationDispatcher>();
        broken.Setup(x => x.DispatchAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("Fixture offline"));
        var services = new ServiceCollection().AddSingleton(db).AddSingleton(broken.Object).BuildServiceProvider();
        TaskReminderBackgroundService Service() => new(services, NullLogger<TaskReminderBackgroundService>.Instance, new ConfigurationBuilder().Build(), new FixedClock(now));
        await Service().ProcessRemindersAsync();
        var escalation = Assert.Single(await db.Notifications.Where(n => n.Type == NotificationType.Escalation).ToListAsync());
        Assert.Equal(owner.Id, escalation.UserId); Assert.True(escalation.RequiresRealtimeDelivery);
        Assert.True((await db.TaskItems.SingleAsync()).IsEscalated);
        db.ChangeTracker.Clear(); await Service().ProcessRemindersAsync();
        Assert.Single(await db.Notifications.Where(n => n.Type == NotificationType.Escalation).ToListAsync());
    }

    [Theory]
    [InlineData("completed")]
    [InlineData("transferred")]
    [InlineData("deadline")]
    [InlineData("reviewer")]
    [InlineData("event")]
    public async Task DeliveryRetry_DiscardsObsoleteReminder(string change)
    {
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner = new User { Username = "owner" }; var officer = new User { Username = "officer" };
        db.Users.AddRange(owner, officer);
        var now = new DateTimeOffset(2026, 10, 6, 3, 0, 0, TimeSpan.Zero);
        var task = new TaskItem { Title = "Nộp báo cáo", AssignerId = owner.Id, AssigneeId = officer.Id, ReviewerId = owner.Id, DueDate = now.UtcDateTime.AddHours(-1) };
        CalendarEvent? evt = null;
        if (change == "event")
        {
            evt = new CalendarEvent { OrganizerId = owner.Id, Title = "Cuộc họp", StartDateTime = now.UtcDateTime.AddMinutes(20), EndDateTime = now.UtcDateTime.AddHours(1) };
            evt.ReminderOffsets.Add(new EventReminderOffset { MinutesBefore = 30 }); db.CalendarEvents.Add(evt);
        }
        else
        {
            db.TaskItems.Add(task);
            if (change == "reviewer")
            {
                task.Status = TaskStatusEnum.InReview;
                db.TaskSubmissions.Add(new TaskSubmission { TaskItemId = task.Id, SubmittedById = officer.Id, Note = "Kết quả" });
            }
        }
        await db.SaveChangesAsync();
        var broken = new Mock<INotificationDispatcher>();
        broken.Setup(x => x.DispatchAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("Fixture offline"));
        var services = new ServiceCollection().AddSingleton(db).AddSingleton(broken.Object).BuildServiceProvider();
        await new TaskReminderBackgroundService(services, NullLogger<TaskReminderBackgroundService>.Instance, new ConfigurationBuilder().Build(), new FixedClock(now)).ProcessRemindersAsync();
        Assert.Single(await db.Notifications.ToListAsync());
        if (change == "completed") task.Status = TaskStatusEnum.Completed;
        if (change == "transferred") task.AssigneeId = owner.Id;
        if (change == "deadline") task.DueDate = now.UtcDateTime.AddDays(3);
        if (change == "reviewer") task.ReviewerId = officer.Id;
        if (evt != null) { evt.Version = Guid.NewGuid(); evt.StartDateTime = evt.StartDateTime.AddDays(1); }
        await db.SaveChangesAsync();
        var publisher = new Mock<IRealtimePublisherService>();
        var live = new NotificationDispatcherService(db, publisher.Object, Mock.Of<IWebPushNotificationService>());
        var retryServices = new ServiceCollection().AddSingleton<IApplicationDbContext>(db).AddSingleton<INotificationDispatcher>(live).BuildServiceProvider();
        await new WorkflowNotificationDeliveryService(retryServices.GetRequiredService<IServiceScopeFactory>(), NullLogger<WorkflowNotificationDeliveryService>.Instance).DeliverPendingAsync();
        publisher.Verify(x => x.PublishToUserAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<object>(), It.IsAny<CancellationToken>()), Times.Never);
        var obsolete = await db.Notifications.SingleAsync();
        Assert.False(obsolete.RequiresRealtimeDelivery); Assert.True(obsolete.IsDeleted);
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = now;
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
