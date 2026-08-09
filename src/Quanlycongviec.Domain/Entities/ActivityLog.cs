using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    /// <summary>
    /// Nhật ký hoạt động toàn xã — ghi lại mọi hành động nghiệp vụ
    /// (giao việc, điều chuyển, hoàn thành, comment, xếp lịch…)
    /// </summary>
    public class ActivityLog : BaseEntity
    {
        public Guid UserId { get; set; }
        public User? User { get; set; }

        /// <summary>
        /// Loại hành động: task_created, task_transferred, task_completed,
        /// comment_added, document_scheduled, status_changed, ubmttq_review
        /// </summary>
        public string ActionType { get; set; } = string.Empty;

        /// <summary>
        /// Loại entity bị tác động: TaskItem, InboxDocument, Notification...
        /// </summary>
        public string TargetEntityType { get; set; } = string.Empty;
        public string TargetEntityId { get; set; } = string.Empty;

        /// <summary>
        /// Mô tả ngắn gọn, ví dụ: "Nguyễn Đình Hùng giao việc cho Trần Thị Mai"
        /// </summary>
        public string Summary { get; set; } = string.Empty;
    }
}
