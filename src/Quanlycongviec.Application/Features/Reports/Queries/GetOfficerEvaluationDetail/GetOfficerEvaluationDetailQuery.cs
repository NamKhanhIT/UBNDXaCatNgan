using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Reports.Queries.GetOfficerEvaluationDetail
{
    /// <summary>
    /// Aggregate data cho View Detail modal: thông tin cán bộ + lịch sử làm việc + văn bản liên quan.
    /// </summary>
    public record GetOfficerEvaluationDetailQuery(Guid UserId)
        : IRequest<OfficerEvaluationDetailDto>;

    public class OfficerEvaluationDetailDto
    {
        public Guid UserId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string RoleName { get; set; } = string.Empty;
        public string DepartmentName { get; set; } = string.Empty;
        public double SystemScore { get; set; }
        public double LeaderScore { get; set; }
        public double FinalScore { get; set; }
        public string TierGrade { get; set; } = string.Empty;
        public int TotalTasksAssigned { get; set; }
        public int CompletedTasksCount { get; set; }
        public int OverdueTasksCount { get; set; }
        public List<OfficerTaskSummaryDto> RecentTasks { get; set; } = new();
        public List<OfficerDocumentSummaryDto> RecentDocuments { get; set; } = new();
    }

    public class OfficerTaskSummaryDto
    {
        public Guid TaskId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int ProgressPercentage { get; set; }
        public DateTime? AssignedAt { get; set; }
        public DateTime? DueDate { get; set; }
        public DateTime? CompletedAt { get; set; }
        public bool IsOverdue { get; set; }
    }

    public class OfficerDocumentSummaryDto
    {
        public Guid DocumentId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? DocumentNumber { get; set; }
        public DateTime UploadedAt { get; set; }
        public string UploaderName { get; set; } = string.Empty;
        public string? Category { get; set; }
    }

    public class GetOfficerEvaluationDetailQueryHandler
        : IRequestHandler<GetOfficerEvaluationDetailQuery, OfficerEvaluationDetailDto>
    {
        private readonly IApplicationDbContext _context;

        public GetOfficerEvaluationDetailQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<OfficerEvaluationDetailDto> Handle(
            GetOfficerEvaluationDetailQuery request,
            CancellationToken cancellationToken)
        {
            var user = await _context.Users
                .Include(u => u.PrimaryDepartment)
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == request.UserId && !u.IsDeleted, cancellationToken);

            if (user == null)
            {
                return new OfficerEvaluationDetailDto { UserId = request.UserId };
            }

            // Tasks gần đây (top 20)
            var tasks = await _context.TaskItems
                .AsNoTracking()
                .Where(t => !t.IsDeleted && t.AssigneeId == request.UserId)
                .OrderByDescending(t => t.CreatedAt)
                .Take(20)
                .ToListAsync(cancellationToken);

            var taskSummaries = tasks.Select(t => new OfficerTaskSummaryDto
            {
                TaskId = t.Id,
                Title = t.Title,
                Status = t.Status.ToString(),
                ProgressPercentage = t.ProgressPercentage,
                AssignedAt = t.CreatedAt,
                DueDate = t.DueDate,
                CompletedAt = t.CompletedAt,
                IsOverdue = t.Status != Domain.Enums.TaskStatusEnum.Completed
                    && t.DueDate.HasValue && t.DueDate.Value < DateTime.UtcNow
            }).ToList();

            // Văn bản liên quan (gần đây) — round này dùng InboxDocuments; round sau wire document-user mapping.
            var inboxDocs = await _context.InboxDocuments
                .AsNoTracking()
                .Where(d => !d.IsDeleted && d.ReceivedByUserId == request.UserId)
                .OrderByDescending(d => d.ReceivedDate)
                .Take(10)
                .ToListAsync(cancellationToken);

            var docSummaries = inboxDocs.Select(d => new OfficerDocumentSummaryDto
            {
                DocumentId = d.Id,
                Title = string.IsNullOrEmpty(d.AiTitle) ? d.Subject : (d.AiTitle ?? d.Subject),
                DocumentNumber = d.DocumentNumber,
                UploadedAt = d.ReceivedDate,
                UploaderName = d.Sender ?? "Hệ thống",
                Category = d.Category
            }).ToList();

            // Điểm thi đua: tổng hợp từ tasks (server-side calc tương tự GetGRADReportQuery)
            double systemScore = 0.0;
            var tasksWithSystemScore = tasks.Where(t => t.SystemScore.HasValue).ToList();
            if (tasksWithSystemScore.Any())
            {
                var avg = tasksWithSystemScore.Average(t => t.SystemScore!.Value);
                systemScore = avg > 3.0 ? Math.Round(avg / 10.0, 1) : Math.Round(avg, 1);
            }
            else
            {
                var totalAssigned = tasks.Count;
                if (totalAssigned > 0)
                {
                    var overdue = tasks.Count(t => t.Status != Domain.Enums.TaskStatusEnum.Completed && t.DueDate.HasValue && t.DueDate.Value < DateTime.UtcNow);
                    var avgProgress = tasks.Average(t => t.ProgressPercentage);
                    var onTimeRatio = (double)(totalAssigned - overdue) / totalAssigned;
                    systemScore = Math.Round(onTimeRatio * 1.5 + (avgProgress / 100.0) * 1.0 + 0.5, 1);
                }
            }
            systemScore = Math.Clamp(systemScore, 0.0, 3.0);

            double leaderScore;
            var tasksWithEval = tasks.Where(t => t.EvaluatorScore.HasValue).ToList();
            if (tasksWithEval.Any())
            {
                var avg = tasksWithEval.Average(t => t.EvaluatorScore!.Value);
                leaderScore = avg > 7.0 ? Math.Round(avg / 10.0, 1) : Math.Round(avg, 1);
            }
            else
            {
                var tasksWithRating = tasks.Where(t => t.RatingScore.HasValue).ToList();
                leaderScore = tasksWithRating.Any()
                    ? Math.Round((tasksWithRating.Average(t => t.RatingScore!.Value) / 10.0) * 7.0, 1)
                    : 6.3;
            }
            leaderScore = Math.Clamp(leaderScore, 0.0, 7.0);

            var finalScore = Math.Round(systemScore + leaderScore, 1);
            var tierGrade = finalScore >= 9.0 ? "Hoàn thành xuất sắc"
                : finalScore >= 7.5 ? "Hoàn thành tốt"
                : finalScore >= 6.0 ? "Hoàn thành"
                : "Cần cải thiện";

            return new OfficerEvaluationDetailDto
            {
                UserId = user.Id,
                FullName = user.FullName,
                RoleName = user.ActiveRoleCode ?? "Cán bộ",
                DepartmentName = user.PrimaryDepartment?.Name ?? "Văn phòng HĐND & UBND",
                SystemScore = systemScore,
                LeaderScore = leaderScore,
                FinalScore = finalScore,
                TierGrade = tierGrade,
                TotalTasksAssigned = tasks.Count,
                CompletedTasksCount = tasks.Count(t => t.Status == Domain.Enums.TaskStatusEnum.Completed),
                OverdueTasksCount = tasks.Count(t =>
                    t.Status != Domain.Enums.TaskStatusEnum.Completed &&
                    t.DueDate.HasValue && t.DueDate.Value < DateTime.UtcNow),
                RecentTasks = taskSummaries,
                RecentDocuments = docSummaries,
            };
        }
    }
}
