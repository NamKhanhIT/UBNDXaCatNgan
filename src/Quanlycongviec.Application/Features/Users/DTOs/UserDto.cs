 using System;

namespace Quanlycongviec.Application.Features.Users.DTOs
{
    public class UserDto
    {
        public Guid Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? ZaloPhoneNumber { get; set; }
        public Guid? PrimaryDepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public string? ActiveRoleCode { get; set; }
        public string? RoleName { get; set; }
        public int RankLevel { get; set; }
        public double AssignedHours { get; set; }
        public double MaxHours { get; set; }
        public double UtilizationRate { get; set; }
        public bool IsOverloaded { get; set; }
    }
}
