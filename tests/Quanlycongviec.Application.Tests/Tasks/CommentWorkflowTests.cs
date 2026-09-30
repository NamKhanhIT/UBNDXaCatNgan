using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Comments.Commands.CreateComment;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Services;

namespace Quanlycongviec.Application.Tests.Tasks;

public sealed class CommentWorkflowTests
{
    [Fact]
    public async Task MentionAll_IsLimitedToTaskReaders_AndRetryDoesNotDuplicate()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var task = await f.AddTask();
        var dispatcher = new NotificationDispatcherService(f.Db, Mock.Of<IRealtimePublisherService>(), Mock.Of<IWebPushNotificationService>());
        var handler = new CreateTaskCommentCommandHandler(f.Db, f.Authorization, dispatcher);
        var request = new CreateTaskCommentCommand { TaskId = task.Id, UserId = f.Officer.Id, RequestId = Guid.NewGuid(), Content = "@all Đã cập nhật nội dung" };
        var first = await handler.Handle(request, default);
        Assert.True(first.Success);
        Assert.False(await f.Db.Notifications.AnyAsync(n => n.Type == Domain.Enums.NotificationType.Comment && n.UserId == f.Other.Id));
        var retry = await handler.Handle(request, default);
        Assert.Equal(first.CommentId, retry.CommentId);
        Assert.Single(await f.Db.TaskComments.ToListAsync());
    }

    [Fact]
    public async Task Mention_TransportFailure_DoesNotLoseCommentOrNotification()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var task = await f.AddTask();
        var broken = new Mock<INotificationDispatcher>();
        broken.Setup(x => x.DispatchBatchAsync(It.IsAny<IEnumerable<Notification>>(), It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("Fixture disconnected"));
        broken.Setup(x => x.DispatchAsync(It.IsAny<Notification>(), It.IsAny<CancellationToken>())).ThrowsAsync(new InvalidOperationException("Fixture disconnected"));
        var handler = new CreateTaskCommentCommandHandler(f.Db, f.Authorization, broken.Object);
        var response = await handler.Handle(new() { TaskId = task.Id, UserId = f.Officer.Id, RequestId = Guid.NewGuid(), Content = "@fixture-leader Báo cáo" }, default);
        Assert.True(response.Success);
        Assert.Single(await f.Db.TaskComments.ToListAsync());
        Assert.Single(await f.Db.Notifications.Where(n => n.Type == Domain.Enums.NotificationType.Comment && n.RequiresRealtimeDelivery && n.UserId == f.Leader.Id).ToListAsync());
    }
}
