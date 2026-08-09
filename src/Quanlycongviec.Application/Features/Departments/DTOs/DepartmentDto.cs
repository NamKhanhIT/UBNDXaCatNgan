using System;

namespace Quanlycongviec.Application.Features.Departments.DTOs
{
    public class DepartmentDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public int MemberCount { get; set; }
    }
}
