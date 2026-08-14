using System;
using System.Collections.Generic;

namespace Quanlycongviec.Application.Features.CalendarEvents.DTOs
{
    public class CalendarEventDto
    {
        public Guid Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string EventType { get; set; } = string.Empty;
        public string EventTypeName { get; set; } = string.Empty;
        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public bool IsAllDay { get; set; }
        public string? Location { get; set; }

        public Guid OrganizerId { get; set; }
        public string OrganizerName { get; set; } = string.Empty;

        public Guid? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }

        public string? ColorTag { get; set; }
        public Guid? RelatedTaskItemId { get; set; }

        public List<EventParticipantDto> Participants { get; set; } = new();
        public List<int> ReminderOffsetsMinutes { get; set; } = new();
    }

    public class EventParticipantDto
    {
        public Guid UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public bool HasResponded { get; set; }
        public string ResponseStatus { get; set; } = "Pending";
    }
}
