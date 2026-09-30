using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Services;
using Quanlycongviec.Application.Features.Inbox.Commands.CreateInboxDocument;
using Quanlycongviec.Application.Features.TaskAnnotations.Queries.GetTaskReviewAnnotations;
using Quanlycongviec.Application.Features.Tasks.Queries.CalculateTaskSystemScore;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Tests.Tasks;

public sealed class WorkflowReviewRegressionTests
{
    [Fact]
    public async Task InactiveAssignee_CanBeReassignedByAuthorizedLeader_WithoutReactivatingAccount()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var task = await f.AddTask();
        f.Officer.IsDeleted = true; task.RequiresWorkflowReview = true; await f.Db.SaveChangesAsync();
        Assert.False(await f.Execute.TransferAsync(task.Id, f.Other.Id,
            new() { RequestId = Guid.NewGuid(), Version = task.Version, TargetUserId = f.Leader.Id, Reason = "Ngoài quyền" }, default));
        Assert.True(await f.Execute.TransferAsync(task.Id, f.Leader.Id,
            new() { RequestId = Guid.NewGuid(), Version = task.Version, TargetUserId = f.Other.Id, Reason = "Người cũ ngừng công tác" }, default));
        Assert.True(f.Officer.IsDeleted); Assert.Equal(f.Other.Id, task.AssigneeId); Assert.False(task.RequiresWorkflowReview);
        Assert.Null(await new WorkflowAccess(f.Db).ActorAsync(f.Officer.Id));
    }

    [Fact]
    public async Task IntakeGrant_ControlsCreationPresentationAndFileWrite_LeaderAuthorityIsSeparate()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var create = new CreateInboxDocumentCommandHandler(f.Db);
        CreateInboxDocumentCommand Request(Guid actor) => new() { ReceivedByUserId = actor, RequestId = Guid.NewGuid(), Subject = "Văn bản thử", Sender = "Nguồn thử" };
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => create.Handle(Request(f.Officer.Id), default));
        var grant = new WorkflowPermission { UserId = f.Officer.Id, CanReceiveDocuments = true }; f.Db.WorkflowPermissions.Add(grant); await f.Db.SaveChangesAsync();
        var id = await create.Handle(Request(f.Officer.Id), default);
        var doc = await f.Db.InboxDocuments.SingleAsync();
        var access = new WorkflowAccess(f.Db); var actor = (await access.ActorAsync(f.Officer.Id))!;
        Assert.True(await access.CanWriteDocumentAsync(actor.Id, id, "Inbox"));
        Assert.True(await new DocumentWorkflow(f.Db).CanPresentAsync(actor, doc, default));
        grant.CanReceiveDocuments = false; await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => create.Handle(Request(f.Officer.Id), default));
        Assert.False(await access.CanWriteDocumentAsync(actor.Id, id, "Inbox"));
        Assert.False(await access.GuardFileWriteAsync(actor.Id, id, "Inbox"));
        Assert.False(await new DocumentWorkflow(f.Db).CanPresentAsync(actor, doc, default));
        Assert.NotEqual(Guid.Empty, await create.Handle(Request(f.Leader.Id), default));
    }

    [Fact]
    public async Task LegacyTaskReads_RejectOutOfScopeAndMissingActor()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var task = await f.AddTask();
        f.Db.TaskReviewAnnotations.Add(new TaskReviewAnnotation { TaskItemId = task.Id, CreatedByUserId = f.Leader.Id, AnchorText = "Nội dung kết quả", CommentText = "Nhận xét riêng" }); await f.Db.SaveChangesAsync();
        var annotations = new GetTaskReviewAnnotationsQueryHandler(f.Db);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => annotations.Handle(new(task.Id, f.Other.Id), default));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => annotations.Handle(new(task.Id), default));
        Assert.Single(await annotations.Handle(new(task.Id, f.Officer.Id), default));
        var calculator = new Mock<ISystemScoreCalculator>();
        var score = new CalculateTaskSystemScoreQueryHandler(f.Db, calculator.Object);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => score.Handle(new(task.Id, f.Other.Id), default));
        calculator.Verify(x => x.Calculate(It.IsAny<TaskItem>(), It.IsAny<int>(), It.IsAny<List<SubTask>>()), Times.Never);
    }

    [Fact]
    public async Task IntakeAssignmentNotice_OpensAccessibleDocument_WithoutGrantingTaskAccess()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        f.Db.WorkflowPermissions.Add(new WorkflowPermission { UserId = f.Officer.Id, CanReceiveDocuments = true });
        var doc = new InboxDocument { Subject = "Văn bản trình", ReceivedByUserId = f.Officer.Id }; f.Db.InboxDocuments.Add(doc); await f.Db.SaveChangesAsync();
        await new DocumentWorkflow(f.Db).PresentAsync(f.Officer.Id, doc.Id, new() { RequestId = Guid.NewGuid(), Version = doc.Version, RecipientId = f.Leader.Id }, default);
        var command = f.Command(); command.AssigneeId = f.Other.Id; command.Documents.Add(new() { Id = doc.Id, Kind = "Inbox", Version = doc.Version });
        var taskId = await f.Create.CreateAsync(command, default);
        var notice = await f.Db.Notifications.SingleAsync(n => n.UserId == f.Officer.Id && n.Title == "Văn bản đã được giao việc");
        Assert.Equal(doc.Id, notice.InboxDocumentId); Assert.Null(notice.TaskItemId);
        var access = new WorkflowAccess(f.Db); var actor = (await access.ActorAsync(f.Officer.Id))!;
        Assert.False(await access.Tasks(actor).AnyAsync(t => t.Id == taskId));
        Assert.True(await access.Inbox(actor).AnyAsync(d => d.Id == doc.Id));
    }
}
