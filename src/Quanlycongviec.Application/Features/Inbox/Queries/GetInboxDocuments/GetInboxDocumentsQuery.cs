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
        public Guid CurrentUserId { get; set; }
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
            var access = new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context);
            var actor = await access.ActorAsync(request.CurrentUserId, cancellationToken);
            if (actor == null) return new();
            var query = access.Inbox(actor);
            var visibleTasks = access.Tasks(actor).Select(t => t.Id);

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
                    CitizenName = null,
                    CitizenPhone = null,
                    ServiceCode = d.ServiceCode,
                    IsScheduled = _context.TaskDocumentLinks.Any(l => l.InboxDocumentId == d.Id && !l.IsDeleted && visibleTasks.Contains(l.TaskItemId)),
                    ScheduledDate = d.ScheduledDate,
                    ScheduledShift = d.ScheduledShift,
                    ScheduledTaskId = _context.TaskDocumentLinks.Where(l => l.InboxDocumentId == d.Id && !l.IsDeleted && visibleTasks.Contains(l.TaskItemId))
                        .OrderBy(l => l.CreatedAt).ThenBy(l => l.Id).Select(l => (Guid?)l.TaskItemId).FirstOrDefault(),
                    DocumentSymbol = d.DocumentSymbol,
                    IssuingAgency = d.IssuingAgency,
                    SignerName = d.SignerName,
                    AttachmentUrl = d.AttachmentUrl,
                    IssuedDate = d.IssuedDate
                })
                .ToListAsync(cancellationToken);

            return docs;
        }
    }
}
