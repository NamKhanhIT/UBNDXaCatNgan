using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.CalendarEvents.Commands.UpdateCalendarEvent
{
    public class UpdateCalendarEventCommand : IRequest<bool>
    {
        public Guid Id { get; set; }
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public EventTypeEnum EventType { get; set; }
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public bool IsAllDay { get; set; }
        public string? Location { get; set; }
        public Guid? DepartmentId { get; set; }
        public string? ColorTag { get; set; }
        public Guid UserId { get; set; }

        public List<Guid> ParticipantUserIds { get; set; } = new();
        public List<int> ReminderOffsetsMinutes { get; set; } = new();
    }

    public class UpdateCalendarEventCommandHandler : IRequestHandler<UpdateCalendarEventCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public UpdateCalendarEventCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(UpdateCalendarEventCommand request, CancellationToken cancellationToken)
        {
            var access = new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context);
            var actor = await access.ActorAsync(request.UserId, cancellationToken) ?? throw new UnauthorizedAccessException();
            var ops = new Quanlycongviec.Application.Common.Services.WorkflowOperations(_context);
            var fingerprint = Quanlycongviec.Application.Common.Services.WorkflowOperations.Fingerprint("UpdateCalendarEvent", request);
            if (await ops.ReplayAsync(actor.Id, request.RequestId, fingerprint, cancellationToken) != null) return true;
            var evt = await _context.CalendarEvents
                .Include(e => e.Participants)
                .Include(e => e.ReminderOffsets)
                .FirstOrDefaultAsync(e => e.Id == request.Id && !e.IsDeleted, cancellationToken);

            if (evt == null)
            {
                throw new InvalidOperationException($"Không tìm thấy sự kiện có Id = {request.Id}");
            }
            if (evt.OrganizerId != actor.Id) throw new UnauthorizedAccessException("Chỉ người tạo lịch được sửa lịch.");
            Quanlycongviec.Application.Common.Services.WorkflowOperations.CheckVersion(evt.Version, request.Version);
            if (request.ParticipantUserIds == null || request.ReminderOffsetsMinutes == null)
                throw new ArgumentException("Vui lòng xác nhận danh sách tham dự và mốc nhắc.");
            if (!Enum.IsDefined(request.EventType)) throw new ArgumentException("Loại lịch không hợp lệ.");
            if (request.DepartmentId.HasValue && !await _context.Departments.AnyAsync(d => d.Id == request.DepartmentId && !d.IsDeleted, cancellationToken))
                throw new ArgumentException("Phòng ban không hợp lệ.");
            await new Quanlycongviec.Application.Common.Services.CalendarWorkflow(_context).ValidateParticipantsAsync(actor, request.ParticipantUserIds, cancellationToken);
            if (evt.SourceInboxDocumentId.HasValue && (string.IsNullOrWhiteSpace(request.Location) || request.ParticipantUserIds.Count == 0))
                throw new ArgumentException("Lịch từ giấy mời cần địa điểm và danh sách tham dự được xác nhận.");
            if (request.DepartmentId.HasValue && request.DepartmentId != actor.DepartmentId && actor.Rank > 2 && actor.RoleCode != "ChanhVanPhong")
                throw new UnauthorizedAccessException("Không được chuyển lịch sang phòng ban ngoài quyền quản lý.");

            if (string.IsNullOrWhiteSpace(request.Title))
            {
                throw new ArgumentException("Tiêu đề sự kiện không được để trống.");
            }

            Quanlycongviec.Application.Common.Services.CalendarWorkflow.ValidateTimes(request.StartDateTime, request.EndDateTime);
            var startUtc = request.StartDateTime;
            var endUtc = request.EndDateTime;
            if (request.ReminderOffsetsMinutes.Any(m => m < 0 || m > 525600)) throw new ArgumentException("Mốc nhắc lịch không hợp lệ.");

            var previousParticipants = evt.Participants.Where(p => !p.IsDeleted).Select(p => p.UserId).ToList();
            var previousTime = $"{evt.StartDateTime.AddHours(7):HH:mm, dd-MM-yyyy} – {evt.EndDateTime.AddHours(7):HH:mm, dd-MM-yyyy}";
            evt.Title = request.Title.Trim();
            evt.Description = request.Description ?? string.Empty;
            evt.EventType = request.EventType;
            evt.StartDateTime = startUtc;
            evt.EndDateTime = endUtc;
            evt.IsAllDay = request.IsAllDay;
            evt.Location = request.Location;
            evt.DepartmentId = request.DepartmentId;
            evt.ColorTag = request.ColorTag;
            evt.UpdatedAt = DateTime.UtcNow;
            evt.Version = Guid.NewGuid();

            // Preserve the identity and response of retained participants, including attendance evidence.
            var participantIds = request.ParticipantUserIds.Distinct().ToList();
            foreach (var participant in evt.Participants.Where(p => !p.IsDeleted && !participantIds.Contains(p.UserId)))
            { participant.IsDeleted = true; participant.UpdatedAt = DateTime.UtcNow; }
            foreach (var userId in participantIds)
            {
                if (evt.Participants.Any(p => p.UserId == userId && !p.IsDeleted)) continue;
                _context.EventParticipants.Add(new EventParticipant
                {
                    Id = Guid.NewGuid(),
                    EventId = evt.Id,
                    UserId = userId,
                    HasResponded = false,
                    ResponseStatus = EventResponseStatusEnum.Pending,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Update ReminderOffsets
            _context.EventReminderOffsets.RemoveRange(evt.ReminderOffsets);
            var offsets = request.ReminderOffsetsMinutes.Distinct().ToList();
            foreach (var minutes in offsets)
            {
                _context.EventReminderOffsets.Add(new EventReminderOffset
                {
                    Id = Guid.NewGuid(),
                    EventId = evt.Id,
                    MinutesBefore = minutes,
                    CreatedAt = DateTime.UtcNow
                });
            }

            ops.Audit(actor.Id, "UpdateCalendarEvent", nameof(CalendarEvent), evt.Id,
                $"Cập nhật lịch: {evt.Title}. Thời gian cũ {previousTime}; mới {evt.StartDateTime.AddHours(7):HH:mm, dd-MM-yyyy} – {evt.EndDateTime.AddHours(7):HH:mm, dd-MM-yyyy}.");
            var affected = previousParticipants.Union(participantIds).Where(id => id != actor.Id).ToList();
            var notifications = affected.Select(id => new Notification
            {
                UserId = id, CalendarEventId = evt.Id, Type = NotificationType.EventReminder, RequiresRealtimeDelivery = true,
                Title = participantIds.Contains(id) ? "Lịch được cập nhật: " + evt.Title : "Thay đổi danh sách tham dự: " + evt.Title,
                Message = participantIds.Contains(id) ? $"Bắt đầu {evt.StartDateTime.AddHours(7):HH:mm, dd-MM-yyyy}. Địa điểm: {evt.Location ?? "Chưa xác định"}."
                    : "Người tổ chức đã bỏ bạn khỏi danh sách tham dự lịch này.", SentAt = DateTime.UtcNow
            }).ToList();
            _context.Notifications.AddRange(notifications);
            await ops.CommitAsync(actor.Id, request.RequestId, fingerprint, evt.Id, cancellationToken);
            return true;
        }
    }
}
