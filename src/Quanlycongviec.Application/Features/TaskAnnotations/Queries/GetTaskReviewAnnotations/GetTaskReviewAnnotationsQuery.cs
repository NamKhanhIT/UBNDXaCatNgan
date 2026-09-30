using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.TaskAnnotations.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.TaskAnnotations.Queries.GetTaskReviewAnnotations
{
    public record GetTaskReviewAnnotationsQuery(Guid TaskItemId, Guid CurrentUserId = default) : IRequest<List<TaskReviewAnnotationDto>>;

    public class GetTaskReviewAnnotationsQueryHandler : IRequestHandler<GetTaskReviewAnnotationsQuery, List<TaskReviewAnnotationDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetTaskReviewAnnotationsQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<TaskReviewAnnotationDto>> Handle(GetTaskReviewAnnotationsQuery request, CancellationToken cancellationToken)
        {
            var access = new Quanlycongviec.Application.Common.Services.WorkflowAccess(_context);
            var actor = await access.ActorAsync(request.CurrentUserId, cancellationToken);
            if (actor == null || !await access.Tasks(actor).AnyAsync(t => t.Id == request.TaskItemId, cancellationToken))
                throw new UnauthorizedAccessException("Không được truy cập chú thích công việc ngoài phạm vi quyền.");
            var annotations = await _context.TaskReviewAnnotations
                .Include(a => a.CreatedByUser)
                .Include(a => a.ResolvedByUser)
                .Where(a => a.TaskItemId == request.TaskItemId && !a.IsDeleted)
                .OrderBy(a => a.CreatedAt)
                .ToListAsync(cancellationToken);

            return annotations.Select(a => new TaskReviewAnnotationDto
            {
                Id = a.Id,
                TaskItemId = a.TaskItemId,
                AnchorText = a.AnchorText,
                StartOffsetHint = a.StartOffsetHint,
                CommentText = a.CommentText,
                Severity = a.Severity,
                SeverityName = GetSeverityLabel(a.Severity),
                CreatedByUserId = a.CreatedByUserId,
                CreatedByUserName = a.CreatedByUser?.FullName ?? "Cán bộ",
                CreatedAt = a.CreatedAt,
                ResolvedStatus = a.ResolvedStatus,
                ResolvedStatusName = a.ResolvedStatus == AnnotationStatusEnum.Resolved ? "Đã sửa xong" : "Chờ sửa",
                ResolvedByUserId = a.ResolvedByUserId,
                ResolvedByUserName = a.ResolvedByUser?.FullName,
                ResolvedAt = a.ResolvedAt
            }).ToList();
        }

        private static string GetSeverityLabel(AnnotationSeverityEnum severity) => severity switch
        {
            AnnotationSeverityEnum.LoiSai => "Lỗi sai",
            AnnotationSeverityEnum.CanChinhSua => "Cần chỉnh sửa",
            AnnotationSeverityEnum.GopY => "Góp ý",
            _ => severity.ToString()
        };
    }
}
