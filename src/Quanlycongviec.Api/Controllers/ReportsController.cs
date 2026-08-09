using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.Reports.Queries.GetGRADReport;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly ISender _mediator;

        public ReportsController(ISender mediator)
        {
            _mediator = mediator;
        }

        /// <summary>
        /// Báo cáo Đánh giá Kép GRAD năng lực cán bộ công chức (40% SubTask + 60% Lãnh đạo nghiệm thu)
        /// </summary>
        [HttpGet("grad")]
        public async Task<IActionResult> GetGRADReport()
        {
            var query = new GetGRADReportQuery();
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Báo cáo KPI tiến độ toàn xã
        /// </summary>
        [HttpGet("kpi")]
        public async Task<IActionResult> GetKPIReport()
        {
            var query = new GetGRADReportQuery();
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = new { overallAverage = result.OverallCommuneAverageScore, departments = result.Departments } });
        }
    }
}
