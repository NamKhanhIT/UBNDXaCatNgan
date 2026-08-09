using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Reports.Queries.GetGRADReport
{
    public class OfficerGRADScoreDto
    {
        public Guid UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string RoleName { get; set; } = string.Empty;
        public string DepartmentName { get; set; } = string.Empty;
        public int TotalTasksAssigned { get; set; }
        public int CompletedTasksCount { get; set; }
        public int OverdueTasksCount { get; set; }
        
        public double ChecklistProgressScore40 { get; set; } // Tối đa 4.0 điểm
        public double LeaderQualityScore60 { get; set; }     // Tối đa 6.0 điểm
        public double FinalGRADScore { get; set; }          // Thang 10 điểm
        public string TierGrade { get; set; } = string.Empty; // A (Xuất sắc), B (Tốt), C (Khá), D (Dưới TB)
    }

    public class DepartmentGRADSummaryDto
    {
        public Guid DepartmentId { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public int MemberCount { get; set; }
        public int TotalTasks { get; set; }
        public double AverageGRADScore { get; set; }
        public string TierGrade { get; set; } = string.Empty;
    }

    public class GRADReportResultDto
    {
        public List<OfficerGRADScoreDto> Officers { get; set; } = new();
        public List<DepartmentGRADSummaryDto> Departments { get; set; } = new();
        public double OverallCommuneAverageScore { get; set; }
    }

    public class GetGRADReportQuery : IRequest<GRADReportResultDto>
    {
    }

    public class GetGRADReportQueryHandler : IRequestHandler<GetGRADReportQuery, GRADReportResultDto>
    {
        private readonly IApplicationDbContext _context;

        public GetGRADReportQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<GRADReportResultDto> Handle(GetGRADReportQuery request, CancellationToken cancellationToken)
        {
            var users = await _context.Users
                .Include(u => u.PrimaryDepartment)
                .Where(u => !u.IsDeleted)
                .ToListAsync(cancellationToken);

            var tasks = await _context.TaskItems
                .Include(t => t.SubTasks)
                .Where(t => !t.IsDeleted)
                .ToListAsync(cancellationToken);

            var officerScores = new List<OfficerGRADScoreDto>();

            foreach (var user in users)
            {
                var userTasks = tasks.Where(t => t.AssigneeId == user.Id).ToList();
                var totalAssigned = userTasks.Count;
                var completed = userTasks.Count(t => t.Status == Domain.Enums.TaskStatusEnum.Completed);
                var overdue = userTasks.Count(t => t.Status != Domain.Enums.TaskStatusEnum.Completed && t.DueDate < DateTime.UtcNow);

                // 1. Calculate Checklist Progress Score (40% Weight -> Max 4.0 pts)
                double avgProgress = totalAssigned > 0
                    ? userTasks.Average(t => t.ProgressPercentage)
                    : 100.0;
                double checklistScore = Math.Round((avgProgress / 100.0) * 4.0, 2);

                // 2. Calculate Leader Quality Rating Score (60% Weight -> Max 6.0 pts)
                double avgRating = totalAssigned > 0
                    ? userTasks.Where(t => t.RatingScore.HasValue).Select(t => t.RatingScore!.Value).DefaultIfEmpty(9.0).Average()
                    : 9.0;
                double leaderScore = Math.Round((avgRating / 10.0) * 6.0, 2);

                double finalScore = Math.Min(10.0, Math.Round(checklistScore + leaderScore, 2));

                string grade = finalScore >= 9.0 ? "A — Xuất sắc"
                    : finalScore >= 7.5 ? "B — Tốt"
                    : finalScore >= 6.0 ? "C — Khá"
                    : "D — Dưới trung bình";

                officerScores.Add(new OfficerGRADScoreDto
                {
                    UserId = user.Id,
                    FullName = user.FullName,
                    RoleName = user.ActiveRoleCode ?? "Cán bộ",
                    DepartmentName = user.PrimaryDepartment?.Name ?? "Văn phòng HĐND & UBND",
                    TotalTasksAssigned = totalAssigned,
                    CompletedTasksCount = completed,
                    OverdueTasksCount = overdue,
                    ChecklistProgressScore40 = checklistScore,
                    LeaderQualityScore60 = leaderScore,
                    FinalGRADScore = finalScore,
                    TierGrade = grade
                });
            }

            // Department Summaries
            var depts = await _context.Departments.Where(d => !d.IsDeleted).ToListAsync(cancellationToken);
            var deptSummaries = new List<DepartmentGRADSummaryDto>();

            foreach (var dept in depts)
            {
                var deptOfficers = officerScores.Where(o => o.DepartmentName == dept.Name).ToList();
                var avgDeptScore = deptOfficers.Count > 0 ? Math.Round(deptOfficers.Average(o => o.FinalGRADScore), 2) : 8.5;
                
                deptSummaries.Add(new DepartmentGRADSummaryDto
                {
                    DepartmentId = dept.Id,
                    DepartmentName = dept.Name,
                    MemberCount = deptOfficers.Count,
                    TotalTasks = deptOfficers.Sum(o => o.TotalTasksAssigned),
                    AverageGRADScore = avgDeptScore,
                    TierGrade = avgDeptScore >= 9.0 ? "A — Xuất sắc" : avgDeptScore >= 7.5 ? "B — Tốt" : "C — Khá"
                });
            }

            var overallAvg = officerScores.Count > 0 ? Math.Round(officerScores.Average(o => o.FinalGRADScore), 2) : 9.0;

            return new GRADReportResultDto
            {
                Officers = officerScores,
                Departments = deptSummaries,
                OverallCommuneAverageScore = overallAvg
            };
        }
    }
}
