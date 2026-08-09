using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Departments.DTOs;

namespace Quanlycongviec.Application.Features.Departments.Queries.GetDepartments
{
    public class GetDepartmentsQuery : IRequest<List<DepartmentDto>>
    {
    }

    public class GetDepartmentsQueryHandler : IRequestHandler<GetDepartmentsQuery, List<DepartmentDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetDepartmentsQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<DepartmentDto>> Handle(GetDepartmentsQuery request, CancellationToken cancellationToken)
        {
            var depts = await _context.Departments
                .Where(d => !d.IsDeleted)
                .Select(d => new DepartmentDto
                {
                    Id = d.Id,
                    Name = d.Name,
                    Code = d.Code,
                    MemberCount = _context.Users.Count(u => u.PrimaryDepartmentId == d.Id && !u.IsDeleted)
                })
                .ToListAsync(cancellationToken);

            return depts;
        }
    }
}
