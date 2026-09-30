using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.SubTasks.Commands.CreateSubTask;
using Quanlycongviec.Application.Features.SubTasks.Commands.ToggleSubTask;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Services;

public sealed class TaskChecklistWorkflow(IApplicationDbContext db)
{
    private async Task<TaskItem> WritableAsync(Guid userId, Guid taskId, Guid? version, CancellationToken ct)
    {
        var access = new WorkflowAccess(db);
        if (!await access.CanWriteDocumentAsync(userId, taskId, "Task", ct))
            throw new UnauthorizedAccessException("Chỉ người thực hiện được sửa checklist trước khi nộp.");
        var task = await db.TaskItems.Include(t => t.SubTasks).FirstAsync(t => t.Id == taskId && !t.IsDeleted, ct);
        WorkflowOperations.CheckVersion(task.Version, version);
        return task;
    }

    private static void Changed(TaskItem task)
    {
        var items = task.SubTasks.Where(s => !s.IsDeleted).ToList();
        task.ProgressPercentage = items.Count == 0 ? 0 : (int)Math.Round(100.0 * items.Count(s => s.IsCompleted) / items.Count);
        task.Version = Guid.NewGuid(); task.UpdatedAt = DateTime.UtcNow;
        // Checklist progress never changes task status or awards acceptance/KPI.
    }

    public async Task<Guid> CreateAsync(CreateSubTaskCommand request, CancellationToken ct)
    {
        var ops = new WorkflowOperations(db);
        var fingerprint = WorkflowOperations.Fingerprint("CreateChecklist", request);
        var replay = await ops.ReplayAsync(request.CurrentUserId, request.RequestId, fingerprint, ct);
        if (replay.HasValue) return replay.Value;
        var task = await WritableAsync(request.CurrentUserId, request.TaskItemId, request.Version, ct);
        if (string.IsNullOrWhiteSpace(request.Title)) throw new ArgumentException("Vui lòng nhập nội dung checklist.");
        var item = new SubTask { TaskItemId = task.Id, Title = request.Title.Trim() };
        task.SubTasks.Add(item); db.SubTasks.Add(item); Changed(task);
        ops.Audit(request.CurrentUserId, "ChecklistAdded", "TaskItem", task.Id, "Thêm checklist: " + item.Title);
        return await ops.CommitAsync(request.CurrentUserId, request.RequestId, fingerprint, item.Id, ct);
    }

    public async Task<bool> SetAsync(ToggleSubTaskCommand request, CancellationToken ct)
    {
        var ops = new WorkflowOperations(db);
        var fingerprint = WorkflowOperations.Fingerprint("SetChecklist", request);
        if (await ops.ReplayAsync(request.CurrentUserId, request.RequestId, fingerprint, ct) != null) return true;
        var item = await db.SubTasks.FirstOrDefaultAsync(s => s.Id == request.SubTaskId && !s.IsDeleted, ct);
        if (item == null || (request.TaskItemId.HasValue && item.TaskItemId != request.TaskItemId)) return false;
        if (!request.IsCompleted.HasValue) throw new ArgumentException("Vui lòng gửi trạng thái checklist cần lưu.");
        var task = await WritableAsync(request.CurrentUserId, item.TaskItemId, request.Version, ct);
        item.IsCompleted = request.IsCompleted.Value; item.UpdatedAt = DateTime.UtcNow; Changed(task);
        ops.Audit(request.CurrentUserId, "ChecklistUpdated", "TaskItem", task.Id,
            (item.IsCompleted ? "Đã đánh dấu: " : "Bỏ đánh dấu: ") + item.Title);
        await ops.CommitAsync(request.CurrentUserId, request.RequestId, fingerprint, item.Id, ct);
        return true;
    }
}
