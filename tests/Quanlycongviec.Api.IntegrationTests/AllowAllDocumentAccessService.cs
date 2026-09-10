using System;
using System.Threading;
using System.Threading.Tasks;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Api.IntegrationTests
{
    // Used only by upload/path-sanitization tests; authorization is tested separately.
    internal sealed class AllowAllDocumentAccessService : IDocumentAccessService
    {
        public Task<bool> CanAccessDocumentAsync(Guid userId, Guid documentId, string targetType, CancellationToken cancellationToken = default)
            => Task.FromResult(true);

        public Task<bool> CanAccessAttachmentAsync(Guid userId, DocumentAttachment attachment, CancellationToken cancellationToken = default)
            => Task.FromResult(true);
    }
}
