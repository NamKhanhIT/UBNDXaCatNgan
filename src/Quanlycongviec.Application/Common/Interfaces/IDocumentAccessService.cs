using System;
using System.Threading;
using System.Threading.Tasks;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface IDocumentAccessService
    {
        Task<bool> CanAccessDocumentAsync(
            Guid userId,
            Guid documentId,
            string targetType,
            CancellationToken cancellationToken = default);

        Task<bool> CanAccessAttachmentAsync(
            Guid userId,
            DocumentAttachment attachment,
            CancellationToken cancellationToken = default);
    }
}
