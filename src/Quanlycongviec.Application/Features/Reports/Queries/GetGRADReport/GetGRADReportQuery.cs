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
        
        /// <summary>
        /// Điểm hệ thống tự động ghi nhận (Tối đa 3.0 điểm: 1.5đ đúng hạn + 1.0đ checklist + 0.5đ không từ chối)
        /// </summary>
        public double SystemAutoScore30 { get; set; }

        /// <summary>
        /// Điểm Lãnh đạo thẩm định chất lượng (Tối đa 7.0 điểm)
        /// </summary>
        public double LeaderEvaluationScore70 { get; set; }

        /// <summary>
        /// Tổng điểm đánh giá thi đua (Thang 10 điểm)
        /// </summary>
        public double FinalScore100 { get; set; }

        /// <summary>
        /// Xếp loại thi đua cán bộ, công chức theo quy chế công vụ
        /// </summary>
        public string TierGrade { get; set; } = string.Empty;

        // ── Thuộc tính tương thích ngược ──
        public double ChecklistProgressScore40 { get => SystemAutoScore30; set => SystemAutoScore30 = value; }
        public double LeaderQualityScore60 { get => LeaderEvaluationScore70; set => LeaderEvaluationScore70 = value; }
        public double FinalGRADScore { get => FinalScore100; set => FinalScore100 = value; }
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

                // 1. Điểm hệ thống tự động (Tối đa 3.0 điểm)
                double systemScore;
                var tasksWithSystemScore = userTasks.Where(t => t.SystemScore.HasValue).ToList();
                if (tasksWithSystemScore.Any())
                {
                    var avg = tasksWithSystemScore.Average(t => t.SystemScore!.Value);
                    systemScore = avg > 3.0 ? Math.Round(avg / 10.0, 1) : Math.Round(avg, 1);
                }
                else
                {
                    double avgProgress = totalAssigned > 0
                        ? userTasks.Average(t => t.ProgressPercentage)
                        : 100.0;
                    double onTimeRatio = totalAssigned > 0 ? (double)(totalAssigned - overdue) / totalAssigned : 1.0;
                    systemScore = Math.Round(onTimeRatio * 1.5 + (avgProgress / 100.0) * 1.0 + 0.5, 1);
                }
                systemScore = Math.Clamp(systemScore, 0.0, 3.0);

                // 2. Điểm Lãnh đạo thẩm định chất lượng (Tối đa 7.0 điểm)
                double leaderScore;
                var tasksWithEvaluatorScore = userTasks.Where(t => t.EvaluatorScore.HasValue).ToList();
                if (tasksWithEvaluatorScore.Any())
                {
                    var avg = tasksWithEvaluatorScore.Average(t => t.EvaluatorScore!.Value);
                    leaderScore = avg > 7.0 ? Math.Round(avg / 10.0, 1) : Math.Round(avg, 1);
                }
                else
                {
                    var tasksWithRating = userTasks.Where(t => t.RatingScore.HasValue).ToList();
                    if (tasksWithRating.Any())
                    {
                        var avgRating = tasksWithRating.Average(t => t.RatingScore!.Value);
                        leaderScore = avgRating > 10.0
                            ? Math.Round((avgRating / 100.0) * 7.0, 1)
                            : Math.Round((avgRating / 10.0) * 7.0, 1);
                    }
                    else
                    {
                        leaderScore = 6.3; // Mặc định mức 90% (6.3/7.0đ)
                    }
                }
                leaderScore = Math.Clamp(leaderScore, 0.0, 7.0);

                // 3. Tổng điểm thi đua (Thang 10 điểm)
                double finalScore = Math.Min(10.0, Math.Round(systemScore + leaderScore, 1));

                // 4. Xếp loại thi đua công vụ chuẩn tác phong cán bộ (Thang 10)
                string grade = finalScore >= 9.0 ? "Hoàn thành xuất sắc nhiệm vụ"
                    : finalScore >= 7.5 ? "Hoàn thành tốt nhiệm vụ"
                    : finalScore >= 6.0 ? "Hoàn thành nhiệm vụ"
                    : finalScore >= 4.0 ? "Cần cải thiện"
                    : "Không hoàn thành nhiệm vụ";

                officerScores.Add(new OfficerGRADScoreDto
                {
                    UserId = user.Id,
                    FullName = user.FullName,
                    RoleName = user.ActiveRoleCode ?? "Cán bộ",
                    DepartmentName = user.PrimaryDepartment?.Name ?? "Văn phòng HĐND & UBND",
                    TotalTasksAssigned = totalAssigned,
                    CompletedTasksCount = completed,
                    OverdueTasksCount = overdue,
                    SystemAutoScore30 = systemScore,
                    LeaderEvaluationScore70 = leaderScore,
                    FinalScore100 = finalScore,
                    TierGrade = grade
                });
            }

            // Department Summaries
            var depts = await _context.Departments.Where(d => !d.IsDeleted).ToListAsync(cancellationToken);
            var deptSummaries = new List<DepartmentGRADSummaryDto>();

            foreach (var dept in depts)
            {
                var deptOfficers = officerScores.Where(o => o.DepartmentName == dept.Name).ToList();
                var avgDeptScore = deptOfficers.Count > 0 ? Math.Round(deptOfficers.Average(o => o.FinalScore100), 1) : 8.5;
                
                deptSummaries.Add(new DepartmentGRADSummaryDto
                {
                    DepartmentId = dept.Id,
                    DepartmentName = dept.Name,
                    MemberCount = deptOfficers.Count,
                    TotalTasks = deptOfficers.Sum(o => o.TotalTasksAssigned),
                    AverageGRADScore = avgDeptScore,
                    TierGrade = avgDeptScore >= 9.0 ? "Hoàn thành xuất sắc" : avgDeptScore >= 7.5 ? "Hoàn thành tốt" : "Hoàn thành"
                });
            }

            var overallAvg = officerScores.Count > 0 ? Math.Round(officerScores.Average(o => o.FinalScore100), 1) : 8.8;

            return new GRADReportResultDto
            {
                Officers = officerScores,
                Departments = deptSummaries,
                OverallCommuneAverageScore = overallAvg
            };
        }
    }
}
