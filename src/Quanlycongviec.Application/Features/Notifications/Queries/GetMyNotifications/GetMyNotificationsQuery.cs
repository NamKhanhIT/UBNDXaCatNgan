using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Notifications.DTOs;

namespace Quanlycongviec.Application.Features.Notifications.Queries.GetMyNotifications
{
    public class GetMyNotificationsQuery : IRequest<UserNotificationsVm>
    {
        public Guid UserId { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;

        public GetMyNotificationsQuery(Guid userId, int page = 1, int pageSize = 20)
        {
            UserId = userId;
            Page = page <= 0 ? 1 : page;
            PageSize = pageSize <= 0 ? 20 : pageSize;
        }
    }

    public class GetMyNotificationsQueryHandler : IRequestHandler<GetMyNotificationsQuery, UserNotificationsVm>
    {
        private readonly IApplicationDbContext _context;

        public GetMyNotificationsQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<UserNotificationsVm> Handle(GetMyNotificationsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Notifications
                .Where(n => n.UserId == request.UserId && !n.IsDeleted);

            int unreadCount = await query.CountAsync(n => !n.IsRead, cancellationToken);
            int totalCount = await query.CountAsync(cancellationToken);

            var items = await query
                .OrderByDescending(n => n.CreatedAt)
                .Skip((request.Page - 1) * request.PageSize)
                .Take(request.PageSize)
                .Select(n => new NotificationDto
                {
                    Id = n.Id,
                    UserId = n.UserId,
                    TaskItemId = n.TaskItemId,
                    Type = n.Type.ToString(),
                    Channel = n.Channel.ToString(),
                    Title = n.Title,
                    Message = n.Message,
                    CreatedAt = n.CreatedAt,
                    SentAt = n.SentAt,
                    ReadAt = n.ReadAt,
                    IsRead = n.IsRead
                })
                .ToListAsync(cancellationToken);

            return new UserNotificationsVm
            {
                Items = items,
                UnreadCount = unreadCount,
                TotalCount = totalCount
            };
        }
    }
}
