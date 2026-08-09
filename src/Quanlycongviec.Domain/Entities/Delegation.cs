using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class Delegation : BaseEntity
    {
        public Guid DelegatorId { get; set; } // Người ủy quyền (lãnh đạo đi vắng)
        public User Delegator { get; set; } = null!;

        public Guid DelegateeId { get; set; } // Người được ủy quyền (cấp phó)
        public User Delegatee { get; set; } = null!;

        public Guid RoleId { get; set; }
        public Role Role { get; set; } = null!;

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public bool IsActive { get; set; } = true;
        public string Scope { get; set; } = "Full"; // Full / ApprovalOnly
        public string Reason { get; set; } = string.Empty;
    }
}
