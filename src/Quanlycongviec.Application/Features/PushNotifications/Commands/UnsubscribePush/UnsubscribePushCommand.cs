using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.PushNotifications.Commands.UnsubscribePush
{
    public class UnsubscribePushCommand : IRequest<bool>
    {
        public Guid UserId { get; set; }
        public string? Endpoint { get; set; }
        public Guid? SubscriptionId { get; set; }
    }

    public class UnsubscribePushCommandHandler : IRequestHandler<UnsubscribePushCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public UnsubscribePushCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(UnsubscribePushCommand request, CancellationToken cancellationToken)
        {
            var query = _context.PushSubscriptions
                .Where(s => s.UserId == request.UserId);

            if (request.SubscriptionId.HasValue)
            {
                query = query.Where(s => s.Id == request.SubscriptionId.Value);
            }
            else if (!string.IsNullOrWhiteSpace(request.Endpoint))
            {
                query = query.Where(s => s.Endpoint == request.Endpoint);
            }
            else
            {
                // Vô hiệu hoá toàn bộ subscription của user
            }

            var subscriptions = await query.ToListAsync(cancellationToken);
            if (!subscriptions.Any())
            {
                return false;
            }

            foreach (var sub in subscriptions)
            {
                sub.IsActive = false;
            }

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
