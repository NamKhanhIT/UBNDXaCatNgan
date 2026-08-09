using System;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.ReadReceipts.Commands.MarkRead;
using Quanlycongviec.Application.Features.ReadReceipts.Queries.GetReadReceipts;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class ReadReceiptsController : ControllerBase
    {
        private readonly ISender _mediator;

        public ReadReceiptsController(ISender mediator)
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
        /// Đánh dấu "đã xem" cho Task / Notification / InboxDocument
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> MarkRead([FromBody] MarkReadReceiptRequest request)
        {
            var command = new MarkReadReceiptCommand
            {
                UserId = CurrentUserId,
                TargetEntityType = request.TargetEntityType,
                TargetEntityId = request.TargetEntityId
            };
            var result = await _mediator.Send(command);
            return Ok(result);
        }

        /// <summary>
        /// Lấy danh sách cán bộ đã xem một entity
        /// </summary>
        [HttpGet("{targetEntityType}/{targetEntityId}")]
        public async Task<IActionResult> GetReadReceipts([FromRoute] string targetEntityType, [FromRoute] string targetEntityId)
        {
            var query = new GetReadReceiptsQuery
            {
                TargetEntityType = targetEntityType,
                TargetEntityId = targetEntityId
            };
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }
    }

    public class MarkReadReceiptRequest
    {
        public string TargetEntityType { get; set; } = string.Empty;
        public string TargetEntityId { get; set; } = string.Empty;
    }
}
