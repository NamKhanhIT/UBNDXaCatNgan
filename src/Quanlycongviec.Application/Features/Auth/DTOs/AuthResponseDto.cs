using System;
using System.Collections.Generic;

namespace Quanlycongviec.Application.Features.Auth.DTOs
{
    public class UserRoleDto
    {
        public string RoleCode { get; set; } = string.Empty;
        public string RoleName { get; set; } = string.Empty;
        public string? DepartmentName { get; set; }
        public bool IsPrimary { get; set; }
    }

    public class AuthResponseDto
    {
        public Guid UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string ActiveRole { get; set; } = string.Empty;
        public List<UserRoleDto> AvailableRoles { get; set; } = new List<UserRoleDto>();
        public string Token { get; set; } = string.Empty;
        public string RefreshToken { get; set; } = string.Empty;

        // Yêu cầu xác thực 2 yếu tố (cần gọi /Auth/mfa/verify-login)
        public bool MfaRequired { get; set; }

        // Token dùng 1 lần (5 phút) cho bước xác thực OTP sau mật khẩu
        public string MfaToken { get; set; } = string.Empty;

        // Trạng thái MFA của tài khoản
        public bool MfaEnabled { get; set; }

        // BẢO MẬT (Audit A5): Tài khoản khởi tạo bắt buộc đổi mật khẩu trước khi thao tác
        public bool MustChangePassword { get; set; }
    }
}
