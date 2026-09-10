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

namespace Quanlycongviec.Application.Features.Users.Queries.GetAssignableUsers
{
    /// <summary>
    /// Endpoint "Operation Center" — picker cán bộ có thể giao việc.
    /// Trả về id, fullName, rankLevel, primaryDepartmentId, currentTaskCount,
    /// overdueTaskCount, last30DaysCompletionRate, capabilityMatches[].
    /// Tự loại trừ chính caller (assignerId) và user đã bị khóa/xoá.
    /// </summary>
    public class GetAssignableUsersQuery : IRequest<List<AssignableUserDto>>
    {
        public Guid CallerUserId { get; set; }
        public Guid? DepartmentId { get; set; }
        public string? Capability { get; set; }   // ví dụ "Địa chính", "Hộ tịch", "Văn phòng"
        public string? Search { get; set; }
    }

    public class AssignableUserDto
    {
        public Guid Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public int RankLevel { get; set; }
        public string? RoleName { get; set; }
        public Guid? PrimaryDepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public int CurrentTaskCount { get; set; }
        public int OverdueTaskCount { get; set; }
        public double Last30DaysCompletionRate { get; set; }  // 0.0 - 1.0
        public double UtilizationRate { get; set; }            // % tải hiện tại
        public List<string> CapabilityMatches { get; set; } = new();
        public List<string> Capabilities { get; set; } = new();
        public double MatchConfidence { get; set; }           // 0.0 - 1.0
    }

    public class GetAssignableUsersQueryHandler : IRequestHandler<GetAssignableUsersQuery, List<AssignableUserDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetAssignableUsersQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<AssignableUserDto>> Handle(
            GetAssignableUsersQuery request,
            CancellationToken cancellationToken)
        {
            var nowUtc = DateTime.UtcNow;
            var cutoff30d = nowUtc.AddDays(-30);

            var users = await _context.Users
                .Include(u => u.PrimaryDepartment)
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .Include(u => u.AssignedTasks)
                .Where(u => !u.IsDeleted && u.Id != request.CallerUserId)
                .AsNoTracking()
                .ToListAsync(cancellationToken);

            var capacities = await _context.WorkloadCapacities
                .AsNoTracking()
                .Select(w => new { w.UserId, w.WeeklyMaxHours })
                .ToListAsync(cancellationToken);

            var capacitiesMap = capacities
                .GroupBy(w => w.UserId)
                .ToDictionary(g => g.Key, g => g.Max(w => w.WeeklyMaxHours));

            var list = users.Select(u =>
            {
                var active = u.AssignedTasks
                    .Where(t => !t.IsDeleted
                                && t.Status != TaskStatusEnum.Completed
                                && t.Status != TaskStatusEnum.Cancelled)
                    .ToList();
                int currentTaskCount = active.Count;
                int overdueTaskCount = active.Count(t =>
                    t.DueDate.HasValue && t.DueDate.Value < nowUtc);

                var recent = u.AssignedTasks
                    .Where(t => !t.IsDeleted
                                && t.Status == TaskStatusEnum.Completed
                                && t.CompletedAt.HasValue
                                && t.CompletedAt.Value >= cutoff30d)
                    .ToList();
                var totalRecentlyAssigned = u.AssignedTasks
                    .Count(t => !t.IsDeleted
                                && t.StartDate.HasValue
                                && t.StartDate.Value >= cutoff30d);
                double completionRate = totalRecentlyAssigned > 0
                    ? (double)recent.Count / totalRecentlyAssigned
                    : 1.0;

                double assignedHours = active.Sum(t => t.EstimatedEffortHours);
                double maxHours = capacitiesMap.TryGetValue(u.Id, out var cap) ? cap : 40.0;
                double utilization = maxHours > 0 ? (assignedHours / maxHours) * 100.0 : 0.0;

                var primaryUr = u.UserRoles.FirstOrDefault(ur => ur.IsPrimary) ?? u.UserRoles.FirstOrDefault();
                string roleName = primaryUr?.Role?.Name ?? string.Empty;
                int rank = primaryUr?.Role?.RankLevel ?? 5;

                var capabilities = ResolveCapabilities(u, u.PrimaryDepartment?.Name);

                var matches = new List<string>();
                double conf = 0.0;

                if (request.DepartmentId.HasValue)
                {
                    var did = request.DepartmentId.Value;
                    if (u.PrimaryDepartmentId == did)
                    {
                        matches.Add("sameDept");
                        conf += 0.4;
                    }
                }

                if (!string.IsNullOrWhiteSpace(request.Capability))
                {
                    var capReq = request.Capability.Trim();
                    if (capabilities.Any(c => string.Equals(c, capReq, StringComparison.OrdinalIgnoreCase)))
                    {
                        matches.Add($"cap:{capReq}");
                        conf += 0.4;
                    }
                    if (u.PrimaryDepartment?.Name?.Contains(capReq, StringComparison.OrdinalIgnoreCase) == true)
                    {
                        matches.Add($"dept:{u.PrimaryDepartment!.Name}");
                        conf += 0.2;
                    }
                }

                // Inverse utilization scoring — càng nhiều task overdue càng giảm conf
                if (overdueTaskCount == 0) conf += 0.2;
                if (utilization > 100.0) conf -= 0.3;

                conf = Math.Clamp(conf, 0.0, 1.0);

                return new AssignableUserDto
                {
                    Id = u.Id,
                    FullName = u.FullName,
                    Username = u.Username,
                    RankLevel = rank,
                    RoleName = roleName,
                    PrimaryDepartmentId = u.PrimaryDepartmentId,
                    DepartmentName = u.PrimaryDepartment?.Name,
                    CurrentTaskCount = currentTaskCount,
                    OverdueTaskCount = overdueTaskCount,
                    Last30DaysCompletionRate = Math.Round(completionRate, 2),
                    UtilizationRate = Math.Round(utilization, 1),
                    CapabilityMatches = matches,
                    Capabilities = capabilities,
                    MatchConfidence = Math.Round(conf, 2)
                };
            });

            // Apply filters
            if (request.DepartmentId.HasValue && request.DepartmentId.Value != Guid.Empty)
            {
                list = list.Where(u => u.PrimaryDepartmentId == request.DepartmentId.Value);
            }

            if (!string.IsNullOrWhiteSpace(request.Capability))
            {
                var cap = request.Capability.Trim();
                list = list.Where(u =>
                    u.Capabilities.Any(c => string.Equals(c, cap, StringComparison.OrdinalIgnoreCase)));
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var s = request.Search.Trim().ToLower();
                list = list.Where(u =>
                    u.FullName.ToLower().Contains(s) || u.Username.ToLower().Contains(s));
            }

            return list
                .OrderByDescending(u => u.MatchConfidence)
                .ThenBy(u => u.OverdueTaskCount)
                .ThenBy(u => u.RankLevel)
                .ThenBy(u => u.FullName)
                .Take(50)
                .ToList();
        }

