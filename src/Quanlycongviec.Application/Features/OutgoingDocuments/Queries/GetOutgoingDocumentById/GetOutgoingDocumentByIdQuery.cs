using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.OutgoingDocuments.DTOs;
using Quanlycongviec.Application.Features.OutgoingDocuments.Queries.GetOutgoingDocumentsPaginated;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Queries.GetOutgoingDocumentById
{
    public class GetOutgoingDocumentByIdQuery : IRequest<OutgoingDocumentDto?>
    {
        public Guid Id { get; set; }
        public Guid CurrentUserId { get; set; }
    }

    public class GetOutgoingDocumentByIdQueryHandler : IRequestHandler<GetOutgoingDocumentByIdQuery, OutgoingDocumentDto?>
    {
        private readonly IApplicationDbContext _context;
        private readonly IDocumentAccessService _documentAccess;

        public GetOutgoingDocumentByIdQueryHandler(
            IApplicationDbContext context,
            IDocumentAccessService documentAccess)
        {
            _context = context;
            _documentAccess = documentAccess;
        }

        public async Task<OutgoingDocumentDto?> Handle(GetOutgoingDocumentByIdQuery request, CancellationToken cancellationToken)
        {
            if (!await _documentAccess.CanAccessDocumentAsync(
                    request.CurrentUserId, request.Id, "Outgoing", cancellationToken))
            {
                return null;
            }

            var doc = await _context.OutgoingDocuments
                .AsNoTracking()
                .FirstOrDefaultAsync(o => o.Id == request.Id && !o.IsDeleted, cancellationToken);
            if (doc == null) return null;
            var access = new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context);
            var actor = await access.ActorAsync(request.CurrentUserId, cancellationToken);
            if (actor == null) return null;
            var visibleTasks = access.Tasks(actor).Select(t => t.Id);

            var draftedUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == doc.DraftedByUserId, cancellationToken);
            var signedUser = doc.SignedByUserId.HasValue
                ? await _context.Users.FirstOrDefaultAsync(u => u.Id == doc.SignedByUserId.Value, cancellationToken)
                : null;

            return new OutgoingDocumentDto
            {
                Id = doc.Id,
                Version = doc.Version,
                DocumentNumber = doc.DocumentNumber,
                DocumentType = doc.DocumentType,
                DocumentTypeName = GetOutgoingDocumentsPaginatedQueryHandler.GetDocumentTypeName(doc.DocumentType),
                Title = doc.Title,
                Content = doc.Content,
                Status = doc.Status,
                StatusName = GetOutgoingDocumentsPaginatedQueryHandler.GetStatusName(doc.Status),
                DraftedByUserId = doc.DraftedByUserId,
                DraftedByUserName = draftedUser?.FullName ?? "Chưa xác định",
                DraftedAt = doc.DraftedAt,
                SignedByUserId = doc.SignedByUserId,
                SignedByUserName = signedUser?.FullName,
                SignedAt = doc.SignedAt,
                IssuedDate = doc.IssuedDate,
                RecipientNote = doc.RecipientNote,
                AttachmentUrl = doc.AttachmentUrl,
                RelatedTaskItemId = await _context.TaskDocumentLinks.Where(l => l.OutgoingDocumentId == doc.Id && !l.IsDeleted && visibleTasks.Contains(l.TaskItemId))
                    .OrderBy(l => l.CreatedAt).ThenBy(l => l.Id).Select(l => (Guid?)l.TaskItemId).FirstOrDefaultAsync(cancellationToken),
                IsUrgent = doc.IsUrgent,
                RejectionReason = doc.RejectionReason,
                IsCorrectionDocument = doc.IsCorrectionDocument,
                OriginalDocumentId = doc.OriginalDocumentId,
                DocumentSequenceNumber = doc.DocumentSequenceNumber,
                DocumentSymbol = doc.DocumentSymbol,
                RecallReason = doc.RecallReason,
                RecalledAt = doc.RecalledAt,
                DestinationLevel = doc.DestinationLevel ?? "Superior",
                AutoCreateTask = doc.AutoCreateTask,
                SecurityLevel = doc.SecurityLevel ?? "Normal",
                UrgencyLevel = doc.UrgencyLevel ?? "Normal",
                ResponseDeadline = doc.ResponseDeadline
            };
        }
    }
}
