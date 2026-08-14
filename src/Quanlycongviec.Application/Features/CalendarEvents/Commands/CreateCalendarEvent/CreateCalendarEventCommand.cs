using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.CalendarEvents.Commands.CreateCalendarEvent
{
    public class CreateCalendarEventCommand : IRequest<Guid>
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public EventTypeEnum EventType { get; set; } = EventTypeEnum.Meeting;
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public bool IsAllDay { get; set; } = false;
        public string? Location { get; set; }
        public Guid OrganizerId { get; set; }
        public Guid? DepartmentId { get; set; }
        public string? ColorTag { get; set; }
        public Guid? RelatedTaskItemId { get; set; }

        public List<Guid> ParticipantUserIds { get; set; } = new();
        public List<int> ReminderOffsetsMinutes { get; set; } = new();
    }

    public class CreateCalendarEventCommandHandler : IRequestHandler<CreateCalendarEventCommand, Guid>
    {
        private readonly IApplicationDbContext _context;

        public CreateCalendarEventCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Handle(CreateCalendarEventCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Title))
            {
                throw new ArgumentException("Tiêu đề sự kiện không được để trống.");
            }

            var startUtc = request.StartDateTime.Kind == DateTimeKind.Utc ? request.StartDateTime : DateTime.SpecifyKind(request.StartDateTime, DateTimeKind.Utc);
            var endUtc = request.EndDateTime.Kind == DateTimeKind.Utc ? request.EndDateTime : DateTime.SpecifyKind(request.EndDateTime, DateTimeKind.Utc);

            if (endUtc < startUtc)
            {
                endUtc = startUtc.AddHours(1);
            }

            var calendarEvent = new CalendarEvent
            {
                Id = Guid.NewGuid(),
                Title = request.Title.Trim(),
                Description = request.Description ?? string.Empty,
                EventType = request.EventType,
                StartDateTime = startUtc,
                EndDateTime = endUtc,
                IsAllDay = request.IsAllDay,
                Location = request.Location,
                OrganizerId = request.OrganizerId,
                DepartmentId = request.DepartmentId,
                ColorTag = request.ColorTag,
                RelatedTaskItemId = request.RelatedTaskItemId,
                CreatedAt = DateTime.UtcNow
            };

            _context.CalendarEvents.Add(calendarEvent);

            // Thêm người tham gia
            var participantIds = request.ParticipantUserIds.Distinct().ToList();
            foreach (var userId in participantIds)
            {
                _context.EventParticipants.Add(new EventParticipant
                {
                    Id = Guid.NewGuid(),
                    EventId = calendarEvent.Id,
                    UserId = userId,
                    HasResponded = false,
                    ResponseStatus = EventResponseStatusEnum.Pending,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Thêm mốc nhắc trước (Mặc định 30 phút nếu rỗng)
            var offsets = request.ReminderOffsetsMinutes.Count > 0 ? request.ReminderOffsetsMinutes.Distinct().ToList() : new List<int> { 30 };
            foreach (var minutes in offsets)
            {
                _context.EventReminderOffsets.Add(new EventReminderOffset
                {
                    Id = Guid.NewGuid(),
                    EventId = calendarEvent.Id,
                    MinutesBefore = minutes,
                    CreatedAt = DateTime.UtcNow
                });
            }

            // Ghi Audit Log
            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.OrganizerId,
                Action = "CreateCalendarEvent",
                EntityName = nameof(CalendarEvent),
                EntityId = calendarEvent.Id.ToString(),
                Details = $"Tạo sự kiện lịch: {calendarEvent.Title} ({calendarEvent.StartDateTime:dd/MM/yyyy HH:mm} - {calendarEvent.EndDateTime:dd/MM/yyyy HH:mm})"
            });

            await _context.SaveChangesAsync(cancellationToken);
            return calendarEvent.Id;
        }
    }
}
