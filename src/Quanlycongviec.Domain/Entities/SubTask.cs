using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class SubTask : BaseEntity
    {
        public Guid TaskItemId { get; set; }
        public TaskItem TaskItem { get; set; } = null!;

        public string Title { get; set; } = string.Empty;
        public bool IsCompleted { get; set; } = false;
    }
}
