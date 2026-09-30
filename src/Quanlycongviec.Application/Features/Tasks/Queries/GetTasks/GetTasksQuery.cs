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
        public string? WorkspaceTab { get; set; }
        public string? Scope { get; set; }
        public string? TimeFilter { get; set; }
        public string? SearchField { get; set; }
        public string? ReviewScope { get; set; }

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

    public class GetTasksQueryHandler(IApplicationDbContext context) : IRequestHandler<GetTasksQuery, PaginatedResult<TaskItemDto>>
    {
        public async Task<PaginatedResult<TaskItemDto>> Handle(GetTasksQuery request, CancellationToken ct)
        {
            var access = new Quanlycongviec.Application.Common.Services.WorkflowAccess(context);
            var actor = await access.ActorAsync(request.UserId ?? Guid.Empty, ct);
            var page = Math.Max(1, request.Page);
            var size = Math.Clamp(request.PageSize, 1, 100);
            if (actor == null) return new(new(), 0, page, size);
            var query = access.Tasks(actor).AsNoTracking();
            if (request.Scope == "mine" || request.TodayOnly)
                query = query.Where(t => t.AssigneeId == actor.Id || t.AssignerId == actor.Id || t.ReviewerId == actor.Id);
            if (request.Scope == "department")
                query = query.Where(t => actor.DepartmentId.HasValue && t.DepartmentId == actor.DepartmentId);
            if (request.DepartmentId.HasValue) query = query.Where(t => t.DepartmentId == request.DepartmentId);
            if (!string.IsNullOrWhiteSpace(request.StatusFilter) && request.StatusFilter != "all")
            {
                if (!Enum.TryParse<TaskStatusEnum>(request.StatusFilter, true, out var status) || !Enum.IsDefined(status)) throw new ArgumentException("Trạng thái không hợp lệ.");
                query = query.Where(t => t.Status == status);
            }
            if (!string.IsNullOrWhiteSpace(request.PriorityFilter) && request.PriorityFilter != "all")
            {
                if (!Enum.TryParse<TaskPriority>(request.PriorityFilter, true, out var priority) || !Enum.IsDefined(priority)) throw new ArgumentException("Mức ưu tiên không hợp lệ.");
                query = query.Where(t => t.Priority == priority);
            }
            if (!string.IsNullOrWhiteSpace(request.SearchQuery))
            {
                var search = request.SearchQuery.Trim().ToLower();
                var field = request.SearchField ?? "all";
                query = query.Where(t => ((field == "all" || field == "title") && t.Title.ToLower().Contains(search))
                    || ((field == "all" || field == "description") && t.Description.ToLower().Contains(search))
                    || ((field == "all" || field == "assignee") && t.Assignee.FullName.ToLower().Contains(search))
                    || ((field == "all" || field == "documentNumber") && t.DocumentLinks.Any(l => !l.IsDeleted
                       && ((l.InboxDocument != null && l.InboxDocument.DocumentNumber.ToLower().Contains(search))
                       || (l.OutgoingDocument != null && l.OutgoingDocument.DocumentNumber.ToLower().Contains(search))))));
            }
            var now = DateTime.UtcNow;
            var start = DateTime.SpecifyKind(now.AddHours(7).Date.AddHours(-7), DateTimeKind.Utc);
            var end = start.AddDays(1);
            var soon = now.AddHours(48);
            var timeFilter = request.TimeFilter;
            if (request.TodayOnly)
                query = query.Where(t => t.DueDate < end && t.Status != TaskStatusEnum.Completed && t.Status != TaskStatusEnum.Cancelled);
            if (timeFilter == "today") query = query.Where(t => t.DueDate >= start && t.DueDate < end);
            if (timeFilter == "soon") query = query.Where(t => t.DueDate >= now && t.DueDate <= soon && (t.Status == TaskStatusEnum.Todo || t.Status == TaskStatusEnum.InProgress));
            if (timeFilter == "overdue") query = query.Where(t => t.DueDate < now && (t.Status == TaskStatusEnum.Todo || t.Status == TaskStatusEnum.InProgress));
            if (timeFilter == "revision") query = query.Where(t => t.Status == TaskStatusEnum.InProgress && t.RejectionReason != null && t.RejectionReason != "");
            if (request.DueDate.HasValue)
            {
                var dateStart = DateTime.SpecifyKind(request.DueDate.Value.Date.AddHours(-7), DateTimeKind.Utc);
                var dateEnd = dateStart.AddDays(1);
                query = query.Where(t => t.DueDate >= dateStart && t.DueDate < dateEnd);
            }
            if (request.DueDateFrom.HasValue && request.DueDateTo.HasValue)
            {
                var from = DateTime.SpecifyKind(request.DueDateFrom.Value.Date.AddHours(-7), DateTimeKind.Utc);
                var to = DateTime.SpecifyKind(request.DueDateTo.Value.Date.AddDays(1).AddHours(-7), DateTimeKind.Utc);
                query = query.Where(t => (t.StartDate ?? t.DueDate) < to && (t.DueDate ?? t.StartDate) >= from);
            }
            var counts = new Dictionary<string, int>();
            foreach (var tab in new[] { "action_needed", "pending_review", "sent", "completed", "all" })
                counts[tab] = await ApplyTab(query, tab, actor.Id, request.ReviewScope).CountAsync(ct);
            var selected = ApplyTab(query, request.WorkspaceTab, actor.Id, request.ReviewScope);
            var total = await selected.CountAsync(ct);
            var items = await selected.OrderByDescending(t => t.Priority == TaskPriority.Urgent ? 3 : t.Priority == TaskPriority.High ? 2 : t.Priority == TaskPriority.Medium ? 1 : 0).ThenBy(t => t.DueDate ?? DateTime.MaxValue)
                .ThenByDescending(t => t.CreatedAt).ThenBy(t => t.Id).Skip((page - 1) * size).Take(size)
                .Select(TaskProjection.Summary).ToListAsync(ct);
            return new(items, total, page, size) { Counts = counts };
        }

        private static IQueryable<Quanlycongviec.Domain.Entities.TaskItem> ApplyTab(IQueryable<Quanlycongviec.Domain.Entities.TaskItem> query, string? tab, Guid userId, string? reviewScope) => tab switch
        {
            "action_needed" or "today" => query.Where(t => (t.AssigneeId == userId && (t.Status == TaskStatusEnum.Todo || t.Status == TaskStatusEnum.InProgress))
                || (t.ReviewerId == userId && t.Status == TaskStatusEnum.InReview)),
            "assigned_to_me" => query.Where(t => t.AssigneeId == userId && t.Status != TaskStatusEnum.Completed && t.Status != TaskStatusEnum.Cancelled),
            "pending_review" => query.Where(t => t.Status == TaskStatusEnum.InReview
                && (reviewScope == "to_review" ? t.ReviewerId == userId : reviewScope == "submitted" ? t.AssigneeId == userId : (t.ReviewerId == userId || t.AssigneeId == userId))),
            "sent" => query.Where(t => t.AssignerId == userId),
            "completed" => query.Where(t => t.Status == TaskStatusEnum.Completed),
            "overdue" => query.Where(t => t.DueDate < DateTime.UtcNow && (t.Status == TaskStatusEnum.Todo || t.Status == TaskStatusEnum.InProgress)),
            _ => query
        };
    }
}
