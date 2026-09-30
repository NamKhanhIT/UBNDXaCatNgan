using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Features.CalendarEvents.Commands.DeleteCalendarEvent
{
    public class DeleteCalendarEventCommand : IRequest<bool>
    {
        public Guid Id { get; set; }
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid UserId { get; set; }
    }

    public class DeleteCalendarEventCommandHandler : IRequestHandler<DeleteCalendarEventCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public DeleteCalendarEventCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(DeleteCalendarEventCommand request, CancellationToken cancellationToken)
        {
            var actor = await new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context).ActorAsync(request.UserId, cancellationToken)
                ?? throw new UnauthorizedAccessException();
            var ops = new Quanlycongviec.Application.Common.Services.WorkflowOperations(_context);
            var fingerprint = Quanlycongviec.Application.Common.Services.WorkflowOperations.Fingerprint("DeleteCalendarEvent", request);
            if (await ops.ReplayAsync(actor.Id, request.RequestId, fingerprint, cancellationToken) != null) return true;
            var evt = await _context.CalendarEvents.Include(e => e.Participants).FirstOrDefaultAsync(e => e.Id == request.Id && !e.IsDeleted, cancellationToken);
            if (evt == null)
            {
                return false;
            }

            if (evt.OrganizerId != actor.Id) throw new UnauthorizedAccessException("Chỉ người tạo lịch được hủy lịch.");
            Quanlycongviec.Application.Common.Services.WorkflowOperations.CheckVersion(evt.Version, request.Version);
            evt.Version = Guid.NewGuid();
            evt.IsDeleted = true;
            evt.UpdatedAt = DateTime.UtcNow;

            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Action = "DeleteCalendarEvent",
                EntityName = nameof(CalendarEvent),
                EntityId = evt.Id.ToString(),
                Details = $"Xóa sự kiện lịch (Soft Delete): {evt.Title}"
            });

            foreach (var participant in evt.Participants.Where(p => !p.IsDeleted && p.UserId != actor.Id).DistinctBy(p => p.UserId))
                _context.Notifications.Add(new Notification { UserId = participant.UserId, CalendarEventId = evt.Id,
                    Type = Quanlycongviec.Domain.Enums.NotificationType.EventReminder, RequiresRealtimeDelivery = true,
                    Title = "Lịch đã hủy: " + evt.Title, Message = "Người tổ chức đã hủy lịch này.", SentAt = DateTime.UtcNow });
            await ops.CommitAsync(actor.Id, request.RequestId, fingerprint, evt.Id, cancellationToken);
            return true;
        }
    }
}
