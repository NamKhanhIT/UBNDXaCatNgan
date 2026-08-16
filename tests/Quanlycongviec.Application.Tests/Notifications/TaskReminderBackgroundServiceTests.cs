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

        private IServiceProvider CreateServiceProvider(ApplicationDbContext context)
        {
            var services = new ServiceCollection();
            services.AddSingleton(context);
            
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

            var assigner = new User { Id = Guid.NewGuid(), Username = "chutich", Email = "chutich@catngan.gov.vn" };
            var assignee = new User { Id = Guid.NewGuid(), Username = "canbo1", Email = "canbo1@catngan.gov.vn" };
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
            var assigner = new User { Id = Guid.NewGuid(), Username = "chutich", Email = "chutich@catngan.gov.vn" };
            var assignee = new User { Id = Guid.NewGuid(), Username = "canbo1", Email = "canbo1@catngan.gov.vn" };
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
    }
}
