using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.CancelDocument
{
    public class CancelOutgoingDocumentCommand : IRequest<bool>
    {
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    public class CancelOutgoingDocumentCommandHandler : IRequestHandler<CancelOutgoingDocumentCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public CancelOutgoingDocumentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(CancelOutgoingDocumentCommand request, CancellationToken cancellationToken)
        {
            var doc = await _context.OutgoingDocuments.FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
            if (doc == null)
            {
                throw new InvalidOperationException($"Không tìm thấy văn bản đi có Id = {request.Id}");
            }

            var now = DateTime.UtcNow;

            if (doc.Status == OutgoingDocumentStatusEnum.Draft)
            {
                // Soft delete cho văn bản nháp
                doc.IsDeleted = true;
                doc.UpdatedAt = now;

                _context.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(),
                    UserId = request.UserId,
                    Action = "DELETE_DRAFT",
                    EntityName = nameof(OutgoingDocument),
                    EntityId = doc.Id.ToString(),
                    Details = $"Xóa mềm văn bản nháp: {doc.Title}"
                });
            }
            else
            {
                // Hủy văn bản đã phát hành / trình ký (không xóa vật lý per Requirement XI)
                if (string.IsNullOrWhiteSpace(request.Reason))
                {
                    throw new ArgumentException("Lý do hủy văn bản là bắt buộc.");
                }

                doc.Status = OutgoingDocumentStatusEnum.Rejected;
                doc.RecallReason = $"HỦY VĂN BẢN: {request.Reason}";
                doc.RecalledAt = now;
                doc.RecalledByUserId = request.UserId;

                _context.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(),
                    UserId = request.UserId,
                    Action = "CANCEL",
                    EntityName = nameof(OutgoingDocument),
                    EntityId = doc.Id.ToString(),
                    Details = $"Hủy văn bản số {doc.DocumentNumber}. Lý do: {request.Reason}"
                });
            }

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
