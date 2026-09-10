using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Infrastructure.Services
{
    public sealed class DocumentAccessService : IDocumentAccessService
    {
        private readonly IApplicationDbContext _context;
        private readonly ITaskAuthorizationService _taskAuthorization;

        public DocumentAccessService(
            IApplicationDbContext context,
            ITaskAuthorizationService taskAuthorization)
        {
            _context = context;
            _taskAuthorization = taskAuthorization;
        }

        public async Task<bool> CanAccessDocumentAsync(
            Guid userId,
            Guid documentId,
            string targetType,
            CancellationToken cancellationToken = default)
        {
            if (userId == Guid.Empty || documentId == Guid.Empty) return false;

            var user = await _context.Users
                .Where(u => u.Id == userId && !u.IsDeleted)
                .Select(u => new
                {
                    u.Id,
                    u.PrimaryDepartmentId,
                    Rank = u.UserRoles
                        .Where(ur => !ur.IsDeleted && ur.Role != null)
                        .Select(ur => (int?)ur.Role.RankLevel)
                        .Min() ?? 5
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (user == null) return false;
            if (user.Rank <= 2) return true;

            if (string.Equals(targetType, "Task", StringComparison.OrdinalIgnoreCase))
            {
                return await _taskAuthorization.CanAccessTaskAsync(userId, documentId, cancellationToken);
            }

            if (string.Equals(targetType, "Inbox", StringComparison.OrdinalIgnoreCase))
            {
                var document = await _context.InboxDocuments
                    .Where(d => d.Id == documentId && !d.IsDeleted)
                    .Select(d => new { d.ScheduledTaskId })
                    .FirstOrDefaultAsync(cancellationToken);

                if (document == null) return false;
                if (document.ScheduledTaskId.HasValue)
                {
                    return await _taskAuthorization.CanAccessTaskAsync(
                        userId, document.ScheduledTaskId.Value, cancellationToken);
                }

                return await _context.DocumentAttachments
                    .AnyAsync(a => a.DocumentId == documentId
                                   && a.TargetType == "Inbox"
                                   && a.UploadedByUserId == userId
                                   && !a.IsDeleted,
                        cancellationToken)
                    || await _context.InboxDocuments.AnyAsync(d =>
                        d.Id == documentId
                        && d.ReceivedByUserId == userId
                        && !d.IsDeleted,
                        cancellationToken);
            }

            if (string.Equals(targetType, "Outgoing", StringComparison.OrdinalIgnoreCase))
            {
                var document = await _context.OutgoingDocuments
                    .Where(d => d.Id == documentId && !d.IsDeleted)
                    .Select(d => new
                    {
                        d.DraftedByUserId,
                        d.SignedByUserId,
                        d.RelatedTaskItemId
                    })
                    .FirstOrDefaultAsync(cancellationToken);

                if (document == null) return false;
                if (document.DraftedByUserId == userId || document.SignedByUserId == userId)
                    return true;

                return document.RelatedTaskItemId.HasValue
                    && await _taskAuthorization.CanAccessTaskAsync(
                        userId, document.RelatedTaskItemId.Value, cancellationToken);
            }

            return false;
        }

        public async Task<bool> CanAccessAttachmentAsync(
            Guid userId,
            DocumentAttachment attachment,
            CancellationToken cancellationToken = default)
        {
            if (attachment == null || attachment.IsDeleted || userId == Guid.Empty)
                return false;

            if (attachment.UploadedByUserId == userId)
                return true;

            return await CanAccessDocumentAsync(
                userId,
                attachment.DocumentId,
                attachment.TargetType,
                cancellationToken);
        }
    }
}
