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
            var evt = await _context.CalendarEvents
                .Include(e => e.Participants)
                .Include(e => e.ReminderOffsets)
                .FirstOrDefaultAsync(e => e.Id == request.Id && !e.IsDeleted, cancellationToken);

            if (evt == null)
            {
                throw new InvalidOperationException($"Không tìm thấy sự kiện có Id = {request.Id}");
            }

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

            // Update Participants
            _context.EventParticipants.RemoveRange(evt.Participants);
            var participantIds = request.ParticipantUserIds.Distinct().ToList();
            foreach (var userId in participantIds)
            {
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
            var offsets = request.ReminderOffsetsMinutes.Count > 0 ? request.ReminderOffsetsMinutes.Distinct().ToList() : new List<int> { 30 };
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

            // Ghi Audit Log
            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Action = "UpdateCalendarEvent",
                EntityName = nameof(CalendarEvent),
                EntityId = evt.Id.ToString(),
                Details = $"Cập nhật sự kiện lịch: {evt.Title}"
            });

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
