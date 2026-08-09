using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Users.DTOs;

namespace Quanlycongviec.Application.Features.Users.Queries.GetUsers
{
    public class GetUsersQuery : IRequest<List<UserDto>>
    {
    }

    public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, List<UserDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetUsersQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
        {
            var users = await _context.Users
                .Include(u => u.PrimaryDepartment)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .Where(u => !u.IsDeleted)
                .ToListAsync(cancellationToken);

            var workloads = await _context.WorkloadCapacities
                .ToDictionaryAsync(w => w.UserId, w => w, cancellationToken);

            var result = users.Select(u =>
            {
                var primaryUr = u.UserRoles.FirstOrDefault(ur => ur.IsPrimary) ?? u.UserRoles.FirstOrDefault();
                var role = primaryUr?.Role;
                workloads.TryGetValue(u.Id, out var wl);

                return new UserDto
                {
                    Id = u.Id,
                    Username = u.Username,
                    FullName = u.FullName,
                    Email = u.Email,
                    ZaloPhoneNumber = u.ZaloPhoneNumber,
                    PrimaryDepartmentId = u.PrimaryDepartmentId,
                    DepartmentName = u.PrimaryDepartment?.Name,
                    ActiveRoleCode = u.ActiveRoleCode,
                    RoleName = role?.Name ?? u.ActiveRoleCode,
                    RankLevel = role?.RankLevel ?? 5,
                    AssignedHours = wl?.CurrentAssignedHours ?? 0,
                    MaxHours = wl?.WeeklyMaxHours ?? 40
                };
            }).ToList();

            return result;
        }
    }
}