        private static List<string> ResolveCapabilities(Quanlycongviec.Domain.Entities.User user, string? departmentName)
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (!string.IsNullOrWhiteSpace(departmentName))
            {
                // Map phòng ban chuẩn hành chính -> capability keywords
                if (departmentName.Contains("Địa chính", StringComparison.OrdinalIgnoreCase))
                {
                    set.Add("Địa chính");
                    set.Add("Quy hoạch");
                }
                if (departmentName.Contains("Tư pháp", StringComparison.OrdinalIgnoreCase))
                {
                    set.Add("Tư pháp");
                    set.Add("Hộ tịch");
                }
                if (departmentName.Contains("Văn phòng", StringComparison.OrdinalIgnoreCase) || departmentName.Contains("Hành chính", StringComparison.OrdinalIgnoreCase))
                {
                    set.Add("Văn phòng");
                }
                if (departmentName.Contains("Tài chính", StringComparison.OrdinalIgnoreCase) || departmentName.Contains("Kế toán", StringComparison.OrdinalIgnoreCase))
                {
                    set.Add("Tài chính");
                    set.Add("Kế toán");
                }
                if (departmentName.Contains("Văn hóa", StringComparison.OrdinalIgnoreCase) || departmentName.Contains("Xã hội", StringComparison.OrdinalIgnoreCase))
                {
                    set.Add("Văn hóa");
                }
            }
            // Allow custom Capabilities attribute present on User entity if exists
            return set.ToList();
        }
    }
}
