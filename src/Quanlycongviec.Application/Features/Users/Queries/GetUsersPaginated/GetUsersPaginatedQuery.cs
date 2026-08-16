using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Users.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Users.Queries.GetUsersPaginated
{
    public class GetUsersPaginatedQuery : IRequest<PaginatedResult<UserDto>>
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public string? Search { get; set; }
        public Guid? DepartmentId { get; set; }
        public string? RoleCode { get; set; }
        public string? WorkloadStatus { get; set; } // "Normal", "NearOverload", "Overloaded"
    }

    public class GetUsersPaginatedQueryHandler : IRequestHandler<GetUsersPaginatedQuery, PaginatedResult<UserDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetUsersPaginatedQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<PaginatedResult<UserDto>> Handle(GetUsersPaginatedQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Users
                .Include(u => u.PrimaryDepartment)
                .Include(u => u.UserRoles)
                    .ThenInclude(ur => ur.Role)
                .Include(u => u.AssignedTasks)
                .Where(u => !u.IsDeleted)
                .AsQueryable();

            // Lọc theo từ khóa tìm kiếm (FullName, Username, Email)
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var search = request.Search.Trim().ToLower();
                query = query.Where(u => EF.Functions.Like(u.FullName.ToLower(), $"%{search}%") ||
                                         EF.Functions.Like(u.Username.ToLower(), $"%{search}%") ||
                                         EF.Functions.Like(u.Email.ToLower(), $"%{search}%"));
            }

            // Lọc theo Phòng ban
            if (request.DepartmentId.HasValue && request.DepartmentId.Value != Guid.Empty)
            {
                query = query.Where(u => u.PrimaryDepartmentId == request.DepartmentId.Value ||
                                         u.UserRoles.Any(ur => ur.DepartmentId == request.DepartmentId.Value));
            }

            // Lọc theo Vai trò
            if (!string.IsNullOrWhiteSpace(request.RoleCode) && request.RoleCode != "ALL")
            {
                var roleCode = request.RoleCode.Trim();
                query = query.Where(u => u.ActiveRoleCode == roleCode ||
                                         u.UserRoles.Any(ur => ur.Role.Code == roleCode));
            }

            var users = await query.ToListAsync(cancellationToken);

            var capacitiesList = await _context.WorkloadCapacities
                .ToListAsync(cancellationToken);

            var capacities = capacitiesList
                .GroupBy(w => w.UserId)
                .ToDictionary(g => g.Key, g => g.First());

            var userDtos = users.Select(u =>
            {
                var primaryUr = u.UserRoles.FirstOrDefault(ur => ur.IsPrimary) ?? u.UserRoles.FirstOrDefault();
                var role = primaryUr?.Role;

                // Đồng bộ chính xác tải việc thực tế từ các task đang active
                var activeTasks = u.AssignedTasks
                    .Where(t => !t.IsDeleted &&
                                t.Status != TaskStatusEnum.Completed &&
                                t.Status != TaskStatusEnum.Cancelled)
                    .ToList();

                double assignedHours = activeTasks.Sum(t => t.EstimatedEffortHours);
                capacities.TryGetValue(u.Id, out var cap);
                double maxHours = cap?.WeeklyMaxHours ?? 40.0;
                double utilizationRate = maxHours > 0 ? Math.Round((assignedHours / maxHours) * 100.0, 1) : 0.0;
                bool isOverloaded = utilizationRate > 100.0;

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
                    AssignedHours = assignedHours,
                    MaxHours = maxHours,
                    UtilizationRate = utilizationRate,
                    IsOverloaded = isOverloaded
                };
            }).ToList();

            // Lọc theo Mức Tải Việc (nếu có yêu cầu)
            if (!string.IsNullOrWhiteSpace(request.WorkloadStatus) && request.WorkloadStatus != "ALL")
            {
                var wlStatus = request.WorkloadStatus.Trim().ToLower();
                if (wlStatus == "normal")
                {
                    userDtos = userDtos.Where(u => u.UtilizationRate < 80.0).ToList();
                }
                else if (wlStatus == "nearoverload" || wlStatus == "near_overload")
                {
                    userDtos = userDtos.Where(u => u.UtilizationRate >= 80.0 && u.UtilizationRate <= 100.0).ToList();
                }
                else if (wlStatus == "overloaded")
                {
                    userDtos = userDtos.Where(u => u.IsOverloaded).ToList();
                }
            }

            int page = request.Page > 0 ? request.Page : 1;
            int pageSize = request.PageSize > 0 ? request.PageSize : 20;
            int totalCount = userDtos.Count;

            var pagedItems = userDtos
                .OrderBy(u => u.RankLevel)
                .ThenBy(u => u.FullName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return new PaginatedResult<UserDto>(pagedItems, totalCount, page, pageSize);
        }
    }
}
