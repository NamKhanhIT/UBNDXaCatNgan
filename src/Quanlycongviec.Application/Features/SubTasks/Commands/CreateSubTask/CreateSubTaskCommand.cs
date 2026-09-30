using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Features.SubTasks.Commands.CreateSubTask
{
    public class CreateSubTaskCommand : IRequest<Guid>
    {
        public Guid TaskItemId { get; set; }
        public Guid CurrentUserId { get; set; }
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public string Title { get; set; } = string.Empty;

        public CreateSubTaskCommand(Guid taskItemId, string title, Guid currentUserId = default)
        {
            TaskItemId = taskItemId;
            Title = title;
            CurrentUserId = currentUserId;
        }
    }

    public class CreateSubTaskCommandHandler : IRequestHandler<CreateSubTaskCommand, Guid>
    {
        private readonly IApplicationDbContext _context;
        private readonly ITaskAuthorizationService _authorizationService;

        public CreateSubTaskCommandHandler(IApplicationDbContext context, ITaskAuthorizationService authorizationService)
        {
            _context = context;
            _authorizationService = authorizationService;
        }

        public Task<Guid> Handle(CreateSubTaskCommand request, CancellationToken cancellationToken) =>
            new Quanlycongviec.Application.Common.Services.TaskChecklistWorkflow(_context).CreateAsync(request, cancellationToken);
    }
}
