using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.CreateOutgoingDocument
{
    public class CreateOutgoingDocumentCommand : IRequest<Guid>
    {
        public DocumentTypeEnum DocumentType { get; set; } = DocumentTypeEnum.CongVan;
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public Guid DraftedByUserId { get; set; }
        public string? RecipientNote { get; set; }
        public string? AttachmentUrl { get; set; }
        public Guid? RelatedTaskItemId { get; set; }
        public bool IsUrgent { get; set; } = false;

        public bool IsCorrectionDocument { get; set; } = false;
        public Guid? OriginalDocumentId { get; set; }

        public string DestinationLevel { get; set; } = "Superior";
        public bool AutoCreateTask { get; set; } = true;
        public string SecurityLevel { get; set; } = "Normal";
        public string UrgencyLevel { get; set; } = "Normal";
        public DateTime? ResponseDeadline { get; set; }
    }

    public class CreateOutgoingDocumentCommandHandler : IRequestHandler<CreateOutgoingDocumentCommand, Guid>
    {
        private readonly IApplicationDbContext _context;

        public CreateOutgoingDocumentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Handle(CreateOutgoingDocumentCommand request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Title))
            {
                throw new ArgumentException("Trích yếu nội dung văn bản không được để trống.");
            }

            var doc = new OutgoingDocument
            {
                Id = Guid.NewGuid(),
                DocumentType = request.DocumentType,
                Title = request.Title.Trim(),
                Content = request.Content ?? string.Empty,
                Status = OutgoingDocumentStatusEnum.Draft,
                DraftedByUserId = request.DraftedByUserId,
                DraftedAt = DateTime.UtcNow,
                RecipientNote = request.RecipientNote,
                AttachmentUrl = request.AttachmentUrl,
                RelatedTaskItemId = request.RelatedTaskItemId,
                IsUrgent = request.IsUrgent,
                IsCorrectionDocument = request.IsCorrectionDocument,
                OriginalDocumentId = request.OriginalDocumentId,
                DestinationLevel = string.IsNullOrWhiteSpace(request.DestinationLevel) ? "Superior" : request.DestinationLevel,
                AutoCreateTask = request.AutoCreateTask,
                SecurityLevel = string.IsNullOrWhiteSpace(request.SecurityLevel) ? "Normal" : request.SecurityLevel,
                UrgencyLevel = string.IsNullOrWhiteSpace(request.UrgencyLevel) ? "Normal" : request.UrgencyLevel,
                ResponseDeadline = request.ResponseDeadline
            };

            _context.OutgoingDocuments.Add(doc);

            // Ghi audit log
            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.DraftedByUserId,
                Action = "CreateOutgoingDocument",
                EntityName = nameof(OutgoingDocument),
                EntityId = doc.Id.ToString(),
                Details = $"Soạn văn bản đi dạng nháp: {doc.Title} (Loại: {doc.DocumentType})"
            });

            await _context.SaveChangesAsync(cancellationToken);
            return doc.Id;
        }
    }
}
