using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.OutgoingDocuments.DTOs;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Queries.GetOutgoingDocumentsPaginated
{
    public class GetOutgoingDocumentsPaginatedQuery : IRequest<PaginatedResult<OutgoingDocumentDto>>
    {
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 20;
        public string? Search { get; set; }
        public OutgoingDocumentStatusEnum? Status { get; set; }
        public DocumentTypeEnum? DocumentType { get; set; }
        public Guid? CurrentUserId { get; set; }
        public int UserRankLevel { get; set; } = 5; // Default Chuyên viên
    }

    public class GetOutgoingDocumentsPaginatedQueryHandler : IRequestHandler<GetOutgoingDocumentsPaginatedQuery, PaginatedResult<OutgoingDocumentDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetOutgoingDocumentsPaginatedQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<PaginatedResult<OutgoingDocumentDto>> Handle(GetOutgoingDocumentsPaginatedQuery request, CancellationToken cancellationToken)
        {
            var query = _context.OutgoingDocuments.AsQueryable();

            // Phân quyền RBAC theo RankLevel
            // Lãnh đạo UBND/HĐND (RankLevel <= 2.5) được xem toàn bộ. Chuyên viên xem văn bản do mình soạn hoặc được giao.
            if (request.UserRankLevel > 2.5 && request.CurrentUserId.HasValue)
            {
                query = query.Where(o => o.DraftedByUserId == request.CurrentUserId.Value ||
                                         o.SignedByUserId == request.CurrentUserId.Value);
            }

            // Lọc theo từ khóa tìm kiếm (Title, DocumentNumber, RecipientNote)
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var search = request.Search.Trim().ToLower();
                query = query.Where(o => (o.DocumentNumber != null && EF.Functions.Like(o.DocumentNumber.ToLower(), $"%{search}%")) ||
                                         EF.Functions.Like(o.Title.ToLower(), $"%{search}%") ||
                                         (o.RecipientNote != null && EF.Functions.Like(o.RecipientNote.ToLower(), $"%{search}%")));
            }

            // Lọc theo trạng thái
            if (request.Status.HasValue)
            {
                query = query.Where(o => o.Status == request.Status.Value);
            }

            // Lọc theo loại văn bản
            if (request.DocumentType.HasValue)
            {
                query = query.Where(o => o.DocumentType == request.DocumentType.Value);
            }

            int page = request.Page > 0 ? request.Page : 1;
            int pageSize = request.PageSize > 0 ? request.PageSize : 20;
            int totalCount = await query.CountAsync(cancellationToken);

            var rawItems = await query
                .OrderByDescending(o => o.DraftedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            // Fetch user names mapping
            var userIds = rawItems
                .Select(o => o.DraftedByUserId)
                .Union(rawItems.Where(o => o.SignedByUserId.HasValue).Select(o => o.SignedByUserId!.Value))
                .Distinct()
                .ToList();

            var usersMap = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);

            var items = rawItems.Select(o => new OutgoingDocumentDto
            {
                Id = o.Id,
                DocumentNumber = o.DocumentNumber,
                DocumentType = o.DocumentType,
                DocumentTypeName = GetDocumentTypeName(o.DocumentType),
                Title = o.Title,
                Content = o.Content,
                Status = o.Status,
                StatusName = GetStatusName(o.Status),
                DraftedByUserId = o.DraftedByUserId,
                DraftedByUserName = usersMap.TryGetValue(o.DraftedByUserId, out var draftedName) ? draftedName : "Chưa xác định",
                DraftedAt = o.DraftedAt,
                SignedByUserId = o.SignedByUserId,
                SignedByUserName = o.SignedByUserId.HasValue && usersMap.TryGetValue(o.SignedByUserId.Value, out var signedName) ? signedName : null,
                SignedAt = o.SignedAt,
                IssuedDate = o.IssuedDate,
                RecipientNote = o.RecipientNote,
                AttachmentUrl = o.AttachmentUrl,
                RelatedTaskItemId = o.RelatedTaskItemId,
                IsUrgent = o.IsUrgent,
                RejectionReason = o.RejectionReason,
                IsCorrectionDocument = o.IsCorrectionDocument,
                OriginalDocumentId = o.OriginalDocumentId,
                DocumentSequenceNumber = o.DocumentSequenceNumber,
                DocumentSymbol = o.DocumentSymbol,
                RecallReason = o.RecallReason,
                RecalledAt = o.RecalledAt
            }).ToList();

            return new PaginatedResult<OutgoingDocumentDto>(items, totalCount, page, pageSize);
        }

        public static string GetDocumentTypeName(DocumentTypeEnum type) => type switch
        {
            DocumentTypeEnum.QuyetDinh => "Quyết định",
            DocumentTypeEnum.CongVan => "Công văn",
            DocumentTypeEnum.ThongBao => "Thông báo",
            DocumentTypeEnum.BaoCao => "Báo cáo",
            DocumentTypeEnum.KeHoach => "Kế hoạch",
            DocumentTypeEnum.ToTrinh => "Tờ trình",
            DocumentTypeEnum.CongDien => "Công điện",
            _ => type.ToString()
        };

        public static string GetStatusName(OutgoingDocumentStatusEnum status) => status switch
        {
            OutgoingDocumentStatusEnum.Draft => "Nháp (Đang soạn)",
            OutgoingDocumentStatusEnum.PendingSignature => "Chờ ký duyệt",
            OutgoingDocumentStatusEnum.Issued => "Đã ban hành",
            OutgoingDocumentStatusEnum.Sent => "Đã gửi đi",
            OutgoingDocumentStatusEnum.Rejected => "Bị từ chối ký",
            _ => status.ToString()
        };
    }
}
