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
    }
}
