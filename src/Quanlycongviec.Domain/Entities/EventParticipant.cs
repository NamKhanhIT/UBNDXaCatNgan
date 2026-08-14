using System;
using Quanlycongviec.Domain.Common;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Domain.Entities
{
    public class EventParticipant : BaseEntity
    {
        public Guid EventId { get; set; }
        public CalendarEvent Event { get; set; } = null!;

        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public bool HasResponded { get; set; } = false;
        public EventResponseStatusEnum ResponseStatus { get; set; } = EventResponseStatusEnum.Pending;
    }
}
