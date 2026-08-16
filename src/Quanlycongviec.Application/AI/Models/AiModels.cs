using System;
using System.Collections.Generic;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.AI.Models
{
    /// <summary>
    /// Kết quả phân tích văn bản từ AI.
    /// Mọi field nullable: AI chỉ điền khi có bằng chứng trực tiếp trong văn bản.
    /// Không suy luận, không phỏng đoán.
    /// </summary>
    public class DocumentAnalysisResult
    {
        public DocumentCategory Category { get; set; }
        public string? Title { get; set; }
        public string? Summary { get; set; }
        public DateTime? DeadlineDate { get; set; }
        public DateTime? EventStartDateTime { get; set; }
        public DateTime? EventEndDateTime { get; set; }
        public List<string> Subjects { get; set; } = new();
        public string? Objectives { get; set; }

        // Cặp Id + Name — KHÔNG dùng string tự do để tránh sai lệch tên↔ID
        public Guid? SuggestedDepartmentId { get; set; }
        public string? SuggestedDepartmentName { get; set; }

        public double Confidence { get; set; }

        private bool? _deadlineSeemsUnreasonable;
        private bool? _lowConfidence;

        // Validation flags — tự động tính dựa trên hạn chót và độ tin cậy nếu chưa set thủ công
        public bool DeadlineSeemsUnreasonable
        {
            get => _deadlineSeemsUnreasonable ?? (DeadlineDate.HasValue && DeadlineDate.Value.Date < DateTime.UtcNow.Date);
            set => _deadlineSeemsUnreasonable = value;
        }

        public bool LowConfidence
        {
            get => _lowConfidence ?? (Confidence < 0.6);
            set => _lowConfidence = value;
        }

        public List<string> ValidationWarnings { get; set; } = new();
    }

    /// <summary>
    /// Gợi ý giao việc từ AI, kèm lý do bằng lời.
    /// </summary>
    public class AssignmentSuggestion
    {
        public Guid SuggestedUserId { get; set; }
        public string SuggestedUserName { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public Guid? SuggestedDepartmentId { get; set; }
        public string? SuggestedDepartmentName { get; set; }
        public double Confidence { get; set; }
        public List<AlternativeCandidate> Alternatives { get; set; } = new();
    }

    public class AlternativeCandidate
    {
        public Guid UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
    }

    /// <summary>
    /// Snapshot tải việc cán bộ, truyền vào AI để gợi ý giao việc.
    /// </summary>
    public class StaffWorkloadSnapshot
    {
        public Guid UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string RoleName { get; set; } = string.Empty;
        public string DepartmentName { get; set; } = string.Empty;
        public Guid DepartmentId { get; set; }
        public string? Expertise { get; set; }
        public int YearsOfExperience { get; set; }
        public int ActiveTasksCount { get; set; }
        public double WorkloadPercentage { get; set; }
    }

    /// <summary>
    /// Đầu việc con do AI đề xuất cho checklist tiến độ.
    /// </summary>
    public class ProgressChecklistItem
    {
        public string Title { get; set; } = string.Empty;
        public int Order { get; set; }
    }

    /// <summary>
    /// Phòng ban thật từ database — truyền vào AI để ép chọn đúng.
    /// </summary>
    public class DepartmentOption
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
    }

    /// <summary>
    /// Kết quả ký số (placeholder cho tích hợp nhà cung cấp sau này).
    /// </summary>
    public class SignatureResult
    {
        public bool Success { get; set; }
        public string? SignatureId { get; set; }
        public string? ErrorMessage { get; set; }
        public DateTime? SignedAt { get; set; }
    }
}
