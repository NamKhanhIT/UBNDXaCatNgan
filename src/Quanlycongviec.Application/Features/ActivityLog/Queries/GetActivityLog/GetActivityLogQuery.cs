using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.ActivityLogs.Queries.GetActivityLog
{
    public class GetActivityLogQuery : IRequest<ActivityLogResultDto>
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public Guid? FilterByUserId { get; set; }
    }

    public class ActivityLogItemDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string UserFullName { get; set; } = string.Empty;
        public string ActionType { get; set; } = string.Empty;
        public string TargetEntityType { get; set; } = string.Empty;
        public string TargetEntityId { get; set; } = string.Empty;
        public string Summary { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class ActivityLogResultDto
    {
        public List<ActivityLogItemDto> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    public class GetActivityLogQueryHandler : IRequestHandler<GetActivityLogQuery, ActivityLogResultDto>
    {
        private readonly IApplicationDbContext _context;

        public GetActivityLogQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<ActivityLogResultDto> Handle(GetActivityLogQuery request, CancellationToken cancellationToken)
        {
            var query = _context.ActivityLogs
                .Include(a => a.User)
                .AsQueryable();

            if (request.FilterByUserId.HasValue)
            {
                query = query.Where(a => a.UserId == request.FilterByUserId.Value);
            }

            var totalCount = await query.CountAsync(cancellationToken);

            var items = await query
                .OrderByDescending(a => a.CreatedAt)
                .Skip((request.Page - 1) * request.PageSize)
                .Take(request.PageSize)
                .Select(a => new ActivityLogItemDto
                {
                    Id = a.Id,
                    UserId = a.UserId,
                    UserFullName = a.User != null ? a.User.FullName : "Hệ thống",
                    ActionType = a.ActionType,
                    TargetEntityType = a.TargetEntityType,
                    TargetEntityId = a.TargetEntityId,
                    Summary = a.Summary,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync(cancellationToken);

            return new ActivityLogResultDto
            {
                Items = items,
                TotalCount = totalCount,
                Page = request.Page,
                PageSize = request.PageSize
            };
        }
    }
}
