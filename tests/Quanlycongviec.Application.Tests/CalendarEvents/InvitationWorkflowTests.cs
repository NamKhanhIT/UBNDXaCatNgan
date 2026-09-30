using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Services;
using Quanlycongviec.Application.Features.CalendarEvents.Commands.CreateCalendarEvent;
using Quanlycongviec.Application.Features.CalendarEvents.Commands.UpdateCalendarEvent;
using Quanlycongviec.Application.Features.CalendarEvents.Commands.DeleteCalendarEvent;
using Quanlycongviec.Application.Features.CalendarEvents.Queries.GetCalendarEvents;
using Quanlycongviec.Application.Tests.Tasks;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Services;

namespace Quanlycongviec.Application.Tests.CalendarEvents;

public sealed class InvitationWorkflowTests
{
    [Fact]
    public async Task ConfirmedInvitation_CreatesOneEventOnRetry_AndParticipantCanReadSource()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var doc = new InboxDocument { Subject = "Giấy mời", ReceivedByUserId = f.Deputy.Id };
        f.Db.InboxDocuments.Add(doc); await f.Db.SaveChangesAsync();
        var command = Request(f, doc);
        var workflow = new CalendarWorkflow(f.Db);
        var id = await workflow.CreateAsync(command, default);
        Assert.Equal(id, await workflow.CreateAsync(command, default));
        Assert.Single(await f.Db.CalendarEvents.ToListAsync());
        Assert.Single(await f.Db.EventParticipants.ToListAsync());
        Assert.Single(await f.Db.Notifications.ToListAsync());
        Assert.Empty(await f.Db.TaskItems.ToListAsync());
        var saved = await f.Db.CalendarEvents.SingleAsync();
        Assert.Equal(command.StartDateTime, saved.StartDateTime);
        Assert.Equal(command.EndDateTime, saved.EndDateTime);
        var access = new DocumentAccessService(f.Db, f.Authorization);
        Assert.True(await access.CanAccessDocumentAsync(f.Officer.Id, doc.Id, "Inbox"));
        Assert.False(await access.CanAccessDocumentAsync(f.Other.Id, doc.Id, "Inbox"));
        Assert.Equal(id, (await f.Db.Notifications.SingleAsync()).CalendarEventId);
    }

    [Fact]
    public async Task IntakeGrant_DoesNotGrantCalendarCreation_AndLeaderCannotInviteAcrossDepartment()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var doc = new InboxDocument { Subject = "Giấy mời", ReceivedByUserId = f.Officer.Id };
        f.Db.InboxDocuments.Add(doc);
        f.Db.WorkflowPermissions.Add(new WorkflowPermission { UserId = f.Officer.Id, CanReceiveDocuments = true });
        await f.Db.SaveChangesAsync();
        var command = Request(f, doc); command.OrganizerId = f.Officer.Id;
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => new CalendarWorkflow(f.Db).CreateAsync(command, default));
        doc.ReceivedByUserId = f.Deputy.Id; await f.Db.SaveChangesAsync();
        command = Request(f, doc); command.ParticipantUserIds = new() { f.Other.Id };
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => new CalendarWorkflow(f.Db).CreateAsync(command, default));
        Assert.Empty(await f.Db.CalendarEvents.ToListAsync());
    }

    [Fact]
    public async Task InvalidTimesAndMissingConfirmationData_AreRejectedWithoutInventingValues()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var doc = new InboxDocument { Subject = "Giấy mời", ReceivedByUserId = f.Deputy.Id };
        f.Db.InboxDocuments.Add(doc); await f.Db.SaveChangesAsync();
        var workflow = new CalendarWorkflow(f.Db);
        var command = Request(f, doc); command.EndDateTime = command.StartDateTime.AddHours(-1);
        await Assert.ThrowsAsync<ArgumentException>(() => workflow.CreateAsync(command, default));
        command = Request(f, doc); command.StartDateTime = DateTime.SpecifyKind(command.StartDateTime, DateTimeKind.Unspecified);
        await Assert.ThrowsAsync<ArgumentException>(() => workflow.CreateAsync(command, default));
        command = Request(f, doc); command.Location = "";
        await Assert.ThrowsAsync<ArgumentException>(() => workflow.CreateAsync(command, default));
        command = Request(f, doc); command.ParticipantUserIds.Clear();
        await Assert.ThrowsAsync<ArgumentException>(() => workflow.CreateAsync(command, default));
        Assert.Empty(await f.Db.CalendarEvents.ToListAsync());
        Assert.Empty(await f.Db.Notifications.ToListAsync());
    }

    [Fact]
    public async Task ReadAccess_DoesNotGrantEditOrDelete_AndQueriesRequireRealCaller()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var doc = new InboxDocument { Subject = "Giấy mời", ReceivedByUserId = f.Deputy.Id };
        f.Db.InboxDocuments.Add(doc); await f.Db.SaveChangesAsync();
        var command = Request(f, doc);
        var id = await new CalendarWorkflow(f.Db).CreateAsync(command, default);
        var saved = await f.Db.CalendarEvents.SingleAsync();
        var query = new GetCalendarEventsQueryHandler(f.Db);
        Assert.Single(await query.Handle(new() { CurrentUserId = f.Officer.Id }, default));
        Assert.Empty(await query.Handle(new() { CurrentUserId = f.Other.Id }, default));
        Assert.Empty(await query.Handle(new(), default));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => new UpdateCalendarEventCommandHandler(f.Db).Handle(new()
        { Id = id, RequestId = Guid.NewGuid(), Version = saved.Version, UserId = f.Officer.Id, Title = "Giả mạo" }, default));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => new DeleteCalendarEventCommandHandler(f.Db).Handle(new()
        { Id = id, RequestId = Guid.NewGuid(), Version = saved.Version, UserId = f.Officer.Id }, default));
        Assert.False(saved.IsDeleted);
        Assert.Equal(command.Title, saved.Title);
    }

    [Fact]
    public async Task EditAndCancel_PreserveResponses_NotifyAffectedPeopleExactlyOnce()
    {
        await using var f = await UnifiedWorkflowTests.Fixture.New();
        var evt = new CalendarEvent { Title = "Lịch gốc", OrganizerId = f.Deputy.Id,
            StartDateTime = DateTime.UtcNow.AddDays(1), EndDateTime = DateTime.UtcNow.AddDays(1).AddHours(1) };
        var participant = new EventParticipant { EventId = evt.Id, UserId = f.Officer.Id, HasResponded = true, ResponseStatus = EventResponseStatusEnum.Accepted };
        evt.Participants.Add(participant); f.Db.CalendarEvents.Add(evt); await f.Db.SaveChangesAsync();
        var edit = new UpdateCalendarEventCommand { Id = evt.Id, UserId = f.Deputy.Id, RequestId = Guid.NewGuid(), Version = evt.Version,
            Title = "Bổ sung địa điểm", StartDateTime = evt.StartDateTime, EndDateTime = evt.EndDateTime,
            Location = "Phòng họp", ParticipantUserIds = new() { f.Officer.Id } };
        var handler = new UpdateCalendarEventCommandHandler(f.Db);
        await handler.Handle(edit, default); await handler.Handle(edit, default);
        var unchanged = await f.Db.EventParticipants.SingleAsync(p => !p.IsDeleted);
        Assert.Equal(participant.Id, unchanged.Id); Assert.True(unchanged.HasResponded);
        Assert.Equal(EventResponseStatusEnum.Accepted, unchanged.ResponseStatus);
        Assert.Single(await f.Db.Notifications.Where(n => n.CalendarEventId == evt.Id).ToListAsync());
        var cancel = new DeleteCalendarEventCommand { Id = evt.Id, UserId = f.Deputy.Id, RequestId = Guid.NewGuid(), Version = evt.Version };
        var delete = new DeleteCalendarEventCommandHandler(f.Db);
        await delete.Handle(cancel, default); await delete.Handle(cancel, default);
        Assert.True(evt.IsDeleted);
        Assert.Equal(2, await f.Db.Notifications.CountAsync(n => n.CalendarEventId == evt.Id && n.UserId == f.Officer.Id && n.RequiresRealtimeDelivery));
    }

    private static CreateCalendarEventCommand Request(UnifiedWorkflowTests.Fixture f, InboxDocument source) => new()
    {
        RequestId = Guid.NewGuid(), OrganizerId = f.Deputy.Id, Title = "Họp xác nhận từ giấy mời",
        SourceInboxDocumentId = source.Id, SourceDocumentVersion = source.Version,
        StartDateTime = new DateTime(2026, 10, 1, 1, 30, 0, DateTimeKind.Utc),
        EndDateTime = new DateTime(2026, 10, 1, 3, 0, 0, DateTimeKind.Utc),
        Location = "Phòng họp được chỉ định", ParticipantUserIds = new() { f.Officer.Id }, ReminderOffsetsMinutes = new() { 30 }
    };
}
