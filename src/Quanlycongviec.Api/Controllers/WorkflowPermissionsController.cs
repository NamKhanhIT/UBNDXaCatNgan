using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Services;

namespace Quanlycongviec.Api.Controllers;

[ApiController, Authorize, Route("api/v1/WorkflowPermissions")]
public sealed class WorkflowPermissionsController(IApplicationDbContext db) : ControllerBase
{
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var actor = await new WorkflowAccess(db).ActorAsync(User.GetUserId(), ct) ?? throw new UnauthorizedAccessException();
        var permission = await db.WorkflowPermissions.AsNoTracking().FirstOrDefaultAsync(p => p.UserId == actor.Id && !p.IsDeleted, ct);
        return Ok(new { success = true, data = new { canAssign = actor.Rank <= 4, canReceiveDocuments = permission?.CanReceiveDocuments ?? false,
            canManageWorkflowPermissions = permission?.CanManageWorkflowPermissions ?? false,
            canViewDepartment = actor.Rank <= 4, canViewOrganization = actor.Rank <= 2 } });
    }

    [HttpGet("people")]
    public async Task<IActionResult> People([FromQuery] string purpose = "assignee", [FromQuery] Guid? assigneeId = null, CancellationToken ct = default)
    {
        var access = new WorkflowAccess(db);
        var actor = await access.ActorAsync(User.GetUserId(), ct) ?? throw new UnauthorizedAccessException();
        var assignee = assigneeId.HasValue ? await access.ActorAsync(assigneeId.Value, ct) : null;
        var users = await db.Users.AsNoTracking().Where(u => !u.IsDeleted)
            .Select(u => new { u.Id, u.FullName, u.PrimaryDepartmentId, DepartmentName = u.PrimaryDepartment != null ? u.PrimaryDepartment.Name : null,
                RoleCode = u.ActiveRoleCode, Rank = u.UserRoles.Where(r => !r.IsDeleted && !r.Role.IsDeleted).Select(r => (int?)r.Role.RankLevel).Min() ?? 5 })
            .OrderBy(u => u.FullName).ToListAsync(ct);
        var eligible = users.Where(u =>
        {
            var person = new WorkflowActor(u.Id, u.Rank, u.PrimaryDepartmentId, u.RoleCode);
            return purpose switch
            {
                "presentation" => DocumentWorkflow.EligibleRecipient(actor, person),
                "reviewer" => assignee != null && WorkflowAccess.CanAssign(actor, assignee) && WorkflowAccess.CanAssign(person, assignee),
                "assignee" => WorkflowAccess.CanAssign(actor, person),
                "calendar" => CalendarWorkflow.CanInvite(actor, person),
                _ => false
            };
        }).Select(u => new { id = u.Id, fullName = u.FullName, departmentId = u.PrimaryDepartmentId, departmentName = u.DepartmentName, roleCode = u.RoleCode });
        return Ok(new { success = true, data = eligible });
    }

    [HttpGet("intake")]
    public async Task<IActionResult> Intake([FromQuery] string? search = null, [FromQuery] int page = 1, CancellationToken ct = default)
    {
        if (!await new WorkflowPermissions(db).IsAdminAsync(User.GetUserId(), ct)) return Forbid();
        var query = db.Users.AsNoTracking().Where(u => !u.IsDeleted);
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(u => u.FullName.ToLower().Contains(search.ToLower()));
        var total = await query.CountAsync(ct);
        var items = await query.OrderBy(u => u.FullName).ThenBy(u => u.Id).Skip((Math.Max(1, page) - 1) * 25).Take(25)
            .Select(u => new { id = u.Id, fullName = u.FullName,
                canReceiveDocuments = db.WorkflowPermissions.Any(p => p.UserId == u.Id && !p.IsDeleted && p.CanReceiveDocuments),
                version = db.WorkflowPermissions.Where(p => p.UserId == u.Id).Select(p => (Guid?)p.Version).FirstOrDefault() }).ToListAsync(ct);
        return Ok(new { success = true, data = new { items, totalCount = total, page, pageSize = 25 } });
    }

    [HttpPut("intake/{userId:guid}")]
    public async Task<IActionResult> SetIntake(Guid userId, [FromBody] IntakePermissionInput request, CancellationToken ct)
    {
        await new WorkflowPermissions(db).SetIntakeAsync(User.GetUserId(), userId, request, ct);
        return Ok(new { success = true });
    }

    [HttpGet("intake/history")]
    public async Task<IActionResult> History(CancellationToken ct)
    {
        if (!await new WorkflowPermissions(db).IsAdminAsync(User.GetUserId(), ct)) return Forbid();
        var items = await db.AuditLogs.AsNoTracking().Where(a => a.Action == "WorkflowIntakePermission")
            .OrderByDescending(a => a.CreatedAt).Take(100).Select(a => new { a.Id, a.UserId, a.EntityId, a.Details, a.CreatedAt }).ToListAsync(ct);
        return Ok(new { success = true, data = items });
    }
}
