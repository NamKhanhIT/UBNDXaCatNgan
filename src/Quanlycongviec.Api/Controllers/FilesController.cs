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
        private readonly FileUploadOptions _uploadOptions;
        private readonly ILogger<FilesController> _logger;

        public FilesController(
            IApplicationDbContext context,
            IOcrService ocrService,
            IDocumentAiService aiService,
            IOptions<FileUploadOptions> uploadOptions,
            ILogger<FilesController> logger)
        {
            _context = context;
            _ocrService = ocrService;
            _aiService = aiService;
            _uploadOptions = uploadOptions.Value;
            _logger = logger;
        }

        private Guid CurrentUserId
        {
            get
            {
                var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value;
                return Guid.TryParse(claim, out var id) ? id : Guid.Empty;
            }
        }

        /// <summary>
        /// Lấy danh sách file đính kèm liên kết với 1 văn bản
        /// </summary>
        [HttpGet("document/{documentId:guid}")]
        public async Task<IActionResult> GetDocumentAttachments([FromRoute] Guid documentId)
        {
            var attachments = await _context.DocumentAttachments
                .Where(a => a.DocumentId == documentId && !a.IsDeleted)
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

        /// <summary>
        /// Inline Secure File Streamer — Cho phép xem PDF / Image trực tiếp trên trình duyệt.
        /// File vật lý không tồn tại → trả 404, KHÔNG sinh file giả.
        /// </summary>
        [HttpGet("{id:guid}/view")]
        public async Task<IActionResult> ViewFileInline([FromRoute] Guid id)
        {
            var att = await _context.DocumentAttachments
                .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

            if (att == null)
            {
                return NotFound(new { success = false, error = "Không tìm thấy file đính kèm." });
            }

            string contentType = GetContentType(att.FileType, att.OriginalFileName);

            // Chỉ trả file nếu tồn tại trên đĩa — KHÔNG fallback file giả
            if (!string.IsNullOrEmpty(att.FilePath) && System.IO.File.Exists(att.FilePath))
            {
                var fileBytes = await System.IO.File.ReadAllBytesAsync(att.FilePath);
                Response.Headers.Append("Content-Disposition", $"inline; filename=\"{att.OriginalFileName}\"");
                return File(fileBytes, contentType);
            }

            // File vật lý không tồn tại → 404 rõ ràng
            _logger.LogWarning("File vật lý không tồn tại: {FilePath} (AttachmentId={Id})", att.FilePath, id);
            return NotFound(new
            {
                success = false,
                error = $"File vật lý không tồn tại trên server. Tên file gốc: {att.OriginalFileName}."
            });
        }

        /// <summary>
        /// Tải file về máy cá nhân.
        /// File vật lý không tồn tại → trả 404, KHÔNG sinh file giả.
        /// </summary>
        [HttpGet("{id:guid}/download")]
        public async Task<IActionResult> DownloadFile([FromRoute] Guid id)
        {
            var att = await _context.DocumentAttachments
                .FirstOrDefaultAsync(a => a.Id == id && !a.IsDeleted);

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

        /// <summary>
        /// Upload file đính kèm mới cho văn bản — có validation dung lượng + loại file.
        /// </summary>
        [HttpPost("upload")]
        public async Task<IActionResult> UploadFile(
            [FromForm] IFormFile file,
            [FromForm] Guid documentId,
            [FromForm] string targetType = "Inbox",
            [FromForm] string attachmentType = "MainDocument")
        {
            var validation = ValidateFile(file);
            if (validation != null) return validation;

            string ext = Path.GetExtension(file!.FileName).TrimStart('.').ToLower();
            string storageDir = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "documents");
            if (!Directory.Exists(storageDir))
            {
                Directory.CreateDirectory(storageDir);
            }

            string safeFileName = $"{Guid.NewGuid()}_{file.FileName}";
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
            await _context.SaveChangesAsync();

            return Ok(new { success = true, data = att.Id, message = "Tải file đính kèm thành công." });
        }

        /// <summary>
        /// Upload file + AI phân tích tự động (Prompt F).
        /// 1. Lưu file vào đĩa (có validation)
        /// 2. OCR/extract text
        /// 3. Lấy danh sách Department thật → gọi AI AnalyzeDocumentAsync
        /// 4. Validate SuggestedDepartmentId → ghi kết quả vào InboxDocument
        /// 5. Trả về DocumentAnalysisResult cho frontend kiểm duyệt
        /// ⚠️ CHƯA tạo TaskItem/CalendarEvent chính thức — chỉ lưu kết quả nháp.
        /// </summary>
        [HttpPost("upload-and-analyze")]
        public async Task<IActionResult> UploadAndAnalyze(
            [FromForm] IFormFile file,
            [FromForm] Guid documentId,
            CancellationToken ct)
        {
            // 1. Validate file
            var validation = ValidateFile(file);
            if (validation != null) return validation;

            // 2. Lưu file vào đĩa
            string ext = Path.GetExtension(file!.FileName).TrimStart('.').ToLower();
            string storageDir = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "documents");
            if (!Directory.Exists(storageDir)) Directory.CreateDirectory(storageDir);

            string safeFileName = $"{Guid.NewGuid()}_{file.FileName}";
            string fullPath = Path.Combine(storageDir, safeFileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream, ct);
            }

            // Lưu DocumentAttachment
            var att = new DocumentAttachment
            {
                Id = Guid.NewGuid(),
                DocumentId = documentId,
                TargetType = "Inbox",
                FileName = safeFileName,
                OriginalFileName = file.FileName,
                FilePath = fullPath,
                FileType = ext,
                FileSize = file.Length,
                AttachmentType = "MainDocument",
                IsMainDocument = true,
                UploadedAt = DateTime.UtcNow,
                UploadedByUserId = CurrentUserId
            };
            _context.DocumentAttachments.Add(att);

            // 3. OCR / Extract text
            string extractedText;
            using (var fileStream = new FileStream(fullPath, FileMode.Open, FileAccess.Read))
            {
                extractedText = await _ocrService.ExtractTextAsync(fileStream, ext, ct);
            }

            _logger.LogInformation("Trích xuất text thành công: {Length} ký tự từ {FileName}",
                extractedText.Length, file.FileName);

            // 4. Lấy danh sách Department thật từ database
            var departments = await _context.Departments
                .Where(d => !d.IsDeleted)
                .Select(d => new DepartmentOption { Id = d.Id, Name = d.Name })
                .ToListAsync(ct);

            // 5. Gọi AI phân tích
            DocumentAnalysisResult analysisResult;
            try
            {
                analysisResult = await _aiService.AnalyzeDocumentAsync(extractedText, departments, ct);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Lỗi gọi AI phân tích văn bản cho documentId={DocumentId}", documentId);
                // Vẫn lưu file, trả về lỗi AI riêng — không mất file đã upload
                await _context.SaveChangesAsync(ct);
                return Ok(new
                {
                    success = true,
                    data = new { attachmentId = att.Id },
                    aiError = $"AI phân tích thất bại: {ex.Message}. File đã được lưu, bạn có thể phân tích lại sau.",
                    analysisResult = (DocumentAnalysisResult?)null
                });
            }

            // 6. Validate SuggestedDepartmentId trả về
            if (analysisResult.SuggestedDepartmentId.HasValue)
            {
                var deptExists = departments.Any(d => d.Id == analysisResult.SuggestedDepartmentId.Value);
                if (!deptExists)
                {
                    _logger.LogWarning(
                        "AI trả về SuggestedDepartmentId={DeptId} không khớp Department thật → set null.",
                        analysisResult.SuggestedDepartmentId);
                    analysisResult.SuggestedDepartmentId = null;
                    analysisResult.SuggestedDepartmentName = null;
                    analysisResult.ValidationWarnings.Add("Phòng ban gợi ý không tồn tại trong hệ thống, đã bỏ qua.");
                }
            }

            // 7. Ghi kết quả AI vào InboxDocument
            var inboxDoc = await _context.InboxDocuments.FindAsync(new object[] { documentId }, ct);
            if (inboxDoc != null)
            {
                inboxDoc.AiCategory = analysisResult.Category.ToString();
                inboxDoc.AiTitle = analysisResult.Title;
                inboxDoc.AiSummary = analysisResult.Summary;
                inboxDoc.AiExtractedDeadline = analysisResult.DeadlineDate;
                inboxDoc.AiExtractedSubjects = analysisResult.Subjects.Count > 0
                    ? JsonSerializer.Serialize(analysisResult.Subjects)
                    : null;
                inboxDoc.AiObjectives = analysisResult.Objectives;
                inboxDoc.AiSuggestedDepartmentId = analysisResult.SuggestedDepartmentId;
                inboxDoc.AiConfidenceScore = analysisResult.Confidence;
                inboxDoc.AiEventStartDateTime = analysisResult.EventStartDateTime;
                inboxDoc.AiEventEndDateTime = analysisResult.EventEndDateTime;
                inboxDoc.AiProcessingStatus = "Analyzed";
                inboxDoc.AiReviewedByUserId = null; // Chưa duyệt
                inboxDoc.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync(ct);

            return Ok(new
            {
                success = true,
                data = new
                {
                    attachmentId = att.Id,
                    documentId = documentId
                },
                analysisResult = analysisResult,
                message = "File đã được tải lên và phân tích bởi AI. Vui lòng kiểm duyệt kết quả."
            });
        }

        #region Validation

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
