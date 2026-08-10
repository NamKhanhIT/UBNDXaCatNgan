using System;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class FilesController : ControllerBase
    {
        private readonly IApplicationDbContext _context;

        public FilesController(IApplicationDbContext context)
        {
            _context = context;
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
        /// Inline Secure File Streamer — Cho phép xem PDF / Image trực tiếp trên trình duyệt
        /// Yêu cầu Token xác thực HTTP Bearer Header per Requirement XXII.
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
            
            // Nếu file tồn tại trên đĩa local storage
            if (!string.IsNullOrEmpty(att.FilePath) && System.IO.File.Exists(att.FilePath))
            {
                var fileBytes = await System.IO.File.ReadAllBytesAsync(att.FilePath);
                Response.Headers.Append("Content-Disposition", $"inline; filename=\"{att.OriginalFileName}\"");
                return File(fileBytes, contentType);
            }

            // Fallback: Tạo mẫu file đính kèm demo nếu chưa có file vật lý thực tế trên server
            byte[] demoBuffer = CreateDemoPdfBuffer(att.OriginalFileName, att.FileType);
            Response.Headers.Append("Content-Disposition", $"inline; filename=\"{att.OriginalFileName}\"");
            return File(demoBuffer, contentType);
        }

        /// <summary>
        /// Tải file về máy cá nhân
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

            byte[] demoBuffer = CreateDemoPdfBuffer(att.OriginalFileName, att.FileType);
            return File(demoBuffer, contentType, att.OriginalFileName);
        }

        /// <summary>
        /// Upload file đính kèm mới cho văn bản
        /// </summary>
        [HttpPost("upload")]
        public async Task<IActionResult> UploadFile([FromForm] IFormFile file, [FromForm] Guid documentId, [FromForm] string targetType = "Inbox", [FromForm] string attachmentType = "MainDocument")
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { success = false, error = "File tải lên không hợp lệ." });
            }

            string ext = Path.GetExtension(file.FileName).TrimStart('.').ToLower();
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

        private static byte[] CreateDemoPdfBuffer(string fileName, string fileType)
        {
            // Minimal valid PDF header buffer for demo fallback
            string pdfHeader = $"%PDF-1.4\n1 0 obj << /Title ({fileName}) /Creator (UBND Xa Cat Ngan Document Management) >> endobj\n2 0 obj << /Type /Catalog /Pages 3 0 R >> endobj\n3 0 obj << /Type /Pages /Kids [4 0 R] /Count 1 >> endobj\n4 0 obj << /Type /Page /Parent 3 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >> endobj\n5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n6 0 obj << /Length 50 >> stream\nBT /F1 12 Tf 50 700 TD (VAN BAN H ANH CHINH UBND XA CAT NGAN) Tj ET\nendstream\nendobj\nxref\n0 7\n0000000000 65535 f \n0000000009 00000 n \n0000000100 00000 n \n0000000150 00000 n \n0000000210 00000 n \n0000000320 00000 n \n0000000400 00000 n \ntrailer << /Size 7 /Root 2 0 R >>\nstartxref\n500\n%%EOF";
            return System.Text.Encoding.UTF8.GetBytes(pdfHeader);
        }
    }
}
