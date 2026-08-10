using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.RevokeIssued
{
    public class RevokeIssuedOutgoingDocumentCommand : IRequest<bool>
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    public class RevokeIssuedOutgoingDocumentCommandHandler : IRequestHandler<RevokeIssuedOutgoingDocumentCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public RevokeIssuedOutgoingDocumentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(RevokeIssuedOutgoingDocumentCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Reason))
            {
                throw new ArgumentException("Lý do thu hồi văn bản là bắt buộc.");
            }

            var doc = await _context.OutgoingDocuments.FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
            if (doc == null)
            {
                throw new InvalidOperationException($"Không tìm thấy văn bản đi có Id = {request.Id}");
            }

            if (doc.Status != OutgoingDocumentStatusEnum.Issued && doc.Status != OutgoingDocumentStatusEnum.Sent)
            {
                throw new InvalidOperationException("Chỉ có thể thu hồi văn bản đã ban hành hoặc đã gửi đi.");
            }

            var now = DateTime.UtcNow;

            // Lưu vết lịch sử phiên bản trước khi thu hồi
            var versionCount = await _context.DocumentVersions.CountAsync(v => v.DocumentId == doc.Id, cancellationToken);
            _context.DocumentVersions.Add(new DocumentVersion
            {
                Id = Guid.NewGuid(),
                DocumentId = doc.Id,
                TargetType = "Outgoing",
                VersionNumber = versionCount + 1,
                VersionName = $"Phiên bản trước khi thu hồi (Số {doc.DocumentNumber})",
                Title = doc.Title,
                Content = doc.Content,
                DocumentNumber = doc.DocumentNumber,
                DocumentSymbol = doc.DocumentSymbol,
                AttachmentUrl = doc.AttachmentUrl,
                ChangeReason = $"Thu hồi văn bản: {request.Reason}",
                ChangedByUserId = request.UserId,
                ChangedAt = now
            });

            // Cập nhật trạng thái thu hồi
            doc.Status = OutgoingDocumentStatusEnum.Rejected; // Dùng trạng thái từ chối / thu hồi
            doc.RecallReason = request.Reason;
            doc.RecalledAt = now;
            doc.RecalledByUserId = request.UserId;

            // Audit Log
            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Action = "RECALL",
                EntityName = nameof(OutgoingDocument),
                EntityId = doc.Id.ToString(),
                Details = $"Thu hồi văn bản số {doc.DocumentNumber}. Lý do: {request.Reason}"
            });

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
