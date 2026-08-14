using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class ReminderLog : BaseEntity
    {
        public Guid? TaskItemId { get; set; }
        public TaskItem? TaskItem { get; set; }

        public Guid? CalendarEventId { get; set; }
        public CalendarEvent? CalendarEvent { get; set; }

        public Guid? UserId { get; set; }
        public User? User { get; set; }

        public string ReminderType { get; set; } = string.Empty; // e.g. BeforeDeadline3d, BeforeDeadline1d, Overdue, Escalation, WeeklySummary_2026_32
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
    }
}
