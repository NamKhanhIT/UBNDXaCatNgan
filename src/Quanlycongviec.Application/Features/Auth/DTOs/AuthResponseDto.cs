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

        /// <summary>Yêu cầu xác thực 2 yếu tố (người dùng đã bật MFA) — cần gọi /Auth/mfa/verify-login</summary>
        public bool MfaRequired { get; set; }

        /// <summary>Token dùng 1 lần (5 phút) cho bước xác thực OTP sau mật khẩu</summary>
        public string MfaToken { get; set; } = string.Empty;

        /// <summary>Trạng thái MFA của tài khoản (đã bật xác thực 2 yếu tố hay chưa)</summary>
        public bool MfaEnabled { get; set; }
    }
}
