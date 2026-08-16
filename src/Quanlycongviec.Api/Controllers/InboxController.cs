using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.AI.Models;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Inbox.Commands.ScheduleDocument;
using Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocuments;
using Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocumentsPaginated;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Hubs;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class InboxController : ControllerBase
    {
        private readonly ISender _mediator;
        private readonly IApplicationDbContext _context;
        private readonly IDocumentAiService _aiService;
        private readonly IHubContext<NotificationHub> _hubContext;
        private readonly IWebPushNotificationService _webPushService;
        private readonly ILogger<InboxController> _logger;

        public InboxController(
            ISender mediator,
            IApplicationDbContext context,
            IDocumentAiService aiService,
            IHubContext<NotificationHub> hubContext,
            IWebPushNotificationService webPushService,
            ILogger<InboxController> logger)
        {
            _mediator = mediator;
            _context = context;
            _aiService = aiService;
            _hubContext = hubContext;
            _webPushService = webPushService;
            _logger = logger;
        }

        private Guid CurrentUserId
        {
            get
            {
                var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value;
                return Guid.TryParse(claim, out var id) ? id : Guid.Empty;
            }
        }

        /// <summary>
        /// Lấy danh sách văn bản chỉ đạo đến từ CSDL PostgreSQL — phân trang server-side
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetInboxDocuments(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] bool? isScheduled = null,
            [FromQuery] string? channel = null,
            [FromQuery] string? search = null,
            [FromQuery] bool? isUrgent = null)
        {
            var query = new GetInboxDocumentsPaginatedQuery
            {
                Page = page,
                PageSize = pageSize,
                IsScheduled = isScheduled,
                Channel = channel,
                Search = search,
                IsUrgent = isUrgent
            };
            var result = await _mediator.Send(query);
            return Ok(new
            {
                success = true,
                data = new
                {
                    items = result.Items,
                    totalCount = result.TotalCount,
                    page = result.Page,
                    pageSize = result.PageSize
                }
            });
        }

        /// <summary>
        /// Lấy chi tiết 1 văn bản đến theo ID
        /// </summary>
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetInboxDocumentById([FromRoute] Guid id)
        {
            var query = new Application.Features.Inbox.Queries.GetInboxDocumentById.GetInboxDocumentByIdQuery { Id = id };
            var result = await _mediator.Send(query);

            if (result == null)
            {
                return NotFound(new { success = false, error = $"Không tìm thấy văn bản đến có Id = {id}" });
            }

            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Xếp lịch xử lý công văn -> Lưu vết vào PostgreSQL và tạo TaskItem
        /// </summary>
        [HttpPost("{id:guid}/schedule")]
        public async Task<IActionResult> ScheduleDocument([FromRoute] Guid id, [FromBody] ScheduleDocumentRequest request)
        {
            var command = new ScheduleInboxDocumentCommand(
                id,
                request.ScheduledDate,
                request.ScheduledShift ?? "Sang",
                CurrentUserId,
                request.AssigneeId ?? CurrentUserId
            );

            var taskId = await _mediator.Send(command);
            return Ok(new { success = true, data = taskId, message = "Đã xếp lịch xử lý công văn thành công." });
        }

        // ══════════════════════════════════════════════════════════════
        // PROMPT F: AI Workflow Endpoints
        // ══════════════════════════════════════════════════════════════

        /// <summary>
        /// Xác nhận phân loại sau kiểm duyệt AI (human-in-the-loop).
        /// Người dùng có thể sửa lại mọi field AI trước khi xác nhận.
        /// Route: 'event' → tạo CalendarEvent draft | 'assign' → giao việc | 'review' → nhận báo cáo
        /// </summary>
        [HttpPost("{id:guid}/confirm-classification")]
        public async Task<IActionResult> ConfirmClassification(
            [FromRoute] Guid id,
            [FromBody] ConfirmClassificationRequest request,
            CancellationToken ct)
        {
            var inboxDoc = await _context.InboxDocuments.FindAsync(new object[] { id }, ct);
            if (inboxDoc == null)
                return NotFound(new { success = false, error = "Không tìm thấy văn bản." });

            // Ghi lại field AI đã được người dùng sửa (nếu có)
            if (request.AiCategory != null) inboxDoc.AiCategory = request.AiCategory;
            if (request.AiTitle != null) inboxDoc.AiTitle = request.AiTitle;
            if (request.AiSummary != null) inboxDoc.AiSummary = request.AiSummary;
            if (request.AiExtractedDeadline.HasValue) inboxDoc.AiExtractedDeadline = request.AiExtractedDeadline;
            if (request.AiSuggestedDepartmentId.HasValue) inboxDoc.AiSuggestedDepartmentId = request.AiSuggestedDepartmentId;
            if (request.AiObjectives != null) inboxDoc.AiObjectives = request.AiObjectives;
            if (request.AiExtractedSubjects != null) inboxDoc.AiExtractedSubjects = request.AiExtractedSubjects;

            // Đánh dấu đã kiểm duyệt
            inboxDoc.AiReviewedByUserId = CurrentUserId;
            inboxDoc.AiReviewedAt = DateTime.UtcNow;
            inboxDoc.AiProcessingStatus = "Reviewed";
            inboxDoc.UpdatedAt = DateTime.UtcNow;

            object? routeResult = null;

            switch (request.Route?.ToLowerInvariant())
            {
                case "event":
                    // Tạo CalendarEvent draft từ dữ liệu AI đã duyệt
                    var calEvent = new CalendarEvent
                    {
                        Id = Guid.NewGuid(),
                        Title = inboxDoc.AiTitle ?? inboxDoc.Subject,
                        Description = inboxDoc.AiSummary ?? "",
                        EventType = EventTypeEnum.Meeting,
                        StartDateTime = inboxDoc.AiEventStartDateTime ?? DateTime.UtcNow.AddDays(1),
                        EndDateTime = inboxDoc.AiEventEndDateTime ?? DateTime.UtcNow.AddDays(1).AddHours(2),
                        OrganizerId = CurrentUserId,
                        DepartmentId = inboxDoc.AiSuggestedDepartmentId,
                        ColorTag = "#3B82F6"
                    };
                    _context.CalendarEvents.Add(calEvent);
                    routeResult = new { calendarEventId = calEvent.Id, message = "Đã tạo lịch nháp từ dữ liệu AI." };
                    inboxDoc.AiProcessingStatus = "Confirmed";
                    break;

                case "assign":
                    // Chuyển sang bước gợi ý giao việc — chưa tạo TaskItem ở đây
                    routeResult = new { message = "Đã xác nhận. Tiếp tục sang bước gợi ý giao việc." };
                    inboxDoc.AiProcessingStatus = "Confirmed";
                    break;

                case "review":
                    // Gắn với luồng nghiệm thu/đánh giá — điền sẵn tóm tắt
                    routeResult = new
                    {
                        message = "Đã xác nhận nhận báo cáo. Dữ liệu AI đã được lưu cho người duyệt xem nhanh.",
                        summary = inboxDoc.AiSummary,
                        deadline = inboxDoc.AiExtractedDeadline
                    };
                    inboxDoc.AiProcessingStatus = "Confirmed";
                    break;

                default:
                    return BadRequest(new { success = false, error = "Route phải là 'event', 'assign', hoặc 'review'." });
            }

            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                success = true,
                data = routeResult,
                route = request.Route
            });
        }

        /// <summary>
        /// AI gợi ý phòng ban + người thực hiện dựa trên tải việc + chuyên môn + kinh nghiệm.
        /// Luôn kèm lý do bằng lời. Người dùng có quyền chọn người khác.
        /// </summary>
        [HttpPost("{id:guid}/suggest-assignment")]
        public async Task<IActionResult> SuggestAssignment(
            [FromRoute] Guid id,
            CancellationToken ct)
        {
            var inboxDoc = await _context.InboxDocuments.FindAsync(new object[] { id }, ct);
            if (inboxDoc == null)
                return NotFound(new { success = false, error = "Không tìm thấy văn bản." });

            // Lấy danh sách cán bộ + tải việc thực tế
            var now = DateTime.UtcNow;
            var candidates = await _context.Users
                .Where(u => !u.IsDeleted)
                .Select(u => new StaffWorkloadSnapshot
                {
                    UserId = u.Id,
                    FullName = u.FullName,
                    RoleName = u.ActiveRoleCode,
                    DepartmentName = u.PrimaryDepartment != null ? u.PrimaryDepartment.Name : "",
                    DepartmentId = u.PrimaryDepartmentId ?? Guid.Empty,
                    Expertise = u.Expertise,
                    YearsOfExperience = u.YearsOfExperience,
                    ActiveTasksCount = u.AssignedTasks.Count(t =>
                        t.Status != TaskStatusEnum.Completed &&
                        t.Status != TaskStatusEnum.Cancelled &&
                        !t.IsDeleted),
                    WorkloadPercentage = u.AssignedTasks.Count(t =>
                        t.Status != TaskStatusEnum.Completed &&
                        t.Status != TaskStatusEnum.Cancelled &&
                        !t.IsDeleted) * 10.0 // Rough % estimate: 10% per active task
                })
                .ToListAsync(ct);

            var taskDescription = $"{inboxDoc.AiTitle ?? inboxDoc.Subject}\n{inboxDoc.AiSummary ?? ""}\n{inboxDoc.AiObjectives ?? ""}";

            var suggestion = await _aiService.SuggestAssignmentAsync(taskDescription, candidates, ct);

            return Ok(new
            {
                success = true,
                data = suggestion,
                message = "Gợi ý giao việc từ AI. Bạn có thể chọn người khác nếu không đồng ý."
            });
        }

        /// <summary>
        /// Tạo TaskItem chính thức + AI checklist SubTasks tự động.
        /// Gọi sau khi người dùng xác nhận route='assign' và chọn người thực hiện.
        /// </summary>
        [HttpPost("{id:guid}/create-task")]
        public async Task<IActionResult> CreateTaskFromInbox(
            [FromRoute] Guid id,
            [FromBody] CreateTaskFromInboxRequest request,
            CancellationToken ct)
        {
            var inboxDoc = await _context.InboxDocuments.FindAsync(new object[] { id }, ct);
            if (inboxDoc == null)
                return NotFound(new { success = false, error = "Không tìm thấy văn bản." });

            // Tạo TaskItem chính thức
            var taskItem = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = inboxDoc.AiTitle ?? inboxDoc.Subject,
                Description = inboxDoc.AiSummary ?? inboxDoc.Subject,
                AssignerId = CurrentUserId,
                AssigneeId = request.AssigneeId,
                DepartmentId = request.DepartmentId ?? inboxDoc.AiSuggestedDepartmentId,
                Priority = request.Priority ?? TaskPriority.Medium,
                Status = TaskStatusEnum.Todo,
                Type = TaskType.BAU,
                DueDate = inboxDoc.AiExtractedDeadline,
                ProgressPercentage = 0,
                AISummary = inboxDoc.AiSummary
            };

            _context.TaskItems.Add(taskItem);

            // Liên kết InboxDocument với TaskItem
            inboxDoc.ScheduledTaskId = taskItem.Id;
            inboxDoc.IsScheduled = true;

            // AI đề xuất checklist tiến độ
            var taskDescription = $"{taskItem.Title}\n{taskItem.Description}";
            List<SubTask> subTasks = new();

            try
            {
                var checklistItems = await _aiService.SuggestProgressChecklistAsync(taskDescription, ct);

                foreach (var item in checklistItems)
                {
                    var subTask = new SubTask
                    {
                        Id = Guid.NewGuid(),
                        TaskItemId = taskItem.Id,
                        Title = item.Title,
                        IsCompleted = false
                    };
                    subTasks.Add(subTask);
                    _context.SubTasks.Add(subTask);
                }

                _logger.LogInformation("AI đề xuất {Count} đầu việc con cho TaskItem {TaskId}",
                    subTasks.Count, taskItem.Id);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không thể tạo checklist AI cho TaskItem {TaskId}. Bỏ qua.", taskItem.Id);
            }

            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                success = true,
                data = new
                {
                    taskItemId = taskItem.Id,
                    subTaskCount = subTasks.Count,
                    subTasks = subTasks.Select(s => new { s.Id, s.Title })
                },
                message = "Đã tạo nhiệm vụ + checklist tiến độ AI."
            });
        }

        /// <summary>
        /// Toggle SubTask hoàn thành → cập nhật ProgressPercentage → thông báo 2 chiều.
        /// Cả Assigner + Assignee đều nhận thông báo % tiến độ mới.
        /// </summary>
        [HttpPost("subtask/{subTaskId:guid}/toggle")]
        public async Task<IActionResult> ToggleSubTask(
            [FromRoute] Guid subTaskId,
            CancellationToken ct)
        {
            var subTask = await _context.SubTasks
                .Include(s => s.TaskItem)
                .FirstOrDefaultAsync(s => s.Id == subTaskId && !s.IsDeleted, ct);

            if (subTask == null)
                return NotFound(new { success = false, error = "Không tìm thấy đầu việc con." });

            // Toggle trạng thái
            subTask.IsCompleted = !subTask.IsCompleted;
            subTask.UpdatedAt = DateTime.UtcNow;

            // Tính lại % tiến độ
            var taskItem = subTask.TaskItem;
            var allSubTasks = await _context.SubTasks
                .Where(s => s.TaskItemId == taskItem.Id && !s.IsDeleted)
                .ToListAsync(ct);

            var totalCount = allSubTasks.Count;
            var completedCount = allSubTasks.Count(s => s.IsCompleted);
            taskItem.ProgressPercentage = totalCount > 0 ? (int)Math.Round(100.0 * completedCount / totalCount) : 0;
            taskItem.UpdatedAt = DateTime.UtcNow;

            // Thông báo 2 chiều: cả người giao và người nhận
            var notificationTitle = $"Tiến độ: {taskItem.Title}";
            var notificationMessage = $"{(subTask.IsCompleted ? "✅" : "⬜")} \"{subTask.Title}\" — Tiến độ: {taskItem.ProgressPercentage}%";

            var userIds = new[] { taskItem.AssignerId, taskItem.AssigneeId }.Distinct();

            foreach (var userId in userIds)
            {
                var notification = new Notification
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    TaskItemId = taskItem.Id,
                    Type = NotificationType.SubTaskProgress,
                    Title = notificationTitle,
                    Message = notificationMessage,
                    SentAt = DateTime.UtcNow,
                    IsRead = false
                };
                _context.Notifications.Add(notification);

                // SignalR realtime
                await _hubContext.Clients.User(userId.ToString())
                    .SendAsync("ReceiveNotification", new
                    {
                        notification.Id,
                        notification.Title,
                        notification.Message,
                        notification.Type,
                        taskItemId = taskItem.Id,
                        progressPercentage = taskItem.ProgressPercentage
                    }, ct);
            }

            // Web Push
            foreach (var userId in userIds)
            {
                try
                {
                    await _webPushService.SendNotificationAsync(
                        userId, notificationTitle, notificationMessage, cancellationToken: ct);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Web Push thất bại cho userId={UserId}", userId);
                }
            }

            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                success = true,
                data = new
                {
                    subTaskId = subTask.Id,
                    isCompleted = subTask.IsCompleted,
                    progressPercentage = taskItem.ProgressPercentage,
                    completedCount,
                    totalCount
                }
            });
        }
    }

    public class ScheduleDocumentRequest
    {
        public DateTime ScheduledDate { get; set; }
        public string? ScheduledShift { get; set; }
        public Guid? AssigneeId { get; set; }
    }

    public class ConfirmClassificationRequest
    {
        public string? Route { get; set; } // "event" | "assign" | "review"
        public string? AiCategory { get; set; }
        public string? AiTitle { get; set; }
        public string? AiSummary { get; set; }
        public DateTime? AiExtractedDeadline { get; set; }
        public string? AiObjectives { get; set; }
        public string? AiExtractedSubjects { get; set; }
        public Guid? AiSuggestedDepartmentId { get; set; }
    }

    public class CreateTaskFromInboxRequest
    {
        public Guid AssigneeId { get; set; }
        public Guid? DepartmentId { get; set; }
        public TaskPriority? Priority { get; set; }
    }
}

