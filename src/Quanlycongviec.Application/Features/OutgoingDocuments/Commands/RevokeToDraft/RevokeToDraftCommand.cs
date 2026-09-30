using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Commands.RevokeToDraft
{
    public class RevokeToDraftCommand : IRequest<bool>
    {
        public Guid Id { get; set; }
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid UserId { get; set; }
    }

    public class RevokeToDraftCommandHandler(IApplicationDbContext context, INotificationDispatcher? dispatcher = null) : IRequestHandler<RevokeToDraftCommand, bool>
    {
        public async Task<bool> Handle(RevokeToDraftCommand request, CancellationToken ct)
        {
            var id = await new Quanlycongviec.Application.Common.Services.OutgoingDocumentWorkflow(context, dispatcher)
                .ActAsync(request.UserId, request.Id, "revoke", new() { RequestId = request.RequestId, Version = request.Version }, ct);
            return true;
        }
    }
}
