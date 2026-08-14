using System;
using System.Collections.Generic;
using Quanlycongviec.Domain.Common;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Domain.Entities
{
    public class CalendarEvent : BaseEntity
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        public EventTypeEnum EventType { get; set; } = EventTypeEnum.Meeting;

        public DateTime StartDateTime { get; set; }
        public DateTime EndDateTime { get; set; }
        public bool IsAllDay { get; set; } = false;

        public string? Location { get; set; }

        public Guid OrganizerId { get; set; }
        public User Organizer { get; set; } = null!;

        public Guid? DepartmentId { get; set; }
        public Department? Department { get; set; }

        public string? ColorTag { get; set; }

        public Guid? RelatedTaskItemId { get; set; }
        public TaskItem? RelatedTaskItem { get; set; }

        public ICollection<EventParticipant> Participants { get; set; } = new List<EventParticipant>();
        public ICollection<EventReminderOffset> ReminderOffsets { get; set; } = new List<EventReminderOffset>();
    }
}
