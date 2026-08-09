using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.Departments.Queries.GetDepartments;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class DepartmentsController : ControllerBase
    {
        private readonly ISender _mediator;

        public DepartmentsController(ISender mediator)
        {
            _mediator = mediator;
        }

        /// <summary>
        /// Lấy danh sách 5 phòng ban chuyên môn cấp xã
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetDepartments()
        {
            var result = await _mediator.Send(new GetDepartmentsQuery());
            return Ok(new { success = true, data = result });
        }
    }
}
