using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Notifications.Commands.MarkRead
{
    public class MarkNotificationReadCommand : IRequest<bool>
    {
        public Guid UserId { get; set; }
        public List<Guid> NotificationIds { get; set; } = new();
        public bool MarkAllAsRead { get; set; } = false;

        public MarkNotificationReadCommand(Guid userId, List<Guid>? notificationIds = null, bool markAllAsRead = false)
        {
            UserId = userId;
            NotificationIds = notificationIds ?? new List<Guid>();
            MarkAllAsRead = markAllAsRead;
        }
    }

    public class MarkNotificationReadCommandHandler : IRequestHandler<MarkNotificationReadCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public MarkNotificationReadCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(MarkNotificationReadCommand request, CancellationToken cancellationToken)
        {
            var query = _context.Notifications
                .Where(n => n.UserId == request.UserId && !n.IsRead);

            if (!request.MarkAllAsRead)
            {
                if (!request.NotificationIds.Any()) return false;
                query = query.Where(n => request.NotificationIds.Contains(n.Id));
            }

            var notificationsToUpdate = await query.ToListAsync(cancellationToken);
            if (!notificationsToUpdate.Any()) return true;

            var now = DateTime.UtcNow;
            foreach (var n in notificationsToUpdate)
            {
                n.IsRead = true;
                n.ReadAt = now;
                n.UpdatedAt = now;
            }

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
