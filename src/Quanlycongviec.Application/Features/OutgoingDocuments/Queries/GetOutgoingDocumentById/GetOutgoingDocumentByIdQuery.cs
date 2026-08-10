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
    }

    public class GetOutgoingDocumentByIdQueryHandler : IRequestHandler<GetOutgoingDocumentByIdQuery, OutgoingDocumentDto?>
    {
        private readonly IApplicationDbContext _context;

        public GetOutgoingDocumentByIdQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<OutgoingDocumentDto?> Handle(GetOutgoingDocumentByIdQuery request, CancellationToken cancellationToken)
        {
            var doc = await _context.OutgoingDocuments.FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
            if (doc == null) return null;

            var draftedUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == doc.DraftedByUserId, cancellationToken);
            var signedUser = doc.SignedByUserId.HasValue
                ? await _context.Users.FirstOrDefaultAsync(u => u.Id == doc.SignedByUserId.Value, cancellationToken)
                : null;

            return new OutgoingDocumentDto
            {
                Id = doc.Id,
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
                RelatedTaskItemId = doc.RelatedTaskItemId,
                IsUrgent = doc.IsUrgent,
                RejectionReason = doc.RejectionReason,
                IsCorrectionDocument = doc.IsCorrectionDocument,
                OriginalDocumentId = doc.OriginalDocumentId,
                DocumentSequenceNumber = doc.DocumentSequenceNumber,
                DocumentSymbol = doc.DocumentSymbol,
                RecallReason = doc.RecallReason,
                RecalledAt = doc.RecalledAt
            };
        }
    }
}
