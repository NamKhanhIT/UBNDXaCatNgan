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
        public Guid CurrentUserId { get; set; }
    }

    public class GetInboxDocumentByIdQueryHandler : IRequestHandler<GetInboxDocumentByIdQuery, InboxDocumentDto?>
    {
        private readonly IApplicationDbContext _context;
        private readonly IDocumentAccessService _documentAccess;

        public GetInboxDocumentByIdQueryHandler(
            IApplicationDbContext context,
            IDocumentAccessService documentAccess)
        {
            _context = context;
            _documentAccess = documentAccess;
        }

        public async Task<InboxDocumentDto?> Handle(GetInboxDocumentByIdQuery request, CancellationToken cancellationToken)
        {
            if (!await _documentAccess.CanAccessDocumentAsync(
                    request.CurrentUserId, request.Id, "Inbox", cancellationToken))
            {
                return null;
            }

            var doc = await _context.InboxDocuments
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.Id == request.Id && !d.IsDeleted, cancellationToken);

            if (doc == null) return null;
            var access = new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context);
            var actor = await access.ActorAsync(request.CurrentUserId, cancellationToken);
            if (actor == null) return null;
            var visibleTasks = access.Tasks(actor).Select(t => t.Id);
            var relatedTask = await _context.TaskDocumentLinks.Where(l => l.InboxDocumentId == doc.Id && !l.IsDeleted && visibleTasks.Contains(l.TaskItemId))
                .OrderBy(l => l.CreatedAt).ThenBy(l => l.Id).Select(l => (Guid?)l.TaskItemId).FirstOrDefaultAsync(cancellationToken);

            return new InboxDocumentDto
            {
                Id = doc.Id,
                DocumentNumber = doc.DocumentNumber,
                Subject = doc.Subject,
                Category = doc.Category,
                Sender = doc.Sender,
                ReceivedDate = doc.ReceivedDate,
                ReceivedByUserId = doc.ReceivedByUserId,
                AiCategory = doc.AiCategory,
                AiTitle = doc.AiTitle,
                AiSummary = doc.AiSummary,
                AiExtractedDeadline = doc.AiExtractedDeadline,
                AiObjectives = doc.AiObjectives,
                AiSuggestedDepartmentId = doc.AiSuggestedDepartmentId,
                AiConfidenceScore = doc.AiConfidenceScore,
                AiEventStartDateTime = doc.AiEventStartDateTime,
                AiEventEndDateTime = doc.AiEventEndDateTime,
                AiReviewedByUserId = doc.AiReviewedByUserId,
                AiReviewedAt = doc.AiReviewedAt,
                AiProcessingStatus = doc.AiProcessingStatus,
                IsUrgent = doc.IsUrgent,
                Channel = doc.Channel.ToString(),
                CitizenName = doc.CitizenName,
                CitizenPhone = doc.CitizenPhone,
                ServiceCode = doc.ServiceCode,
                IsScheduled = relatedTask.HasValue,
                ScheduledDate = doc.ScheduledDate,
                ScheduledShift = doc.ScheduledShift,
                ScheduledTaskId = relatedTask,
                DocumentSymbol = doc.DocumentSymbol,
                IssuingAgency = doc.IssuingAgency,
                SignerName = doc.SignerName,
                AttachmentUrl = doc.AttachmentUrl,
                IssuedDate = doc.IssuedDate
            };
        }
    }
}
