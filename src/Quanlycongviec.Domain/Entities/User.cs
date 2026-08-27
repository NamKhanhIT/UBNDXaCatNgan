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

        [System.Text.Json.Serialization.JsonIgnore]
        public string? MfaEmailOtpHash { get; set; }           // BẢO MẬT (Audit Đợt 3): SHA-256 hex của mã OTP email — KHÔNG lưu plaintext

        public DateTime? MfaEmailOtpExpiry { get; set; }       // Hạn dùng mã OTP email (5 phút)

        public DateTime? MfaEmailOtpSentUtc { get; set; }      // Mốc gửi gần nhất — chặn spam gửi lại (cooldown 60s)

        // ── Khôi phục mật khẩu (Forgot Password OTP) ──
        [System.Text.Json.Serialization.JsonIgnore]
        public string? PasswordResetOtp { get; set; }          // Mã OTP đặt lại mật khẩu

        public DateTime? PasswordResetOtpExpiry { get; set; }  // Thời hạn OTP khôi phục mật khẩu

        // ── BẢO MẬT (Audit Đợt 4 - H3/H5) ──
        public int OtpFailedCount { get; set; } = 0;           // Số lần sai OTP khôi phục liên tiếp
        public DateTime? OtpLockedUntil { get; set; }          // Khóa brute-force OTP đến mốc này

        [System.Text.Json.Serialization.JsonIgnore]
        public long LastUsedTotpCounter { get; set; } = 0;     // Timestep TOTP đã tiêu thụ gần nhất — chặn replay

        // ── BẢO MẬT (Audit Đợt 4 - A5): ép đổi mật khẩu lần đầu với tài khoản khởi tạo ──
        public bool MustChangePassword { get; set; } = false;

        // ── Xác thực số điện thoại & SMS OTP ──
        public bool PhoneNumberConfirmed { get; set; } = false; // Đã xác thực số điện thoại qua SMS
        [System.Text.Json.Serialization.JsonIgnore]
        public string? PhoneOtpHash { get; set; }               // SHA-256 mã OTP gửi qua SMS
        public DateTime? PhoneOtpExpiry { get; set; }           // Thời hạn OTP SMS (5 phút)
        public DateTime? PhoneOtpSentUtc { get; set; }          // Mốc gửi SMS gần nhất (cooldown 60s)
        public int PhoneOtpFailedCount { get; set; } = 0;       // Số lần sai OTP SMS

        // ── Xác thực đổi Email công vụ (2-Step Verification) ──
        public string? EmailChangeNewEmail { get; set; }        // Email mới đang chờ xác thực
        [System.Text.Json.Serialization.JsonIgnore]
        public string? EmailChangeOtpHash { get; set; }         // SHA-256 mã OTP gửi đến Email mới
        public DateTime? EmailChangeOtpExpiry { get; set; }     // Thời hạn OTP đổi email (5 phút)
        public DateTime? EmailChangeOtpSentUtc { get; set; }    // Mốc gửi OTP đổi email (cooldown 60s)


        // ── Chuyên môn & kinh nghiệm (Prompt F: AI gợi ý giao việc) ──
        public string? Expertise { get; set; }           // Danh sách chuyên môn dạng tag: "Đất đai, Quy hoạch, TTHC"
        public int YearsOfExperience { get; set; } = 0;  // Số năm kinh nghiệm (mặc định 0 — cần nhập tay sau triển khai)
        public string? WorkProfileJson { get; set; }     // Dữ liệu hồ sơ năng lực chi tiết (Học vị, chứng chỉ, lịch sử công tác)

        // ── Tùy biến người dùng (Preferences) ──
        public string? NotificationPreferences { get; set; } // Cấu hình thông báo & kênh nhận
        public string? AppearancePreferences { get; set; }   // Cấu hình giao diện (Font, Density, Theme)

        public ICollection<UserRole> UserRoles { get; set; } = new List<UserRole>();
        public ICollection<Delegation> DelegationsGiven { get; set; } = new List<Delegation>();
        public ICollection<Delegation> DelegationsReceived { get; set; } = new List<Delegation>();
        public ICollection<TaskItem> AssignedTasks { get; set; } = new List<TaskItem>();
        public ICollection<TaskItem> CreatedTasks { get; set; } = new List<TaskItem>();
        public ICollection<PushSubscription> PushSubscriptions { get; set; } = new List<PushSubscription>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    }
}
