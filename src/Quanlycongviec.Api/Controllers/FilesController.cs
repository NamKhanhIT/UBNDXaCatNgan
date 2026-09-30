using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.AI.Models;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class FilesController : ControllerBase
    {
        private readonly IApplicationDbContext _context;
        private readonly IOcrService _ocrService;
        private readonly IDocumentAiService _aiService;
        private readonly IDocumentAccessService _documentAccessService;
        private readonly FileUploadOptions _uploadOptions;
        private readonly ILogger<FilesController> _logger;

        public FilesController(
            IApplicationDbContext context,
            IOcrService ocrService,
            IDocumentAiService aiService,
            IOptions<FileUploadOptions> uploadOptions,
            ILogger<FilesController> logger,
            IDocumentAccessService documentAccessService)
        {
            _context = context;
            _ocrService = ocrService;
            _aiService = aiService;
            _documentAccessService = documentAccessService;
            _uploadOptions = uploadOptions.Value;
            _logger = logger;
        }

        // BẢO MẬT (Audit X1): Lấy ID người dùng hiện tại qua CurrentUserExtensions
        private Guid CurrentUserId => User.GetUserId();

        // Lấy danh sách file đính kèm liên kết với 1 văn bản
        [HttpGet("document/{documentId:guid}")]
        public async Task<IActionResult> GetDocumentAttachments(
            [FromRoute] Guid documentId,
            [FromQuery] string targetType = "Inbox")
        {
            if (!await _documentAccessService.CanAccessDocumentAsync(
                    CurrentUserId, documentId, targetType, HttpContext.RequestAborted))
            {
                return NotFound();
            }

            var attachments = await _context.DocumentAttachments
                .Where(a => a.DocumentId == documentId
                            && a.TargetType == targetType
                            && !a.IsDeleted)
                .OrderByDescending(a => a.IsMainDocument)
                .ThenBy(a => a.UploadedAt)
                .Select(a => new
                {
                    a.Id,
                    a.DocumentId,
                    a.TargetType,
                    a.FileName,
                    a.OriginalFileName,
                    a.FileType,
                    a.FileSize,
                    a.AttachmentType,
                    a.IsMainDocument,
                    a.UploadedAt
                })
                .ToListAsync();

            return Ok(new { success = true, data = attachments });
        }

        // Xem trực tiếp PDF / Ảnh trên trình duyệt (file không tồn tại trả 404)
        [HttpGet("{id:guid}/view")]
        public async Task<IActionResult> ViewFileInline([FromRoute] Guid id)
        {
            var att = await _context.DocumentAttachments
                .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

            if (att == null)
            {
                return NotFound(new { success = false, error = "Không tìm thấy file đính kèm." });
            }

            if (!await _documentAccessService.CanAccessAttachmentAsync(
                    CurrentUserId, att, HttpContext.RequestAborted))
            {
                return NotFound();
            }

            string contentType = GetContentType(att.FileType, att.OriginalFileName);

            // Chỉ trả file nếu tồn tại trên đĩa — KHÔNG fallback file giả
            if (!string.IsNullOrEmpty(att.FilePath) && System.IO.File.Exists(att.FilePath))
            {
                var fileBytes = await System.IO.File.ReadAllBytesAsync(att.FilePath);
                Response.Headers.Append("Content-Disposition", $"inline; filename=\"{att.OriginalFileName}\"");
                return File(fileBytes, contentType);
            }

            _logger.LogWarning("File vật lý không tồn tại: {FilePath} (AttachmentId={Id})", att.FilePath, id);
            return NotFound(new
            {
                success = false,
                error = $"File vật lý không tồn tại trên server. Tên file gốc: {att.OriginalFileName}."
            });
        }

        // Tải file về máy (file không tồn tại trả 404)
        [HttpGet("{id:guid}/download")]
        public async Task<IActionResult> DownloadFile([FromRoute] Guid id)
        {
            var att = await _context.DocumentAttachments
                .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

            if (att != null && !await _documentAccessService.CanAccessAttachmentAsync(
                    CurrentUserId, att, HttpContext.RequestAborted))
            {
                return NotFound();
            }

            if (att == null)
            {
                return NotFound(new { success = false, error = "Không tìm thấy file đính kèm." });
            }

            string contentType = GetContentType(att.FileType, att.OriginalFileName);

            if (!string.IsNullOrEmpty(att.FilePath) && System.IO.File.Exists(att.FilePath))
            {
                var fileBytes = await System.IO.File.ReadAllBytesAsync(att.FilePath);
                return File(fileBytes, contentType, att.OriginalFileName);
            }

            _logger.LogWarning("File vật lý không tồn tại: {FilePath} (AttachmentId={Id})", att.FilePath, id);
            return NotFound(new
            {
                success = false,
                error = $"File vật lý không tồn tại trên server. Tên file gốc: {att.OriginalFileName}."
            });
        }

        // BẢO MẬT (Audit N1): Upload file đính kèm mới với validation dung lượng và Path.GetFileName chống path traversal
        [HttpPost("upload")]
        public async Task<IActionResult> UploadFile(
            [FromForm] IFormFile file,
            [FromForm] Guid documentId,
            [FromForm] string targetType = "Inbox",
            [FromForm] string attachmentType = "MainDocument",
            [FromForm] Guid? requestId = null)
        {
            var validation = ValidateFile(file);
            if (validation != null) return validation;

            var magicValidation = await ValidateMagicBytesAsync(file);
            if (magicValidation != null) return magicValidation;

            if (!await _documentAccessService.CanAccessDocumentAsync(
                    CurrentUserId, documentId, targetType, HttpContext.RequestAborted))
            {
                return NotFound();
            }

            var ops = new Quanlycongviec.Application.Common.Services.WorkflowOperations(_context);
            var operationId = requestId ?? Guid.NewGuid();
            string contentHash;
            await using (var input = file.OpenReadStream())
                contentHash = Convert.ToHexString(await System.Security.Cryptography.SHA256.HashDataAsync(input, HttpContext.RequestAborted));
            var fingerprint = Quanlycongviec.Application.Common.Services.WorkflowOperations.Fingerprint("UploadFile",
                new { documentId, targetType, attachmentType, file.FileName, file.Length, contentHash });
            var replay = await ops.ReplayAsync(CurrentUserId, operationId, fingerprint, HttpContext.RequestAborted);
            if (replay.HasValue) return Ok(new { success = true, data = replay.Value });
            if (!await new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context)
                    .GuardFileWriteAsync(CurrentUserId, documentId, targetType, HttpContext.RequestAborted))
                return StatusCode(403, new { success = false, error = "Bạn được xem nhưng không có quyền thêm tệp vào đối tượng này." });

            string ext = Path.GetExtension(file!.FileName).TrimStart('.').ToLower();
            string storageDir = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "documents");
            if (!Directory.Exists(storageDir))
            {
                Directory.CreateDirectory(storageDir);
            }

            string safeFileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            string fullPath = Path.Combine(storageDir, safeFileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            _logger.LogInformation("File uploaded: {OriginalName}, Size={Size}B, Path={Path}",
                file.FileName, file.Length, fullPath);

            var att = new DocumentAttachment
            {
                Id = Guid.NewGuid(),
                DocumentId = documentId,
                TargetType = targetType,
                FileName = safeFileName,
                OriginalFileName = file.FileName,
                FilePath = fullPath,
                FileType = ext,
                FileSize = file.Length,
                AttachmentType = attachmentType,
                IsMainDocument = attachmentType == "MainDocument",
                UploadedAt = DateTime.UtcNow,
                UploadedByUserId = CurrentUserId
            };

            _context.DocumentAttachments.Add(att);
            Guid attachmentId;
            try { attachmentId = await ops.CommitAsync(CurrentUserId, operationId, fingerprint, att.Id, HttpContext.RequestAborted); }
            catch
            {
                // Only this attempt's newly generated file is removed; existing attachments are untouched.
                System.IO.File.Delete(fullPath);
                throw;
            }
            if (attachmentId != att.Id) System.IO.File.Delete(fullPath);
            return Ok(new { success = true, data = attachmentId, message = "Tải file đính kèm thành công." });
        }

        // Compatibility upload route delegates to the same durable upload before optional OCR/AI.
        [HttpPost("upload-and-analyze")]
        public async Task<IActionResult> UploadAndAnalyze([FromForm] IFormFile file, [FromForm] Guid documentId,
            CancellationToken ct, [FromForm] Guid? requestId = null)
        {
            var uploaded = await UploadFile(file, documentId, "Inbox", "MainDocument", requestId);
            if (uploaded is not OkObjectResult ok) return uploaded;
            var attachmentId = JsonSerializer.SerializeToElement(ok.Value).GetProperty("data").GetGuid();
            return await AnalyzeStoredFile(attachmentId, ct);
        }

        [HttpPost("{id:guid}/analyze")]
        public Task<IActionResult> AnalyzeFile(Guid id, CancellationToken ct) => AnalyzeStoredFile(id, ct);

        private async Task<IActionResult> AnalyzeStoredFile(Guid attachmentId, CancellationToken ct)
        {
            var attachment = await _context.DocumentAttachments.FirstOrDefaultAsync(a => a.Id == attachmentId && !a.IsDeleted, ct);
            if (attachment == null || attachment.TargetType != "Inbox"
                || !await _documentAccessService.CanAccessAttachmentAsync(CurrentUserId, attachment, ct)) return NotFound();
            var documentId = attachment.DocumentId;
            var access = new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context);
            if (!await access.GuardFileWriteAsync(CurrentUserId, documentId, "Inbox", ct))
                return Ok(new { success = true, data = new { attachmentId, documentId },
                    aiError = "Tệp đã lưu. Văn bản đã chuyển bước xử lý nên không ghi đè gợi ý AI.", analysisResult = (DocumentAnalysisResult?)null });

            DocumentAnalysisResult analysisResult;
            try
            {
                await using var stream = new FileStream(attachment.FilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                var extractedText = await _ocrService.ExtractTextAsync(stream, attachment.FileType, ct);
                var departments = await _context.Departments.Where(d => !d.IsDeleted)
                    .Select(d => new DepartmentOption { Id = d.Id, Name = d.Name }).ToListAsync(ct);
                analysisResult = await _aiService.AnalyzeDocumentAsync(extractedText, departments, ct);
                if (analysisResult.SuggestedDepartmentId.HasValue && !departments.Any(d => d.Id == analysisResult.SuggestedDepartmentId))
                {
                    analysisResult.SuggestedDepartmentId = null; analysisResult.SuggestedDepartmentName = null;
                    analysisResult.ValidationWarnings.Add("Phòng ban gợi ý không còn hợp lệ, đã bỏ qua.");
                }
            }
            catch (Exception exception) when (!ct.IsCancellationRequested)
            {
                _logger.LogWarning("OCR/AI không hoàn tất cho văn bản {DocumentId}; loại lỗi {ErrorType}", documentId, exception.GetType().Name);
                return Ok(new { success = true, data = new { attachmentId, documentId },
                    aiError = "Chưa phân tích được nội dung. Tệp đã được lưu; bạn vẫn có thể giao việc thủ công hoặc thử phân tích lại.",
                    analysisResult = (DocumentAnalysisResult?)null });
            }

            var doc = await _context.InboxDocuments.FindAsync(new object[] { documentId }, ct);
            if (doc == null) return NotFound();
            doc.AiCategory = analysisResult.Category.ToString(); doc.AiTitle = analysisResult.Title;
            doc.AiSummary = analysisResult.Summary; doc.AiObjectives = analysisResult.Objectives;
            doc.AiExtractedDeadline = analysisResult.DeadlineDate;
            doc.AiExtractedSubjects = analysisResult.Subjects.Count > 0 ? JsonSerializer.Serialize(analysisResult.Subjects) : null;
            doc.AiSuggestedDepartmentId = analysisResult.SuggestedDepartmentId; doc.AiConfidenceScore = analysisResult.Confidence;
            doc.AiEventStartDateTime = analysisResult.EventStartDateTime; doc.AiEventEndDateTime = analysisResult.EventEndDateTime;
            doc.AiProcessingStatus = "Analyzed"; doc.AiReviewedByUserId = null; doc.AiReviewedAt = null;
            doc.Version = Guid.NewGuid(); doc.UpdatedAt = DateTime.UtcNow;
            try { await _context.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException)
            {
                return Ok(new { success = true, data = new { attachmentId, documentId },
                    aiError = "Tệp đã lưu. Văn bản vừa thay đổi nên gợi ý AI không được ghi đè. Vui lòng tải lại chi tiết.",
                    analysisResult = (DocumentAnalysisResult?)null });
            }
            return Ok(new { success = true, data = new { attachmentId, documentId }, analysisResult,
                message = "Đã lưu gợi ý. Vui lòng kiểm tra nội dung trước khi giao việc hoặc tạo lịch." });
        }

        #region Validation

        private static async Task<IActionResult?> ValidateMagicBytesAsync(IFormFile file)
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

                var extension = Path.GetExtension(file.FileName).TrimStart('.').ToLowerInvariant();
                var valid = extension switch
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
                    "doc" => read >= 8 &&
                             ((header[0] == 0xD0 && header[1] == 0xCF && header[2] == 0x11 && header[3] == 0xE0
                               && header[4] == 0xA1 && header[5] == 0xB1 && header[6] == 0x1A && header[7] == 0xE1)
                              || (header[0] == 0x50 && header[1] == 0x4B && header[2] == 0x03 && header[3] == 0x04)),
                    "docx" or "xlsx" => read >= 4
                             && header[0] == 0x50 && header[1] == 0x4B
                             && header[2] == 0x03 && header[3] == 0x04,
                    _ => false
                };

                return valid
                    ? null
                    : new BadRequestObjectResult(new
                    {
                        success = false,
                        error = "Nội dung file không khớp với phần mở rộng đã khai báo."
                    });
            }
            catch (Exception)
            {
                return new BadRequestObjectResult(new
                {
                    success = false,
                    error = "Không thể kiểm tra định dạng file tải lên."
                });
            }
        }

        private IActionResult? ValidateFile(IFormFile? file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { success = false, error = "File tải lên không hợp lệ hoặc rỗng." });
            }

            // Kiểm tra dung lượng
            if (file.Length > _uploadOptions.MaxFileSizeBytes)
            {
                return BadRequest(new
                {
                    success = false,
                    error = $"File vượt quá dung lượng cho phép ({_uploadOptions.MaxFileSizeMB}MB). " +
                            $"Dung lượng file: {file.Length / (1024.0 * 1024.0):F1}MB."
                });
            }

            // Kiểm tra loại file
            var ext = Path.GetExtension(file.FileName).TrimStart('.').ToLowerInvariant();
            var allowedExts = _uploadOptions.GetAllowedExtensionArray();
            if (!allowedExts.Contains(ext, StringComparer.OrdinalIgnoreCase))
            {
                return BadRequest(new
                {
                    success = false,
                    error = $"Loại file .{ext} không được hỗ trợ. Chỉ chấp nhận: {_uploadOptions.AllowedExtensions}."
                });
            }

            return null; // Hợp lệ
        }

        #endregion

        private static string GetContentType(string ext, string fileName)
        {
            string fileExt = (!string.IsNullOrEmpty(ext) ? ext : Path.GetExtension(fileName).TrimStart('.')).ToLower();
            return fileExt switch
            {
                "pdf" => "application/pdf",
                "png" => "image/png",
                "jpg" or "jpeg" => "image/jpeg",
                "doc" or "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "xls" or "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                _ => "application/octet-stream"
            };
        }

        // ❌ CreateDemoPdfBuffer đã bị XÓA HẲN — file vật lý không tìm thấy → 404 thật, không giả mạo.
    }
}
