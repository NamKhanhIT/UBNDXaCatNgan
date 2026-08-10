using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.RevokeToDraft
{
    public class RevokeToDraftCommand : IRequest<bool>
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
    }

    public class RevokeToDraftCommandHandler : IRequestHandler<RevokeToDraftCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public RevokeToDraftCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(RevokeToDraftCommand request, CancellationToken cancellationToken)
        {
            var doc = await _context.OutgoingDocuments.FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
            if (doc == null)
            {
                throw new InvalidOperationException($"Không tìm thấy văn bản đi có Id = {request.Id}");
            }

            if (doc.Status != OutgoingDocumentStatusEnum.PendingSignature)
            {
                throw new InvalidOperationException("Chỉ có thể thu hồi về nháp đối với văn bản đang Chờ ký duyệt.");
            }

            doc.Status = OutgoingDocumentStatusEnum.Draft;

            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Action = "RevokeToDraft",
                EntityName = nameof(OutgoingDocument),
                EntityId = doc.Id.ToString(),
                Details = $"Thu hồi văn bản đi về trạng thái bản nháp: {doc.Title}"
            });

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
