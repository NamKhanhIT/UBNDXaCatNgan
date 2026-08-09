using System;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.Comments.Commands.CreateComment;
using Quanlycongviec.Application.Features.Comments.Queries.GetComments;
using Quanlycongviec.Application.Features.SubTasks.Commands.CreateSubTask;
using Quanlycongviec.Application.Features.SubTasks.Commands.ToggleSubTask;
using Quanlycongviec.Application.Features.SubTasks.Queries.GetSubTasks;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Application.Features.Tasks.Commands.ProcessAIStructuredTask;
using Quanlycongviec.Application.Features.Tasks.Commands.SubmitUBMTTQReview;
using Quanlycongviec.Application.Features.Tasks.Commands.TransferTask;
using Quanlycongviec.Application.Features.Tasks.Commands.UpdateTaskStatus;
using Quanlycongviec.Application.Features.Tasks.Queries.GetTasks;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class TasksController : ControllerBase
    {
        private readonly ISender _mediator;

        public TasksController(ISender mediator)
        {
            _mediator = mediator;
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

        private int CurrentRankLevel
        {
            get
            {
                var claim = User.FindFirst("RankLevel")?.Value;
                return int.TryParse(claim, out var rank) ? rank : 5;
            }
        }

        /// <summary>
        /// Lấy danh sách nhiệm vụ phân quyền theo cán bộ / lãnh đạo
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetTasks([FromQuery] string? status = null, [FromQuery] Guid? departmentId = null, [FromQuery] string? q = null)
        {
            var query = new GetTasksQuery(CurrentUserId, CurrentRankLevel, status, departmentId, q);
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Khởi tạo thẻ công việc mới (Giao việc)
        /// </summary>
        [HttpPost]
        [Authorize(Policy = "ManagerPlus")]
        public async Task<IActionResult> CreateTask([FromBody] CreateTaskCommand command)
        {
            var taskId = await _mediator.Send(command);
            return Ok(new { success = true, data = taskId, message = "Khởi tạo công việc thành công." });
        }

        /// <summary>
        /// Cập nhật trạng thái công việc (Hoàn thành, Từ chối, Đang xử lý, Chờ duyệt)
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
                request.NewExtendedDueDate);

            var success = await _mediator.Send(command);
            if (!success) return BadRequest(new { success = false, message = "Không thể cập nhật trạng thái nhiệm vụ." });

            return Ok(new { success = true, message = "Đã cập nhật trạng thái nhiệm vụ thành công." });
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
            var query = new GetSubTasksQuery(taskId);
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Thêm công việc con mới vào checklist
        /// </summary>
        [HttpPost("{taskId:guid}/subtasks")]
        public async Task<IActionResult> CreateSubTask([FromRoute] Guid taskId, [FromBody] CreateSubTaskRequest request)
        {
            var command = new CreateSubTaskCommand(taskId, request.Title);
            var id = await _mediator.Send(command);
            return Ok(new { success = true, data = id, message = "Đã thêm công việc con thành công." });
        }

        /// <summary>
        /// Tích chọn hoàn thành / chưa hoàn thành công việc con
        /// </summary>
        [HttpPatch("{taskId:guid}/subtasks/{subTaskId:guid}/toggle")]
        public async Task<IActionResult> ToggleSubTask([FromRoute] Guid taskId, [FromRoute] Guid subTaskId)
        {
            var command = new ToggleSubTaskCommand(subTaskId);
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
            var query = new GetTaskCommentsQuery { TaskId = taskId };
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
        public string? RejectionReason { get; set; }
        public DateTime? NewExtendedDueDate { get; set; }
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
