using System;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Comments.Commands.CreateComment;
using Quanlycongviec.Application.Features.Comments.Queries.GetComments;
using Quanlycongviec.Application.Features.SubTasks.Commands.CreateSubTask;
using Quanlycongviec.Application.Features.SubTasks.Commands.ToggleSubTask;
using Quanlycongviec.Application.Features.SubTasks.Queries.GetSubTasks;
using Quanlycongviec.Application.Features.TaskAnnotations.Commands.CreateTaskReviewAnnotation;
using Quanlycongviec.Application.Features.TaskAnnotations.Commands.ResolveTaskReviewAnnotation;
using Quanlycongviec.Application.Features.TaskAnnotations.Queries.GetTaskReviewAnnotations;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Application.Features.Tasks.Commands.ProcessAIStructuredTask;
using Quanlycongviec.Application.Features.Tasks.Commands.SubmitUBMTTQReview;
using Quanlycongviec.Application.Features.Tasks.Commands.TransferTask;
using Quanlycongviec.Application.Features.Tasks.Commands.UpdateTaskStatus;
using Quanlycongviec.Application.Features.Tasks.Queries.CalculateTaskSystemScore;
using Quanlycongviec.Application.Features.Tasks.Queries.GetTasks;
using Quanlycongviec.Application.Features.Tasks.Queries.GetTaskDetail;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class TasksController : ControllerBase
    {
        private readonly ISender _mediator;
        private readonly Quanlycongviec.Application.Common.Interfaces.IRealtimePublisherService _realtimePublisher;
        private readonly Quanlycongviec.Application.Common.Interfaces.IApplicationDbContext _context;

        public TasksController(
            ISender mediator,
            Quanlycongviec.Application.Common.Interfaces.IRealtimePublisherService realtimePublisher,
            Quanlycongviec.Application.Common.Interfaces.IApplicationDbContext context)
        {
            _mediator = mediator;
            _realtimePublisher = realtimePublisher;
            _context = context;
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
        /// Lấy danh sách nhiệm vụ phân quyền theo cán bộ / lãnh đạo — phân trang server-side
        /// Hỗ trợ: ?page=1&pageSize=25&status=...&departmentId=...&q=...&dueDate=...&dueDateFrom=...&dueDateTo=...
        /// Tham số mới (Audit 04-09-2026): <c>today=true</c> — chỉ trả về task liên quan tới user
        /// (giao hoặc nhận) có DueDate hôm nay hoặc đã quá hạn.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetTasks(
            [FromQuery] string? status = null,
            [FromQuery] Guid? departmentId = null,
            [FromQuery] string? q = null,
            [FromQuery] string? priority = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] DateTime? dueDate = null,
            [FromQuery] DateTime? dueDateFrom = null,
            [FromQuery] DateTime? dueDateTo = null,
            [FromQuery(Name = "today")] bool todayOnly = false)
        {
            var query = new GetTasksQuery(CurrentUserId, CurrentRankLevel, status, departmentId, q, page, pageSize, dueDate, dueDateFrom, dueDateTo, todayOnly)
            {
                PriorityFilter = priority
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

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetTaskDetail([FromRoute] Guid id)
        {
            var result = await _mediator.Send(new GetTaskDetailQuery(id, CurrentUserId));
            if (result == null) return NotFound(new { success = false, error = "Không tìm thấy nhiệm vụ." });
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Khởi tạo thẻ công việc mới (Giao việc)
        /// </summary>
        [HttpPost]
        [Authorize(Policy = "ManagerPlus")]
        public async Task<IActionResult> CreateTask([FromBody] CreateTaskCommand command)
        {
            // The authenticated principal is the only trusted assigner identity.
            command.AssignerId = CurrentUserId;
            if (command.AssignerId == Guid.Empty) return Unauthorized(new { success = false, message = "Phiên làm việc không hợp lệ." });
            if (command.AssigneeId == Guid.Empty)
            {
                return BadRequest(new { success = false, message = "Vui lòng chọn cán bộ thực hiện nhiệm vụ." });
            }

            var taskId = await _mediator.Send(command);

            // Phát sự kiện SignalR TaskAssigned và ReceiveNotification tới các client realtime
            await _realtimePublisher.PublishToUsersAsync(new[] { command.AssignerId, command.AssigneeId }, "TaskAssigned", new
            {
                taskId,
                title = command.Title,
                assigneeId = command.AssigneeId,
                assignerId = command.AssignerId,
                dueDate = command.DueDate,
                priority = command.Priority.ToString(),
                type = command.Type.ToString()
            });

            await _realtimePublisher.PublishToUserAsync(command.AssigneeId, "ReceiveNotification", new
            {
                id = $"notif-{taskId}",
                userId = command.AssigneeId,
                taskItemId = taskId,
                type = "Assigned",
                channel = "SignalR",
                title = $"📌 Nhiệm vụ mới: {command.Title}",
                message = $"Đồng chí được giao nhiệm vụ [{command.Title}].",
                sentAt = DateTime.UtcNow,
                isRead = false
            });

            return Ok(new { success = true, data = taskId, message = "Khởi tạo công việc thành công." });
        }

        /// <summary>
        /// Cập nhật trạng thái công việc (Hoàn thành, Từ chối, Đang xử lý, Chờ duyệt) kèm đánh giá thang 10 điểm
        /// </summary>
        [HttpPatch("{id:guid}/status")]
        public async Task<IActionResult> UpdateStatus([FromRoute] Guid id, [FromBody] UpdateTaskStatusRequest request)
        {
            var command = new UpdateTaskStatusCommand(
                id,
                request.Status,
                CurrentUserId,
                request.RatingScore,
                request.RejectionReason,
                request.NewExtendedDueDate,
                request.SystemScore,
                request.EvaluatorScore,
                request.SubmissionNote);

            var success = await _mediator.Send(command);
            if (!success) return BadRequest(new { success = false, message = "Không thể cập nhật trạng thái nhiệm vụ." });

            var taskParticipants = await _context.TaskItems
                .Where(t => t.Id == id && !t.IsDeleted)
                .Select(t => new { t.AssignerId, t.AssigneeId })
                .FirstOrDefaultAsync(HttpContext.RequestAborted);
            var recipientIds = taskParticipants == null
                ? new[] { CurrentUserId }
                : new[] { CurrentUserId, taskParticipants.AssignerId, taskParticipants.AssigneeId };

            // Phát sự kiện TaskUpdated
            await _realtimePublisher.PublishToUsersAsync(recipientIds, "TaskUpdated", new
            {
                taskId = id,
                status = request.Status,
                ratingScore = request.RatingScore,
                submissionNote = request.SubmissionNote,
                updatedBy = CurrentUserId
            });

            // Nếu gia hạn hạn chót
            if (request.NewExtendedDueDate.HasValue)
            {
                await _realtimePublisher.PublishToUsersAsync(recipientIds, "TaskDeadlineChanged", new
                {
                    taskId = id,
                    newDueDate = request.NewExtendedDueDate.Value
                });
            }

            // Phát sự kiện trạng thái nghiệp vụ báo cáo
            if (string.Equals(request.Status, "Cho_Duyet", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(request.Status, "PendingReview", StringComparison.OrdinalIgnoreCase))
            {
                await _realtimePublisher.PublishToUsersAsync(recipientIds, "ReportSubmitted", new
                {
                    taskId = id,
                    submissionNote = request.SubmissionNote,
                    submittedBy = CurrentUserId
                });
            }
            else if (string.Equals(request.Status, "Hoan_Thanh", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(request.Status, "Completed", StringComparison.OrdinalIgnoreCase))
            {
                await _realtimePublisher.PublishToUsersAsync(recipientIds, "ReportApproved", new
                {
                    taskId = id,
                    ratingScore = request.RatingScore ?? request.EvaluatorScore,
                    approvedBy = CurrentUserId
                });
            }
            else if (string.Equals(request.Status, "Tu_Choi", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(request.Status, "Rejected", StringComparison.OrdinalIgnoreCase))
            {
                await _realtimePublisher.PublishToUsersAsync(recipientIds, "ReportRejected", new
                {
                    taskId = id,
                    reason = request.RejectionReason,
                    rejectedBy = CurrentUserId
                });
            }

            return Ok(new { success = true, message = "Đã cập nhật trạng thái nhiệm vụ thành công." });
        }

        /// <summary>
        /// Xem trước / Tính toán điểm số hệ thống tự động (30 điểm khách quan)
        /// </summary>
        [HttpGet("{id:guid}/system-score")]
        public async Task<IActionResult> GetSystemScore([FromRoute] Guid id)
        {
            var query = new CalculateTaskSystemScoreQuery(id);
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Lấy toàn bộ danh sách chú thích khoanh vùng (cả Open và Resolved)
        /// </summary>
        [HttpGet("{id:guid}/annotations")]
        public async Task<IActionResult> GetAnnotations([FromRoute] Guid id)
        {
            var query = new GetTaskReviewAnnotationsQuery(id);
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Tạo chú thích khoanh vùng mới trên nội dung kết quả nộp
        /// </summary>
        [HttpPost("{id:guid}/annotations")]
        public async Task<IActionResult> CreateAnnotation([FromRoute] Guid id, [FromBody] CreateAnnotationRequest request)
        {
            var command = new CreateTaskReviewAnnotationCommand(
                id,
                request.AnchorText,
                request.StartOffsetHint,
                request.CommentText,
                request.Severity,
                CurrentUserId);

            var result = await _mediator.Send(command);
            return Ok(new { success = true, data = result, message = "Đã thêm chú thích nhận xét thành công." });
        }

        /// <summary>
        /// Đánh dấu đã sửa xong chú thích (Resolve annotation)
        /// </summary>
        [HttpPost("{id:guid}/annotations/{annotationId:guid}/resolve")]
        public async Task<IActionResult> ResolveAnnotation([FromRoute] Guid id, [FromRoute] Guid annotationId)
        {
            var command = new ResolveTaskReviewAnnotationCommand(id, annotationId, CurrentUserId);
            var result = await _mediator.Send(command);
            return Ok(new { success = true, data = result, message = "Đã xác nhận sửa xong chú thích." });
        }

        /// <summary>
        /// Trích xuất tác vụ tự động từ tài liệu chỉ đạo / biên bản họp thông qua AI Multi-Agent Engine
        /// </summary>
        [HttpPost("ai-extract")]
        [Authorize(Policy = "ManagerPlus")]
        public async Task<IActionResult> ProcessAITask([FromBody] ProcessAIStructuredTaskCommand command)
        {
            var result = await _mediator.Send(command);
            return Ok(new { success = true, data = result, message = "Trích xuất công việc bằng AI thành công." });
        }

        /// <summary>
        /// Điều chuyển nhiệm vụ sang cán bộ khác và cập nhật tải công chức trong PostgreSQL
        /// </summary>
        [HttpPost("{id:guid}/transfer")]
        [Authorize(Policy = "ManagerPlus")]
        public async Task<IActionResult> TransferTask([FromRoute] Guid id, [FromBody] TransferTaskRequest request)
        {
            var command = new TransferTaskCommand(id, request.TargetUserId, request.Reason, CurrentUserId);
            var success = await _mediator.Send(command);
            if (!success) return BadRequest(new { success = false, message = "Không thể điều chuyển nhiệm vụ." });

            return Ok(new { success = true, message = "Đã điều chuyển nhiệm vụ thành công." });
        }

        /// <summary>
        /// Lấy danh sách checklist công việc con (SubTasks)
        /// </summary>
        [HttpGet("{taskId:guid}/subtasks")]
        public async Task<IActionResult> GetSubTasks([FromRoute] Guid taskId)
        {
            var query = new GetSubTasksQuery(taskId) { CurrentUserId = CurrentUserId };
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Thêm công việc con mới vào checklist
        /// </summary>
        [HttpPost("{taskId:guid}/subtasks")]
        public async Task<IActionResult> CreateSubTask([FromRoute] Guid taskId, [FromBody] CreateSubTaskRequest request)
        {
            var command = new CreateSubTaskCommand(taskId, request.Title, CurrentUserId);
            var id = await _mediator.Send(command);
            return Ok(new { success = true, data = id, message = "Đã thêm công việc con thành công." });
        }

        /// <summary>
        /// Tích chọn hoàn thành / chưa hoàn thành công việc con
        /// </summary>
        [HttpPatch("{taskId:guid}/subtasks/{subTaskId:guid}/toggle")]
        public async Task<IActionResult> ToggleSubTask([FromRoute] Guid taskId, [FromRoute] Guid subTaskId)
        {
            var command = new ToggleSubTaskCommand(subTaskId, CurrentUserId);
            var success = await _mediator.Send(command);
            if (!success) return BadRequest(new { success = false, message = "Không thể cập nhật công việc con." });

            return Ok(new { success = true, message = "Đã cập nhật trạng thái công việc con." });
        }

        /// <summary>
        /// Lấy danh sách bình luận của nhiệm vụ
        /// </summary>
        [HttpGet("{taskId:guid}/comments")]
        public async Task<IActionResult> GetComments([FromRoute] Guid taskId)
        {
            var query = new GetTaskCommentsQuery { TaskId = taskId, CurrentUserId = CurrentUserId };
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Tạo bình luận mới (hỗ trợ @mention)
        /// </summary>
        [HttpPost("{taskId:guid}/comments")]
        public async Task<IActionResult> CreateComment([FromRoute] Guid taskId, [FromBody] CreateCommentRequest request)
        {
            var command = new CreateTaskCommentCommand
            {
                TaskId = taskId,
                UserId = CurrentUserId,
                Content = request.Content
            };
            var result = await _mediator.Send(command);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }

        /// <summary>
        /// Phản biện UBMTTQ cho công việc loại Dự án / Nghị quyết (bắt buộc theo Luật 72/2025)
        /// </summary>
        [HttpPost("{taskId:guid}/ubmttq-review")]
        public async Task<IActionResult> SubmitUBMTTQReview([FromRoute] Guid taskId, [FromBody] SubmitUBMTTQReviewRequest request)
        {
            var command = new SubmitUBMTTQReviewCommand
            {
                TaskId = taskId,
                ReviewerUserId = CurrentUserId,
                ReviewContent = request.ReviewContent,
                IsApproved = request.IsApproved
            };
            var result = await _mediator.Send(command);
            if (!result.Success) return BadRequest(result);
            return Ok(result);
        }
    }

    public class UpdateTaskStatusRequest
    {
        public string Status { get; set; } = string.Empty;
        public double? RatingScore { get; set; }
        public double? SystemScore { get; set; }
        public double? EvaluatorScore { get; set; }
        public string? SubmissionNote { get; set; }
        public string? RejectionReason { get; set; }
        public DateTime? NewExtendedDueDate { get; set; }
    }

    public class CreateAnnotationRequest
    {
        public string AnchorText { get; set; } = string.Empty;
        public int? StartOffsetHint { get; set; }
        public string CommentText { get; set; } = string.Empty;
        public AnnotationSeverityEnum Severity { get; set; } = AnnotationSeverityEnum.CanChinhSua;
    }

    public class TransferTaskRequest
    {
        public Guid TargetUserId { get; set; }
        public string Reason { get; set; } = string.Empty;
    }

    public class CreateSubTaskRequest
    {
        public string Title { get; set; } = string.Empty;
    }

    public class CreateCommentRequest
    {
        public string Content { get; set; } = string.Empty;
    }

    public class SubmitUBMTTQReviewRequest
    {
        public string ReviewContent { get; set; } = string.Empty;
        public bool IsApproved { get; set; }
    }
}
