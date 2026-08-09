using System;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class UserRole : BaseEntity
    {
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public Guid RoleId { get; set; }
        public Role Role { get; set; } = null!;

        public Guid? DepartmentId { get; set; }
        public Department? Department { get; set; }

        public bool IsPrimary { get; set; } = false;
    }
}
