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
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
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
        public bool AutoCreateTask { get; set; } = false;
        public string SecurityLevel { get; set; } = "Normal";
        public string UrgencyLevel { get; set; } = "Normal";
        public DateTime? ResponseDeadline { get; set; }
    }

    public class UpdateOutgoingDocumentCommandHandler(IApplicationDbContext context, INotificationDispatcher? dispatcher = null) : IRequestHandler<UpdateOutgoingDocumentCommand, bool>
    {
        public Task<bool> Handle(UpdateOutgoingDocumentCommand request, CancellationToken ct) =>
            new Quanlycongviec.Application.Common.Services.OutgoingDocumentWorkflow(context, dispatcher).EditAsync(request, ct);
    }
}
