using System;
using System.Threading;
using System.Threading.Tasks;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Common.Interfaces
{
    public interface ITaskAuthorizationService
    {
        Task<bool> CanAssignTaskAsync(Guid assignerId, Guid assigneeId, Guid? departmentId, CancellationToken cancellationToken = default);
        Task<bool> CanTransferTaskAsync(Guid currentUserId, Guid taskId, Guid targetUserId, CancellationToken cancellationToken = default);
        Task<bool> CanUpdateTaskStatusAsync(Guid currentUserId, Guid taskId, TaskStatusEnum newStatus, CancellationToken cancellationToken = default);
        Task<bool> CanScoreTaskAsync(Guid evaluatorId, Guid taskId, CancellationToken cancellationToken = default);
    }
}
