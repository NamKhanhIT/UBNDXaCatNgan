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

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1")]
    public class RatingHistoryController : ControllerBase
    {
        private readonly IMediator _mediator;

        public RatingHistoryController(IMediator mediator)
        {
            _mediator = mediator;
        }

        private Guid GetCurrentUserId()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(userIdStr, out var userId))
            {
                return userId;
            }
            // Fallback default admin user ID for local demo mode if claim is absent
            return Guid.Parse("11111111-1111-1111-1111-111111111111");
        }

        /// <summary>
        /// Gửi đề xuất điều chỉnh điểm đánh giá nghiệm thu
        /// </summary>
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

        /// <summary>
        /// Xem lịch sử điều chỉnh điểm của 1 công việc (Cho phép cả người làm, người giao và lãnh đạo xem)
        /// </summary>
        [HttpGet("Tasks/{id}/rating-history")]
        public async Task<ActionResult<List<RatingHistoryDto>>> GetTaskRatingHistory(Guid id)
        {
            var result = await _mediator.Send(new GetTaskRatingHistoryQuery(id));
            return Ok(result);
        }

        /// <summary>
        /// Lấy danh sách các đề xuất sửa điểm đang chờ Lãnh đạo cấp trên phê duyệt
        /// </summary>
        [HttpGet("RatingHistory/pending")]
        public async Task<ActionResult<List<RatingHistoryDto>>> GetPendingRatingRevisions()
        {
            var result = await _mediator.Send(new GetPendingRatingRevisionsQuery());
            return Ok(result);
        }

        /// <summary>
        /// Lãnh đạo cấp trên phê duyệt đề xuất sửa điểm (Thực sự áp dụng điểm mới)
        /// </summary>
        [HttpPost("RatingHistory/{id}/approve")]
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

        /// <summary>
        /// Lãnh đạo cấp trên từ chối đề xuất sửa điểm (Điểm số giữ nguyên)
        /// </summary>
        [HttpPost("RatingHistory/{id}/reject")]
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
    }
}
