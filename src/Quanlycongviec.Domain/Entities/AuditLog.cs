using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class AuditLog : BaseEntity
    {
        public Guid UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string ActingRole { get; set; } = string.Empty; // Vai trò tại thời điểm thực hiện
        public bool IsDelegatedAction { get; set; } = false;
        public Guid? DelegatedFromUserId { get; set; }
        
        public string Action { get; set; } = string.Empty; // e.g. "CreateTask", "ApproveTask", "SwitchContext"
        public string EntityName { get; set; } = string.Empty;
        public string EntityId { get; set; } = string.Empty;
        public string Details { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
    }
}
