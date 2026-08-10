using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.RejectOutgoingDocument
{
    public class RejectOutgoingDocumentCommand : IRequest<bool>
    {
        public Guid Id { get; set; }
        public string RejectionReason { get; set; } = string.Empty;
        public Guid UserId { get; set; }
        public int UserRankLevel { get; set; } = 5;
    }

    public class RejectOutgoingDocumentCommandHandler : IRequestHandler<RejectOutgoingDocumentCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public RejectOutgoingDocumentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(RejectOutgoingDocumentCommand request, CancellationToken cancellationToken)
        {
            if (request.UserRankLevel > 2.5)
            {
                throw new UnauthorizedAccessException("Cán bộ không có thẩm quyền từ chối phê duyệt văn bản hành chính.");
            }

            if (string.IsNullOrWhiteSpace(request.RejectionReason))
            {
                throw new ArgumentException("Vui lòng nhập lý do từ chối phê duyệt.");
            }

            var doc = await _context.OutgoingDocuments.FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
            if (doc == null)
            {
                throw new InvalidOperationException($"Không tìm thấy văn bản đi có Id = {request.Id}");
            }

            if (doc.Status != OutgoingDocumentStatusEnum.PendingSignature)
            {
                throw new InvalidOperationException("Chỉ có thể từ chối văn bản đang ở trạng thái Chờ ký duyệt.");
            }

            doc.Status = OutgoingDocumentStatusEnum.Rejected;
            doc.RejectionReason = request.RejectionReason.Trim();

            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Action = "RejectOutgoingDocument",
                EntityName = nameof(OutgoingDocument),
                EntityId = doc.Id.ToString(),
                Details = $"Từ chối ký duyệt văn bản đi: {doc.Title}. Lý do: {doc.RejectionReason}"
            });

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
