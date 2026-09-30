using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.CalendarEvents.Commands.CreateCalendarEvent;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Common.Services;

public sealed class CalendarWorkflow(IApplicationDbContext db, INotificationDispatcher? dispatcher = null)
{
    public static bool CanInvite(WorkflowActor organizer, WorkflowActor person) =>
        organizer.Id == person.Id || WorkflowAccess.CanAssign(organizer, person);

    public async Task<Guid> CreateAsync(CreateCalendarEventCommand request, CancellationToken ct)
    {
        var access = new WorkflowAccess(db);
        var actor = await access.ActorAsync(request.OrganizerId, ct) ?? throw new UnauthorizedAccessException("Phiên làm việc không hợp lệ.");
        var ops = new WorkflowOperations(db, dispatcher);
        var fingerprint = WorkflowOperations.Fingerprint("CreateCalendarEvent", request);
        var replay = await ops.ReplayAsync(actor.Id, request.RequestId, fingerprint, ct);
        if (replay.HasValue) return replay.Value;
        if (string.IsNullOrWhiteSpace(request.Title)) throw new ArgumentException("Vui lòng nhập tên lịch.");
        if (request.ParticipantUserIds == null || request.ReminderOffsetsMinutes == null)
            throw new ArgumentException("Danh sách tham dự và mốc nhắc phải được cung cấp, có thể là danh sách rỗng.");
        ValidateTimes(request.StartDateTime, request.EndDateTime);
        if (!Enum.IsDefined(request.EventType)) throw new ArgumentException("Loại lịch không hợp lệ.");
        if (request.DepartmentId.HasValue && !await db.Departments.AnyAsync(d => d.Id == request.DepartmentId && !d.IsDeleted, ct))
            throw new ArgumentException("Phòng ban không hợp lệ.");
        if (request.DepartmentId.HasValue && request.DepartmentId != actor.DepartmentId && actor.Rank > 2 && actor.RoleCode != "ChanhVanPhong")
            throw new UnauthorizedAccessException("Không được tạo lịch cho phòng ban ngoài phạm vi quản lý.");
        if (request.RelatedTaskItemId.HasValue && !await access.Tasks(actor).AnyAsync(t => t.Id == request.RelatedTaskItemId, ct))
            throw new UnauthorizedAccessException("Không được liên kết công việc ngoài quyền truy cập.");
        var participantIds = request.ParticipantUserIds.Distinct().ToList();
        await ValidateParticipantsAsync(actor, participantIds, ct);
        if (request.SourceInboxDocumentId.HasValue)
        {
            var doc = await access.Inbox(actor).FirstOrDefaultAsync(d => d.Id == request.SourceInboxDocumentId, ct)
                ?? throw new UnauthorizedAccessException("Không được truy cập giấy mời này.");
            if (!await access.CanAssignFromInboxAsync(actor, doc, ct))
                throw new UnauthorizedAccessException("Chỉ lãnh đạo có quyền xử lý văn bản được xác nhận tạo lịch.");
            WorkflowOperations.CheckVersion(doc.Version, request.SourceDocumentVersion);
            if (string.IsNullOrWhiteSpace(request.Location) || participantIds.Count == 0)
                throw new ArgumentException("Vui lòng xác nhận địa điểm và danh sách tham dự từ giấy mời.");
            doc.Version = Guid.NewGuid(); doc.UpdatedAt = DateTime.UtcNow;
        }
        if (request.ReminderOffsetsMinutes.Any(m => m < 0 || m > 525600))
            throw new ArgumentException("Mốc nhắc lịch không hợp lệ.");
        var calendarEvent = new CalendarEvent { Title = request.Title.Trim(), Description = request.Description,
            StartDateTime = request.StartDateTime, EndDateTime = request.EndDateTime, Location = request.Location?.Trim(),
            OrganizerId = actor.Id, DepartmentId = request.DepartmentId, EventType = request.EventType,
            IsAllDay = request.IsAllDay, ColorTag = request.ColorTag, RelatedTaskItemId = request.RelatedTaskItemId,
            SourceInboxDocumentId = request.SourceInboxDocumentId };
        db.CalendarEvents.Add(calendarEvent);
        foreach (var userId in participantIds)
            db.EventParticipants.Add(new EventParticipant { EventId = calendarEvent.Id, UserId = userId, ResponseStatus = EventResponseStatusEnum.Pending });
        foreach (var minutes in request.ReminderOffsetsMinutes.Distinct())
            db.EventReminderOffsets.Add(new EventReminderOffset { EventId = calendarEvent.Id, MinutesBefore = minutes });
        ops.Audit(actor.Id, "CreateCalendarEvent", "CalendarEvent", calendarEvent.Id,
            $"Tạo lịch: {calendarEvent.Title} ({calendarEvent.StartDateTime.AddHours(7):HH:mm, dd-MM-yyyy} – {calendarEvent.EndDateTime.AddHours(7):HH:mm, dd-MM-yyyy})");
        var notifications = participantIds.Where(id => id != actor.Id).Select(id => new Notification
        {
            UserId = id, CalendarEventId = calendarEvent.Id, Type = NotificationType.EventReminder,
            Title = "Lịch mới: " + calendarEvent.Title,
            Message = $"Bắt đầu {calendarEvent.StartDateTime.AddHours(7):HH:mm, dd-MM-yyyy}. Địa điểm: {calendarEvent.Location ?? "Chưa xác định"}.",
            RequiresRealtimeDelivery = true
        }).ToList();
        db.Notifications.AddRange(notifications);
        var result = await ops.CommitAsync(actor.Id, request.RequestId, fingerprint, calendarEvent.Id, ct);
        await ops.PublishAsync(notifications, ct);
        return result;
    }

    public static void ValidateTimes(DateTime start, DateTime end)
    {
        WorkflowOperations.Utc(start); WorkflowOperations.Utc(end);
        if (start == default || end <= start) throw new ArgumentException("Vui lòng xác nhận thời gian kết thúc sau thời gian bắt đầu.");
    }

    public async Task ValidateParticipantsAsync(WorkflowActor actor, IEnumerable<Guid> participants, CancellationToken ct)
    {
        var access = new WorkflowAccess(db);
        foreach (var id in participants.Distinct())
        {
            var person = await access.ActorAsync(id, ct);
            if (person == null) throw new ArgumentException("Danh sách tham dự có tài khoản không hợp lệ.");
            if (!CanInvite(actor, person)) throw new UnauthorizedAccessException("Người tham dự nằm ngoài phạm vi quản lý.");
        }
    }
}
