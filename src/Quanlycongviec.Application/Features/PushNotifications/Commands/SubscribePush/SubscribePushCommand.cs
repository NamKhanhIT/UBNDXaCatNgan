using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.PushNotifications.DTOs;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Features.PushNotifications.Commands.SubscribePush
{
    public class SubscribePushCommand : IRequest<PushSubscriptionDto>
    {
        public Guid UserId { get; set; }
        public string Endpoint { get; set; } = string.Empty;
        public string P256dhKey { get; set; } = string.Empty;
        public string AuthKey { get; set; } = string.Empty;
        public string? DeviceLabel { get; set; }
    }

    public class SubscribePushCommandHandler : IRequestHandler<SubscribePushCommand, PushSubscriptionDto>
    {
        private readonly IApplicationDbContext _context;

        public SubscribePushCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<PushSubscriptionDto> Handle(SubscribePushCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Endpoint))
            {
                throw new ArgumentException("Endpoint không được để trống.", nameof(request.Endpoint));
            }

            var existing = await _context.PushSubscriptions
                .FirstOrDefaultAsync(s => s.Endpoint == request.Endpoint, cancellationToken);

            if (existing != null)
            {
                existing.UserId = request.UserId;
                existing.P256dhKey = request.P256dhKey;
                existing.AuthKey = request.AuthKey;
                existing.DeviceLabel = !string.IsNullOrWhiteSpace(request.DeviceLabel) ? request.DeviceLabel : existing.DeviceLabel;
                existing.IsActive = true;
                existing.LastUsedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync(cancellationToken);

                return new PushSubscriptionDto
                {
                    Id = existing.Id,
                    UserId = existing.UserId,
                    Endpoint = existing.Endpoint,
                    DeviceLabel = existing.DeviceLabel,
                    CreatedAt = existing.CreatedAt,
                    LastUsedAt = existing.LastUsedAt,
                    IsActive = existing.IsActive
                };
            }

            var newSub = new PushSubscription
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Endpoint = request.Endpoint,
                P256dhKey = request.P256dhKey,
                AuthKey = request.AuthKey,
                DeviceLabel = request.DeviceLabel ?? "Thiết bị cá nhân",
                CreatedAt = DateTime.UtcNow,
                LastUsedAt = DateTime.UtcNow,
                IsActive = true
            };

            _context.PushSubscriptions.Add(newSub);
            await _context.SaveChangesAsync(cancellationToken);

            return new PushSubscriptionDto
            {
                Id = newSub.Id,
                UserId = newSub.UserId,
                Endpoint = newSub.Endpoint,
                DeviceLabel = newSub.DeviceLabel,
                CreatedAt = newSub.CreatedAt,
                LastUsedAt = newSub.LastUsedAt,
                IsActive = newSub.IsActive
            };
        }
    }
}
