using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Validators;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Reports.Commands.EvaluateOfficer
{
    public class EvaluateOfficerRequestDto
    {
        [Required]
        public Guid TargetUserId { get; set; }
        public string? TargetUserName { get; set; }
        public string? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }

        [Range(0.0, 10.0, ErrorMessage = "Điểm đánh giá tổng hợp phải từ 0.0 đến 10.0")]
        public double RatingScore10 { get; set; }

        [Range(0.0, 7.0, ErrorMessage = "Điểm lãnh đạo thẩm định phải từ 0.0 đến 7.0")]
        public double? EvaluatorScore70 { get; set; }

        [Range(0.0, 3.0, ErrorMessage = "Điểm hệ thống tự động phải từ 0.0 đến 3.0")]
        public double? SystemScore30 { get; set; }

        public string? EvaluationPeriod { get; set; }
        public string? EvaluationNotes { get; set; }

        // 07-09-2026: bắt buộc khi delta-edit (tăng hoặc giảm điểm)
        public string? Reason { get; set; }
        public Guid[]? EvidenceFileIds { get; set; }
        public string[]? EvidenceUrls { get; set; }
    }

    public record EvaluateOfficerCommand(
        Guid TargetUserId,
        double RatingScore10,
        double? EvaluatorScore70,
        double? SystemScore30,
        string? EvaluationPeriod,
        string? EvaluationNotes,
        Guid EvaluatedByUserId,
        string? Reason = null,
        Guid[]? EvidenceFileIds = null,
        string[]? EvidenceUrls = null,
        double? OldScore = null
    ) : IRequest<EvaluateOfficerResultDto>;

    public class EvaluateOfficerResultDto
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? Error { get; set; }
        public double FinalScore { get; set; }
        public double SystemScore { get; set; }
        public double EvaluatorScore { get; set; }
        public string TierGrade { get; set; } = string.Empty;
    }

    public class EvaluateOfficerCommandHandler : IRequestHandler<EvaluateOfficerCommand, EvaluateOfficerResultDto>
    {
        private readonly IApplicationDbContext _context;
        private readonly INotificationDispatcher _notificationDispatcher;

        public EvaluateOfficerCommandHandler(
            IApplicationDbContext context,
            INotificationDispatcher notificationDispatcher)
        {
            _context = context;
            _notificationDispatcher = notificationDispatcher;
        }

        public async Task<EvaluateOfficerResultDto> Handle(EvaluateOfficerCommand request, CancellationToken cancellationToken)
        {
            // 1. Kiểm tra quyền hạn của người đánh giá (Caller)
            var evaluator = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.Id == request.EvaluatedByUserId && !u.IsDeleted, cancellationToken);

            if (evaluator == null)
            {
                throw new UnauthorizedAccessException("Không tìm thấy thông tin người đánh giá trên hệ thống.");
            }

            int evaluatorRank = evaluator.UserRoles.Where(ur => !ur.IsDeleted).Min(ur => (int?)ur.Role.RankLevel) ?? 5;
            // Chỉ Lãnh đạo cấp xã (Rank <= 2) hoặc Lãnh đạo phòng ban (Rank 3 - 4) mới có thẩm quyền thẩm định
            if (evaluatorRank > 4)
            {
                throw new UnauthorizedAccessException("Chỉ cán bộ lãnh đạo, quản lý từ cấp Phó Trưởng phòng trở lên mới có thẩm quyền thẩm định thi đua cán bộ.");
            }

            // 2. Kiểm tra thông tin cán bộ được đánh giá (Target User)
            var targetUser = await _context.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .Include(u => u.PrimaryDepartment)
                .FirstOrDefaultAsync(u => u.Id == request.TargetUserId && !u.IsDeleted, cancellationToken);

            if (targetUser == null)
            {
                throw new InvalidOperationException("Không tìm thấy thông tin cán bộ cần thẩm định.");
            }

            // ── R.1 (07-09-2026): CẤM TỰ ĐÁNH GIÁ ĐIỂM BẢN THÂN ──
            // Áp dụng cho mọi role rank, kể cả lãnh đạo cao nhất — không có ngoại lệ.
            if (request.EvaluatedByUserId == request.TargetUserId)
            {
                throw new UnauthorizedAccessException("Bạn không thể tự đánh giá điểm thi đua của chính mình để đảm bảo tính khách quan.");
            }

            // Nếu người đánh giá là Trưởng/Phó phòng (Rank 3-4), chỉ được thẩm định cán bộ thuộc phòng ban mình
            if (evaluatorRank is 3 or 4)
            {
                bool sameDept = evaluator.PrimaryDepartmentId.HasValue && evaluator.PrimaryDepartmentId == targetUser.PrimaryDepartmentId;
                if (!sameDept)
                {
                    throw new UnauthorizedAccessException("Trưởng/Phó phòng chỉ được phép thẩm định cán bộ trực thuộc cùng phòng ban chuyên môn.");
                }
            }

            // 3. Kiểm tra điểm lãnh đạo thẩm định (thang tối đa 7.0 điểm)
            if (!request.EvaluatorScore70.HasValue || request.EvaluatorScore70.Value < 0.0 || request.EvaluatorScore70.Value > 7.0)
            {
                throw new ArgumentException("Điểm Lãnh đạo thẩm định phải nằm trong khoảng từ 0.0 đến 7.0 điểm.");
            }

            string period = string.IsNullOrWhiteSpace(request.EvaluationPeriod)
                ? DateTime.UtcNow.ToString("yyyy-MM")
                : request.EvaluationPeriod.Trim();

            // Kiểm tra xem kỳ đánh giá đã bị khóa sổ chưa
            var isPeriodClosed = await _context.RatingPeriods
                .AnyAsync(p => !p.IsDeleted && p.Title == period && p.IsClosed, cancellationToken);
            if (isPeriodClosed)
            {
                throw new InvalidOperationException($"Kỳ đánh giá thi đua [{period}] đã được khóa sổ, không thể điều chỉnh điểm.");
            }

            // Tính toán SystemScore server-side từ nhiệm vụ thực tế của cán bộ (KHÔNG tin client)
            var userTasks = await _context.TaskItems
                .AsNoTracking()
                .Where(t => !t.IsDeleted && t.AssigneeId == targetUser.Id)
                .ToListAsync(cancellationToken);

            double systemScore;
            var tasksWithSystemScore = userTasks.Where(t => t.SystemScore.HasValue).ToList();
            if (tasksWithSystemScore.Any())
            {
                var avg = tasksWithSystemScore.Average(t => t.SystemScore!.Value);
                systemScore = avg > 3.0 ? Math.Round(avg / 10.0, 1) : Math.Round(avg, 1);
            }
            else
            {
                int totalAssigned = userTasks.Count;
                // BẢO MẬT (Audit 04-09-2026): Không gian hệ thống với công việc = 0.
                // Officer không có nhiệm vụ nào không phải là điểm cao — không có bằng chứng hiệu suất.
                if (totalAssigned == 0)
                {
                    systemScore = 0.0;
                }
                else
                {
                    int overdue = userTasks.Count(t => t.Status != TaskStatusEnum.Completed && t.DueDate.HasValue && t.DueDate < DateTime.UtcNow);
                    double avgProgress = userTasks.Average(t => t.ProgressPercentage);
                    double onTimeRatio = (double)(totalAssigned - overdue) / totalAssigned;
                    systemScore = Math.Round(onTimeRatio * 1.5 + (avgProgress / 100.0) * 1.0 + 0.5, 1);
                }
            }
            systemScore = Math.Clamp(systemScore, 0.0, 3.0);

            double evaluatorScore = Math.Round(request.EvaluatorScore70.Value, 1);
            double finalScore = Math.Clamp(Math.Round(systemScore + evaluatorScore, 1), 0.0, 10.0);

            // 4. Xếp loại thi đua công vụ chuẩn
            string tierGrade = finalScore >= 9.0 ? "Hoàn thành xuất sắc nhiệm vụ"
                : finalScore >= 7.5 ? "Hoàn thành tốt nhiệm vụ"
                : finalScore >= 6.0 ? "Hoàn thành nhiệm vụ"
                : finalScore >= 4.0 ? "Cần cải thiện"
                : "Không hoàn thành nhiệm vụ";

            // ── R.2 + R.3 (07-09-2026): Validate reason + evidence khi delta-edit ──
            double oldScore = request.OldScore ?? finalScore; // nếu lần đầu thì delta = 0 → skip validation
            double delta = finalScore - oldScore;
            bool isDelta = Math.Abs(delta) >= 0.05;

            if (isDelta)
            {
                // R.2: Lý do không hợp lệ
                var reasonError = RatingReasonValidator.Validate(request.Reason, oldScore, finalScore);
                if (reasonError != null)
                {
                    throw new ArgumentException($"Lý do không hợp lệ: {reasonError}");
                }

                // R.3: Bằng chứng không hợp lệ
                if (request.EvidenceFileIds == null || request.EvidenceFileIds.Length == 0)
                {
                    throw new ArgumentException("Phải đính kèm ít nhất 1 bằng chứng khi thay đổi điểm.");
                }

                var evidenceError = await EvidenceValidator.ValidateAsync(
                    request.EvidenceFileIds,
                    request.TargetUserId,
                    _context,
                    cancellationToken);
                if (evidenceError != null)
                {
                    throw new ArgumentException($"Bằng chứng không hợp lệ: {evidenceError}");
                }
            }

            // 5. Ghi nhật ký hoạt động thẩm định (ActivityLog)
            var log = new ActivityLog
            {
                Id = Guid.NewGuid(),
                UserId = request.EvaluatedByUserId,
                ActionType = isDelta ? "officer_score_updated" : "officer_evaluated",
                TargetEntityType = "User",
                TargetEntityId = request.TargetUserId.ToString(),
                Summary = isDelta
                    ? $"Cập nhật điểm thi đua kỳ {period} cho cán bộ [{targetUser.FullName}]: {oldScore:F1} → {finalScore:F1}/10.0 (Δ {delta:+0.0;-0.0;0}). Lý do: {request.Reason}."
                    : $"Thẩm định điểm thi đua kỳ {period} cho cán bộ [{targetUser.FullName}]: {finalScore:F1}/10.0 điểm (Lãnh đạo: {evaluatorScore:F1}đ, Hệ thống: {systemScore:F1}đ). Xếp loại: {tierGrade}.",
                CreatedAt = DateTime.UtcNow
            };
            _context.ActivityLogs.Add(log);

            // Ghi RatingHistory khi delta-edit (R.4 audit trail)
            if (isDelta)
            {
                var ratingHistory = new Domain.Entities.RatingHistory
                {
                    Id = Guid.NewGuid(),
                    TaskItemId = Guid.Empty, // aggregate-level edit, không gắn với task cụ thể
                    OldScore = oldScore,
                    NewScore = finalScore,
                    ScoreDelta = delta,
                    ChangedByUserId = request.EvaluatedByUserId,
                    ChangedAt = DateTime.UtcNow,
                    Reason = request.Reason ?? string.Empty,
                    EvidenceUrl = request.EvidenceUrls?.FirstOrDefault() ?? string.Empty,
                    ApprovalStatus = RatingApprovalStatusEnum.Applied,
                    OldSystemScore = systemScore,
                    OldEvaluatorScore = oldScore - systemScore,
                    NewSystemScore = systemScore,
                    NewEvaluatorScore = evaluatorScore,
                };
                _context.RatingHistories.Add(ratingHistory);
            }

            await _context.SaveChangesAsync(cancellationToken);

            // 6. Gửi thông báo tới cán bộ được đánh giá qua INotificationDispatcher
            await _notificationDispatcher.DispatchAsync(new Notification
            {
                UserId = targetUser.Id,
                Type = NotificationType.Reviewed,
                Channel = NotificationChannel.InApp,
                Title = "Kết quả thẩm định thi đua công vụ",
                Message = $"Lãnh đạo đã thẩm định kết quả thi đua kỳ {period}: {finalScore:F1}/10.0 điểm ({tierGrade}).",
                SentAt = DateTime.UtcNow,
                IsRead = false
            }, cancellationToken);

            return new EvaluateOfficerResultDto
            {
                Success = true,
                Message = $"Đã ghi nhận kết quả thẩm định cho cán bộ {targetUser.FullName}: {finalScore:F1}/10.0 điểm.",
                FinalScore = finalScore,
                SystemScore = systemScore,
                EvaluatorScore = evaluatorScore,
                TierGrade = tierGrade
            };
        }
    }
}
