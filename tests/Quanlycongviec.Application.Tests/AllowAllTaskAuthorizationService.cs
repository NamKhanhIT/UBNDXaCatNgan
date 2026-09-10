using System;
using System.Threading;
using System.Threading.Tasks;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Tests
{
    // Used only by data-integrity tests that are not testing authorization rules.
    internal sealed class AllowAllTaskAuthorizationService : ITaskAuthorizationService
    {
        public Task<bool> CanAssignTaskAsync(Guid assignerId, Guid assigneeId, Guid? departmentId, CancellationToken cancellationToken = default)
            => Task.FromResult(true);

        public Task<bool> CanTransferTaskAsync(Guid currentUserId, Guid taskId, Guid targetUserId, CancellationToken cancellationToken = default)
            => Task.FromResult(true);

        public Task<bool> CanAccessTaskAsync(Guid currentUserId, Guid taskId, CancellationToken cancellationToken = default)
            => Task.FromResult(true);

        public Task<bool> CanUpdateTaskStatusAsync(Guid currentUserId, Guid taskId, TaskStatusEnum newStatus, CancellationToken cancellationToken = default)
            => Task.FromResult(true);

        public Task<bool> CanScoreTaskAsync(Guid evaluatorId, Guid taskId, CancellationToken cancellationToken = default)
            => Task.FromResult(true);
    }
}
