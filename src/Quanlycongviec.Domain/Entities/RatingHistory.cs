 using System;
using Quanlycongviec.Domain.Common;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Domain.Entities
{
    public class RatingHistory : BaseEntity
    {
        public Guid TaskItemId { get; set; }
        public TaskItem TaskItem { get; set; } = null!;

        /// <summary>
        /// Điểm số trước khi chỉnh sửa (null nếu là lần đầu chấm)
        /// </summary>
        public double? OldScore { get; set; }

        /// <summary>
        /// Điểm số mới đề xuất
        /// </summary>
        public double NewScore { get; set; }

        /// <summary>
        /// Độ lệch tuyệt đối: Math.Abs(NewScore - (OldScore ?? NewScore))
        /// </summary>
        public double ScoreDelta { get; set; }

        /// <summary>
        /// Người thực hiện đề xuất sửa điểm
        /// </summary>
        public Guid ChangedByUserId { get; set; }
        public DateTime ChangedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Lý do thay đổi điểm (Bắt buộc tối thiểu 30 ký tự)
        /// </summary>
        public string Reason { get; set; } = string.Empty;

        /// <summary>
        /// Đường dẫn minh chứng đính kèm (Ảnh, biên bản, file giải trình - Bắt buộc)
        /// </summary>
        public string EvidenceUrl { get; set; } = string.Empty;

        public RatingApprovalStatusEnum ApprovalStatus { get; set; } = RatingApprovalStatusEnum.Applied;

        /// <summary>
        /// Người có thẩm quyền cấp trên phê duyệt (khi ScoreDelta > threshold)
        /// </summary>
        public Guid? ApprovedByUserId { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? RejectionReason { get; set; }
    }
}
