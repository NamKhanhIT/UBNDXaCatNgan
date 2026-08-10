using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.SubmitForSignature
{
    public class SubmitForSignatureCommand : IRequest<bool>
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
    }

    public class SubmitForSignatureCommandHandler : IRequestHandler<SubmitForSignatureCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public SubmitForSignatureCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(SubmitForSignatureCommand request, CancellationToken cancellationToken)
        {
            var doc = await _context.OutgoingDocuments.FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
            if (doc == null)
            {
                throw new InvalidOperationException($"Không tìm thấy văn bản đi có Id = {request.Id}");
            }

            if (doc.Status != OutgoingDocumentStatusEnum.Draft && doc.Status != OutgoingDocumentStatusEnum.Rejected)
            {
                throw new InvalidOperationException("Chỉ có thể trình ký văn bản đang ở trạng thái Nháp hoặc Bị từ chối.");
            }

            doc.Status = OutgoingDocumentStatusEnum.PendingSignature;
            doc.RejectionReason = null; // Clear old rejection reason if re-submitted

            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Action = "SubmitForSignature",
                EntityName = nameof(OutgoingDocument),
                EntityId = doc.Id.ToString(),
                Details = $"Trình ký duyệt văn bản đi: {doc.Title}"
            });

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
