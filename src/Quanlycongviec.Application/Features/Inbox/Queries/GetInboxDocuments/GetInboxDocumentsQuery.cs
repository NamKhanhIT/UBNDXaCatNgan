using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Inbox.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocuments
{
    public class GetInboxDocumentsQuery : IRequest<List<InboxDocumentDto>>
    {
        public string? Channel { get; set; }
    }

    public class GetInboxDocumentsQueryHandler : IRequestHandler<GetInboxDocumentsQuery, List<InboxDocumentDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetInboxDocumentsQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<InboxDocumentDto>> Handle(GetInboxDocumentsQuery request, CancellationToken cancellationToken)
        {
            var query = _context.InboxDocuments.Where(d => !d.IsDeleted);

            if (!string.IsNullOrWhiteSpace(request.Channel))
            {
                if (Enum.TryParse<InboxChannel>(request.Channel, true, out var channelEnum))
                {
                    query = query.Where(d => d.Channel == channelEnum);
                }
            }

            var docs = await query
                .OrderByDescending(d => d.ReceivedDate)
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
                    ScheduledTaskId = d.ScheduledTaskId
                })
                .ToListAsync(cancellationToken);

            return docs;
        }
    }
}

