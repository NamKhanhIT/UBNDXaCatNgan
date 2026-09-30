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
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid DocumentId { get; set; }
        public Guid UserId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? AttachmentUrl { get; set; }
        public string ChangeReason { get; set; } = string.Empty;
    }

    public class CreateDocumentVersionCommandHandler(IApplicationDbContext context, INotificationDispatcher? dispatcher = null)
        : IRequestHandler<CreateDocumentVersionCommand, Guid>
    {
        public async Task<Guid> Handle(CreateDocumentVersionCommand request, CancellationToken ct)
        {
            var workflow = new Quanlycongviec.Application.Common.Services.OutgoingDocumentWorkflow(context, dispatcher);
            return await workflow.SaveVersionAsync(request.UserId, request.DocumentId,
                new() { RequestId = request.RequestId, Version = request.Version, Reason = request.ChangeReason }, request.Title, request.Content, ct);
        }
    }
}
