using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Inbox.DTOs;

namespace Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocumentById
{
    public class GetInboxDocumentByIdQuery : IRequest<InboxDocumentDto?>
    {
        public Guid Id { get; set; }
    }

    public class GetInboxDocumentByIdQueryHandler : IRequestHandler<GetInboxDocumentByIdQuery, InboxDocumentDto?>
    {
        private readonly IApplicationDbContext _context;

        public GetInboxDocumentByIdQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<InboxDocumentDto?> Handle(GetInboxDocumentByIdQuery request, CancellationToken cancellationToken)
        {
            var doc = await _context.InboxDocuments
                .FirstOrDefaultAsync(d => d.Id == request.Id && !d.IsDeleted, cancellationToken);

            if (doc == null) return null;

            return new InboxDocumentDto
            {
                Id = doc.Id,
                DocumentNumber = doc.DocumentNumber,
                Subject = doc.Subject,
                Category = doc.Category,
                Sender = doc.Sender,
                ReceivedDate = doc.ReceivedDate,
                IsUrgent = doc.IsUrgent,
                Channel = doc.Channel.ToString(),
                CitizenName = doc.CitizenName,
                CitizenPhone = doc.CitizenPhone,
                ServiceCode = doc.ServiceCode,
                IsScheduled = doc.IsScheduled,
                ScheduledDate = doc.ScheduledDate,
                ScheduledShift = doc.ScheduledShift,
                ScheduledTaskId = doc.ScheduledTaskId,
                DocumentSymbol = doc.DocumentSymbol,
                IssuingAgency = doc.IssuingAgency,
                SignerName = doc.SignerName,
                AttachmentUrl = doc.AttachmentUrl,
                IssuedDate = doc.IssuedDate
            };
        }
    }
}
