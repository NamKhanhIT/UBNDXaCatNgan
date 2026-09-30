using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Services;

namespace Quanlycongviec.Api.Controllers;

[ApiController, Authorize, Route("api/v1/Documents")]
public sealed class DocumentWorkspaceController(IApplicationDbContext db, INotificationDispatcher notifications) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] DocumentWorkspaceQuery query, CancellationToken ct) =>
        Ok(new { success = true, data = await new DocumentWorkspace(db).ListAsync(User.GetUserId(), query, ct) });

    [HttpGet("pending")]
    public async Task<IActionResult> Pending(CancellationToken ct) =>
        Ok(new { success = true, data = await new DocumentWorkspace(db).PendingAsync(User.GetUserId(), ct) });

    [HttpGet("{kind}/{id:guid}")]
    public async Task<IActionResult> Detail(string kind, Guid id, CancellationToken ct)
    {
        var result = await new DocumentWorkspace(db).DetailAsync(User.GetUserId(), kind, id, ct);
        return result == null ? NotFound(new { success = false, error = "Không tìm thấy văn bản trong phạm vi quyền của bạn." })
            : Ok(new { success = true, data = result });
    }

    [HttpPost("{id:guid}/presentations")]
    public async Task<IActionResult> Present(Guid id, [FromBody] PresentDocumentInput request, CancellationToken ct)
    {
        await new DocumentWorkflow(db, notifications).PresentAsync(User.GetUserId(), id, request, ct);
        return Ok(new { success = true, data = await new DocumentWorkspace(db).DetailAsync(User.GetUserId(), "Inbox", id, ct) });
    }

    [HttpPost("{id:guid}/decision")]
    public async Task<IActionResult> Decide(Guid id, [FromBody] DocumentDecisionInput request, CancellationToken ct)
    {
        await new DocumentWorkflow(db, notifications).DecideAsync(User.GetUserId(), id, request, ct);
        return Ok(new { success = true, data = await new DocumentWorkspace(db).DetailAsync(User.GetUserId(), "Inbox", id, ct) });
    }
}
