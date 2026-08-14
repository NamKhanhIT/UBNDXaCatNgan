using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class EventReminderOffset : BaseEntity
    {
        public Guid EventId { get; set; }
        public CalendarEvent Event { get; set; } = null!;

        public int MinutesBefore { get; set; } = 30;
    }
}
