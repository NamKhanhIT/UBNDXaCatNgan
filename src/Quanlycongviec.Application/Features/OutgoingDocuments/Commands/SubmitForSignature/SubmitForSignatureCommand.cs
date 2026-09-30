using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.SubmitForSignature
{
    public class SubmitForSignatureCommand : IRequest<bool>
    {
        public Guid Id { get; set; }
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid UserId { get; set; }
    }

    public class SubmitForSignatureCommandHandler(IApplicationDbContext context, INotificationDispatcher? dispatcher = null) : IRequestHandler<SubmitForSignatureCommand, bool>
    {
        public async Task<bool> Handle(SubmitForSignatureCommand request, CancellationToken ct)
        {
            var id = await new Quanlycongviec.Application.Common.Services.OutgoingDocumentWorkflow(context, dispatcher)
                .ActAsync(request.UserId, request.Id, "submit", new() { RequestId = request.RequestId, Version = request.Version }, ct);
            return true;
        }
    }
}
