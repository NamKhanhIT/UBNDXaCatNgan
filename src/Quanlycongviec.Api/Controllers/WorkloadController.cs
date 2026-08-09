using System;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.Workload.Queries.GetWorkloadHeatmap;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class WorkloadController : ControllerBase
    {
        private readonly ISender _mediator;

        public WorkloadController(ISender mediator)
        {
            _mediator = mediator;
        }

        /// <summary>
        /// Truy vấn Heatmap tải công việc cán bộ / nhân sự (Resource Capacity & Workload Heatmap)
        /// </summary>
        [HttpGet("heatmap")]
        public async Task<IActionResult> GetHeatmap([FromQuery] Guid? departmentId)
        {
            var result = await _mediator.Send(new GetWorkloadHeatmapQuery(departmentId));
            return Ok(new { success = true, data = result, message = "Lấy dữ liệu Heatmap tải công việc thành công." });
        }
    }
}
