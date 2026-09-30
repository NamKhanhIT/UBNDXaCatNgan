using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Services;
using Quanlycongviec.Application.Features.Tasks.Queries.GetTaskDetail;

namespace Quanlycongviec.Api.Controllers;

public partial class TasksController
{
    [HttpPost("{id:guid}/submissions")]
    public Task<IActionResult> Submit(Guid id, [FromBody] UpdateTaskStatusRequest request)
    {
        request.Status = "InReview";
        return UpdateStatus(id, request);
    }

    [HttpPost("{id:guid}/submissions/{submissionId:guid}/review")]
    public Task<IActionResult> Review(Guid id, Guid submissionId, [FromBody] UpdateTaskStatusRequest request)
    {
        if (request.Status != "Completed" && request.Status != "InProgress")
            throw new ArgumentException("Vui lòng chọn nghiệm thu hoặc yêu cầu chỉnh sửa.");
        request.SubmissionId = submissionId;
        return UpdateStatus(id, request);
    }

    [HttpPatch("{id:guid}/details")]
    public async Task<IActionResult> Amend(Guid id, [FromBody] TaskAmendment request,
        [FromServices] ITaskAuthorizationService authorization, [FromServices] INotificationDispatcher notifications, CancellationToken ct)
    {
        await new TaskExecutionWorkflow(_context, authorization, notifications).AmendAsync(id, CurrentUserId, request, ct);
        return Ok(new { success = true, data = await _mediator.Send(new GetTaskDetailQuery(id, CurrentUserId), ct) });
    }
}
