using MediatR;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Services;

namespace Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;

public class CreateTaskCommandHandler(IApplicationDbContext context, ITaskAuthorizationService authService, INotificationDispatcher? notificationDispatcher = null)
    : IRequestHandler<CreateTaskCommand, Guid>
{
    public Task<Guid> Handle(CreateTaskCommand request, CancellationToken cancellationToken) =>
        new TaskCreationWorkflow(context, authService, notificationDispatcher).CreateAsync(request, cancellationToken);
}