using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace Quanlycongviec.Application.Common.Interfaces
{
    /// <summary>
    /// Trích xuất văn bản từ file (PDF/DOCX/ảnh).
    /// Tách riêng khỏi IDocumentAiService để thay thế OCR engine độc lập.
    /// </summary>
    public interface IOcrService
    {
        /// <summary>
        /// Trích xuất text từ file stream.
        /// PDF có lớp text → dùng PdfPig, DOCX → dùng OpenXml, ảnh/PDF scan → dùng Tesseract OCR.
        /// </summary>
        Task<string> ExtractTextAsync(Stream fileStream, string fileExtension, CancellationToken ct);

        /// <summary>
        /// Kiểm tra extension có được hỗ trợ OCR/text extraction không.
        /// </summary>
        bool SupportsFileType(string fileExtension);
    }
}
