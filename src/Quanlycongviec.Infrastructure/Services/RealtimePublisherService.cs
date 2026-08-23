using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Models;
using Quanlycongviec.Infrastructure.Hubs;

namespace Quanlycongviec.Infrastructure.Services
{
    public class RealtimePublisherService : IRealtimePublisherService
    {
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly ILogger<RealtimePublisherService> _logger;

        public RealtimePublisherService(
            IHubContext<NotificationHub> hubContext,
            ILogger<RealtimePublisherService> logger)
        {
            _hubContext = hubContext;
            _logger = logger;
        }

        public async Task PublishToUserAsync<T>(Guid userId, string eventName, T data, CancellationToken cancellationToken = default)
        {
            try
            {
                var envelope = RealtimeEventEnvelope<T>.Create(eventName, data);
                await _hubContext.Clients.User(userId.ToString()).SendAsync(eventName, envelope, cancellationToken);
                _logger.LogInformation("SignalR Event '{EventName}' [{EventId}] published to User {UserId}", eventName, envelope.EventId, userId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to publish SignalR Event '{EventName}' to User {UserId}", eventName, userId);
            }
        }

        public async Task PublishToUsersAsync<T>(IEnumerable<Guid> userIds, string eventName, T data, CancellationToken cancellationToken = default)
        {
            var idList = userIds.Distinct().ToList();
            if (!idList.Any()) return;

            try
            {
                var envelope = RealtimeEventEnvelope<T>.Create(eventName, data);
                var stringIds = idList.Select(id => id.ToString()).ToList();
                await _hubContext.Clients.Users(stringIds).SendAsync(eventName, envelope, cancellationToken);
                _logger.LogInformation("SignalR Event '{EventName}' [{EventId}] published to {Count} Users", eventName, envelope.EventId, idList.Count);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to publish SignalR Event '{EventName}' to multiple users", eventName);
            }
        }

        public async Task PublishToGroupAsync<T>(string groupName, string eventName, T data, CancellationToken cancellationToken = default)
        {
            try
            {
                var envelope = RealtimeEventEnvelope<T>.Create(eventName, data);
                await _hubContext.Clients.Group(groupName).SendAsync(eventName, envelope, cancellationToken);
                _logger.LogInformation("SignalR Event '{EventName}' [{EventId}] published to Group '{GroupName}'", eventName, envelope.EventId, groupName);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to publish SignalR Event '{EventName}' to Group '{GroupName}'", eventName, groupName);
            }
        }

        public async Task BroadcastAsync<T>(string eventName, T data, CancellationToken cancellationToken = default)
        {
            try
            {
                var envelope = RealtimeEventEnvelope<T>.Create(eventName, data);
                await _hubContext.Clients.All.SendAsync(eventName, envelope, cancellationToken);
                _logger.LogInformation("SignalR Event '{EventName}' [{EventId}] broadcasted to all connected clients", eventName, envelope.EventId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast SignalR Event '{EventName}'", eventName);
            }
        }
    }
}
