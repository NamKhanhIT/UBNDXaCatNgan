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
        public Guid RequestId { get; set; }
        public Guid? SourceInboxDocumentId { get; set; }
        public Guid? SourceDocumentVersion { get; set; }
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

    public class CreateCalendarEventCommandHandler(IApplicationDbContext context, INotificationDispatcher? dispatcher = null)
        : IRequestHandler<CreateCalendarEventCommand, Guid>
    {
        public Task<Guid> Handle(CreateCalendarEventCommand request, CancellationToken cancellationToken) =>
            new Quanlycongviec.Application.Common.Services.CalendarWorkflow(context, dispatcher).CreateAsync(request, cancellationToken);
    }
}
