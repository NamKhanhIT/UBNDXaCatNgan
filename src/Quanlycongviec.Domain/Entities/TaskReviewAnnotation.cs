using System;
using Quanlycongviec.Domain.Common;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Domain.Entities
{
    public class TaskReviewAnnotation : BaseEntity
    {
        public Guid TaskItemId { get; set; }
        public TaskItem TaskItem { get; set; } = null!;

        /// <summary>
        /// Đoạn text được người chấm bôi đen chọn, lưu nguyên văn để định vị lại bền vững
        /// </summary>
        public string AnchorText { get; set; } = string.Empty;

        /// <summary>
        /// Vị trí ký tự lúc tạo, chỉ dùng làm gợi ý ưu tiên khi có nhiều đoạn trùng lặp AnchorText giống nhau
        /// </summary>
        public int? StartOffsetHint { get; set; }

        /// <summary>
        /// Nội dung góp ý / nhận xét chi tiết
        /// </summary>
        public string CommentText { get; set; } = string.Empty;

        /// <summary>
        /// Mức độ góp ý: LoiSai (Lỗi sai), CanChinhSua (Cần chỉnh sửa), GopY (Góp ý)
        /// </summary>
        public AnnotationSeverityEnum Severity { get; set; } = AnnotationSeverityEnum.CanChinhSua;

        /// <summary>
        /// Người tạo chú thích
        /// </summary>
        public Guid CreatedByUserId { get; set; }
        public User CreatedByUser { get; set; } = null!;

        /// <summary>
        /// Trạng thái xử lý của góp ý: Open (Chờ sửa), Resolved (Đã sửa xong)
        /// </summary>
        public AnnotationStatusEnum ResolvedStatus { get; set; } = AnnotationStatusEnum.Open;

        /// <summary>
        /// Người xác nhận đã giải quyết xong góp ý
        /// </summary>
        public Guid? ResolvedByUserId { get; set; }
        public User? ResolvedByUser { get; set; }
        public DateTime? ResolvedAt { get; set; }
    }
}
