using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.Notifications.Commands.MarkRead;
using Quanlycongviec.Application.Features.Notifications.Queries.GetMyNotifications;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public NotificationsController(IMediator mediator)
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
        /// Lấy danh sách thông báo của người dùng đăng nhập hiện tại
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetMyNotifications([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            if (CurrentUserId == Guid.Empty)
                return Unauthorized(new { success = false, message = "Không xác định được phiên làm việc người dùng." });

            var query = new GetMyNotificationsQuery(CurrentUserId, page, pageSize);
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Đánh dấu 1 thông báo là đã đọc
        /// </summary>
        [HttpPatch("{id:guid}/read")]
        public async Task<IActionResult> MarkRead([FromRoute] Guid id)
        {
            if (CurrentUserId == Guid.Empty)
                return Unauthorized(new { success = false, message = "Không xác định được phiên làm việc người dùng." });

            var command = new MarkNotificationReadCommand(CurrentUserId, new List<Guid> { id });
            var result = await _mediator.Send(command);
            return Ok(new { success = result, message = "Đã đánh dấu thông báo là đã đọc." });
        }

        /// <summary>
        /// Đánh dấu tất cả thông báo là đã đọc
        /// </summary>
        [HttpPatch("read-all")]
        public async Task<IActionResult> MarkAllRead()
        {
            if (CurrentUserId == Guid.Empty)
                return Unauthorized(new { success = false, message = "Không xác định được phiên làm việc người dùng." });

            var command = new MarkNotificationReadCommand(CurrentUserId, markAllAsRead: true);
            var result = await _mediator.Send(command);
            return Ok(new { success = result, message = "Đã đánh dấu tất cả thông báo là đã đọc." });
        }
    }
}
