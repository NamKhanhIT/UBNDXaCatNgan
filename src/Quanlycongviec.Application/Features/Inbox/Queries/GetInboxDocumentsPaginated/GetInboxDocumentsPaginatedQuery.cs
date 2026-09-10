using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Inbox.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocumentsPaginated
{
    public class GetInboxDocumentsPaginatedQuery : IRequest<PaginatedResult<InboxDocumentDto>>
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 25;
        public Guid? CurrentUserId { get; set; }
        public int? UserRankLevel { get; set; }
        public bool? IsScheduled { get; set; }
        public string? Channel { get; set; }
        public string? Search { get; set; }
        public bool? IsUrgent { get; set; }
        public string? Category { get; set; }
        public string? AiProcessingStatus { get; set; }
    }

    public class GetInboxDocumentsPaginatedQueryHandler
        : IRequestHandler<GetInboxDocumentsPaginatedQuery, PaginatedResult<InboxDocumentDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetInboxDocumentsPaginatedQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<PaginatedResult<InboxDocumentDto>> Handle(
            GetInboxDocumentsPaginatedQuery request,
            CancellationToken cancellationToken)
        {
            var page = Math.Max(1, request.Page);
            var pageSize = Math.Clamp(request.PageSize, 1, 100);

            if (!request.CurrentUserId.HasValue
                || request.CurrentUserId.Value == Guid.Empty
                || !request.UserRankLevel.HasValue)
            {
                return new PaginatedResult<InboxDocumentDto>(
                    new System.Collections.Generic.List<InboxDocumentDto>(), 0, page, pageSize);
            }

            var query = _context.InboxDocuments
                .AsNoTracking()
                .Where(d => !d.IsDeleted);

            if (request.UserRankLevel.Value >= 5)
            {
                query = query.Where(d =>
                    d.AiReviewedByUserId == request.CurrentUserId.Value
                    || _context.DocumentAttachments.Any(a =>
                        a.DocumentId == d.Id
                        && a.TargetType == "Inbox"
                        && a.UploadedByUserId == request.CurrentUserId.Value
                        && !a.IsDeleted)
                    || (d.ScheduledTaskId.HasValue && _context.TaskItems.Any(t =>
                        t.Id == d.ScheduledTaskId.Value
                        && !t.IsDeleted
                        && (t.AssigneeId == request.CurrentUserId.Value || t.AssignerId == request.CurrentUserId.Value))));
            }
            else if (request.UserRankLevel.Value is 3 or 4)
            {
                var callerDepartmentId = await _context.Users
                    .Where(u => u.Id == request.CurrentUserId.Value && !u.IsDeleted)
                    .Select(u => u.PrimaryDepartmentId)
                    .FirstOrDefaultAsync(cancellationToken);

                query = query.Where(d =>
                    d.AiReviewedByUserId == request.CurrentUserId.Value
                    || d.AiSuggestedDepartmentId == callerDepartmentId
                    || _context.DocumentAttachments.Any(a =>
                        a.DocumentId == d.Id
                        && a.TargetType == "Inbox"
                        && a.UploadedByUserId == request.CurrentUserId.Value
                        && !a.IsDeleted)
                    || (callerDepartmentId.HasValue && d.ScheduledTaskId.HasValue
                        && _context.TaskItems.Any(t =>
                            t.Id == d.ScheduledTaskId.Value
                            && !t.IsDeleted
                            && t.DepartmentId == callerDepartmentId.Value)));
            }

            // Filter: IsScheduled (tab "Đến — Chưa xử lý" vs "Đã xếp lịch")
            if (request.IsScheduled.HasValue)
            {
                query = query.Where(d => d.IsScheduled == request.IsScheduled.Value);
            }

            // Filter: Channel (Internal / PublicService)
            if (!string.IsNullOrWhiteSpace(request.Channel))
            {
                if (Enum.TryParse<InboxChannel>(request.Channel, true, out var channelEnum))
                {
                    query = query.Where(d => d.Channel == channelEnum);
                }
            }

            // Filter: IsUrgent
            if (request.IsUrgent.HasValue)
            {
                query = query.Where(d => d.IsUrgent == request.IsUrgent.Value);
            }

            // Filter: Category
            if (!string.IsNullOrWhiteSpace(request.Category) && request.Category != "all")
            {
                var cat = request.Category.Trim();
                query = query.Where(d => d.Category == cat || d.AiCategory == cat);
            }

            // Filter: AiProcessingStatus
            if (!string.IsNullOrWhiteSpace(request.AiProcessingStatus) && request.AiProcessingStatus != "all")
            {
                var status = request.AiProcessingStatus.Trim();
                query = query.Where(d => d.AiProcessingStatus == status);
            }

            // Filter: Search (documentNumber, documentSymbol, subject, sender, issuingAgency)
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var q = request.Search.Trim().ToLower();
                query = query.Where(d =>
                    d.DocumentNumber.ToLower().Contains(q) ||
                    (d.DocumentSymbol != null && d.DocumentSymbol.ToLower().Contains(q)) ||
                    (d.IssuingAgency != null && d.IssuingAgency.ToLower().Contains(q)) ||
                    d.Subject.ToLower().Contains(q) ||
                    d.Sender.ToLower().Contains(q));
            }

            // Default sort: urgent first, then by received date descending
            query = query
                .OrderByDescending(d => d.IsUrgent)
                .ThenByDescending(d => d.ReceivedDate)
                .ThenByDescending(d => d.Id);

            // Count total before pagination
            var totalCount = await query.CountAsync(cancellationToken);

            // Paginate
            var docs = await query
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(d => new InboxDocumentDto
                {
                    Id = d.Id,
                    DocumentNumber = d.DocumentNumber,
                    Subject = d.Subject,
                    Category = d.Category,
                    Sender = d.Sender,
                    ReceivedDate = d.ReceivedDate,
                    // BẢO MẬT (Audit 04-09-2026): ReceivedByUserId là metadata hành chính nội bộ
                    // — KHÔNG phơi ra list API; chỉ cung cấp ở detail endpoint.
                    ReceivedByUserId = null,
                    AiCategory = d.AiCategory,
                    AiTitle = d.AiTitle,
                    AiSummary = d.AiSummary,
                    AiExtractedDeadline = d.AiExtractedDeadline,
                    AiObjectives = d.AiObjectives,
                    AiSuggestedDepartmentId = d.AiSuggestedDepartmentId,
                    AiConfidenceScore = d.AiConfidenceScore,
                    AiEventStartDateTime = d.AiEventStartDateTime,
                    AiEventEndDateTime = d.AiEventEndDateTime,
                    AiReviewedByUserId = d.AiReviewedByUserId,
                    AiReviewedAt = d.AiReviewedAt,
                    AiProcessingStatus = d.AiProcessingStatus,
                    IsUrgent = d.IsUrgent,
                    Channel = d.Channel.ToString(),
                    // BẢO MẬT (Audit 04-09-2026): CitizenName / CitizenPhone là PII công dân
                    // — KHÔNG phơi ra list API.
                    CitizenName = null,
                    CitizenPhone = null,
                    ServiceCode = d.ServiceCode,
                    IsScheduled = d.IsScheduled,
                    ScheduledDate = d.ScheduledDate,
                    ScheduledShift = d.ScheduledShift,
                    ScheduledTaskId = d.ScheduledTaskId,
                    DocumentSymbol = d.DocumentSymbol,
                    IssuingAgency = d.IssuingAgency,
                    SignerName = d.SignerName,
                    AttachmentUrl = d.AttachmentUrl,
                    IssuedDate = d.IssuedDate
                })
                .ToListAsync(cancellationToken);

            return new PaginatedResult<InboxDocumentDto>(docs, totalCount, page, pageSize);
        }
    }
}
