using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Services;
using Quanlycongviec.Application.Features.SubTasks.Commands.CreateSubTask;
using Quanlycongviec.Application.Features.SubTasks.Commands.ToggleSubTask;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Tests.Tasks;

public sealed class ChecklistWorkflowTests
{
    [Fact]
    public async Task RetryCreateAndSet_PreservesOneChecklist_WithoutFinishingTask()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var task = new TaskItem { Title = "Theo dõi", AssignerId = f.Deputy.Id, AssigneeId = f.Officer.Id, Status = TaskStatusEnum.InProgress };
        f.Db.TaskItems.Add(task); await f.Db.SaveChangesAsync();
        var creator = new CreateSubTaskCommandHandler(f.Db, f.Authorization);
        var create = new CreateSubTaskCommand(task.Id, "Kiểm tra nguồn", f.Officer.Id) { RequestId = Guid.NewGuid(), Version = task.Version };
        var id = await creator.Handle(create, default);
        Assert.Equal(id, await creator.Handle(create, default));
        Assert.Single(await f.Db.SubTasks.ToListAsync());
        var handler = new ToggleSubTaskCommandHandler(f.Db, f.Authorization);
        var set = new ToggleSubTaskCommand(id, f.Officer.Id) { TaskItemId = task.Id, RequestId = Guid.NewGuid(), Version = task.Version, IsCompleted = true };
        Assert.True(await handler.Handle(set, default));
        Assert.True(await handler.Handle(set, default));
        Assert.True((await f.Db.SubTasks.SingleAsync()).IsCompleted);
        Assert.Equal(100, task.ProgressPercentage); Assert.Equal(TaskStatusEnum.InProgress, task.Status);
    }

    [Fact]
    public async Task Checklist_RejectsStaleVersionAndReadOnlyActor()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var task = new TaskItem { Title = "Theo dõi", AssignerId = f.Deputy.Id, AssigneeId = f.Officer.Id, Status = TaskStatusEnum.InProgress };
        f.Db.TaskItems.Add(task); await f.Db.SaveChangesAsync();
        var creator = new CreateSubTaskCommandHandler(f.Db, f.Authorization);
        await Assert.ThrowsAsync<WorkflowConflictException>(() => creator.Handle(new(task.Id, "Bản cũ", f.Officer.Id)
            { RequestId = Guid.NewGuid(), Version = Guid.NewGuid() }, default));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => creator.Handle(new(task.Id, "Người xem", f.Deputy.Id)
            { RequestId = Guid.NewGuid(), Version = task.Version }, default));
        Assert.Empty(await f.Db.SubTasks.ToListAsync());
    }
}
