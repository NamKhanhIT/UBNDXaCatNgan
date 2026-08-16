using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.PushNotifications.DTOs;

namespace Quanlycongviec.Application.Features.PushNotifications.Queries.GetMyPushSubscriptions
{
    public class GetMyPushSubscriptionsQuery : IRequest<List<PushSubscriptionDto>>
    {
        public Guid UserId { get; set; }

        public GetMyPushSubscriptionsQuery(Guid userId)
        {
            UserId = userId;
        }
    }

    public class GetMyPushSubscriptionsQueryHandler : IRequestHandler<GetMyPushSubscriptionsQuery, List<PushSubscriptionDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetMyPushSubscriptionsQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<PushSubscriptionDto>> Handle(GetMyPushSubscriptionsQuery request, CancellationToken cancellationToken)
        {
            return await _context.PushSubscriptions
                .Where(s => s.UserId == request.UserId && s.IsActive)
                .OrderByDescending(s => s.LastUsedAt ?? s.CreatedAt)
                .Select(s => new PushSubscriptionDto
                {
                    Id = s.Id,
                    UserId = s.UserId,
                    Endpoint = s.Endpoint,
                    DeviceLabel = s.DeviceLabel,
                    CreatedAt = s.CreatedAt,
                    LastUsedAt = s.LastUsedAt,
                    IsActive = s.IsActive
                })
                .ToListAsync(cancellationToken);
        }
    }
}
