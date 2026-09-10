using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Queries.GetTasks
{
    public class GetTasksQuery : IRequest<PaginatedResult<TaskItemDto>>
    {
        public Guid? UserId { get; set; }
        public int? RankLevel { get; set; }
        public string? StatusFilter { get; set; }
        public Guid? DepartmentId { get; set; }
        public string? SearchQuery { get; set; }
        public string? PriorityFilter { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
        public DateTime? DueDate { get; set; }
        public DateTime? DueDateFrom { get; set; }
        public DateTime? DueDateTo { get; set; }
        // BẢO MẬT/Domain (Audit 04-09-2026): TodayOnly filter — chỉ hiển thị các nhiệm vụ
        // liên quan tới user (giao hoặc nhận) có DueDate hôm nay hoặc đã quá hạn.
        public bool TodayOnly { get; set; } = false;

        public GetTasksQuery(
            Guid? userId = null,
            int? rankLevel = null,
            string? statusFilter = null,
            Guid? departmentId = null,
            string? searchQuery = null,
            int page = 1,
            int pageSize = 25,
            DateTime? dueDate = null,
            DateTime? dueDateFrom = null,
            DateTime? dueDateTo = null,
            bool todayOnly = false)
        {
            UserId = userId;
            RankLevel = rankLevel;
            StatusFilter = statusFilter;
            DepartmentId = departmentId;
            SearchQuery = searchQuery;
            Page = page;
            PageSize = pageSize;
            DueDate = dueDate;
            DueDateFrom = dueDateFrom;
            DueDateTo = dueDateTo;
            TodayOnly = todayOnly;
        }
    }

    public class GetTasksQueryHandler : IRequestHandler<GetTasksQuery, PaginatedResult<TaskItemDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetTasksQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<PaginatedResult<TaskItemDto>> Handle(GetTasksQuery request, CancellationToken cancellationToken)
        {
            if (!request.UserId.HasValue || request.UserId.Value == Guid.Empty || !request.RankLevel.HasValue)
            {
                return new PaginatedResult<TaskItemDto>(
                    new List<TaskItemDto>(),
                    0,
                    Math.Max(1, request.Page),
                    Math.Clamp(request.PageSize, 1, 100));
            }

            var query = _context.TaskItems
                .AsNoTracking()
                .Include(t => t.Assigner)
                .Include(t => t.Assignee)
                .Include(t => t.Department)
                .Where(t => !t.IsDeleted);

            // Scope level filtering
            if (request.RankLevel.HasValue && request.UserId.HasValue)
            {
                // Khi bật TodayOnly, tab "Hôm Nay" phải thấy cả task user GIAO và user NHẬN
                // có DueDate hôm nay/quá hạn — bất kể rank. Áp dụng rule rộng hơn.
                if (request.TodayOnly)
                {
                    query = query.Where(t =>
                        t.AssigneeId == request.UserId.Value
                        || t.AssignerId == request.UserId.Value);
                }
                else if (request.RankLevel.Value >= 5) // Chuyên viên: chỉ thấy task phân cho mình
                {
                    query = query.Where(t => t.AssigneeId == request.UserId.Value);
                }
                else if (request.RankLevel.Value == 3 || request.RankLevel.Value == 4) // Trưởng/Phó phòng: thấy task trong phòng mình hoặc do mình tạo
                {
                    // The caller's department comes from the server-side user
                    // record; a client supplied filter cannot widen this scope.
                    var callerDepartmentId = await _context.Users
                        .Where(u => u.Id == request.UserId.Value && !u.IsDeleted)
                        .Select(u => u.PrimaryDepartmentId)
                        .FirstOrDefaultAsync(cancellationToken);

                    query = query.Where(t => t.AssignerId == request.UserId.Value
                        || (callerDepartmentId.HasValue && t.DepartmentId == callerDepartmentId.Value));
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

            if (!string.IsNullOrWhiteSpace(request.PriorityFilter)
                && request.PriorityFilter != "all"
                && Enum.TryParse<TaskPriority>(request.PriorityFilter, true, out var priority))
            {
                query = query.Where(t => t.Priority == priority);
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

            // Filter: DueDate (exact day for "Hôm nay" tab)
            if (request.DueDate.HasValue)
            {
                var date = request.DueDate.Value.Date;
                query = query.Where(t => t.DueDate.HasValue && t.DueDate.Value.Date == date);
            }

            // Filter: Date range intersection for Calendar (From & To)
            if (request.DueDateFrom.HasValue && request.DueDateTo.HasValue)
            {
                var from = request.DueDateFrom.Value.Date;
                var to = request.DueDateTo.Value.Date;
                query = query.Where(t => (t.StartDate.HasValue || t.DueDate.HasValue) &&
                    ((t.StartDate ?? t.DueDate)!.Value.Date <= to) &&
                    ((t.DueDate ?? t.StartDate)!.Value.Date >= from));
            }

            // Filter: TodayOnly — chỉ hiển thị các task liên quan tới user (giao hoặc nhận)
            // có DueDate hôm nay hoặc đã quá hạn (hỗ trợ tab "Hôm Nay" trong Trung tâm điều hành).
            if (request.TodayOnly)
            {
                var today = DateTime.UtcNow.Date;
                query = query.Where(t =>
                    t.DueDate.HasValue
                    && t.DueDate.Value.Date <= today
                    && (t.AssigneeId == request.UserId.Value || t.AssignerId == request.UserId.Value));
            }

            // Count total before pagination
            var totalCount = await query.CountAsync(cancellationToken);

            // Paginate
            var page = Math.Max(1, request.Page);
            var pageSize = Math.Clamp(request.PageSize, 1, 100);

            var list = await query
                .OrderByDescending(t => t.CreatedAt)
                .ThenByDescending(t => t.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(t => new TaskItemDto
                {
                    Id = t.Id,
                    Title = t.Title,
                    Description = t.Description,
                    Requirements = t.Requirements,
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
                    StartDate = t.StartDate ?? t.DueDate,
                    DueDate = t.DueDate,
                    CompletedAt = t.CompletedAt,
                    SubmissionNote = t.SubmissionNote,
                    SystemScore = t.SystemScore,
                    EvaluatorScore = t.EvaluatorScore,
                    RatingScore = t.RatingScore,
                    RejectionReason = t.RejectionReason,
                    IsEscalated = t.IsEscalated,
                    OpenAnnotationCount = t.Annotations.Count(a => a.ResolvedStatus == AnnotationStatusEnum.Open),
                    TotalAnnotationCount = t.Annotations.Count(),
                    CreatedAt = t.CreatedAt
                })
                .ToListAsync(cancellationToken);

            return new PaginatedResult<TaskItemDto>(list, totalCount, page, pageSize);
        }
    }
}
