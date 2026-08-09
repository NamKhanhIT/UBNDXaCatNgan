using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.SubTasks.Queries.GetSubTasks
{
    public class SubTaskDto
    {
        public Guid Id { get; set; }
        public Guid TaskItemId { get; set; }
        public string Title { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
    }

    public class GetSubTasksQuery : IRequest<List<SubTaskDto>>
    {
        public Guid TaskItemId { get; set; }

        public GetSubTasksQuery(Guid taskItemId)
        {
            TaskItemId = taskItemId;
        }
    }

    public class GetSubTasksQueryHandler : IRequestHandler<GetSubTasksQuery, List<SubTaskDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetSubTasksQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<SubTaskDto>> Handle(GetSubTasksQuery request, CancellationToken cancellationToken)
        {
            var list = await _context.SubTasks
                .Where(st => st.TaskItemId == request.TaskItemId && !st.IsDeleted)
                .OrderBy(st => st.CreatedAt)
                .Select(st => new SubTaskDto
                {
                    Id = st.Id,
                    TaskItemId = st.TaskItemId,
                    Title = st.Title,
                    IsCompleted = st.IsCompleted
                })
                .ToListAsync(cancellationToken);

            return list;
        }
    }
}
