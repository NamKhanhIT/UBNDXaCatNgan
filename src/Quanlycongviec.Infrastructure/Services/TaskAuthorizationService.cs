using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Services;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Infrastructure.Services;

public sealed class TaskAuthorizationService(IApplicationDbContext db) : ITaskAuthorizationService
{
    private readonly WorkflowAccess access = new(db);

    public async Task<bool> CanAssignTaskAsync(Guid assignerId, Guid assigneeId, Guid? departmentId, CancellationToken cancellationToken = default)
    {
        var assigner = await access.ActorAsync(assignerId, cancellationToken);
        var assignee = await access.ActorAsync(assigneeId, cancellationToken);
        return assigner != null && assignee != null && WorkflowAccess.CanAssign(assigner, assignee, departmentId);
    }

    public async Task<bool> CanAccessTaskAsync(Guid currentUserId, Guid taskId, CancellationToken cancellationToken = default)
    {
        var actor = await access.ActorAsync(currentUserId, cancellationToken);
        return actor != null && await access.Tasks(actor).AnyAsync(t => t.Id == taskId, cancellationToken);
    }

    public async Task<bool> CanTransferTaskAsync(Guid currentUserId, Guid taskId, Guid targetUserId, CancellationToken cancellationToken = default)
    {
        var actor = await access.ActorAsync(currentUserId, cancellationToken);
        var task = await db.TaskItems.FirstOrDefaultAsync(t => t.Id == taskId && !t.IsDeleted, cancellationToken);
        return actor != null && task != null && await access.CanManageTaskAsync(actor, task, cancellationToken)
            && await CanAssignTaskAsync(currentUserId, targetUserId, null, cancellationToken);
    }

    public async Task<bool> CanUpdateTaskStatusAsync(Guid currentUserId, Guid taskId, TaskStatusEnum newStatus, CancellationToken cancellationToken = default)
    {
        var actor = await access.ActorAsync(currentUserId, cancellationToken);
        var task = await db.TaskItems.FirstOrDefaultAsync(t => t.Id == taskId && !t.IsDeleted, cancellationToken);
        if (actor == null || task == null) return false;
        if (task.Status == TaskStatusEnum.Completed || task.Status == TaskStatusEnum.Cancelled || task.Status == newStatus) return false;
        if (newStatus == TaskStatusEnum.Completed && task.Status != TaskStatusEnum.InReview) return false;
        if (newStatus == TaskStatusEnum.Completed || (task.Status == TaskStatusEnum.InReview && newStatus == TaskStatusEnum.InProgress))
            return await access.CanReviewAsync(actor, task, cancellationToken);
        if (newStatus == TaskStatusEnum.Cancelled) return await access.CanManageTaskAsync(actor, task, cancellationToken);
        if (newStatus == TaskStatusEnum.InProgress)
            return task.Status == TaskStatusEnum.Todo && currentUserId == task.AssigneeId;
        if (newStatus == TaskStatusEnum.InReview)
            return task.Status == TaskStatusEnum.InProgress && currentUserId == task.AssigneeId;
        return false;
    }

    public async Task<bool> CanScoreTaskAsync(Guid evaluatorId, Guid taskId, CancellationToken cancellationToken = default)
    {
        var actor = await access.ActorAsync(evaluatorId, cancellationToken);
        var task = await db.TaskItems.FirstOrDefaultAsync(t => t.Id == taskId && !t.IsDeleted, cancellationToken);
        if (actor == null || task == null || actor.Id == task.AssigneeId) return false;
        var assignee = await access.ActorAsync(task.AssigneeId, cancellationToken);
        return assignee != null && WorkflowAccess.CanAssign(actor, assignee);
    }
}
