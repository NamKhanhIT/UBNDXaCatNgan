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
using Quanlycongviec.Application.Features.Inbox.Commands.CreateInboxDocument;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
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
        private readonly INotificationDispatcher _notificationDispatcher;
        private readonly ILogger<InboxController> _logger;
        private readonly IDocumentAccessService _documentAccess;
        private readonly ITaskAuthorizationService _taskAuthorization;

        public InboxController(
            ISender mediator,
            IApplicationDbContext context,
            IDocumentAiService aiService,
            INotificationDispatcher notificationDispatcher,
            ILogger<InboxController> logger,
            IDocumentAccessService documentAccess,
            ITaskAuthorizationService taskAuthorization)
        {
            _mediator = mediator;
            _context = context;
            _aiService = aiService;
            _notificationDispatcher = notificationDispatcher;
            _logger = logger;
            _documentAccess = documentAccess;
            _taskAuthorization = taskAuthorization;
        }

        // BẢO MẬT (Audit X1): dùng extension dùng chung CurrentUserExtensions.GetUserId
        private Guid CurrentUserId => User.GetUserId();

        private int CurrentRankLevel
        {
            get
            {
                var claim = User.FindFirst("RankLevel")?.Value;
                return int.TryParse(claim, out var rank) ? rank : 5;
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
            [FromQuery] bool? isUrgent = null,
            [FromQuery] string? category = null,
            [FromQuery] string? status = null)
        {
            var query = new GetInboxDocumentsPaginatedQuery
            {
                Page = page,
                PageSize = pageSize,
                CurrentUserId = CurrentUserId,
                UserRankLevel = CurrentRankLevel,
                IsScheduled = isScheduled,
                Channel = channel,
                Search = search,
                IsUrgent = isUrgent,
                Category = category,
                AiProcessingStatus = status
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

        [HttpPost]
        public async Task<IActionResult> CreateInboxDocument(
            [FromBody] CreateInboxDocumentCommand command,
            CancellationToken ct)
        {
            command.ReceivedByUserId = CurrentUserId;
            var id = await _mediator.Send(command, ct);
            return CreatedAtAction(nameof(GetInboxDocumentById), new { id }, new { success = true, data = id });
        }

        /// <summary>
        /// Lấy chi tiết 1 văn bản đến theo ID
        /// </summary>
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetInboxDocumentById([FromRoute] Guid id)
        {
            var query = new Application.Features.Inbox.Queries.GetInboxDocumentById.GetInboxDocumentByIdQuery
            {
                Id = id,
                CurrentUserId = CurrentUserId
            };
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
        public Task<IActionResult> ScheduleDocument([FromRoute] Guid id, [FromBody] ScheduleDocumentRequest request) =>
            CreateTaskFromInbox(id, new CreateTaskFromInboxRequest
            {
                RequestId = request.RequestId, Version = request.Version, AssigneeId = request.AssigneeId ?? Guid.Empty,
                ReviewerId = request.ReviewerId, DueDate = request.ScheduledDate, Requirements = request.Requirements
            }, HttpContext.RequestAborted);
        // ══════════════════════════════════════════════════════════════
        // AI Workflow Endpoints
        // ══════════════════════════════════════════════════════════════

        /// <summary>
        /// Xác nhận phân loại sau kiểm duyệt AI (human-in-the-loop).
        /// Người dùng có thể sửa lại mọi field AI trước khi xác nhận.
        /// Chỉ trả gợi ý; tạo lịch/giao việc phải xác nhận trên biểu mẫu workflow.
        /// </summary>
        [HttpPost("{id:guid}/confirm-classification")]
        public async Task<IActionResult> ConfirmClassification(
            [FromRoute] Guid id,
            [FromBody] ConfirmClassificationRequest request,
            CancellationToken ct)
        {
            if (!await _documentAccess.CanAccessDocumentAsync(CurrentUserId, id, "Inbox", ct))
            {
                return NotFound(new { success = false, error = "Không tìm thấy văn bản." });
            }

            var inboxDoc = await _context.InboxDocuments.FindAsync(new object[] { id }, ct);
            if (inboxDoc == null)
                return NotFound(new { success = false, error = "Không tìm thấy văn bản." });

            var access = new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context);
            var actor = await access.ActorAsync(CurrentUserId, ct);
            if (actor == null || !await access.CanAssignFromInboxAsync(actor, inboxDoc, ct))
                return StatusCode(403, new { success = false, error = "Bạn được xem nhưng không có quyền xác nhận xử lý văn bản." });
            if (request.Route?.ToLowerInvariant() is not ("event" or "assign" or "review" or "store"))
                return BadRequest(new { success = false, error = "Hướng xử lý không hợp lệ." });
            // Legacy clients receive an editable draft. Only the confirmed workflow commands may create
            // a task/calendar event or change the document's business state.
            return Ok(new { success = true, route = request.Route, data = new
            {
                documentId = id, version = inboxDoc.Version, requiresConfirmation = true,
                title = request.AiTitle ?? inboxDoc.AiTitle ?? inboxDoc.Subject,
                description = request.AiSummary ?? inboxDoc.AiSummary,
                requirements = request.AiObjectives ?? inboxDoc.AiObjectives,
                dueDate = request.AiExtractedDeadline ?? inboxDoc.AiExtractedDeadline,
                startDateTime = request.EventStartDateTime ?? inboxDoc.AiEventStartDateTime,
                endDateTime = request.EventEndDateTime ?? inboxDoc.AiEventEndDateTime,
                message = "Mở văn bản để xác nhận nội dung, người nhận và thời gian trên biểu mẫu chung."
            } });
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
            if (!await _documentAccess.CanAccessDocumentAsync(CurrentUserId, id, "Inbox", ct))
            {
                return NotFound(new { success = false, error = "Không tìm thấy văn bản." });
            }

            var inboxDoc = await _context.InboxDocuments.FindAsync(new object[] { id }, ct);
            if (inboxDoc == null)
                return NotFound(new { success = false, error = "Không tìm thấy văn bản." });

            var access = new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context);
            var actor = await access.ActorAsync(CurrentUserId, ct);
            if (actor == null || !await access.CanAssignFromInboxAsync(actor, inboxDoc, ct))
                return StatusCode(403, new { success = false, error = "Bạn không có quyền giao việc từ văn bản này." });
            var people = await _context.Users.Where(u => !u.IsDeleted).Select(u =>
                new Quanlycongviec.Application.Common.Services.WorkflowActor(u.Id,
                    u.UserRoles.Where(r => !r.IsDeleted && !r.Role.IsDeleted).Select(r => (int?)r.Role.RankLevel).Min() ?? 5,
                    u.PrimaryDepartmentId, u.ActiveRoleCode)).ToListAsync(ct);
            var eligible = people.Where(p => Quanlycongviec.Application.Common.Services.WorkflowAccess.CanAssign(actor, p)).Select(p => p.Id).ToList();
            var candidates = await _context.Users
                .Where(u => !u.IsDeleted && eligible.Contains(u.Id))
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
                        !t.IsDeleted) * 10.0 // Ước lượng: 10% mỗi nhiệm vụ đang thực hiện
                })
                .ToListAsync(ct);

            if (candidates.Count == 0) return Ok(new { success = true, data = (AssignmentSuggestion?)null, message = "Chưa có người đủ điều kiện trong phạm vi giao việc." });
            var taskDescription = $"{inboxDoc.AiTitle ?? inboxDoc.Subject}\n{inboxDoc.AiSummary ?? ""}\n{inboxDoc.AiObjectives ?? ""}";

            Quanlycongviec.Application.AI.Models.AssignmentSuggestion suggestion;
            try
            {
                suggestion = await _aiService.SuggestAssignmentAsync(taskDescription, candidates, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Lỗi khi gọi AI gợi ý giao việc cho văn bản {InboxId}. Sử dụng thuật toán dự phòng theo tải việc.", id);
                suggestion = Quanlycongviec.Infrastructure.AI.OllamaDocumentAiService.GenerateHeuristicAssignmentFallback(candidates, taskDescription);
            }

            // AI output is untrusted; resolve every identity and department from the eligible set.
            var chosen = candidates.FirstOrDefault(c => c.UserId == suggestion.SuggestedUserId);
            if (chosen == null)
            {
                suggestion = Quanlycongviec.Infrastructure.AI.OllamaDocumentAiService.GenerateHeuristicAssignmentFallback(candidates, taskDescription);
                chosen = candidates.First(c => c.UserId == suggestion.SuggestedUserId);
            }
            suggestion.SuggestedUserName = chosen.FullName;
            suggestion.SuggestedDepartmentId = chosen.DepartmentId == Guid.Empty ? null : chosen.DepartmentId;
            suggestion.SuggestedDepartmentName = chosen.DepartmentName;
            suggestion.Alternatives = (suggestion.Alternatives ?? new()).Where(a => eligible.Contains(a.UserId))
                .Select(a => new AlternativeCandidate { UserId = a.UserId, FullName = candidates.First(c => c.UserId == a.UserId).FullName, Reason = a.Reason }).ToList();
            return Ok(new
            {
                success = true,
                data = suggestion,
                message = "Gợi ý giao việc từ hệ thống. Bạn có thể chọn người khác nếu không đồng ý."
            });
        }

        /// <summary>
        /// Tạo công việc đã được người giao xác nhận qua workflow chung.
        /// Gọi sau khi người dùng xác nhận route='assign' và chọn người thực hiện.
        /// </summary>
        [HttpPost("{id:guid}/create-task")]
        public async Task<IActionResult> CreateTaskFromInbox([FromRoute] Guid id, [FromBody] CreateTaskFromInboxRequest request, CancellationToken ct)
        {
            if (!await _documentAccess.CanAccessDocumentAsync(CurrentUserId, id, "Inbox", ct)) return NotFound(new { success = false, error = "Không tìm thấy văn bản." });
            var document = await _context.InboxDocuments.FirstAsync(d => d.Id == id && !d.IsDeleted, ct);
            var command = new CreateTaskCommand
            {
                RequestId = request.RequestId, Title = request.Title ?? document.Subject,
                Description = request.Description ?? "", Requirements = request.Requirements,
                AssignerId = CurrentUserId, AssigneeId = request.AssigneeId, ReviewerId = request.ReviewerId,
                DepartmentId = request.DepartmentId, Priority = request.Priority ?? TaskPriority.Medium,
                DueDate = request.DueDate,
                Documents = new() { new() { Id = id, Kind = "Inbox", Version = request.Version } }
            };
            var taskId = await _mediator.Send(command, ct);
            return Ok(new { success = true, data = await _mediator.Send(new Application.Features.Tasks.Queries.GetTaskDetail.GetTaskDetailQuery(taskId, CurrentUserId), ct) });
        }
        /// <summary>
        /// Toggle SubTask hoàn thành → cập nhật ProgressPercentage → thông báo 2 chiều.
        /// Cả Assigner + Assignee đều nhận thông báo % tiến độ mới.
        /// </summary>
        [HttpPost("subtask/{subTaskId:guid}/toggle")]
        public async Task<IActionResult> ToggleSubTask([FromRoute] Guid subTaskId, [FromBody] SetChecklistRequest request, CancellationToken ct)
        {
            var result = await _mediator.Send(new Application.Features.SubTasks.Commands.ToggleSubTask.ToggleSubTaskCommand(subTaskId, CurrentUserId)
                { RequestId = request.RequestId, Version = request.Version, IsCompleted = request.IsCompleted }, ct);
            return result ? Ok(new { success = true }) : NotFound(new { success = false, error = "Không tìm thấy checklist có thể chỉnh sửa." });
        }
    }
    public class ScheduleDocumentRequest
    {
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid? ReviewerId { get; set; }
        public string? Requirements { get; set; }
        public DateTime ScheduledDate { get; set; }
        public string? ScheduledShift { get; set; }
        public Guid? AssigneeId { get; set; }
    }

    public class ConfirmClassificationRequest
    {
        public string? Route { get; set; } // "event" | "assign" | "review"
        public DateTime? EventStartDateTime { get; set; }
        public DateTime? EventEndDateTime { get; set; }
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
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid? ReviewerId { get; set; }
        public string? Title { get; set; }
        public string? Description { get; set; }
        public Guid AssigneeId { get; set; }
        public Guid? DepartmentId { get; set; }
        public TaskPriority? Priority { get; set; }
        public DateTime? DueDate { get; set; }
        public string? Requirements { get; set; }
    }
}
