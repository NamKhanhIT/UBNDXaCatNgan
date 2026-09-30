using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Services;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.CreateOutgoingDocument;
using Quanlycongviec.Application.Features.OutgoingDocuments.Queries.GetDocumentVersions;
using Quanlycongviec.Application.Tests.Tasks;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Tests.OutgoingDocuments;

public sealed class UnifiedOutgoingWorkflowTests
{
    [Fact]
    public async Task CreateAndIssue_UsesCanonicalLink_AndNeverCreatesOrCompletesTaskAutomatically()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var task = await f.AddTask();
        var workflow = new OutgoingDocumentWorkflow(f.Db);
        var request = new CreateOutgoingDocumentCommand { RequestId = Guid.NewGuid(), DraftedByUserId = f.Officer.Id,
            Title = "Văn bản trả lời", Content = "Nội dung xác nhận", RelatedTaskItemId = task.Id, AutoCreateTask = true, DestinationLevel = "Subordinate" };
        var id = await workflow.CreateAsync(request, default);
        Assert.Equal(id, await workflow.CreateAsync(request, default));
        var doc = await f.Db.OutgoingDocuments.SingleAsync();
        Assert.Null(doc.RelatedTaskItemId);
        Assert.False(doc.AutoCreateTask);
        Assert.Single(await f.Db.TaskDocumentLinks.ToListAsync());
        await workflow.ActAsync(f.Officer.Id, id, "submit", Action(doc), default);
        await workflow.ActAsync(f.Leader.Id, id, "sign", Action(doc), default);
        Assert.Equal(OutgoingDocumentStatusEnum.Issued, doc.Status);
        Assert.Single(await f.Db.TaskItems.ToListAsync());
        Assert.Equal(TaskStatusEnum.Todo, task.Status);
        Assert.Contains(await f.Db.Notifications.ToListAsync(), n => n.OutgoingDocumentId == id && n.UserId == f.Officer.Id);
        for (var index = 0; index < 2; index++)
        {
            var command = f.Command(); command.Documents.Add(new() { Kind = "Outgoing", Id = id, Version = doc.Version });
            await f.Create.CreateAsync(command, default);
        }
        Assert.Equal(3, await f.Db.TaskDocumentLinks.CountAsync());
        Assert.Equal(3, await f.Db.TaskItems.CountAsync());
    }

    [Fact]
    public async Task ReturnEditResubmit_PreservesContentAndReasonHistory_AndRecallKeepsIssuedEvidence()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var workflow = new OutgoingDocumentWorkflow(f.Db);
        var id = await workflow.CreateAsync(new() { RequestId = Guid.NewGuid(), DraftedByUserId = f.Officer.Id, Title = "Bản gốc", Content = "Nội dung trước sửa" }, default);
        var doc = await f.Db.OutgoingDocuments.SingleAsync();
        await workflow.ActAsync(f.Officer.Id, id, "submit", Action(doc), default);
        var reject = Action(doc); reject.Reason = "Bổ sung căn cứ pháp lý";
        await workflow.ActAsync(f.Leader.Id, id, "reject", reject, default);
        await workflow.EditAsync(new() { Id = id, UserId = f.Officer.Id, RequestId = Guid.NewGuid(), Version = doc.Version,
            Title = "Bản đã sửa", Content = "Đã bổ sung căn cứ" }, default);
        Assert.Equal("Nội dung trước sửa", (await f.Db.DocumentVersions.SingleAsync()).Content);
        await workflow.ActAsync(f.Officer.Id, id, "submit", Action(doc), default);
        await workflow.ActAsync(f.Leader.Id, id, "sign", Action(doc), default);
        var number = doc.DocumentNumber;
        var recall = Action(doc); recall.Reason = "Thay bằng văn bản mới";
        await workflow.ActAsync(f.Leader.Id, id, "recall", recall, default);
        Assert.Equal(OutgoingDocumentStatusEnum.Recalled, doc.Status);
        Assert.Equal(number, doc.DocumentNumber);
        Assert.Equal("Đã bổ sung căn cứ", doc.Content);
        Assert.Equal(2, await f.Db.DocumentVersions.CountAsync());
        Assert.Contains(await f.Db.AuditLogs.ToListAsync(), a => a.Details.Contains("Bổ sung căn cứ pháp lý"));
        await Assert.ThrowsAsync<WorkflowConflictException>(() => workflow.ActAsync(f.Officer.Id, id, "submit", Action(doc), default));
    }

    [Fact]
    public async Task ViewingDocument_DoesNotGrantEditOrVersionAccessOutsideScope()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var workflow = new OutgoingDocumentWorkflow(f.Db);
        var id = await workflow.CreateAsync(new() { RequestId = Guid.NewGuid(), DraftedByUserId = f.Officer.Id, Title = "Bản nháp riêng" }, default);
        var doc = await f.Db.OutgoingDocuments.SingleAsync();
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => workflow.EditAsync(new() { Id = id, UserId = f.Leader.Id,
            RequestId = Guid.NewGuid(), Version = doc.Version, Title = "Không được sửa thay" }, default));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => new GetDocumentVersionsQueryHandler(f.Db).Handle(
            new() { DocumentId = id, CurrentUserId = f.Other.Id }, default));
        await Assert.ThrowsAsync<ArgumentException>(() => workflow.ActAsync(f.Officer.Id, id, "cancel", Action(doc), default));
        var cancel = Action(doc); cancel.Reason = "Không còn sử dụng";
        await workflow.ActAsync(f.Officer.Id, id, "cancel", cancel, default);
        Assert.False(doc.IsDeleted);
        Assert.Equal(OutgoingDocumentStatusEnum.Cancelled, doc.Status);
        Assert.Equal("Không còn sử dụng", doc.RecallReason);
    }

    private static OutgoingActionInput Action(OutgoingDocument doc) => new() { RequestId = Guid.NewGuid(), Version = doc.Version };
}
