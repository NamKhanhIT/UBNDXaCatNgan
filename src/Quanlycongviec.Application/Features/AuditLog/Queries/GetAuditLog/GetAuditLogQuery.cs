using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.AuditLogs.Queries.GetAuditLog
{
    public class GetAuditLogQuery : IRequest<AuditLogResultDto>
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public Guid? FilterByUserId { get; set; }
        public string? FilterByAction { get; set; }
    }

    public class AuditLogItemDto
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string ActingRole { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string EntityName { get; set; } = string.Empty;
        public string EntityId { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public bool IsDelegatedAction { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class AuditLogResultDto
    {
        public List<AuditLogItemDto> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    public class GetAuditLogQueryHandler : IRequestHandler<GetAuditLogQuery, AuditLogResultDto>
    {
        private readonly IApplicationDbContext _context;

        public GetAuditLogQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<AuditLogResultDto> Handle(GetAuditLogQuery request, CancellationToken cancellationToken)
        {
            var query = _context.AuditLogs.AsQueryable();

            if (request.FilterByUserId.HasValue)
                query = query.Where(a => a.UserId == request.FilterByUserId.Value);

            if (!string.IsNullOrWhiteSpace(request.FilterByAction))
                query = query.Where(a => a.Action == request.FilterByAction);

            var totalCount = await query.CountAsync(cancellationToken);

            var items = await query
                .OrderByDescending(a => a.CreatedAt)
                .Skip((request.Page - 1) * request.PageSize)
                .Take(request.PageSize)
                .Select(a => new AuditLogItemDto
                {
                    Id = a.Id,
                    UserId = a.UserId,
                    Username = a.Username,
                    ActingRole = a.ActingRole,
                    Action = a.Action,
                    EntityName = a.EntityName,
                    EntityId = a.EntityId,
                    Details = a.Details,
                    IpAddress = a.IpAddress,
                    IsDelegatedAction = a.IsDelegatedAction,
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync(cancellationToken);

            return new AuditLogResultDto
            {
                Items = items,
                TotalCount = totalCount,
                Page = request.Page,
                PageSize = request.PageSize
            };
        }
    }
}
