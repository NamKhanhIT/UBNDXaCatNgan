using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Inbox.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocumentsPaginated
{
    public class GetInboxDocumentsPaginatedQuery : IRequest<PaginatedResult<InboxDocumentDto>>
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
        public bool? IsScheduled { get; set; }
        public string? Channel { get; set; }
        public string? Search { get; set; }
        public bool? IsUrgent { get; set; }
    }

    public class GetInboxDocumentsPaginatedQueryHandler
        : IRequestHandler<GetInboxDocumentsPaginatedQuery, PaginatedResult<InboxDocumentDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetInboxDocumentsPaginatedQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<PaginatedResult<InboxDocumentDto>> Handle(
            GetInboxDocumentsPaginatedQuery request,
            CancellationToken cancellationToken)
        {
            var query = _context.InboxDocuments.Where(d => !d.IsDeleted);

            // Filter: IsScheduled (tab "Đến — Chưa xử lý" vs "Đã xếp lịch")
            if (request.IsScheduled.HasValue)
            {
                query = query.Where(d => d.IsScheduled == request.IsScheduled.Value);
            }

            // Filter: Channel (Internal / PublicService)
            if (!string.IsNullOrWhiteSpace(request.Channel))
            {
                if (Enum.TryParse<InboxChannel>(request.Channel, true, out var channelEnum))
                {
                    query = query.Where(d => d.Channel == channelEnum);
                }
            }

            // Filter: IsUrgent
            if (request.IsUrgent.HasValue)
            {
                query = query.Where(d => d.IsUrgent == request.IsUrgent.Value);
            }

            // Filter: Search (documentNumber, documentSymbol, subject, sender, issuingAgency)
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var q = request.Search.Trim().ToLower();
                query = query.Where(d =>
                    d.DocumentNumber.ToLower().Contains(q) ||
                    (d.DocumentSymbol != null && d.DocumentSymbol.ToLower().Contains(q)) ||
                    (d.IssuingAgency != null && d.IssuingAgency.ToLower().Contains(q)) ||
                    d.Subject.ToLower().Contains(q) ||
                    d.Sender.ToLower().Contains(q));
            }

            // Default sort: urgent first, then by received date descending
            query = query
                .OrderByDescending(d => d.IsUrgent)
                .ThenByDescending(d => d.ReceivedDate);

            // Count total before pagination
            var totalCount = await query.CountAsync(cancellationToken);

            // Paginate
            var page = Math.Max(1, request.Page);
            var pageSize = Math.Clamp(request.PageSize, 1, 100);

            var docs = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(d => new InboxDocumentDto
                {
                    Id = d.Id,
                    DocumentNumber = d.DocumentNumber,
                    Subject = d.Subject,
                    Category = d.Category,
                    Sender = d.Sender,
                    ReceivedDate = d.ReceivedDate,
                    IsUrgent = d.IsUrgent,
                    Channel = d.Channel.ToString(),
                    CitizenName = d.CitizenName,
                    CitizenPhone = d.CitizenPhone,
                    ServiceCode = d.ServiceCode,
                    IsScheduled = d.IsScheduled,
                    ScheduledDate = d.ScheduledDate,
                    ScheduledShift = d.ScheduledShift,
                    ScheduledTaskId = d.ScheduledTaskId,
                    DocumentSymbol = d.DocumentSymbol,
                    IssuingAgency = d.IssuingAgency,
                    SignerName = d.SignerName,
                    AttachmentUrl = d.AttachmentUrl,
                    IssuedDate = d.IssuedDate
                })
                .ToListAsync(cancellationToken);

            return new PaginatedResult<InboxDocumentDto>(docs, totalCount, page, pageSize);
        }
    }
}
