using System;
using System.IO;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Reports.Commands.DeleteOfficerRating;
using Quanlycongviec.Application.Features.Reports.Commands.EvaluateOfficer;
using Quanlycongviec.Application.Features.Reports.Queries.ExportEvaluationReport;
using Quanlycongviec.Application.Features.Reports.Queries.GetGRADReport;
using Quanlycongviec.Application.Features.Reports.Queries.GetOfficerEvaluationDetail;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class ReportsController : ControllerBase
    {
        private readonly ISender _mediator;
        private readonly IApplicationDbContext _context;

        public ReportsController(ISender mediator, IApplicationDbContext context)
        {
            _mediator = mediator;
            _context = context;
        }

        private Guid CurrentUserId => User.GetUserId();

        private int CurrentRankLevel
        {
            get
            {
                var claim = User.FindFirst("RankLevel")?.Value;
                return int.TryParse(claim, out var rank) ? rank : 5;
            }
        }

        private Guid? CurrentDepartmentId
        {
            get
            {
                var claim = User.FindFirst("DepartmentId")?.Value;
                return Guid.TryParse(claim, out var deptId) ? deptId : null;
            }
        }

        // Báo cáo Đánh giá Kép GRAD năng lực cán bộ công chức (40% SubTask + 60% Lãnh đạo nghiệm thu)
        // Phân quyền phạm vi: Lãnh đạo xã xem toàn bộ, Trưởng phòng xem phòng mình, Chuyên viên bị cấm.
        [HttpGet("grad")]
        public async Task<IActionResult> GetGRADReport()
        {
            if (CurrentRankLevel > 4)
            {
                return Forbid();
            }

            var query = new GetGRADReportQuery
            {
                CurrentUserId = CurrentUserId,
                UserRankLevel = CurrentRankLevel,
                DepartmentId = CurrentDepartmentId
            };
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }

        // Lãnh đạo thẩm định điểm thi đua cán bộ công chức (Thang 10 điểm: Tối đa 3 điểm hệ thống + 7 điểm lãnh đạo)
        [HttpPost("grad/evaluate")]
        public async Task<IActionResult> EvaluateOfficer(
            [FromBody] EvaluateOfficerRequestDto dto,
            CancellationToken ct)
        {
            if (CurrentRankLevel > 4)
            {
                return Forbid();
            }

            var command = new EvaluateOfficerCommand(
                dto.TargetUserId,
                dto.RatingScore10,
                dto.EvaluatorScore70,
                dto.SystemScore30,
                dto.EvaluationPeriod,
                dto.EvaluationNotes,
                CurrentUserId,
                dto.Reason,
                dto.EvidenceFileIds,
                dto.EvidenceUrls
            );

            try
            {
                var result = await _mediator.Send(command, ct);
                return Ok(new { success = true, data = result });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { success = false, error = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
        }

        // Báo cáo KPI tiến độ toàn xã
        [HttpGet("kpi")]
        public async Task<IActionResult> GetKPIReport()
        {
            var query = new GetGRADReportQuery
            {
                CurrentUserId = CurrentUserId,
                UserRankLevel = CurrentRankLevel,
                DepartmentId = CurrentDepartmentId
            };
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = new { overallAverage = result.OverallCommuneAverageScore, departments = result.Departments } });
        }

        // Xem chi tiết đánh giá 1 cán bộ: thông tin, bảng điểm, lịch sử làm việc, văn bản liên quan.
        // Read-only — dùng cho View Detail Modal phía frontend.
        [HttpGet("grad/officer/{userId}")]
        public async Task<IActionResult> GetOfficerEvaluationDetail(Guid userId)
        {
            if (CurrentRankLevel > 4)
            {
                return Forbid();
            }

            var result = await _mediator.Send(new GetOfficerEvaluationDetailQuery(userId));
            return Ok(new { success = true, data = result });
        }

        // Xuất báo cáo thi đua ra file Excel (.xlsx). Hỗ trợ 5 period: week | month | quarter | halfyear | year.
        [HttpGet("grad/export")]
        public async Task<IActionResult> ExportEvaluation(
            [FromQuery] string period = "month",
            [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null,
            [FromQuery] string format = "csv")
        {
            if (CurrentRankLevel > 4)
            {
                return Forbid();
            }

            try
            {
                var (bytes, fileName, contentType) = await _mediator.Send(new ExportEvaluationReportQuery(
                    period,
                    from,
                    to,
                    CurrentUserId,
                    CurrentRankLevel,
                    CurrentDepartmentId,
                    format));

                return File(bytes, contentType, fileName);
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (NotImplementedException ex)
            {
                return StatusCode(501, new { success = false, error = ex.Message });
            }
        }

        // 07-09-2026: Upload evidence file (PDF/PNG/JPG/DOCX) cho đánh giá thi đua.
        // File được lưu vào /uploads/evaluation-evidence/ với DocumentAttachment.TargetType="EvaluationEvidence"
        // và DocumentId=Guid.Empty (orphan — không gắn với InboxDocument/OutgoingDocument).
        // EvidenceValidator truy vấn theo Id nên vẫn work.
        [HttpPost("grad/evidence/upload")]
        [RequestSizeLimit(50 * 1024 * 1024)] // 50MB
        [RequestFormLimits(MultipartBodyLengthLimit = 50 * 1024 * 1024)]
        public async Task<IActionResult> UploadEvidence(
            [FromForm] IFormFile? file,
            CancellationToken ct = default)
        {
            if (CurrentRankLevel > 4)
            {
                return Forbid();
            }

            // 1. Validate file
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { success = false, error = "File tải lên không hợp lệ hoặc rỗng." });
            }

            const long maxBytes = 10 * 1024 * 1024; // 10MB
            if (file.Length > maxBytes)
            {
                return BadRequest(new
                {
                    success = false,
                    error = $"File vượt quá dung lượng cho phép (10MB). Dung lượng file: {file.Length / (1024.0 * 1024.0):F1}MB."
                });
            }

            var ext = Path.GetExtension(file.FileName).TrimStart('.').ToLowerInvariant();
            var allowedExts = new[] { "pdf", "png", "jpg", "jpeg", "docx" };
            if (!allowedExts.Contains(ext))
            {
                return BadRequest(new
                {
                    success = false,
                    error = $"Loại file .{ext} không được hỗ trợ. Chỉ chấp nhận: PDF, PNG, JPG, DOCX."
                });
            }

            // 2. Magic bytes validation (copy pattern từ FilesController)
            var magicError = await ValidateEvidenceMagicBytesAsync(file, ext);
            if (magicError != null)
            {
                return BadRequest(new { success = false, error = magicError });
            }

            // 3. Save to disk
            string storageDir = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "evaluation-evidence");
            if (!Directory.Exists(storageDir))
            {
                Directory.CreateDirectory(storageDir);
            }

            string safeFileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            string fullPath = Path.Combine(storageDir, safeFileName);

            try
            {
                using (var stream = new FileStream(fullPath, FileMode.Create))
                {
                    await file.CopyToAsync(stream, ct);
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    error = $"Không thể lưu file: {ex.Message}"
                });
            }

            // 4. Tạo DocumentAttachment record
            var attachment = new DocumentAttachment
            {
                Id = Guid.NewGuid(),
                DocumentId = Guid.Empty, // Orphan — đánh dấu là Evidence
                TargetType = "EvaluationEvidence",
                FileName = safeFileName,
                OriginalFileName = file.FileName,
                FilePath = fullPath,
                FileType = ext,
                FileSize = file.Length,
                AttachmentType = "Evidence",
                IsMainDocument = false,
                UploadedAt = DateTime.UtcNow,
                UploadedByUserId = CurrentUserId
            };
            _context.DocumentAttachments.Add(attachment);
            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                success = true,
                data = attachment.Id,
                message = "Tải file bằng chứng thành công."
            });
        }

        private static async Task<string?> ValidateEvidenceMagicBytesAsync(IFormFile file, string ext)
        {
            try
            {
                await using var stream = file.OpenReadStream();
                var header = new byte[8];
                var read = 0;
                while (read < header.Length)
                {
                    var count = await stream.ReadAsync(header.AsMemory(read, header.Length - read));
                    if (count == 0) break;
                    read += count;
                }

                var valid = ext switch
                {
                    "pdf" => read >= 5
                             && header[0] == 0x25 && header[1] == 0x50
                             && header[2] == 0x44 && header[3] == 0x46 && header[4] == 0x2D,
                    "png" => read >= 8
                             && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E
                             && header[3] == 0x47 && header[4] == 0x0D && header[5] == 0x0A
                             && header[6] == 0x1A && header[7] == 0x0A,
                    "jpg" or "jpeg" => read >= 3
                             && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
                    "docx" => read >= 4
                             && header[0] == 0x50 && header[1] == 0x4B
                             && header[2] == 0x03 && header[3] == 0x04,
                    _ => false
                };

                return valid ? null : "Nội dung file không khớp với phần mở rộng đã khai báo.";
            }
            catch
            {
                return "Không thể kiểm tra định dạng file tải lên.";
            }
        }

        // 07-09-2026: Xóa điểm thi đua cho 1 cán bộ trong kỳ (soft-delete + audit trail).
        // Lý do + bằng chứng là bắt buộc, kiểm tra tại handler (R.1 + R.2 + R.3).
        [HttpDelete("grad/evaluate")]
        public async Task<IActionResult> DeleteOfficerRating(
            [FromQuery] Guid targetUserId,
            [FromQuery] string evaluationPeriod,
            [FromQuery] string reason,
            [FromBody] Guid[]? evidenceFileIds,
            CancellationToken ct = default)
        {
            if (CurrentRankLevel > 4)
            {
                return Forbid();
            }

            if (targetUserId == Guid.Empty)
            {
                return BadRequest(new { success = false, error = "Thiếu targetUserId." });
            }

            if (string.IsNullOrWhiteSpace(reason))
            {
                return BadRequest(new { success = false, error = "Lý do xóa là bắt buộc." });
            }

            var command = new DeleteOfficerRatingCommand(
                targetUserId,
                evaluationPeriod ?? DateTime.UtcNow.ToString("yyyy-MM"),
                reason,
                evidenceFileIds ?? Array.Empty<Guid>(),
                CurrentUserId);

            try
            {
                var result = await _mediator.Send(command, ct);
                return Ok(new { success = true, data = result });
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(new { success = false, error = ex.Message });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(403, new { success = false, error = ex.Message });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, error = ex.Message });
            }
        }
    }
}
