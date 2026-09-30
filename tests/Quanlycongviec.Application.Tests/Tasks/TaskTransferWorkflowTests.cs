using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Services;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Tests.Tasks;

public sealed class TaskTransferWorkflowTests
{
    [Fact]
    public async Task Transfer_UpdatesCoordinationReviewerAndHistory_AndRetryDoesNotDuplicate()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var replacement = new User { Username = "new_lead", FullName = "Chủ trì mới", Email = "new@example.invalid", PrimaryDepartment = f.Officer.PrimaryDepartment };
        f.Db.Users.Add(replacement); await f.Db.SaveChangesAsync();
        var command = f.Command();
        command.CoordinationTasks.Add(new() { Title = "Phần phối hợp", Requirements = "Số liệu", AssigneeId = f.Other.Id, DueDate = command.DueDate });
        var rootId = await f.Create.CreateAsync(command, default);
        var root = await f.Db.TaskItems.SingleAsync(t => t.Id == rootId);
        var child = await f.Db.TaskItems.SingleAsync(t => t.ParentTaskId == rootId);
        await f.Change(root, f.Officer.Id, "InProgress");
        await f.Change(child, f.Other.Id, "InProgress");
        await f.Change(child, f.Other.Id, "InReview", note: "Số liệu được giữ lại");
        var request = new TaskTransferInput { RequestId = Guid.NewGuid(), Version = root.Version, TargetUserId = replacement.Id, Reason = "Đổi cán bộ phụ trách" };
        await f.Execute.TransferAsync(rootId, f.Leader.Id, request, default);
        var notificationCount = await f.Db.Notifications.CountAsync();
        await f.Execute.TransferAsync(rootId, f.Leader.Id, request, default);
        Assert.Equal(notificationCount, await f.Db.Notifications.CountAsync());
        Assert.Equal(replacement.Id, root.AssigneeId);
        Assert.Equal(TaskStatusEnum.Todo, root.Status);
        Assert.Equal(replacement.Id, child.ReviewerId);
        Assert.Equal(TaskStatusEnum.InReview, child.Status);
        Assert.Equal("Số liệu được giữ lại", (await f.Db.TaskSubmissions.SingleAsync()).Note);
        Assert.Single(await f.Db.TaskWorkflowChanges.Where(c => c.TaskItemId == rootId && c.Kind == "AssigneeChanged").ToListAsync());
    }

    [Fact]
    public async Task Transfer_RejectsStaleVersionAndPendingReview_AndCannotCreateSelfReviewer()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var task = await f.AddTask();
        var oldVersion = task.Version;
        await f.Change(task, f.Officer.Id, "InProgress");
        await Assert.ThrowsAsync<WorkflowConflictException>(() => f.Execute.TransferAsync(task.Id, f.Leader.Id,
            new() { RequestId = Guid.NewGuid(), Version = oldVersion, TargetUserId = f.Other.Id, Reason = "Lý do" }, default));
        await Assert.ThrowsAsync<ArgumentException>(() => f.Execute.TransferAsync(task.Id, f.Leader.Id,
            new() { RequestId = Guid.NewGuid(), Version = task.Version, TargetUserId = f.Other.Id, ReviewerId = f.Other.Id, Reason = "Lý do" }, default));
        await f.Change(task, f.Officer.Id, "InReview", note: "Kết quả" );
        await Assert.ThrowsAsync<WorkflowConflictException>(() => f.Execute.TransferAsync(task.Id, f.Leader.Id,
            new() { RequestId = Guid.NewGuid(), Version = task.Version, TargetUserId = f.Other.Id, Reason = "Lý do" }, default));
        Assert.Equal(f.Officer.Id, task.AssigneeId);
    }
}
