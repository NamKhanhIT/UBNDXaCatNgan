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
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public string RejectionReason { get; set; } = string.Empty;
        public Guid UserId { get; set; }
        public int UserRankLevel { get; set; } = 5;
    }

    public class RejectOutgoingDocumentCommandHandler(IApplicationDbContext context, INotificationDispatcher? dispatcher = null) : IRequestHandler<RejectOutgoingDocumentCommand, bool>
    {
        public async Task<bool> Handle(RejectOutgoingDocumentCommand request, CancellationToken ct)
        {
            var id = await new Quanlycongviec.Application.Common.Services.OutgoingDocumentWorkflow(context, dispatcher)
                .ActAsync(request.UserId, request.Id, "reject", new() { RequestId = request.RequestId, Version = request.Version, Reason = request.RejectionReason }, ct);
            return true;
        }
    }
}
