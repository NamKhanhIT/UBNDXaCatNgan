using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Services;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Application.Features.Tasks.Commands.UpdateTaskStatus;
using Quanlycongviec.Application.Features.Tasks.Queries.GetTasks;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;

namespace Quanlycongviec.Application.Tests.Tasks;

public sealed class UnifiedWorkflowTests
{
    [Fact]
    public async Task SharedSource_CreatesTwoIndependentTasks_AndRetryCreatesNoThirdTask()
    {
        await using var f = await Fixture.New();
        var doc = new InboxDocument { Subject = "Văn bản mẫu", ReceivedByUserId = f.Leader.Id };
        f.Db.InboxDocuments.Add(doc); await f.Db.SaveChangesAsync();
        var first = f.Command(); first.Documents.Add(new() { Id = doc.Id, Version = doc.Version });
        var id = await f.Create.CreateAsync(first, default);
        Assert.Equal(id, await f.Create.CreateAsync(first, default));
        var second = f.Command(); second.Documents.Add(new() { Id = doc.Id, Version = doc.Version });
        await f.Create.CreateAsync(second, default);
        Assert.Equal(2, await f.Db.TaskItems.CountAsync());
        Assert.Equal(2, await f.Db.TaskDocumentLinks.CountAsync());
        Assert.Equal(2, await f.Db.Notifications.CountAsync());
        Assert.Null(doc.ScheduledTaskId);
        var documents = new DocumentAccessService(f.Db, f.Authorization);
        Assert.True(await documents.CanAccessDocumentAsync(f.Officer.Id, doc.Id, "Inbox"));
        Assert.False(await documents.CanAccessDocumentAsync(f.Other.Id, doc.Id, "Inbox"));
    }

