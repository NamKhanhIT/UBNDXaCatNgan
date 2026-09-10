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

        public async Task<Guid> Handle(CreateSubTaskCommand request, CancellationToken cancellationToken)
        {
            var task = await _context.TaskItems
                .Include(t => t.SubTasks)
                .FirstOrDefaultAsync(t => t.Id == request.TaskItemId, cancellationToken);

            if (task == null) throw new InvalidOperationException("Không tìm thấy nhiệm vụ.");
            if (!await _authorizationService.CanAccessTaskAsync(request.CurrentUserId, request.TaskItemId, cancellationToken))
                throw new UnauthorizedAccessException("Bạn không có quyền cập nhật checklist của nhiệm vụ này.");

            var subTask = new SubTask
            {
                TaskItemId = request.TaskItemId,
                Title = request.Title,
                IsCompleted = false
            };

            _context.SubTasks.Add(subTask);

            // Tính toán lại Tiến độ tự động dựa trên Checklist SubTasks
            var total = task.SubTasks.Count + 1;
            var completed = 0;
            foreach (var st in task.SubTasks)
            {
                if (st.IsCompleted) completed++;
            }

            task.ProgressPercentage = (int)Math.Round((double)completed / total * 100);
            task.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync(cancellationToken);
            return subTask.Id;
        }
    }
}
