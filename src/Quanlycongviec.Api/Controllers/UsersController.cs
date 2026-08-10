using System;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.Users.Queries.GetUsersPaginated;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly ISender _mediator;

        public UsersController(ISender mediator)
        {
            _mediator = mediator;
        }

        /// <summary>
        /// Lấy danh sách cán bộ / nhân sự toàn xã (Hỗ trợ phân trang, tìm kiếm, lọc phòng ban, vai trò, mức tải việc)
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetUsers(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20,
            [FromQuery] string? search = null,
            [FromQuery] Guid? departmentId = null,
            [FromQuery] string? roleCode = null,
            [FromQuery] string? workloadStatus = null)
        {
            var result = await _mediator.Send(new GetUsersPaginatedQuery
            {
                Page = page,
                PageSize = pageSize,
                Search = search,
                DepartmentId = departmentId,
                RoleCode = roleCode,
                WorkloadStatus = workloadStatus
            });
            return Ok(new { success = true, data = result });
        }
    }
}
