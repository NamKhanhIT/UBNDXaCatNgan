using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Workload.Queries.GetWorkloadHeatmap
{
    public class UserWorkloadDto
    {
        public Guid UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string RoleName { get; set; } = string.Empty;
        public string DepartmentName { get; set; } = string.Empty;
        public double WeeklyMaxHours { get; set; }
        public double CurrentAssignedHours { get; set; }
        public double UtilizationRate { get; set; }
        public bool IsOverloaded { get; set; }
        public int ActiveTaskCount { get; set; }
    }

    public record GetWorkloadHeatmapQuery(Guid? DepartmentId = null) : IRequest<List<UserWorkloadDto>>;

    public class GetWorkloadHeatmapQueryHandler : IRequestHandler<GetWorkloadHeatmapQuery, List<UserWorkloadDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetWorkloadHeatmapQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<UserWorkloadDto>> Handle(GetWorkloadHeatmapQuery request, CancellationToken cancellationToken)
        {
            var query = _context.Users
                .Include(u => u.PrimaryDepartment)
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .Include(u => u.AssignedTasks)
                .AsQueryable();

            if (request.DepartmentId.HasValue)
            {
                query = query.Where(u => u.PrimaryDepartmentId == request.DepartmentId.Value);
            }

            var users = await query.ToListAsync(cancellationToken);
            var capacities = await _context.WorkloadCapacities.ToListAsync(cancellationToken);

            var result = new List<UserWorkloadDto>();

            foreach (var user in users)
            {
                var cap = capacities.FirstOrDefault(c => c.UserId == user.Id);
                var activeTasks = user.AssignedTasks.Where(t => t.Status != Domain.Enums.TaskStatusEnum.Completed && t.Status != Domain.Enums.TaskStatusEnum.Cancelled).ToList();
                double assignedHours = activeTasks.Sum(t => t.EstimatedEffortHours);
                double maxHours = cap?.WeeklyMaxHours ?? 40.0;
                double rate = maxHours > 0 ? (assignedHours / maxHours) * 100.0 : 0.0;

                result.Add(new UserWorkloadDto
                {
                    UserId = user.Id,
                    FullName = user.FullName,
                    RoleName = user.UserRoles.FirstOrDefault()?.Role.Name ?? "Chuyên viên",
                    DepartmentName = user.PrimaryDepartment?.Name ?? "Văn phòng UBND",
                    WeeklyMaxHours = maxHours,
                    CurrentAssignedHours = assignedHours,
                    UtilizationRate = Math.Round(rate, 1),
                    IsOverloaded = rate > 100.0,
                    ActiveTaskCount = activeTasks.Count
                });
            }

            return result;
        }
    }
}
