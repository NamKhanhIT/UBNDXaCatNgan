using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Tasks.Queries.GetTasks;
using Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocumentsPaginated;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Tasks;

public class WorkspaceQueryTests
{
    [Fact]
    public async Task Tabs_ShouldFilterBeforePaging_AndKeepReviewSeparateFromOverdue()
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var user = new User { Username = "workspace", Email = "workspace@test.local" };
        var other = new User { Username = "other", Email = "other@test.local" };
        db.Users.AddRange(user, other);
        foreach (var status in new[] { TaskStatusEnum.InProgress, TaskStatusEnum.InReview, TaskStatusEnum.Completed, TaskStatusEnum.Cancelled })
            db.TaskItems.Add(new TaskItem { Title = status.ToString(), AssignerId = other.Id, AssigneeId = user.Id, DueDate = DateTime.UtcNow.AddDays(-2), Status = status });
        db.TaskItems.Add(new TaskItem { Title = "Other private work", AssignerId = other.Id, AssigneeId = other.Id, DueDate = DateTime.UtcNow.AddDays(-1) });
        await db.SaveChangesAsync();
        var handler = new GetTasksQueryHandler(db);
        foreach (var (tab, title) in new[] { ("overdue", "InProgress"), ("pending_review", "InReview"), ("completed", "Completed") })
        {
            var result = await handler.Handle(new GetTasksQuery(user.Id, 5, pageSize: 1) { WorkspaceTab = tab }, CancellationToken.None);
            result.TotalCount.Should().Be(1);
            result.Items.Should().ContainSingle(t => t.Title == title);
        }
        var today = await handler.Handle(new GetTasksQuery(user.Id, 5) { WorkspaceTab = "today" }, CancellationToken.None);
        today.Items.Select(t => t.Title).Should().BeEquivalentTo("InProgress", "InReview");
        var invalidScope = await handler.Handle(new GetTasksQuery(user.Id, 5) { Scope = "accessible", WorkspaceTab = "all" }, CancellationToken.None);
        invalidScope.Items.Should().NotContain(t => t.Title == "Other private work");
    }

    [Fact]
    public async Task PersonalDocuments_ShouldRetainUploaderAndAssigneeAccess_AfterTaskAssignment()
    {
        using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner = new User { Username = "owner", Email = "owner@test.local" };
        var staff = new User { Username = "staff", Email = "staff@test.local" };
        var stranger = new User { Username = "stranger", Email = "stranger@test.local" };
        db.Users.AddRange(owner, staff, stranger);
        var task = new TaskItem { Title = "Assigned", AssignerId = owner.Id, AssigneeId = staff.Id };
        db.TaskItems.Add(task);
        var doc = new InboxDocument { Subject = "Directive", ReceivedByUserId = owner.Id, ScheduledTaskId = task.Id, AiProcessingStatus = "Confirmed" };
        db.InboxDocuments.AddRange(doc, new InboxDocument { Subject = "Other private", ReceivedByUserId = stranger.Id });
        await db.SaveChangesAsync();
        var handler = new GetInboxDocumentsPaginatedQueryHandler(db);
        foreach (var caller in new[] { owner, staff })
        {
            var result = await handler.Handle(new GetInboxDocumentsPaginatedQuery { CurrentUserId = caller.Id, UserRankLevel = 5, Scope = "mine", WorkspaceState = "assigned" }, CancellationToken.None);
            result.Items.Should().ContainSingle(d => d.Id == doc.Id);
        }
        var strangerResult = await handler.Handle(new GetInboxDocumentsPaginatedQuery { CurrentUserId = stranger.Id, UserRankLevel = 5, Scope = "accessible", WorkspaceState = "assigned" }, CancellationToken.None);
        strangerResult.Items.Should().BeEmpty();
    }
}
