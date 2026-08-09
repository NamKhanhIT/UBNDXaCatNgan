using System;
using System.Collections.Generic;
using Quanlycongviec.Domain.Common;

namespace Quanlycongviec.Domain.Entities
{
    public class User : BaseEntity
    {
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string? ZaloPhoneNumber { get; set; }
        
        public Guid? PrimaryDepartmentId { get; set; }
        public Department? PrimaryDepartment { get; set; }

        public string ActiveRoleCode { get; set; } = string.Empty; // Ngữ cảnh hiện tại khi thao tác (Context Switching)

        public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
        public ICollection<Delegation> DelegationsGiven { get; set; } = new List<Delegation>();
        public ICollection<Delegation> DelegationsReceived { get; set; } = new List<Delegation>();
        public ICollection<TaskItem> AssignedTasks { get; set; } = new List<TaskItem>();
        public ICollection<TaskItem> CreatedTasks { get; set; } = new List<TaskItem>();
    }
}
