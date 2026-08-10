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
        /// Lấy sổ kiểm toán hệ thống append-only (Hỗ trợ lọc theo Người dùng, Hành động, ID Văn bản/Thực thể)
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAuditLog(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] Guid? userId = null,
            [FromQuery] string? action = null,
            [FromQuery] string? entityId = null)
        {
            var query = new GetAuditLogQuery
            {
                Page = page,
                PageSize = pageSize,
                FilterByUserId = userId,
                FilterByAction = action,
                FilterByEntityId = entityId
            };
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }
    }
}
