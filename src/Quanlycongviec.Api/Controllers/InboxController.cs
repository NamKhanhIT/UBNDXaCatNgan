using System;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.Inbox.Commands.ScheduleDocument;
using Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocuments;

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
        /// Lấy danh sách văn bản chỉ đạo đến từ CSDL PostgreSQL (hỗ trợ phân luồng ?channel=Internal hoặc ?channel=PublicService)
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetInboxDocuments([FromQuery] string? channel = null)
        {
            var query = new GetInboxDocumentsQuery { Channel = channel };
            var result = await _mediator.Send(query);
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
