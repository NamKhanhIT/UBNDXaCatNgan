using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.OutgoingDocuments.Queries.GetDocumentVersions
{
    public class GetDocumentVersionsQuery : IRequest<List<DocumentVersionDto>>
    {
        public Guid DocumentId { get; set; }
    }

    public class DocumentVersionDto
    {
        public Guid Id { get; set; }
        public Guid DocumentId { get; set; }
        public int VersionNumber { get; set; }
        public string VersionName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string? DocumentNumber { get; set; }
        public string? DocumentSymbol { get; set; }
        public string? AttachmentUrl { get; set; }
        public string ChangeReason { get; set; } = string.Empty;
        public Guid ChangedByUserId { get; set; }
        public string ChangedByName { get; set; } = string.Empty;
        public DateTime ChangedAt { get; set; }
    }

    public class GetDocumentVersionsQueryHandler : IRequestHandler<GetDocumentVersionsQuery, List<DocumentVersionDto>>
    {
        private readonly IApplicationDbContext _context;

        public GetDocumentVersionsQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<DocumentVersionDto>> Handle(GetDocumentVersionsQuery request, CancellationToken cancellationToken)
        {
            var versions = await _context.DocumentVersions
                .Where(v => v.DocumentId == request.DocumentId && !v.IsDeleted)
                .OrderByDescending(v => v.VersionNumber)
                .ToListAsync(cancellationToken);

            var userIds = versions.Select(v => v.ChangedByUserId).Distinct().ToList();
            var users = await _context.Users
                .Where(u => userIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.FullName, cancellationToken);

            return versions.Select(v => new DocumentVersionDto
            {
                Id = v.Id,
                DocumentId = v.DocumentId,
                VersionNumber = v.VersionNumber,
                VersionName = v.VersionName,
                Title = v.Title,
                Content = v.Content,
                DocumentNumber = v.DocumentNumber,
                DocumentSymbol = v.DocumentSymbol,
                AttachmentUrl = v.AttachmentUrl,
                ChangeReason = v.ChangeReason,
                ChangedByUserId = v.ChangedByUserId,
                ChangedByName = users.TryGetValue(v.ChangedByUserId, out var name) ? name : "Cán bộ hệ thống",
                ChangedAt = v.ChangedAt
            }).ToList();
        }
    }
}
