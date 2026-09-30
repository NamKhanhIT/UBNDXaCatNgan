using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Services;

namespace Quanlycongviec.Application.Tests.Tasks;

public sealed class WorkflowReminderTests
{
    [Fact]
    public async Task ReminderKey_ChangesWithReviewerAndSubmissionRound_AndStopsAfterAcceptance()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var task = await f.AddTask();
        await f.Change(task, f.Officer.Id, "InProgress");
        await f.Change(task, f.Officer.Id, "InReview", note: "Kết quả lần đầu");
        var dispatcher = Mock.Of<INotificationDispatcher>();
        var now = DateTime.UtcNow;
        Task Remind() => WorkflowTaskReminder.SendAsync(f.Db, dispatcher, task, now, 24,
            "PendingReview", NotificationType.BeforeDeadline, "REMINDER_TEST", "Nghiệm thu kết quả", default);
        await Remind(); await Remind();
        Assert.Equal(f.Leader.Id, (await f.Db.Notifications.SingleAsync(n => n.Title == "REMINDER_TEST")).UserId);
        await f.Execute.AmendAsync(task.Id, f.Leader.Id, new() { RequestId = Guid.NewGuid(), Version = task.Version,
            ReviewerId = f.Deputy.Id, Reason = "Chuyển người nghiệm thu có thẩm quyền" }, default);
        await Remind();
        Assert.Single(await f.Db.Notifications.Where(n => n.Title == "REMINDER_TEST" && n.UserId == f.Deputy.Id).ToListAsync());
        var first = await f.Db.TaskSubmissions.SingleAsync();
        await f.Change(task, f.Deputy.Id, "InProgress", reason: "Bổ sung căn cứ", submissionId: first.Id);
        await f.Change(task, f.Officer.Id, "InReview", note: "Kết quả lần hai");
        await Remind();
        Assert.Equal(3, await f.Db.ReminderLogs.CountAsync());
        var second = await f.Db.TaskSubmissions.SingleAsync(s => s.Decision == "Pending");
        await f.Change(task, f.Deputy.Id, "Completed", submissionId: second.Id);
        await Remind();
        Assert.Equal(3, await f.Db.ReminderLogs.CountAsync());
    }

    [Fact]
    public async Task CancellingParent_ClosesPendingCoordinationSubmissionWithReason()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var command = f.Command();
        command.CoordinationTasks.Add(new() { Title = "Số liệu phối hợp", Requirements = "Bảng số liệu", AssigneeId = f.Other.Id, DueDate = command.DueDate });
        var id = await f.Create.CreateAsync(command, default);
        var parent = await f.Db.TaskItems.SingleAsync(t => t.Id == id);
        var child = await f.Db.TaskItems.SingleAsync(t => t.ParentTaskId == id);
        await f.Change(child, f.Other.Id, "InProgress");
        await f.Change(child, f.Other.Id, "InReview", note: "Đã có số liệu");
        await f.Change(parent, f.Leader.Id, "Cancelled", reason: "Văn bản chỉ đạo đã thu hồi");
        Assert.Equal(TaskStatusEnum.Cancelled, child.Status);
        Assert.Contains("Văn bản chỉ đạo đã thu hồi", child.RejectionReason);
        var submission = await f.Db.TaskSubmissions.SingleAsync();
        Assert.Equal("Cancelled", submission.Decision);
        Assert.Equal("Đã có số liệu", submission.Note);
        Assert.Equal(f.Leader.Id, submission.ReviewedById);
        Assert.Equal("Văn bản chỉ đạo đã thu hồi", submission.ReviewNote);
    }
}
