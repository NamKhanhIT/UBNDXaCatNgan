using System;
using System.Collections.Generic;
using Quanlycongviec.Domain.Common;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Domain.Entities
{
    public class TaskItem : BaseEntity
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        public Guid AssignerId { get; set; } // Người giao việc (lãnh đạo)
        public User Assigner { get; set; } = null!;

        public Guid AssigneeId { get; set; } // Người chủ trì (chuyên viên)
        public User Assignee { get; set; } = null!;

        public Guid? DepartmentId { get; set; }
        public Department? Department { get; set; }

        public TaskPriority Priority { get; set; } = TaskPriority.Medium;
        public TaskStatusEnum Status { get; set; } = TaskStatusEnum.Todo;
        public TaskType Type { get; set; } = TaskType.BAU;

        public int ProgressPercentage { get; set; } = 0;
        public double EstimatedEffortHours { get; set; } = 8.0; // Dự toán số giờ công
        
        public DateTime? StartDate { get; set; }
        public DateTime? DueDate { get; set; }
        public DateTime? CompletedAt { get; set; }

        public string? OCRText { get; set; } // Nội dung bóc tách từ công văn scan
        public string? DocumentUrl { get; set; }
        
        public bool IsDelegatedAction { get; set; } = false;
        public bool IsEscalated { get; set; } = false; // Trạng thái leo thang khi quá hạn khẩn
        public string? AISummary { get; set; } // Tóm tắt từ RAG AI Engine

        public string? SubmissionNote { get; set; } // Nội dung kết quả nộp dạng text (cán bộ điền khi nộp việc)
        public double? SystemScore { get; set; } // Điểm hệ thống tự động tính (tối đa 30 điểm)
        public double? EvaluatorScore { get; set; } // Điểm người chấm quyết định (tối đa 70 điểm)
        public double? RatingScore { get; set; } // Tổng điểm đánh giá nghiệm thu (0-100) = SystemScore + EvaluatorScore
        public string? RejectionReason { get; set; } // Lý do từ chối yêu cầu làm lại

        public ICollection<SubTask> SubTasks { get; set; } = new List<SubTask>();
        public ICollection<TaskComment> Comments { get; set; } = new List<TaskComment>();
        public ICollection<TaskReviewAnnotation> Annotations { get; set; } = new List<TaskReviewAnnotation>();
    }
}
