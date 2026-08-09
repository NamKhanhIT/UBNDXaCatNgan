using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Queries.GetTasks
{
    public class GetTasksQuery : IRequest<List<TaskItemDto>>
    {
        public Guid? UserId { get; set; }
        public int? RankLevel { get; set; }
        public string? StatusFilter { get; set; }
        public Guid? DepartmentId { get; set; }
        public string? SearchQuery { get; set; }

        public GetTasksQuery(Guid? userId = null, int? rankLevel = null, string? statusFilter = null, Guid? departmentId = null, string? searchQuery = null)
        {
            UserId = userId;
            RankLevel = rankLevel;
            StatusFilter = statusFilter;
            DepartmentId = departmentId;
            SearchQuery = searchQuery;
        }
    }

    public class GetTasksQueryHandler : IRequestHandler<GetTasksQuery, List<TaskItemDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetTasksQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<TaskItemDto>> Handle(GetTasksQuery request, CancellationToken cancellationToken)
        {
            var query = _context.TaskItems
                .Include(t => t.Assigner)
                .Include(t => t.Assignee)
                .Include(t => t.Department)
                .Where(t => !t.IsDeleted);

            // Scope level filtering
            if (request.RankLevel.HasValue && request.UserId.HasValue)
            {
                if (request.RankLevel.Value >= 5) // Chuyên viên: chỉ thấy task phân cho mình
                {
                    query = query.Where(t => t.AssigneeId == request.UserId.Value);
                }
                else if (request.RankLevel.Value == 3 || request.RankLevel.Value == 4) // Trưởng/Phó phòng: thấy task trong phòng mình hoặc do mình tạo
                {
                    if (request.DepartmentId.HasValue)
                    {
                        query = query.Where(t => t.DepartmentId == request.DepartmentId.Value || t.AssignerId == request.UserId.Value);
                    }
                }
                // RankLevel 1,2: Lãnh đạo cao nhất thấy toàn bộ
            }

            if (!string.IsNullOrWhiteSpace(request.StatusFilter) && request.StatusFilter != "all")
            {
                if (Enum.TryParse<TaskStatusEnum>(request.StatusFilter, true, out var statusEnum))
                {
                    query = query.Where(t => t.Status == statusEnum);
                }
            }

            if (request.DepartmentId.HasValue && !request.RankLevel.HasValue)
            {
                query = query.Where(t => t.DepartmentId == request.DepartmentId.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.SearchQuery))
            {
                var q = request.SearchQuery.Trim().ToLower();
                query = query.Where(t =>
                    t.Title.ToLower().Contains(q) ||
                    t.Assignee.FullName.ToLower().Contains(q) ||
                    t.Assigner.FullName.ToLower().Contains(q));
            }

            var list = await query
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => new TaskItemDto
                {
                    Id = t.Id,
                    Title = t.Title,
                    Description = t.Description,
                    AssignerId = t.AssignerId,
                    AssignerName = t.Assigner != null ? t.Assigner.FullName : string.Empty,
                    AssigneeId = t.AssigneeId,
                    AssigneeName = t.Assignee != null ? t.Assignee.FullName : string.Empty,
                    DepartmentId = t.DepartmentId,
                    DepartmentName = t.Department != null ? t.Department.Name : string.Empty,
                    Priority = t.Priority.ToString(),
                    Status = t.Status.ToString(),
                    Type = t.Type.ToString(),
                    EstimatedEffortHours = t.EstimatedEffortHours,
                    DueDate = t.DueDate,
                    RatingScore = t.RatingScore,
                    RejectionReason = t.RejectionReason,
                    IsEscalated = t.IsEscalated,
                    CreatedAt = t.CreatedAt
                })
                .ToListAsync(cancellationToken);

            return list;
        }
    }
}
