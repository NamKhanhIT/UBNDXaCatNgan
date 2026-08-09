using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class TaskComment : BaseEntity
    {
        public Guid TaskItemId { get; set; }
        public TaskItem TaskItem { get; set; } = null!;

        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public string Content { get; set; } = string.Empty;
        public string? AttachmentUrl { get; set; }
    }
}
