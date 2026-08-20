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

        // ── Xác thực 2 yếu tố (MFA/OTP) ──
        public bool MfaEnabled { get; set; } = false;          // Đã bật TOTP

        [System.Text.Json.Serialization.JsonIgnore]
        public string? MfaSecret { get; set; }                 // Secret Base32 TOTP (chỉ lưu DB bảo vệ)

        // ── Chuyên môn & kinh nghiệm (Prompt F: AI gợi ý giao việc) ──
        public string? Expertise { get; set; }           // Danh sách chuyên môn dạng tag: "Đất đai, Quy hoạch, TTHC"
        public int YearsOfExperience { get; set; } = 0;  // Số năm kinh nghiệm (mặc định 0 — cần nhập tay sau triển khai)

        public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
        public ICollection<Delegation> DelegationsGiven { get; set; } = new List<Delegation>();
        public ICollection<Delegation> DelegationsReceived { get; set; } = new List<Delegation>();
        public ICollection<TaskItem> AssignedTasks { get; set; } = new List<TaskItem>();
        public ICollection<TaskItem> CreatedTasks { get; set; } = new List<TaskItem>();
        public ICollection<PushSubscription> PushSubscriptions { get; set; } = new List<PushSubscription>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    }
}
