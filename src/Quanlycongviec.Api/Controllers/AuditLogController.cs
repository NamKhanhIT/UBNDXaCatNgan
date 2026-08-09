using System;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.AuditLogs.Queries.GetAuditLog;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class AuditLogController : ControllerBase
    {
        private readonly ISender _mediator;

        public AuditLogController(ISender mediator)
        {
            _mediator = mediator;
        }

        /// <summary>
        /// Lấy sổ kiểm toán hệ thống append-only (chỉ Lãnh đạo xem)
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAuditLog([FromQuery] int page = 1, [FromQuery] int pageSize = 20, [FromQuery] Guid? userId = null, [FromQuery] string? action = null)
        {
            var query = new GetAuditLogQuery
            {
                Page = page,
                PageSize = pageSize,
                FilterByUserId = userId,
                FilterByAction = action
            };
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }
    }
}
