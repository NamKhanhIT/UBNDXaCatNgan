using System;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.Inbox.Commands.ScheduleDocument;
using Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocuments;
using Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocumentsPaginated;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class InboxController : ControllerBase
    {
        private readonly ISender _mediator;

        public InboxController(ISender mediator)
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

        /// <summary>
        /// Lấy danh sách văn bản chỉ đạo đến từ CSDL PostgreSQL — phân trang server-side
        /// Hỗ trợ: ?page=1&pageSize=25&isScheduled=false&channel=Internal&search=...&isUrgent=true
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
    }

    public class ScheduleDocumentRequest
    {
        public DateTime ScheduledDate { get; set; }
        public string? ScheduledShift { get; set; }
        public Guid? AssigneeId { get; set; }
    }
}
