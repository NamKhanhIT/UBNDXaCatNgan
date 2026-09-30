using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;
using Quanlycongviec.Application.Common.Services;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Application.Features.Tasks.Commands.UpdateTaskStatus;
using Quanlycongviec.Application.Features.Tasks.Queries.GetTasks;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;

namespace Quanlycongviec.Application.Tests.Tasks;

public sealed class PostgresWorkflowFactAttribute : FactAttribute
{
    public PostgresWorkflowFactAttribute()
    {
        if (Environment.GetEnvironmentVariable("WORKFLOW_TEST_POSTGRES") != "1")
            Skip = "Requires the isolated, synthetic PostgreSQL cluster on 127.0.0.1:55439.";
    }
}

public sealed class PostgresWorkflowTests
{
    [PostgresWorkflowFact]
    public async Task FileUpload_WhenOwnerMovesToNextStep_RollsBackMetadataAndReceipt()
    {
        await using var fixture = await DatabaseFixture.Create();
        await using var setup = fixture.Context();
        var (leader, _) = await Seed(setup);
        var doc = new InboxDocument { Subject = "Kiểm tra tranh chấp tải tệp", ReceivedByUserId = leader.Id };
        setup.InboxDocuments.Add(doc); await setup.SaveChangesAsync();
        await using var upload = fixture.Context();
        Assert.True(await new WorkflowAccess(upload).GuardFileWriteAsync(leader.Id, doc.Id, "Inbox"));
        upload.DocumentAttachments.Add(new DocumentAttachment { DocumentId = doc.Id, TargetType = "Inbox", OriginalFileName = "fixture.pdf", UploadedByUserId = leader.Id });
        upload.WorkflowRequests.Add(new WorkflowRequest { UserId = leader.Id, RequestId = Guid.NewGuid(), Fingerprint = "synthetic-upload", ResultId = doc.Id });
        await using (var move = fixture.Context())
        {
            var current = await move.InboxDocuments.SingleAsync();
            current.BusinessStatus = "Submitted"; current.Version = Guid.NewGuid();
            await move.SaveChangesAsync();
        }
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => upload.SaveChangesAsync());
        setup.ChangeTracker.Clear();
        Assert.Empty(await setup.DocumentAttachments.ToListAsync());
        Assert.Empty(await setup.WorkflowRequests.ToListAsync());
        Assert.Equal("Submitted", (await setup.InboxDocuments.SingleAsync()).BusinessStatus);
    }

    [PostgresWorkflowFact]
    public async Task ConcurrentIssuance_RejectsStaleCounter_AndRetryAllocatesDistinctNumbers()
    {
        await using var fixture = await DatabaseFixture.Create();
        await using var setup = fixture.Context();
        var (leader, officer) = await Seed(setup);
        var docs = new[] { new OutgoingDocument { Title = "Văn bản A", DraftedByUserId = officer.Id, Status = OutgoingDocumentStatusEnum.PendingSignature },
            new OutgoingDocument { Title = "Văn bản B", DraftedByUserId = officer.Id, Status = OutgoingDocumentStatusEnum.PendingSignature } };
        setup.OutgoingDocuments.AddRange(docs);
        setup.DocumentNumberSequences.Add(new DocumentNumberSequence { Year = DateTime.UtcNow.AddHours(7).Year, Symbol = "CV-UBND", CurrentNumber = 0 });
        await setup.SaveChangesAsync();
        var requests = docs.Select(d => new OutgoingActionInput { RequestId = Guid.NewGuid(), Version = d.Version }).ToArray();
        var barrier = new SaveBarrier();
        async Task<Exception?> Sign(int index)
        {
            await using var db = fixture.Context(barrier);
            return await Record.ExceptionAsync(() => new OutgoingDocumentWorkflow(db).ActAsync(leader.Id, docs[index].Id, "sign", requests[index], default));
        }
        var errors = await Task.WhenAll(Sign(0), Sign(1));
        Assert.Single(errors, error => error == null);
        Assert.IsType<WorkflowConflictException>(Assert.Single(errors, error => error != null));
        var loser = Array.FindIndex(errors, error => error != null);
        await using (var retry = fixture.Context())
            await new OutgoingDocumentWorkflow(retry).ActAsync(leader.Id, docs[loser].Id, "sign", requests[loser], default);
        setup.ChangeTracker.Clear();
        var numbers = await setup.OutgoingDocuments.OrderBy(d => d.DocumentNumber).Select(d => d.DocumentNumber).ToListAsync();
        Assert.Equal(new[] { "01/CV-UBND", "02/CV-UBND" }, numbers);
        Assert.Equal(2, (await setup.DocumentNumberSequences.SingleAsync()).CurrentNumber);
        Assert.Equal(2, await setup.WorkflowRequests.CountAsync());
        Assert.Equal(2, await setup.Notifications.CountAsync());
        Assert.Empty(await setup.TaskItems.ToListAsync());
    }

    [PostgresWorkflowFact]
    public async Task ExplicitAdminProvisioning_GrantsOnlyNamedAccount_AndAuditsRetries()
    {
        await using var fixture = await DatabaseFixture.Create();
        await using var db = fixture.Context();
        var (leader, officer) = await Seed(db);
        var scriptPath = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "docs", "operations", "provision-workflow-admin.sql"));
        var sql = await File.ReadAllTextAsync(scriptPath);
        sql = string.Join("\n", sql.Split('\n').Where(line => !line.TrimStart().StartsWith("\\set")));
        foreach (var parameter in new[] { "operator_username", "target_username", "grant_admin", "reason", "request_id" })
            sql = sql.Replace(":'" + parameter + "'", "@" + parameter);
        var requestId = Guid.NewGuid();
        async Task Provision(string target, bool grant, Guid request)
        {
            await using var connection = new NpgsqlConnection(db.Database.GetConnectionString());
            await connection.OpenAsync();
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue("operator_username", leader.Email);
            command.Parameters.AddWithValue("target_username", target);
            command.Parameters.AddWithValue("grant_admin", grant ? "true" : "false");
            command.Parameters.AddWithValue("reason", "Quyết định chỉ định quản trị kiểm thử");
            command.Parameters.AddWithValue("request_id", request.ToString());
            await command.ExecuteNonQueryAsync();
        }
        await Provision(officer.Email, true, requestId);
        await Provision(officer.Email, true, requestId);
        Assert.True(await new WorkflowPermissions(db).IsAdminAsync(officer.Id, default));
        Assert.False(await new WorkflowPermissions(db).IsAdminAsync(leader.Id, default));
        Assert.Equal(1, await db.AuditLogs.CountAsync(a => a.Action == "WorkflowAdminPermission"));
        await Assert.ThrowsAsync<PostgresException>(() => Provision(leader.Email, true, requestId));
        await Provision(officer.Email, false, Guid.NewGuid());
        Assert.False(await new WorkflowPermissions(db).IsAdminAsync(officer.Id, default));
        Assert.Equal(2, await db.AuditLogs.CountAsync(a => a.Action == "WorkflowAdminPermission"));
    }

    [PostgresWorkflowFact]
    public async Task Upgrade_PreservesLegacyLinksEvidenceAndCancellationReason_WithoutInventingDates()
    {
        await using var fixture = await DatabaseFixture.Create("20260903150000_AddPerformanceIndexesForPagination");
        await using var db = fixture.Context();
        var department = Guid.NewGuid(); var leader = Guid.NewGuid(); var officer = Guid.NewGuid();
        var leaderRole = Guid.NewGuid(); var officerRole = Guid.NewGuid();
        var task = Guid.NewGuid(); var cancelled = Guid.NewGuid(); var inbox = Guid.NewGuid(); var outgoing = Guid.NewGuid();
        await fixture.InsertLegacy("Departments", new() { ["Id"] = department, ["Code"] = "TEST_DEPT" });
        await fixture.InsertLegacy("Roles", new() { ["Id"] = leaderRole, ["Code"] = "TEST_LEADER", ["RankLevel"] = 1 });
        await fixture.InsertLegacy("Roles", new() { ["Id"] = officerRole, ["Code"] = "TEST_OFFICER", ["RankLevel"] = 5 });
        await fixture.InsertLegacy("Users", new() { ["Id"] = leader, ["Username"] = "legacy_leader", ["Email"] = "leader@example.invalid", ["PrimaryDepartmentId"] = department, ["ActiveRoleCode"] = "TEST_LEADER" });
        await fixture.InsertLegacy("Users", new() { ["Id"] = officer, ["Username"] = "legacy_officer", ["Email"] = "officer@example.invalid", ["PrimaryDepartmentId"] = department, ["ActiveRoleCode"] = "TEST_OFFICER" });
        await fixture.InsertLegacy("UserRoles", new() { ["UserId"] = leader, ["RoleId"] = leaderRole, ["IsPrimary"] = true });
        await fixture.InsertLegacy("UserRoles", new() { ["UserId"] = officer, ["RoleId"] = officerRole, ["IsPrimary"] = true });
        await fixture.InsertLegacy("TaskItems", new() { ["Id"] = task, ["AssignerId"] = leader, ["AssigneeId"] = officer,
            ["DepartmentId"] = department, ["Status"] = "PendingUBMTTQReview", ["Type"] = "AdHoc", ["Priority"] = "High",
            ["Requirements"] = "", ["SubmissionNote"] = "Bằng chứng cũ giữ nguyên" });
        await fixture.InsertLegacy("TaskItems", new() { ["Id"] = cancelled, ["AssignerId"] = leader, ["AssigneeId"] = officer,
            ["Status"] = "Cancelled", ["Type"] = "AdHoc", ["Priority"] = "High", ["RejectionReason"] = "Lý do hủy cũ" });
        await fixture.InsertLegacy("InboxDocuments", new() { ["Id"] = inbox, ["ReceivedByUserId"] = leader, ["ScheduledTaskId"] = task, ["Channel"] = "Internal" });
        await fixture.InsertLegacy("OutgoingDocuments", new() { ["Id"] = outgoing, ["DraftedByUserId"] = leader,
            ["RelatedTaskItemId"] = task, ["Status"] = "Issued", ["DocumentType"] = "CongVan" });
        await db.Database.MigrateAsync();
        var migrated = await db.TaskItems.SingleAsync(t => t.Id == task);
        Assert.Equal(TaskStatusEnum.InReview, migrated.Status);
        Assert.Equal(leader, migrated.ReviewerId);
        Assert.True(migrated.RequiresWorkflowReview);
        Assert.Null(migrated.DueDate);
        var evidence = await db.TaskSubmissions.SingleAsync(s => s.TaskItemId == task);
        Assert.True(evidence.IsLegacy);
        Assert.Equal("Bằng chứng cũ giữ nguyên", evidence.Note);
        Assert.Null(evidence.SubmittedAt);
        Assert.Null(evidence.DueDateAtSubmission);
        Assert.Equal("Pending", evidence.Decision);
        Assert.Equal(2, await db.TaskDocumentLinks.CountAsync(l => l.TaskItemId == task));
        Assert.Equal("Lý do hủy cũ", (await db.TaskItems.SingleAsync(t => t.Id == cancelled)).RejectionReason);
        Assert.Equal("Assigned", (await db.InboxDocuments.SingleAsync(d => d.Id == inbox)).BusinessStatus);
        Assert.Single(await db.TaskWorkflowChanges.Where(c => c.TaskItemId == task && c.Kind == "LegacyMigration").ToListAsync());
    }

    [PostgresWorkflowFact]
    public async Task FreshMigration_ExecutesUnifiedDocumentsAndWorkspaceQueries()
    {
        await using var fixture = await DatabaseFixture.Create();
        await using var db = fixture.Context();
        var (leader, officer) = await Seed(db);
        var doc = new InboxDocument { Subject = "Văn bản kiểm thử SQL", ReceivedByUserId = leader.Id };
        db.InboxDocuments.Add(doc);
        await db.SaveChangesAsync();
        var create = Command(leader, officer);
        create.Documents.Add(new() { Id = doc.Id, Version = doc.Version });
        var taskId = await new TaskCreationWorkflow(db, new TaskAuthorizationService(db)).CreateAsync(create, default);
        var documents = await new DocumentWorkspace(db).ListAsync(officer.Id, new() { Scope = "mine" }, default);
        Assert.Single(documents.Items);
        Assert.Equal(1, documents.Items[0].TaskCount);
        var tasks = await new GetTasksQueryHandler(db).Handle(new(officer.Id)
            { WorkspaceTab = "action_needed", Scope = "mine" }, default);
        Assert.Equal(taskId, Assert.Single(tasks.Items).Id);
        Assert.Equal(tasks.TotalCount, tasks.Counts["action_needed"]);
        // Verify tables already represented in the model also exist after the complete migration chain.
        Assert.Empty(await db.MonthlyRatingSummaries.ToListAsync());
    }

    [PostgresWorkflowFact]
    public async Task SimultaneousCreateRetry_CommitsOneTaskLinkAuditAndNotification()
    {
        await using var fixture = await DatabaseFixture.Create();
        await using var setup = fixture.Context();
        var (leader, officer) = await Seed(setup);
        var doc = new InboxDocument { Subject = "Văn bản đồng thời", ReceivedByUserId = leader.Id };
        setup.InboxDocuments.Add(doc); await setup.SaveChangesAsync();
        var command = Command(leader, officer);
        command.Documents.Add(new() { Id = doc.Id, Version = doc.Version });
        var barrier = new SaveBarrier();
        async Task<Guid> Send()
        {
            await using var db = fixture.Context(barrier);
            return await new TaskCreationWorkflow(db, new TaskAuthorizationService(db)).CreateAsync(command, default);
        }
        var ids = await Task.WhenAll(Send(), Send());
        Assert.Equal(ids[0], ids[1]);
        Assert.Equal(1, await setup.TaskItems.CountAsync());
        Assert.Equal(1, await setup.TaskDocumentLinks.CountAsync());
        Assert.Equal(1, await setup.WorkflowRequests.CountAsync());
        Assert.Equal(1, await setup.Notifications.CountAsync());
        Assert.Equal(1, await setup.AuditLogs.CountAsync(a => a.Action == "CreateTask"));
    }

    [PostgresWorkflowFact]
    public async Task SimultaneousReview_OnlyOneDecisionCommits()
    {
        await using var fixture = await DatabaseFixture.Create();
        await using var setup = fixture.Context();
        var (leader, officer) = await Seed(setup);
        var taskId = await new TaskCreationWorkflow(setup, new TaskAuthorizationService(setup)).CreateAsync(Command(leader, officer), default);
        var task = await setup.TaskItems.SingleAsync(t => t.Id == taskId);
        var workflow = new TaskExecutionWorkflow(setup, new TaskAuthorizationService(setup));
        await workflow.ChangeStatusAsync(new() { RequestId = Guid.NewGuid(), Version = task.Version,
            TaskId = taskId, CurrentUserId = officer.Id, Status = "InProgress" }, default);
        await workflow.ChangeStatusAsync(new() { RequestId = Guid.NewGuid(), Version = task.Version,
            TaskId = taskId, CurrentUserId = officer.Id, Status = "InReview", SubmissionNote = "Kết quả kiểm thử" }, default);
        var submission = await setup.TaskSubmissions.SingleAsync();
        var barrier = new SaveBarrier();
        async Task<Exception?> Review(string status)
        {
            await using var db = fixture.Context(barrier);
            return await Record.ExceptionAsync(() => new TaskExecutionWorkflow(db, new TaskAuthorizationService(db)).ChangeStatusAsync(new()
            { RequestId = Guid.NewGuid(), Version = task.Version, TaskId = taskId, CurrentUserId = leader.Id,
                SubmissionId = submission.Id, Status = status, RejectionReason = status == "InProgress" ? "Bổ sung số liệu" : null }, default));
        }
        var outcomes = await Task.WhenAll(Review("Completed"), Review("InProgress"));
        Assert.Single(outcomes, e => e == null);
        Assert.IsType<DbUpdateConcurrencyException>(Assert.Single(outcomes, e => e != null));
        setup.ChangeTracker.Clear();
        var saved = await setup.TaskSubmissions.SingleAsync();
        Assert.Contains(saved.Decision, new[] { "Accepted", "Returned" });
        Assert.Equal(4, await setup.WorkflowRequests.CountAsync()); // create, start, submit, one decision
    }

    private static CreateTaskCommand Command(User leader, User officer) => new()
    { RequestId = Guid.NewGuid(), Title = "Công việc PostgreSQL", Requirements = "Báo cáo có bằng chứng",
        AssignerId = leader.Id, AssigneeId = officer.Id, DueDate = DateTime.UtcNow.AddDays(2) };

    private static async Task<(User Leader, User Officer)> Seed(ApplicationDbContext db)
    {
        var leader = new User { Username = "test_leader", FullName = "Lãnh đạo thử", Email = "leader@example.invalid" };
        var officer = new User { Username = "test_officer", FullName = "Chuyên viên thử", Email = "officer@example.invalid" };
        WorkflowTestData.AddAssignmentRoles(db, leader, officer);
        await db.SaveChangesAsync();
        return (leader, officer);
    }

    private sealed class SaveBarrier : SaveChangesInterceptor
    {
        private int arrivals;
        private readonly TaskCompletionSource release = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (Interlocked.Increment(ref arrivals) == 2) release.TrySetResult();
            await release.Task.WaitAsync(TimeSpan.FromSeconds(15), cancellationToken);
            return result;
        }
    }

    private sealed class DatabaseFixture : IAsyncDisposable
    {
        // Fixed loopback endpoint and synthetic account; never load application configuration or credentials.
        private const string Server = "Host=127.0.0.1;Port=55439;Username=workflow_test;Pooling=false;Passfile=workflow-test-no-passfile";
        private readonly string name = "workflow_test_" + Guid.NewGuid().ToString("N");
        public ApplicationDbContext Context(IInterceptor? interceptor = null)
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseNpgsql(Server + ";Database=" + name);
            if (interceptor != null) options.AddInterceptors(interceptor);
            return new(options.Options);
        }
        public static async Task<DatabaseFixture> Create(string? targetMigration = null)
        {
            var fixture = new DatabaseFixture();
            await using var admin = new NpgsqlConnection(Server + ";Database=postgres");
            await admin.OpenAsync();
            await new NpgsqlCommand($"CREATE DATABASE \"{fixture.name}\"", admin).ExecuteNonQueryAsync();
            await using var db = fixture.Context();
            await db.GetService<IMigrator>().MigrateAsync(targetMigration);
            return fixture;
        }
        public async Task InsertLegacy(string table, Dictionary<string, object> values)
        {
            // Supply mandatory legacy columns from schema metadata without assuming today's EF model.
            await using var connection = new NpgsqlConnection(Server + ";Database=" + name);
            await connection.OpenAsync();
            await using var query = new NpgsqlCommand("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=@table AND is_nullable='NO' AND column_default IS NULL", connection);
            query.Parameters.AddWithValue("table", table);
            await using (var reader = await query.ExecuteReaderAsync())
                while (await reader.ReadAsync())
                    values.TryAdd(reader.GetString(0), reader.GetString(1) switch
                    {
                        "uuid" => Guid.NewGuid(), "boolean" => false, "integer" => 0,
                        "bigint" => 0L, "double precision" => 0d, "numeric" => 0m,
                        "timestamp with time zone" => DateTime.UtcNow,
                        _ => "fixture"
                    });
            var columns = values.Keys.ToList();
            await using var insert = new NpgsqlCommand($"INSERT INTO \"{table}\" ({string.Join(",", columns.Select(c => "\"" + c + "\""))}) VALUES ({string.Join(",", columns.Select((_, i) => "@p" + i))})", connection);
            for (var i = 0; i < columns.Count; i++) insert.Parameters.AddWithValue("p" + i, values[columns[i]]);
            await insert.ExecuteNonQueryAsync();
        }
        public async ValueTask DisposeAsync()
        {
            await using var admin = new NpgsqlConnection(Server + ";Database=postgres");
            await admin.OpenAsync();
            await new NpgsqlCommand($"DROP DATABASE \"{name}\" WITH (FORCE)", admin).ExecuteNonQueryAsync();
        }
    }
}
