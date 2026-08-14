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
            var evt = await _context.CalendarEvents.FirstOrDefaultAsync(e => e.Id == request.Id && !e.IsDeleted, cancellationToken);
            if (evt == null)
            {
                return false;
            }

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

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
