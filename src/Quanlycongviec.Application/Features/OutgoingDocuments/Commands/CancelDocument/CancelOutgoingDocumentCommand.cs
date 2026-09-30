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
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid Id { get; set; }
        public Guid UserId { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    public class CancelOutgoingDocumentCommandHandler(IApplicationDbContext context, INotificationDispatcher? dispatcher = null)
        : IRequestHandler<CancelOutgoingDocumentCommand, bool>
    {
        public async Task<bool> Handle(CancelOutgoingDocumentCommand request, CancellationToken ct)
        {
            var workflow = new Quanlycongviec.Application.Common.Services.OutgoingDocumentWorkflow(context, dispatcher);
            await workflow.ActAsync(request.UserId, request.Id, "cancel",
                new() { RequestId = request.RequestId, Version = request.Version, Reason = request.Reason }, ct);
            return true;
        }
    }
}
