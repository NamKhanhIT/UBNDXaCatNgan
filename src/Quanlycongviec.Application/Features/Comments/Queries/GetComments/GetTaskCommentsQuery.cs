using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Comments.Queries.GetComments
{
    public class GetTaskCommentsQuery : IRequest<List<TaskCommentDto>>
    {
        public Guid TaskId { get; set; }
    }

    public class TaskCommentDto
    {
        public Guid Id { get; set; }
        public Guid TaskItemId { get; set; }
        public Guid UserId { get; set; }
        public string UserFullName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class GetTaskCommentsQueryHandler : IRequestHandler<GetTaskCommentsQuery, List<TaskCommentDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetTaskCommentsQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<TaskCommentDto>> Handle(GetTaskCommentsQuery request, CancellationToken cancellationToken)
        {
            return await _context.TaskComments
                .Where(c => c.TaskItemId == request.TaskId && !c.IsDeleted)
                .Include(c => c.User)
                .OrderBy(c => c.CreatedAt)
                .Select(c => new TaskCommentDto
                {
                    Id = c.Id,
                    TaskItemId = c.TaskItemId,
                    UserId = c.UserId,
                    UserFullName = c.User.FullName,
                    Content = c.Content,
                    CreatedAt = c.CreatedAt
                })
                .ToListAsync(cancellationToken);
        }
    }
}
