using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.RatingHistory.Commands.ApproveRatingRevision;
using Quanlycongviec.Application.Features.RatingHistory.Commands.RejectRatingRevision;
using Quanlycongviec.Application.Features.RatingHistory.Commands.SubmitRatingRevision;
using Quanlycongviec.Application.Features.RatingHistory.DTOs;
using Quanlycongviec.Application.Features.RatingHistory.Queries.GetPendingRatingRevisions;
using Quanlycongviec.Application.Features.RatingHistory.Queries.GetTaskRatingHistory;
using Quanlycongviec.Application.Features.RatingHistory.Queries.GetUserRatingHistory;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1")]
    [Authorize]
    public class RatingHistoryController : ControllerBase
    {
        private readonly IMediator _mediator;

        public RatingHistoryController(IMediator mediator)
        {
            _mediator = mediator;
        }

        // BẢO MẬT (Audit X1 + L3): dùng extension dùng chung — bỏ fallback GUID admin cứng
        private Guid GetCurrentUserId() => User.GetUserId();

        // Gửi đề xuất điều chỉnh điểm đánh giá nghiệm thu
        [HttpPost("Tasks/{id}/rating-revision")]
        public async Task<ActionResult<RatingHistoryDto>> SubmitRatingRevision(Guid id, [FromBody] SubmitRatingRevisionDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _mediator.Send(new SubmitRatingRevisionCommand(
                    id,
                    dto.NewScore,
                    dto.Reason,
                    dto.EvidenceUrl,
                    userId,
                    dto.NewSystemScore,
                    dto.NewEvaluatorScore
                ));

                return Ok(result);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(new { error = ex.Message });
            }
        }

        // Xem lịch sử điều chỉnh điểm của 1 công việc (Cho phép cả người làm, người giao và lãnh đạo xem)
        [HttpGet("Tasks/{id}/rating-history")]
        public async Task<ActionResult<List<RatingHistoryDto>>> GetTaskRatingHistory(Guid id)
        {
            var result = await _mediator.Send(new GetTaskRatingHistoryQuery(id));
            return Ok(result);
        }

        // Lấy danh sách các đề xuất sửa điểm đang chờ Lãnh đạo cấp trên phê duyệt
        [HttpGet("RatingHistory/pending")]
        [Authorize(Policy = "LeaderOnly")]
        public async Task<ActionResult<List<RatingHistoryDto>>> GetPendingRatingRevisions()
        {
            var result = await _mediator.Send(new GetPendingRatingRevisionsQuery());
            return Ok(result);
        }

        // Lãnh đạo cấp trên phê duyệt đề xuất sửa điểm (Thực sự áp dụng điểm mới)
        [HttpPost("RatingHistory/{id}/approve")]
        [Authorize(Policy = "LeaderOnly")]
        public async Task<ActionResult<bool>> ApproveRatingRevision(Guid id)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _mediator.Send(new ApproveRatingRevisionCommand(id, userId));
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // Lãnh đạo cấp trên từ chối đề xuất sửa điểm (Điểm số giữ nguyên)
        [HttpPost("RatingHistory/{id}/reject")]
        [Authorize(Policy = "LeaderOnly")]
        public async Task<ActionResult<bool>> RejectRatingRevision(Guid id, [FromBody] RejectRatingRevisionDto dto)
        {
            try
            {
                var userId = GetCurrentUserId();
                var result = await _mediator.Send(new RejectRatingRevisionCommand(id, dto.RejectionReason, userId));
                return Ok(result);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // Lấy chu kỳ đánh giá cán bộ đang hoạt động
        [HttpGet("RatingPeriods/active")]
        public async Task<ActionResult<Quanlycongviec.Application.Features.RatingHistory.Queries.GetActiveRatingPeriod.RatingPeriodDto?>> GetActiveRatingPeriod()
        {
            var result = await _mediator.Send(new Quanlycongviec.Application.Features.RatingHistory.Queries.GetActiveRatingPeriod.GetActiveRatingPeriodQuery());
            return Ok(result);
        }

        // Lấy lịch sử chỉnh sửa điểm tổng hợp của 1 cán bộ (qua tất cả công việc được giao).
        // Dùng cho Evaluation Timeline modal trên frontend.
        
        [HttpGet("RatingHistory/by-user")]
        public async Task<ActionResult<List<RatingHistoryDto>>> GetUserRatingHistory(
            [FromQuery] Guid userId,
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null)
        {
            var result = await _mediator.Send(new GetUserRatingHistoryQuery(userId, from, to));
            return Ok(result);
        }
    }
}
