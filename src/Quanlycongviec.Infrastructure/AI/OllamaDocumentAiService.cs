using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.AI.Models;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Infrastructure.AI
{
    /// <summary>
    /// Gọi Ollama nội bộ (http://localhost:11434/api/chat).
    /// Ép JSON output qua format: "json". Model đọc từ cấu hình.
    /// Dữ liệu KHÔNG rời khỏi server nội bộ.
    /// </summary>
    public class OllamaDocumentAiService : IDocumentAiService
    {
        private readonly HttpClient _httpClient;
        private readonly AiProviderOptions _options;
        private readonly ILogger<OllamaDocumentAiService> _logger;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        public OllamaDocumentAiService(
            HttpClient httpClient,
            IOptions<AiProviderOptions> options,
            ILogger<OllamaDocumentAiService> logger)
        {
            _httpClient = httpClient;
            _options = options.Value;
            _logger = logger;
        }

        public async Task<DocumentAnalysisResult> AnalyzeDocumentAsync(
            string extractedText,
            IEnumerable<DepartmentOption> availableDepartments,
            CancellationToken ct)
        {
            var departments = availableDepartments.ToList();
            var departmentList = string.Join("\n", departments.Select(d => $"  - Id: \"{d.Id}\", Name: \"{d.Name}\""));

            var systemPrompt = BuildAnalysisSystemPrompt(departmentList);
            var userPrompt = $"Phân tích văn bản hành chính sau và trả về JSON:\n\n{extractedText}";

            var responseJson = await CallOllamaAsync(systemPrompt, userPrompt, ct);
            var result = ParseAnalysisResult(responseJson, departments);

            // Post-validation bằng code — không chỉ tin JSON hợp lệ cú pháp
            ValidateAnalysisResult(result);

            return result;
        }

        public async Task<AssignmentSuggestion> SuggestAssignmentAsync(
            string taskDescription,
            IEnumerable<StaffWorkloadSnapshot> candidates,
            CancellationToken ct)
        {
            var candidateList = candidates.ToList();
            var candidateInfo = string.Join("\n", candidateList.Select(c =>
            {
                var expertise = string.IsNullOrWhiteSpace(c.Expertise) ? "chưa cập nhật" : c.Expertise;
                var years = c.YearsOfExperience > 0 ? $"{c.YearsOfExperience} năm" : "chưa cập nhật";
                return $"  - UserId: \"{c.UserId}\", Tên: \"{c.FullName}\", Phòng: \"{c.DepartmentName}\", " +
                       $"Chuyên môn: {expertise}, Kinh nghiệm: {years}, " +
                       $"Số việc đang làm: {c.ActiveTasksCount}, Tải việc: {c.WorkloadPercentage:F0}%";
            }));

            var systemPrompt = BuildAssignmentSystemPrompt(candidateInfo);
            var userPrompt = $"Mô tả công việc cần giao:\n\n{taskDescription}";

            var responseJson = await CallOllamaAsync(systemPrompt, userPrompt, ct);
            return ParseAssignmentResult(responseJson, candidateList);
        }

        public async Task<List<ProgressChecklistItem>> SuggestProgressChecklistAsync(
            string taskDescription,
            CancellationToken ct)
        {
            var systemPrompt = BuildChecklistSystemPrompt();
            var userPrompt = $"Mô tả công việc:\n\n{taskDescription}";

            var responseJson = await CallOllamaAsync(systemPrompt, userPrompt, ct);
            return ParseChecklistResult(responseJson);
        }

        #region Ollama HTTP

        private async Task<string> CallOllamaAsync(string systemPrompt, string userPrompt, CancellationToken ct)
        {
            var baseUrl = _options.Ollama.BaseUrl.TrimEnd('/');
            var model = _options.Ollama.Model;

            if (string.IsNullOrWhiteSpace(model))
            {
                throw new InvalidOperationException(
                    "AiProvider:Ollama:Model chưa được cấu hình. Vui lòng chỉ định model đã tải về máy chủ Ollama.");
            }

            var requestBody = new
            {
                model = model,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                },
                format = "json",
                stream = false
            };

            var jsonContent = JsonSerializer.Serialize(requestBody);
            var httpContent = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            _logger.LogInformation("Gọi Ollama: {BaseUrl}/api/chat, model={Model}", baseUrl, model);

            var response = await _httpClient.PostAsync($"{baseUrl}/api/chat", httpContent, ct);
            response.EnsureSuccessStatusCode();

            var responseBody = await response.Content.ReadAsStringAsync(ct);

            // Ollama trả về JSON object chứa field "message.content"
            using var doc = JsonDocument.Parse(responseBody);
            var messageContent = doc.RootElement
                .GetProperty("message")
                .GetProperty("content")
                .GetString();

            if (string.IsNullOrWhiteSpace(messageContent))
            {
                throw new InvalidOperationException("Ollama trả về nội dung rỗng.");
            }

            _logger.LogDebug("Ollama response content: {Content}", messageContent);
            return messageContent;
        }

        #endregion

        #region System Prompts

        private static string BuildAnalysisSystemPrompt(string departmentList)
        {
            return @"Bạn là hệ thống AI phân tích văn bản hành chính Việt Nam. Trả về JSON theo schema dưới đây.

RÀNG BUỘC BẮT BUỘC:
1. Chỉ điền trường nào có bằng chứng trực tiếp trong văn bản. Để null nếu không chắc chắn hoặc không được đề cập. Không suy luận, không phỏng đoán.
2. Với trường suggestedDepartmentId, CHỈ được chọn 1 Id trong danh sách phòng ban dưới đây. Không tự đặt tên phòng ban mới, không suy diễn Id không có trong danh sách. Để null nếu không xác định được.

DANH SÁCH PHÒNG BAN:
" + departmentList + @"

JSON SCHEMA:
{
  ""category"": ""MeetingInvitation"" | ""SuperiorDirective"" | ""TaskAssignmentDown"" | ""ReportSubmissionUp"" | ""Other"",
  ""title"": ""string hoặc null"",
  ""summary"": ""string hoặc null"",
  ""deadlineDate"": ""yyyy-MM-dd hoặc null"",
  ""eventStartDateTime"": ""yyyy-MM-ddTHH:mm:ss hoặc null"",
  ""eventEndDateTime"": ""yyyy-MM-ddTHH:mm:ss hoặc null"",
  ""subjects"": [""string""] hoặc [],
  ""objectives"": ""string hoặc null"",
  ""suggestedDepartmentId"": ""guid hoặc null"",
  ""suggestedDepartmentName"": ""string hoặc null"",
  ""confidence"": 0.0 tới 1.0
}";
        }

        private static string BuildAssignmentSystemPrompt(string candidateInfo)
        {
            return @"Bạn là hệ thống AI gợi ý giao việc cho UBND xã. Dựa trên mô tả công việc và danh sách cán bộ, chọn người phù hợp nhất.

RÀNG BUỘC BẮT BUỘC:
1. CHỈ chọn userId trong danh sách cán bộ được cung cấp.
2. Nếu cán bộ có chuyên môn/kinh nghiệm là ""chưa cập nhật"" hoặc 0, KHÔNG được bịa lý do liên quan tới kinh nghiệm/chuyên môn cho người đó. Chỉ lập luận dựa trên tải việc.
3. Đưa ra lý do cụ thể, dễ hiểu cho người dùng không rành kỹ thuật.

DANH SÁCH CÁN BỘ:
" + candidateInfo + @"

JSON SCHEMA:
{
  ""suggestedUserId"": ""guid"",
  ""suggestedUserName"": ""string"",
  ""reason"": ""string — lý do chọn người này"",
  ""suggestedDepartmentId"": ""guid hoặc null"",
  ""suggestedDepartmentName"": ""string hoặc null"",
  ""confidence"": 0.0 tới 1.0,
  ""alternatives"": [{ ""userId"": ""guid"", ""fullName"": ""string"", ""reason"": ""string"" }]
}";
        }

        private static string BuildChecklistSystemPrompt()
        {
            return @"Bạn là hệ thống AI tạo checklist tiến độ cho công việc hành chính. Dựa trên mô tả công việc, đề xuất danh sách các đầu việc con (5-10 mục).

RÀNG BUỘC:
1. Mỗi đầu việc phải ngắn gọn, cụ thể, hành động được.
2. Sắp xếp theo thứ tự thực hiện logic.
3. Không đề xuất quá chung chung (ví dụ: ""Hoàn thành công việc"").

JSON SCHEMA:
{
  ""items"": [{ ""title"": ""string"", ""order"": 1 }]
}";
        }

        #endregion

        #region Parsing & Validation

        private DocumentAnalysisResult ParseAnalysisResult(string json, List<DepartmentOption> departments)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var result = new DocumentAnalysisResult
                {
                    Category = ParseCategory(GetStringOrNull(root, "category")),
                    Title = GetStringOrNull(root, "title"),
                    Summary = GetStringOrNull(root, "summary"),
                    DeadlineDate = ParseDateTimeOrNull(GetStringOrNull(root, "deadlineDate")),
                    EventStartDateTime = ParseDateTimeOrNull(GetStringOrNull(root, "eventStartDateTime")),
                    EventEndDateTime = ParseDateTimeOrNull(GetStringOrNull(root, "eventEndDateTime")),
                    Objectives = GetStringOrNull(root, "objectives"),
                    Confidence = root.TryGetProperty("confidence", out var conf) ? conf.GetDouble() : 0.5
                };

                // Parse subjects
                if (root.TryGetProperty("subjects", out var subjectsEl) && subjectsEl.ValueKind == JsonValueKind.Array)
                {
                    result.Subjects = subjectsEl.EnumerateArray()
                        .Where(e => e.ValueKind == JsonValueKind.String)
                        .Select(e => e.GetString()!)
                        .Where(s => !string.IsNullOrWhiteSpace(s))
                        .ToList();
                }

                // Validate departmentId — chỉ giữ nếu khớp department thật
                var suggestedDeptIdStr = GetStringOrNull(root, "suggestedDepartmentId");
                if (Guid.TryParse(suggestedDeptIdStr, out var deptId))
                {
                    var matchedDept = departments.FirstOrDefault(d => d.Id == deptId);
                    if (matchedDept != null)
                    {
                        result.SuggestedDepartmentId = deptId;
                        result.SuggestedDepartmentName = matchedDept.Name;
                    }
                    else
                    {
                        _logger.LogWarning(
                            "AI trả về SuggestedDepartmentId={DeptId} không khớp phòng ban thật nào → set null.",
                            suggestedDeptIdStr);
                        result.ValidationWarnings.Add($"Phòng ban gợi ý '{suggestedDeptIdStr}' không tồn tại trong hệ thống, đã bỏ qua.");
                    }
                }

                return result;
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Không parse được JSON từ Ollama: {Json}", json);
                throw new InvalidOperationException("AI trả về JSON không hợp lệ. Vui lòng thử lại.", ex);
            }
        }

        private AssignmentSuggestion ParseAssignmentResult(string json, List<StaffWorkloadSnapshot> candidates)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var suggestion = new AssignmentSuggestion
                {
                    SuggestedUserName = GetStringOrNull(root, "suggestedUserName") ?? "",
                    Reason = GetStringOrNull(root, "reason") ?? "",
                    SuggestedDepartmentName = GetStringOrNull(root, "suggestedDepartmentName"),
                    Confidence = root.TryGetProperty("confidence", out var conf) ? conf.GetDouble() : 0.5
                };

                // Validate suggestedUserId against candidates
                var userIdStr = GetStringOrNull(root, "suggestedUserId");
                if (Guid.TryParse(userIdStr, out var userId) && candidates.Any(c => c.UserId == userId))
                {
                    suggestion.SuggestedUserId = userId;
                    var matched = candidates.First(c => c.UserId == userId);
                    suggestion.SuggestedUserName = matched.FullName;
                }
                else if (candidates.Any())
                {
                    // Fallback: chọn người có tải việc thấp nhất
                    var fallback = candidates.OrderBy(c => c.WorkloadPercentage).First();
                    suggestion.SuggestedUserId = fallback.UserId;
                    suggestion.SuggestedUserName = fallback.FullName;
                    suggestion.Reason = $"[Gợi ý tự động] {fallback.FullName} có tải việc thấp nhất ({fallback.WorkloadPercentage:F0}%).";
                }

                // Parse alternatives
                if (root.TryGetProperty("alternatives", out var alts) && alts.ValueKind == JsonValueKind.Array)
                {
                    foreach (var alt in alts.EnumerateArray())
                    {
                        var altIdStr = GetStringOrNull(alt, "userId");
                        if (Guid.TryParse(altIdStr, out var altId) && candidates.Any(c => c.UserId == altId))
                        {
                            suggestion.Alternatives.Add(new AlternativeCandidate
                            {
                                UserId = altId,
                                FullName = GetStringOrNull(alt, "fullName") ?? "",
                                Reason = GetStringOrNull(alt, "reason") ?? ""
                            });
                        }
                    }
                }

                return suggestion;
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Không parse được JSON gợi ý giao việc: {Json}", json);
                throw new InvalidOperationException("AI trả về JSON không hợp lệ cho gợi ý giao việc.", ex);
            }
        }

        private List<ProgressChecklistItem> ParseChecklistResult(string json)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var items = new List<ProgressChecklistItem>();

                if (root.TryGetProperty("items", out var itemsEl) && itemsEl.ValueKind == JsonValueKind.Array)
                {
                    int order = 1;
                    foreach (var item in itemsEl.EnumerateArray())
                    {
                        var title = GetStringOrNull(item, "title");
                        if (!string.IsNullOrWhiteSpace(title))
                        {
                            items.Add(new ProgressChecklistItem
                            {
                                Title = title,
                                Order = item.TryGetProperty("order", out var o) ? o.GetInt32() : order
                            });
                            order++;
                        }
                    }
                }

                return items;
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Không parse được JSON checklist: {Json}", json);
                return new List<ProgressChecklistItem>();
            }
        }

        private void ValidateAnalysisResult(DocumentAnalysisResult result)
        {
            // Validate DeadlineDate: cảnh báo nếu trong quá khứ hoặc quá xa (>2 năm)
            if (result.DeadlineDate.HasValue)
            {
                var now = DateTime.UtcNow;
                if (result.DeadlineDate.Value < now.AddDays(-7))
                {
                    result.DeadlineSeemsUnreasonable = true;
                    result.ValidationWarnings.Add($"Hạn chót {result.DeadlineDate.Value:dd/MM/yyyy} đã qua. Có thể AI đọc nhầm ngày tháng.");
                }
                else if (result.DeadlineDate.Value > now.AddYears(2))
                {
                    result.DeadlineSeemsUnreasonable = true;
                    result.ValidationWarnings.Add($"Hạn chót {result.DeadlineDate.Value:dd/MM/yyyy} quá xa (>2 năm). Cần kiểm tra lại.");
                }
            }

            // Validate Confidence
            if (result.Confidence < _options.ConfidenceThreshold)
            {
                result.LowConfidence = true;
                result.ValidationWarnings.Add(
                    $"Độ tin cậy AI thấp ({result.Confidence:P0} < {_options.ConfidenceThreshold:P0}). Cần xem kỹ kết quả.");
            }
        }

        #endregion

        #region Helpers

        private static string? GetStringOrNull(JsonElement el, string propertyName)
        {
            if (el.TryGetProperty(propertyName, out var prop))
            {
                if (prop.ValueKind == JsonValueKind.String)
                    return prop.GetString();
                if (prop.ValueKind == JsonValueKind.Null)
                    return null;
            }
            return null;
        }

        private static DocumentCategory ParseCategory(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return DocumentCategory.Other;
            return Enum.TryParse<DocumentCategory>(value, true, out var cat) ? cat : DocumentCategory.Other;
        }

        private static DateTime? ParseDateTimeOrNull(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            return DateTime.TryParse(value, out var dt) ? dt : null;
        }

        #endregion
    }
}
