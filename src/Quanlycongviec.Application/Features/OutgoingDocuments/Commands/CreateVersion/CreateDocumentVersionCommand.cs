using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.CreateVersion
{
    public class CreateDocumentVersionCommand : IRequest<Guid>
    {
        public Guid DocumentId { get; set; }
        public Guid UserId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? AttachmentUrl { get; set; }
        public string ChangeReason { get; set; } = string.Empty;
    }

    public class CreateDocumentVersionCommandHandler : IRequestHandler<CreateDocumentVersionCommand, Guid>
    {
        private readonly IApplicationDbContext _context;

        public CreateDocumentVersionCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Handle(CreateDocumentVersionCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.ChangeReason))
            {
                throw new ArgumentException("Lý do tạo phiên bản chỉnh sửa là bắt buộc.");
            }

            var doc = await _context.OutgoingDocuments.FirstOrDefaultAsync(o => o.Id == request.DocumentId, cancellationToken);
            if (doc == null)
            {
                throw new InvalidOperationException($"Không tìm thấy văn bản đi có Id = {request.DocumentId}");
            }

            var existingVersionCount = await _context.DocumentVersions
                .CountAsync(v => v.DocumentId == doc.Id, cancellationToken);

            int nextVersion = existingVersionCount + 1;
            var now = DateTime.UtcNow;

            var version = new DocumentVersion
            {
                Id = Guid.NewGuid(),
                DocumentId = doc.Id,
                TargetType = "Outgoing",
                VersionNumber = nextVersion,
                VersionName = $"Phiên bản {nextVersion} (Đính chính)",
                Title = string.IsNullOrWhiteSpace(request.Title) ? doc.Title : request.Title,
                Content = string.IsNullOrWhiteSpace(request.Content) ? doc.Content : request.Content,
                DocumentNumber = doc.DocumentNumber,
                DocumentSymbol = doc.DocumentSymbol,
                AttachmentUrl = request.AttachmentUrl ?? doc.AttachmentUrl,
                ChangeReason = request.ChangeReason,
                ChangedByUserId = request.UserId,
                ChangedAt = now
            };

            _context.DocumentVersions.Add(version);

            // Cập nhật văn bản chính với thông tin mới nhất
            if (!string.IsNullOrWhiteSpace(request.Title)) doc.Title = request.Title;
            if (!string.IsNullOrWhiteSpace(request.Content)) doc.Content = request.Content;
            if (!string.IsNullOrWhiteSpace(request.AttachmentUrl)) doc.AttachmentUrl = request.AttachmentUrl;
            doc.UpdatedAt = now;

            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Action = "CREATE_VERSION",
                EntityName = nameof(OutgoingDocument),
                EntityId = doc.Id.ToString(),
                Details = $"Tạo phiên bản v{nextVersion} đính chính văn bản số {doc.DocumentNumber}. Lý do: {request.ChangeReason}"
            });

            await _context.SaveChangesAsync(cancellationToken);
            return version.Id;
        }
    }
}
