using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Commands.SubmitUBMTTQReview
{
    public class SubmitUBMTTQReviewCommand : IRequest<SubmitUBMTTQReviewResult>
    {
        public Guid TaskId { get; set; }
        public Guid ReviewerUserId { get; set; }
        public string ReviewContent { get; set; } = string.Empty;
        public bool IsApproved { get; set; }
    }

    public class SubmitUBMTTQReviewResult
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
    }

    public class SubmitUBMTTQReviewCommandHandler
        : IRequestHandler<SubmitUBMTTQReviewCommand, SubmitUBMTTQReviewResult>
    {
        private readonly IApplicationDbContext _context;

        public SubmitUBMTTQReviewCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<SubmitUBMTTQReviewResult> Handle(
            SubmitUBMTTQReviewCommand request, CancellationToken cancellationToken)
        {
            var task = await _context.TaskItems
                .FirstOrDefaultAsync(t => t.Id == request.TaskId && !t.IsDeleted, cancellationToken);

            if (task == null)
                return new SubmitUBMTTQReviewResult { Success = false, Message = "Không tìm thấy công việc." };

            // Chỉ áp dụng cho TaskType.Project
            if (task.Type != TaskType.Project)
                return new SubmitUBMTTQReviewResult
                {
                    Success = false,
                    Message = "Phản biện UBMTTQ chỉ áp dụng cho công việc loại Dự án / Nghị quyết trọng điểm."
                };

            // Chỉ xử lý khi task đang ở PendingUBMTTQReview
            if (task.Status != TaskStatusEnum.PendingUBMTTQReview)
                return new SubmitUBMTTQReviewResult
                {
                    Success = false,
                    Message = $"Công việc hiện ở trạng thái \"{task.Status}\", không phải \"Chờ phản biện UBMTTQ\"."
                };

            var reviewer = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == request.ReviewerUserId && !u.IsDeleted, cancellationToken);

            if (reviewer == null)
                return new SubmitUBMTTQReviewResult { Success = false, Message = "Người phản biện không hợp lệ." };

            if (request.IsApproved)
            {
                // Phản biện đồng ý → chuyển sang InReview (chờ lãnh đạo duyệt cuối)
                task.Status = TaskStatusEnum.InReview;
                task.UpdatedAt = DateTime.UtcNow;

                // Ghi comment phản biện
                _context.TaskComments.Add(new TaskComment
                {
                    TaskItemId = task.Id,
                    UserId = request.ReviewerUserId,
                    Content = $"[Phản biện UBMTTQ — ĐÃ PHÊ DUYỆT]\n{request.ReviewContent}"
                });

                // Ghi Activity Log
                _context.ActivityLogs.Add(new Domain.Entities.ActivityLog
                {
                    UserId = request.ReviewerUserId,
                    ActionType = "ubmttq_review_approved",
                    TargetEntityType = "TaskItem",
                    TargetEntityId = task.Id.ToString(),
                    Summary = $"{reviewer.FullName} phê duyệt phản biện UBMTTQ cho \"{task.Title}\""
                });
            }
            else
            {
                // Phản biện không đồng ý → trả task về Todo kèm lý do
                task.Status = TaskStatusEnum.Todo;
                task.RejectionReason = $"Phản biện UBMTTQ yêu cầu chỉnh sửa: {request.ReviewContent}";
                task.UpdatedAt = DateTime.UtcNow;

                // Ghi comment phản biện
                _context.TaskComments.Add(new TaskComment
                {
                    TaskItemId = task.Id,
                    UserId = request.ReviewerUserId,
                    Content = $"[Phản biện UBMTTQ — YÊU CẦU CHỈNH SỬA]\n{request.ReviewContent}"
                });

                // Ghi Activity Log
                _context.ActivityLogs.Add(new Domain.Entities.ActivityLog
                {
                    UserId = request.ReviewerUserId,
                    ActionType = "ubmttq_review_rejected",
                    TargetEntityType = "TaskItem",
                    TargetEntityId = task.Id.ToString(),
                    Summary = $"{reviewer.FullName} yêu cầu chỉnh sửa phản biện UBMTTQ cho \"{task.Title}\""
                });
            }

            await _context.SaveChangesAsync(cancellationToken);

            return new SubmitUBMTTQReviewResult
            {
                Success = true,
                Message = request.IsApproved
                    ? "Phản biện UBMTTQ đã phê duyệt. Công việc chuyển sang chờ lãnh đạo duyệt."
                    : "Phản biện UBMTTQ yêu cầu chỉnh sửa. Công việc trả về trạng thái ban đầu."
            };
        }
    }
}
