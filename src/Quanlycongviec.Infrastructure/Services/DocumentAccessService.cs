using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Services;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Infrastructure.Services;

public sealed class DocumentAccessService(IApplicationDbContext db, ITaskAuthorizationService taskAuthorization) : IDocumentAccessService
{
    public async Task<bool> CanAccessDocumentAsync(Guid userId, Guid documentId, string targetType, CancellationToken cancellationToken = default)
    {
        var access = new WorkflowAccess(db);
        var actor = await access.ActorAsync(userId, cancellationToken);
        if (actor == null || documentId == Guid.Empty) return false;
        return targetType.ToLowerInvariant() switch
        {
            "task" => await taskAuthorization.CanAccessTaskAsync(userId, documentId, cancellationToken),
            "inbox" => await access.Inbox(actor).AnyAsync(d => d.Id == documentId, cancellationToken),
            "outgoing" => await access.Outgoing(actor).AnyAsync(d => d.Id == documentId, cancellationToken),
            _ => false
        };
    }

    public Task<bool> CanAccessAttachmentAsync(Guid userId, DocumentAttachment attachment, CancellationToken cancellationToken = default) =>
        attachment == null || attachment.IsDeleted ? Task.FromResult(false)
            : CanAccessDocumentAsync(userId, attachment.DocumentId, attachment.TargetType, cancellationToken);
}