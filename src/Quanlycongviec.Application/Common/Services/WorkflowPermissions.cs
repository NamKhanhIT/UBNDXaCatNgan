using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Common.Services;

public sealed class WorkflowPermissions(IApplicationDbContext db)
{
    public async Task<bool> IsAdminAsync(Guid actorId, CancellationToken ct) =>
        await db.WorkflowPermissions.AnyAsync(p => p.UserId == actorId && !p.IsDeleted && !p.User.IsDeleted && p.CanManageWorkflowPermissions, ct);

    public async Task SetIntakeAsync(Guid actorId, Guid userId, IntakePermissionInput request, CancellationToken ct)
    {
        if (!await IsAdminAsync(actorId, ct)) throw new UnauthorizedAccessException("Chỉ quản trị hệ thống được cấp hoặc thu quyền tiếp nhận/trình.");
        var ops = new WorkflowOperations(db);
        var fingerprint = WorkflowOperations.Fingerprint("SetIntakePermission", new { userId, request });
        if (await ops.ReplayAsync(actorId, request.RequestId, fingerprint, ct) != null) return;
        if (!await db.Users.AnyAsync(u => u.Id == userId && !u.IsDeleted, ct)) throw new ArgumentException("Tài khoản không tồn tại.");
        if (string.IsNullOrWhiteSpace(request.Reason)) throw new ArgumentException("Vui lòng nhập lý do thay đổi quyền.");
        var permission = await db.WorkflowPermissions.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (permission == null)
        {
            if (request.Version.HasValue) throw new WorkflowConflictException("Quyền đã thay đổi. Vui lòng tải lại.");
            permission = new WorkflowPermission { UserId = userId };
            db.WorkflowPermissions.Add(permission);
        }
        else WorkflowOperations.CheckVersion(permission.Version, request.Version);
        permission.CanReceiveDocuments = request.CanReceiveDocuments; permission.IsDeleted = false;
        permission.UpdatedById = actorId; permission.UpdatedAt = DateTime.UtcNow; permission.Version = Guid.NewGuid();
        ops.Audit(actorId, "WorkflowIntakePermission", "User", userId,
            (request.CanReceiveDocuments ? "Cấp" : "Thu") + " quyền tiếp nhận/trình văn bản. " + request.Reason);
        await ops.CommitAsync(actorId, request.RequestId, fingerprint, userId, ct);
    }
}

public sealed class IntakePermissionInput
{
    public Guid RequestId { get; set; }
    public Guid? Version { get; set; }
    public bool CanReceiveDocuments { get; set; }
    public string Reason { get; set; } = string.Empty;
}