    [Fact]
    public async Task IntakeGrant_IsRequired_AndPresentationRecipientGetsAccess()
    {
        await using var f = await Fixture.New();
        var doc = new InboxDocument { Subject = "Văn bản tiếp nhận", ReceivedByUserId = f.Officer.Id };
        f.Db.InboxDocuments.Add(doc); await f.Db.SaveChangesAsync();
        var workflow = new DocumentWorkflow(f.Db);
        var request = new PresentDocumentInput { RequestId = Guid.NewGuid(), Version = doc.Version, RecipientId = f.Deputy.Id };
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => workflow.PresentAsync(f.Officer.Id, doc.Id, request, default));
        f.Db.WorkflowPermissions.Add(new WorkflowPermission { UserId = f.Officer.Id, CanReceiveDocuments = true });
        await f.Db.SaveChangesAsync();
        var id = await workflow.PresentAsync(f.Officer.Id, doc.Id, request, default);
        Assert.Equal("Submitted", doc.BusinessStatus);
        Assert.True(await new DocumentAccessService(f.Db, f.Authorization).CanAccessDocumentAsync(f.Deputy.Id, doc.Id, "Inbox"));
        await workflow.DecideAsync(f.Deputy.Id, doc.Id, new() { RequestId = Guid.NewGuid(), Version = doc.Version, PresentationId = id,
            Decision = "Supplement", Note = "Bổ sung phụ lục" }, default);
        Assert.Equal("NeedsSupplement", doc.BusinessStatus);
        await workflow.PresentAsync(f.Officer.Id, doc.Id, new() { RequestId = Guid.NewGuid(), Version = doc.Version, RecipientId = f.Deputy.Id }, default);
        Assert.Equal(2, await f.Db.DocumentPresentations.CountAsync());
        Assert.Single(await f.Db.DocumentPresentations.Where(p => p.Status == "SupplementRequested").ToListAsync());
    }

    [Fact]
    public async Task SubmissionRoundTrip_PreservesFilesAndDeadline_AndOnlyNamedReviewerCanAccept()
    {
        await using var f = await Fixture.New();
        var task = await f.AddTask();
        await f.Change(task, f.Officer.Id, "InProgress");
        var file = new DocumentAttachment { DocumentId = task.Id, TargetType = "Task", UploadedByUserId = f.Officer.Id,
            OriginalFileName = "ket-qua-1.txt", FileName = "fixture-1.txt", FilePath = "fixture-1.txt" };
        f.Db.DocumentAttachments.Add(file); await f.Db.SaveChangesAsync();
        await f.Change(task, f.Officer.Id, "InReview", note: "Kết quả lần 1", files: new[] { file.Id });
        var first = await f.Db.TaskSubmissions.SingleAsync();
        var originalDue = first.DueDateAtSubmission;
        Assert.Single(first.Attachments);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => f.Change(task, f.Officer.Id, "Completed", submissionId: first.Id));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => f.Change(task, f.Deputy.Id, "Completed", submissionId: first.Id));
        await f.Change(task, f.Leader.Id, "InProgress", reason: "Cần chỉnh sửa số liệu", submissionId: first.Id);
        await f.Execute.AmendAsync(task.Id, f.Leader.Id, new() { RequestId = Guid.NewGuid(), Version = task.Version,
            DueDate = task.DueDate!.Value.AddDays(1), Reason = "Gia hạn để bổ sung số liệu" }, default);
        await f.Change(task, f.Officer.Id, "InReview", note: "Kết quả lần 2");
        Assert.Null(task.RejectionReason);
        var second = await f.Db.TaskSubmissions.SingleAsync(s => s.Decision == "Pending");
        await f.Change(task, f.Leader.Id, "Completed", submissionId: second.Id);
        Assert.Equal(TaskStatusEnum.Completed, task.Status);
        Assert.Equal("Returned", first.Decision);
        Assert.Equal(originalDue, first.DueDateAtSubmission);
        Assert.NotEqual(first.DueDateAtSubmission, second.DueDateAtSubmission);
        Assert.Equal(2, await f.Db.TaskSubmissions.CountAsync());
        Assert.Null(task.RatingScore);
    }

    [Fact]
    public async Task Coordination_RequiresAcceptanceBeforeParentSubmission_AndDoesNotFinishParent()
    {
        await using var f = await Fixture.New();
        var command = f.Command();
        command.CoordinationTasks.Add(new() { Title = "Phối hợp", Requirements = "Bảng số liệu", AssigneeId = f.Other.Id, DueDate = command.DueDate });
        var rootId = await f.Create.CreateAsync(command, default);
        var root = await f.Db.TaskItems.SingleAsync(t => t.Id == rootId);
        var child = await f.Db.TaskItems.SingleAsync(t => t.ParentTaskId == rootId);
        await f.Change(root, f.Officer.Id, "InProgress");
        await Assert.ThrowsAsync<WorkflowConflictException>(() => f.Change(root, f.Officer.Id, "InReview", note: "Chưa đủ phần việc"));
        await f.Change(child, f.Other.Id, "InProgress");
        await f.Change(child, f.Other.Id, "InReview", note: "Số liệu phối hợp");
        var submission = await f.Db.TaskSubmissions.SingleAsync();
        await f.Change(child, f.Officer.Id, "Completed", submissionId: submission.Id);
        Assert.Equal(TaskStatusEnum.InProgress, root.Status);
        await f.Change(root, f.Officer.Id, "InReview", note: "Tổng hợp đủ kết quả");
        Assert.Equal(TaskStatusEnum.InReview, root.Status);
    }

    [Fact]
    public async Task VersionAndRequestKeys_RejectStaleOrChangedPayload()
    {
        await using var f = await Fixture.New();
        var command = f.Command();
        await f.Create.CreateAsync(command, default);
        command.Title = "Nội dung bị thay đổi";
        await Assert.ThrowsAsync<WorkflowConflictException>(() => f.Create.CreateAsync(command, default));
        var task = await f.Db.TaskItems.SingleAsync();
        var version = task.Version;
        await f.Change(task, f.Officer.Id, "InProgress");
        await Assert.ThrowsAsync<WorkflowConflictException>(() => f.Execute.ChangeStatusAsync(new()
        { TaskId = task.Id, CurrentUserId = f.Officer.Id, RequestId = Guid.NewGuid(), Version = version,
            Status = "InReview", SubmissionNote = "Bản cũ" }, default));
        Assert.Empty(await f.Db.TaskSubmissions.ToListAsync());
    }

    [Fact]
    public async Task DeputyCanAssignWithinDepartment_ButCannotAssignAcrossDepartments()
    {
        await using var f = await Fixture.New();
        var command = f.Command(); command.AssignerId = f.Deputy.Id;
        await f.Create.CreateAsync(command, default);
        var outside = f.Command(); outside.AssignerId = f.Deputy.Id; outside.AssigneeId = f.Other.Id;
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => f.Create.CreateAsync(outside, default));
    }

    [Fact]
    public async Task ActionNeeded_IncludesTodoAndFutureWork_AndCountsMatch()
    {
        await using var f = await Fixture.New();
        await f.AddTask();
        var result = await new GetTasksQueryHandler(f.Db).Handle(new(f.Officer.Id, 5)
            { WorkspaceTab = "action_needed", Scope = "mine" }, default);
        Assert.Single(result.Items);
        Assert.Equal(result.TotalCount, result.Counts["action_needed"]);
    }

    internal sealed class Fixture : IAsyncDisposable
    {
        public ApplicationDbContext Db { get; }
        public User Leader { get; private set; } = null!;
        public User Deputy { get; private set; } = null!;
        public User Officer { get; private set; } = null!;
        public User Other { get; private set; } = null!;
        public TaskAuthorizationService Authorization { get; }
        public TaskCreationWorkflow Create { get; }
        public TaskExecutionWorkflow Execute { get; }
        private Fixture()
        {
            Db = new(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            Authorization = new(Db); Create = new(Db, Authorization); Execute = new(Db, Authorization);
        }
        public static async Task<Fixture> New()
        {
            var f = new Fixture();
            var dept = new Department { Code = "FIXTURE_A", Name = "Phòng thử A" };
            var other = new Department { Code = "FIXTURE_B", Name = "Phòng thử B" };
            f.Db.Departments.AddRange(dept, other);
            f.Leader = f.AddUser("fixture-leader", 1, dept);
            f.Deputy = f.AddUser("fixture-deputy", 4, dept);
            f.Officer = f.AddUser("fixture-officer", 5, dept);
            f.Other = f.AddUser("fixture-other", 5, other);
            await f.Db.SaveChangesAsync();
            return f;
        }
        private User AddUser(string name, int rank, Department dept)
        {
            var role = new Role { Code = name, Name = name, RankLevel = rank };
            var user = new User { Username = name, FullName = name, Email = name + "@example.invalid", PrimaryDepartment = dept, ActiveRoleCode = role.Code };
            user.UserRoles.Add(new UserRole { User = user, Role = role, IsPrimary = true });
            Db.Users.Add(user);
            return user;
        }
        public CreateTaskCommand Command() => new() { RequestId = Guid.NewGuid(), Title = "Công việc mẫu", Requirements = "Báo cáo kết quả",
            AssignerId = Leader.Id, AssigneeId = Officer.Id, DueDate = DateTime.UtcNow.AddDays(3) };
        public async Task<TaskItem> AddTask()
        {
            var id = await Create.CreateAsync(Command(), default);
            return await Db.TaskItems.SingleAsync(t => t.Id == id);
        }
        public Task<bool> Change(TaskItem task, Guid actor, string status, string? note = null, string? reason = null,
            Guid? submissionId = null, IEnumerable<Guid>? files = null) => Execute.ChangeStatusAsync(new()
            { TaskId = task.Id, CurrentUserId = actor, RequestId = Guid.NewGuid(), Version = task.Version, Status = status,
                SubmissionNote = note, RejectionReason = reason, SubmissionId = submissionId, AttachmentIds = files?.ToList() ?? new() }, default);
        public ValueTask DisposeAsync() => Db.DisposeAsync();
    }
}
