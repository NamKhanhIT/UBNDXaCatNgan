using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Quanlycongviec.Application.AI.Models;

namespace Quanlycongviec.Application.Common.Interfaces
{
    /// <summary>
    /// Lớp trừu tượng AI phân tích văn bản hành chính.
    /// 2 implementation: OllamaDocumentAiService (nội bộ) và ApiCompatibleDocumentAiService (API ngoài).
    /// Chọn provider qua AiProvider:Type trong cấu hình, không hard-code.
    /// </summary>
    public interface IDocumentAiService
    {
        /// <summary>
        /// Phân tích văn bản: phân loại, trích xuất deadline/đối tượng/mục tiêu, gợi ý phòng ban.
        /// AI chỉ điền field có bằng chứng trực tiếp, để null nếu không chắc chắn.
        /// </summary>
        /// <param name="extractedText">Nội dung text đã trích xuất từ file (qua OCR hoặc PDF text layer)</param>
        /// <param name="availableDepartments">Danh sách phòng ban thật từ database — AI chỉ được chọn trong danh sách này</param>
        /// <param name="ct">Cancellation token</param>
        Task<DocumentAnalysisResult> AnalyzeDocumentAsync(
            string extractedText,
            IEnumerable<DepartmentOption> availableDepartments,
            CancellationToken ct);

        /// <summary>
        /// Gợi ý giao việc dựa trên tải việc + chuyên môn + kinh nghiệm.
        /// Nếu candidate thiếu Expertise/YearsOfExperience, không được bịa lý do liên quan.
        /// </summary>
        Task<AssignmentSuggestion> SuggestAssignmentAsync(
            string taskDescription,
            IEnumerable<StaffWorkloadSnapshot> candidates,
            CancellationToken ct);

        /// <summary>
        /// Đề xuất checklist tiến độ (danh sách đầu việc con) cho công việc.
        /// </summary>
        Task<List<ProgressChecklistItem>> SuggestProgressChecklistAsync(
            string taskDescription,
            CancellationToken ct);
    }
}
