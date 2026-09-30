using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Commands.TransferTask
{
    public class TransferTaskCommand : IRequest<bool>
    {
        public Guid TaskId { get; set; }
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid? ReviewerId { get; set; }
        public Guid TargetUserId { get; set; }
        public string Reason { get; set; } = string.Empty;
        public Guid CurrentUserId { get; set; }

        public TransferTaskCommand(Guid taskId, Guid targetUserId, string reason, Guid currentUserId)
        {
            TaskId = taskId;
            TargetUserId = targetUserId;
            Reason = reason;
            CurrentUserId = currentUserId;
        }
    }

    public class TransferTaskCommandHandler(IApplicationDbContext context, ITaskAuthorizationService? authService = null,
        INotificationDispatcher? notificationDispatcher = null) : IRequestHandler<TransferTaskCommand, bool>
    {
        public Task<bool> Handle(TransferTaskCommand request, CancellationToken cancellationToken) =>
            new Quanlycongviec.Application.Common.Services.TaskExecutionWorkflow(context, authService!, notificationDispatcher)
                .TransferAsync(request.TaskId, request.CurrentUserId, new() { RequestId = request.RequestId, Version = request.Version,
                    ReviewerId = request.ReviewerId, TargetUserId = request.TargetUserId, Reason = request.Reason }, cancellationToken);
    }
}
