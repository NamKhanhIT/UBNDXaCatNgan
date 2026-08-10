using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.UpdateOutgoingDocument
{
    public class UpdateOutgoingDocumentCommand : IRequest<bool>
    {
        public Guid Id { get; set; }
        public DocumentTypeEnum DocumentType { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? RecipientNote { get; set; }
        public string? AttachmentUrl { get; set; }
        public Guid? RelatedTaskItemId { get; set; }
        public bool IsUrgent { get; set; }
        public Guid UserId { get; set; }

        public string DestinationLevel { get; set; } = "Superior";
        public bool AutoCreateTask { get; set; } = true;
        public string SecurityLevel { get; set; } = "Normal";
        public string UrgencyLevel { get; set; } = "Normal";
        public DateTime? ResponseDeadline { get; set; }
    }

    public class UpdateOutgoingDocumentCommandHandler : IRequestHandler<UpdateOutgoingDocumentCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public UpdateOutgoingDocumentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(UpdateOutgoingDocumentCommand request, CancellationToken cancellationToken)
        {
            var doc = await _context.OutgoingDocuments.FirstOrDefaultAsync(o => o.Id == request.Id, cancellationToken);
            if (doc == null)
            {
                throw new InvalidOperationException($"Không tìm thấy văn bản đi có Id = {request.Id}");
            }

            // Quy tắc bất biến: CHỈ được sửa khi Status == Draft
            if (doc.Status != OutgoingDocumentStatusEnum.Draft)
            {
                throw new InvalidOperationException("Văn bản đã trình ký hoặc ban hành không được chỉnh sửa trực tiếp. Vui lòng thu hồi về nháp trước khi sửa.");
            }

            if (string.IsNullOrWhiteSpace(request.Title))
            {
                throw new ArgumentException("Trích yếu nội dung văn bản không được để trống.");
            }

            doc.DocumentType = request.DocumentType;
            doc.Title = request.Title.Trim();
            doc.Content = request.Content ?? string.Empty;
            doc.RecipientNote = request.RecipientNote;
            doc.AttachmentUrl = request.AttachmentUrl;
            doc.RelatedTaskItemId = request.RelatedTaskItemId;
            doc.IsUrgent = request.IsUrgent;
            doc.DestinationLevel = string.IsNullOrWhiteSpace(request.DestinationLevel) ? "Superior" : request.DestinationLevel;
            doc.AutoCreateTask = request.AutoCreateTask;
            doc.SecurityLevel = string.IsNullOrWhiteSpace(request.SecurityLevel) ? "Normal" : request.SecurityLevel;
            doc.UrgencyLevel = string.IsNullOrWhiteSpace(request.UrgencyLevel) ? "Normal" : request.UrgencyLevel;
            doc.ResponseDeadline = request.ResponseDeadline;

            _context.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                UserId = request.UserId,
                Action = "UpdateOutgoingDocument",
                EntityName = nameof(OutgoingDocument),
                EntityId = doc.Id.ToString(),
                Details = $"Cập nhật bản nháp văn bản đi: {doc.Title}"
            });

            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
