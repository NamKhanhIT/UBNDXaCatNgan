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
        public Guid RequestId { get; set; }
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
        public bool AutoCreateTask { get; set; } = false;
        public string SecurityLevel { get; set; } = "Normal";
        public string UrgencyLevel { get; set; } = "Normal";
        public DateTime? ResponseDeadline { get; set; }
    }

    public class CreateOutgoingDocumentCommandHandler(IApplicationDbContext context, INotificationDispatcher? dispatcher = null) : IRequestHandler<CreateOutgoingDocumentCommand, Guid>
    {
        public Task<Guid> Handle(CreateOutgoingDocumentCommand request, CancellationToken ct) =>
            new Quanlycongviec.Application.Common.Services.OutgoingDocumentWorkflow(context, dispatcher).CreateAsync(request, ct);
    }
}
