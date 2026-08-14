using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.CalendarEvents.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.CalendarEvents.Queries.GetCalendarEvents
{
    public class GetCalendarEventsQuery : IRequest<List<CalendarEventDto>>
    {
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public Guid? DepartmentId { get; set; }
        public Guid? UserId { get; set; }
    }

    public class GetCalendarEventsQueryHandler : IRequestHandler<GetCalendarEventsQuery, List<CalendarEventDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetCalendarEventsQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<CalendarEventDto>> Handle(GetCalendarEventsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.CalendarEvents
                .Include(e => e.Organizer)
                .Include(e => e.Department)
                .Include(e => e.Participants)
                    .ThenInclude(p => p.User)
                .Include(e => e.ReminderOffsets)
                .Where(e => !e.IsDeleted);

            if (request.From.HasValue)
            {
                var fromUtc = request.From.Value.Kind == DateTimeKind.Utc ? request.From.Value : DateTime.SpecifyKind(request.From.Value, DateTimeKind.Utc);
                query = query.Where(e => e.EndDateTime >= fromUtc);
            }

            if (request.To.HasValue)
            {
                var toUtc = request.To.Value.Kind == DateTimeKind.Utc ? request.To.Value : DateTime.SpecifyKind(request.To.Value, DateTimeKind.Utc);
                query = query.Where(e => e.StartDateTime <= toUtc);
            }

            if (request.DepartmentId.HasValue)
            {
                query = query.Where(e => e.DepartmentId == request.DepartmentId.Value);
            }

            if (request.UserId.HasValue)
            {
                query = query.Where(e => e.OrganizerId == request.UserId.Value || e.Participants.Any(p => p.UserId == request.UserId.Value));
            }

            var events = await query
                .OrderBy(e => e.StartDateTime)
                .ToListAsync(cancellationToken);

            return events.Select(e => new CalendarEventDto
            {
                Id = e.Id,
                Title = e.Title,
                Description = e.Description,
                EventType = e.EventType.ToString(),
                EventTypeName = GetEventTypeName(e.EventType),
                StartDateTime = e.StartDateTime,
                EndDateTime = e.EndDateTime,
                IsAllDay = e.IsAllDay,
                Location = e.Location,
                OrganizerId = e.OrganizerId,
                OrganizerName = e.Organizer != null ? e.Organizer.FullName : string.Empty,
                DepartmentId = e.DepartmentId,
                DepartmentName = e.Department != null ? e.Department.Name : string.Empty,
                ColorTag = e.ColorTag,
                RelatedTaskItemId = e.RelatedTaskItemId,
                Participants = e.Participants.Select(p => new EventParticipantDto
                {
                    UserId = p.UserId,
                    UserName = p.User != null ? p.User.FullName : string.Empty,
                    HasResponded = p.HasResponded,
                    ResponseStatus = p.ResponseStatus.ToString()
                }).ToList(),
                ReminderOffsetsMinutes = e.ReminderOffsets.Select(r => r.MinutesBefore).ToList()
            }).ToList();
        }

        public static string GetEventTypeName(EventTypeEnum type)
        {
            return type switch
            {
                EventTypeEnum.Meeting => "Cuộc họp",
                EventTypeEnum.Conference => "Hội nghị / Đại hội",
                EventTypeEnum.Training => "Tập huấn / Bồi dưỡng",
                EventTypeEnum.FieldTrip => "Đi công tác / Khảo sát",
                _ => "Sự kiện khác"
            };
        }
    }
}
