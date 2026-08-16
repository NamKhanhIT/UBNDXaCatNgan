using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Infrastructure.AI
{
    /// <summary>
    /// Composite OCR Service: chọn engine phù hợp theo loại file.
    /// - PDF có lớp text → PdfPig (extract text layer)
    /// - DOCX → OpenXml (extract paragraphs)
    /// - Ảnh (jpg/jpeg/png) / PDF scan → Tesseract OCR
    /// 
    /// Lưu ý: Tesseract OCR cần tessdata/vie.traineddata cho tiếng Việt.
    /// Chất lượng OCR với văn bản scan có dấu mộc/chữ ký có thể kém — cần test thật trước khi tin tưởng.
    /// </summary>
    public class CompositeOcrService : IOcrService
    {
        private readonly ILogger<CompositeOcrService> _logger;
        private static readonly string[] SupportedExtensions = { "pdf", "doc", "docx", "jpg", "jpeg", "png", "xlsx" };

        public CompositeOcrService(ILogger<CompositeOcrService> logger)
        {
            _logger = logger;
        }

        public bool SupportsFileType(string fileExtension)
        {
            var ext = fileExtension.TrimStart('.').ToLowerInvariant();
            return Array.Exists(SupportedExtensions, e => e == ext);
        }

        public async Task<string> ExtractTextAsync(Stream fileStream, string fileExtension, CancellationToken ct)
        {
            var ext = fileExtension.TrimStart('.').ToLowerInvariant();

            _logger.LogInformation("Trích xuất văn bản từ file loại: {Extension}", ext);

            try
            {
                return ext switch
                {
                    "pdf" => await ExtractFromPdfAsync(fileStream, ct),
                    "docx" or "doc" => ExtractFromDocx(fileStream),
                    "jpg" or "jpeg" or "png" => await ExtractFromImageAsync(fileStream, ct),
                    "xlsx" => ExtractFromXlsx(fileStream),
                    _ => throw new NotSupportedException($"Không hỗ trợ trích xuất text từ file .{ext}")
                };
            }
            catch (Exception ex) when (ex is not NotSupportedException)
            {
                _logger.LogError(ex, "Lỗi trích xuất text từ file .{Extension}", ext);
                throw new InvalidOperationException($"Không thể trích xuất văn bản từ file .{ext}: {ex.Message}", ex);
            }
        }

        private async Task<string> ExtractFromPdfAsync(Stream stream, CancellationToken ct)
        {
            // Sử dụng PdfPig để trích xuất text layer từ PDF
            stream.Position = 0;

            // Copy stream to memory để PdfPig có thể đọc
            using var memoryStream = new MemoryStream();
            await stream.CopyToAsync(memoryStream, ct);
            memoryStream.Position = 0;

            try
            {
                using var document = UglyToad.PdfPig.PdfDocument.Open(memoryStream);
                var sb = new StringBuilder();

                foreach (var page in document.GetPages())
                {
                    var pageText = page.Text;
                    if (!string.IsNullOrWhiteSpace(pageText))
                    {
                        sb.AppendLine(pageText);
                    }
                }

                var extractedText = sb.ToString().Trim();

                if (string.IsNullOrWhiteSpace(extractedText))
                {
                    _logger.LogWarning("PDF không có lớp text (có thể là scan) — cần OCR riêng hoặc model đa phương thức.");
                    return "[PDF SCAN - Không có lớp text. Cần OCR hoặc model đa phương thức để đọc nội dung.]";
                }

                _logger.LogInformation("Trích xuất thành công {Length} ký tự từ PDF ({Pages} trang).",
                    extractedText.Length, document.NumberOfPages);
                return extractedText;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PdfPig không đọc được PDF — có thể là file bị mã hóa hoặc hỏng.");
                return $"[Lỗi đọc PDF: {ex.Message}]";
            }
        }

        private string ExtractFromDocx(Stream stream)
        {
            stream.Position = 0;

            try
            {
                using var doc = DocumentFormat.OpenXml.Packaging.WordprocessingDocument.Open(stream, false);
                var body = doc.MainDocumentPart?.Document?.Body;

                if (body == null)
                {
                    _logger.LogWarning("DOCX không có nội dung body.");
                    return "";
                }

                var text = body.InnerText;
                _logger.LogInformation("Trích xuất thành công {Length} ký tự từ DOCX.", text.Length);
                return text;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không đọc được file DOCX.");
                return $"[Lỗi đọc DOCX: {ex.Message}]";
            }
        }

        private Task<string> ExtractFromImageAsync(Stream stream, CancellationToken ct)
        {
            // Tesseract OCR placeholder — yêu cầu NuGet Tesseract + tessdata/vie.traineddata
            // Chưa tích hợp trực tiếp vì cần native binaries + language data.
            // Khi triển khai thật, thay thế đoạn này bằng Tesseract.NET wrapper.
            _logger.LogWarning(
                "OCR ảnh (Tesseract) chưa được tích hợp native binaries. " +
                "Cần cài đặt tessdata/vie.traineddata và Tesseract engine trên server.");

            return Task.FromResult(
                "[ẢNH - Cần Tesseract OCR engine + vie.traineddata để trích xuất. " +
                "Hoặc dùng model AI đa phương thức (vision) nếu provider hỗ trợ.]");
        }

        private string ExtractFromXlsx(Stream stream)
        {
            stream.Position = 0;

            try
            {
                using var doc = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Open(stream, false);
                var workbookPart = doc.WorkbookPart;
                if (workbookPart == null) return "";

                var sb = new StringBuilder();
                var sharedStrings = workbookPart.SharedStringTablePart?.SharedStringTable;

                foreach (var worksheetPart in workbookPart.WorksheetParts)
                {
                    var sheetData = worksheetPart.Worksheet
                        .GetFirstChild<DocumentFormat.OpenXml.Spreadsheet.SheetData>();
                    if (sheetData == null) continue;

                    foreach (var row in sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>())
                    {
                        foreach (var cell in row.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>())
                        {
                            var value = cell.CellValue?.Text ?? "";
                            if (cell.DataType?.Value == DocumentFormat.OpenXml.Spreadsheet.CellValues.SharedString
                                && int.TryParse(value, out var idx)
                                && sharedStrings != null)
                            {
                                value = sharedStrings.ElementAt(idx).InnerText;
                            }
                            if (!string.IsNullOrWhiteSpace(value))
                            {
                                sb.Append(value).Append('\t');
                            }
                        }
                        sb.AppendLine();
                    }
                }

                return sb.ToString().Trim();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không đọc được file XLSX.");
                return $"[Lỗi đọc XLSX: {ex.Message}]";
            }
        }
    }
}
