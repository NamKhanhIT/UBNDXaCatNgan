using System;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.ActivityLogs.Queries.GetActivityLog;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class ActivityLogController : ControllerBase
    {
        private readonly ISender _mediator;

        public ActivityLogController(ISender mediator)
        {
            _mediator = mediator;
        }

        // BẢO MẬT (Audit X1): dùng extension dùng chung CurrentUserExtensions.GetUserId
        private Guid CurrentUserId => User.GetUserId();

        /// <summary>
        /// Lấy nhật ký hoạt động toàn xã (có phân trang)
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetActivityLog([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] Guid? userId = null)
        {
            var query = new GetActivityLogQuery
            {
                Page = page,
                PageSize = pageSize,
                FilterByUserId = userId
            };
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }
    }
}
