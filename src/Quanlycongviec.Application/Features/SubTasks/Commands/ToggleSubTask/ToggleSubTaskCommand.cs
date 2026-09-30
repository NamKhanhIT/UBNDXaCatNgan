using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.SubTasks.Commands.ToggleSubTask
{
    public class ToggleSubTaskCommand : IRequest<bool>
    {
        public Guid SubTaskId { get; set; }
        public Guid CurrentUserId { get; set; }
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid? TaskItemId { get; set; }
        public bool? IsCompleted { get; set; }

        public ToggleSubTaskCommand(Guid subTaskId, Guid currentUserId = default)
        {
            SubTaskId = subTaskId;
            CurrentUserId = currentUserId;
        }
    }

    public class ToggleSubTaskCommandHandler : IRequestHandler<ToggleSubTaskCommand, bool>
    {
        private readonly IApplicationDbContext _context;
        private readonly ITaskAuthorizationService _authorizationService;

        public ToggleSubTaskCommandHandler(IApplicationDbContext context, ITaskAuthorizationService authorizationService)
        {
            _context = context;
            _authorizationService = authorizationService;
        }

        public Task<bool> Handle(ToggleSubTaskCommand request, CancellationToken cancellationToken) =>
            new Quanlycongviec.Application.Common.Services.TaskChecklistWorkflow(_context).SetAsync(request, cancellationToken);
    }
}
