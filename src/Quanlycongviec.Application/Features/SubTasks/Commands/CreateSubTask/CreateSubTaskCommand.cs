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
        public string Title { get; set; } = string.Empty;

        public CreateSubTaskCommand(Guid taskItemId, string title)
        {
            TaskItemId = taskItemId;
            Title = title;
        }
    }

    public class CreateSubTaskCommandHandler : IRequestHandler<CreateSubTaskCommand, Guid>
    {
        private readonly IApplicationDbContext _context;

        public CreateSubTaskCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Handle(CreateSubTaskCommand request, CancellationToken cancellationToken)
        {
            var task = await _context.TaskItems
                .Include(t => t.SubTasks)
                .FirstOrDefaultAsync(t => t.Id == request.TaskItemId, cancellationToken);

            if (task == null) throw new InvalidOperationException("Không tìm thấy nhiệm vụ.");

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
