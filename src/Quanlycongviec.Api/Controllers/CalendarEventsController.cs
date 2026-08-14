using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.CalendarEvents.Commands.CreateCalendarEvent;
using Quanlycongviec.Application.Features.CalendarEvents.Commands.DeleteCalendarEvent;
using Quanlycongviec.Application.Features.CalendarEvents.Commands.UpdateCalendarEvent;
using Quanlycongviec.Application.Features.CalendarEvents.DTOs;
using Quanlycongviec.Application.Features.CalendarEvents.Queries.GetCalendarEvents;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class CalendarEventsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public CalendarEventsController(IMediator mediator)
        {
            _mediator = mediator;
        }

        private Guid GetCurrentUserId()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub")?.Value;
            if (Guid.TryParse(userIdStr, out var userId))
            {
                return userId;
            }
            return Guid.Parse("11111111-1111-1111-1111-111111111111");
        }

        [HttpGet]
        public async Task<ActionResult<List<CalendarEventDto>>> GetCalendarEvents(
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] Guid? departmentId,
            [FromQuery] Guid? userId)
        {
            var query = new GetCalendarEventsQuery
            {
                From = from,
                To = to,
                DepartmentId = departmentId,
                UserId = userId
            };
            var result = await _mediator.Send(query);
            return Ok(result);
        }

        [HttpPost]
        public async Task<ActionResult<Guid>> Create([FromBody] CreateCalendarEventCommand command)
        {
            if (command.OrganizerId == Guid.Empty)
            {
                command.OrganizerId = GetCurrentUserId();
            }

            var id = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetCalendarEvents), new { id }, id);
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<bool>> Update(Guid id, [FromBody] UpdateCalendarEventCommand command)
        {
            if (id != command.Id)
            {
                command.Id = id;
            }
            command.UserId = GetCurrentUserId();

            var success = await _mediator.Send(command);
            if (!success) return NotFound();
            return Ok(true);
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<bool>> Delete(Guid id)
        {
            var command = new DeleteCalendarEventCommand
            {
                Id = id,
                UserId = GetCurrentUserId()
            };

            var success = await _mediator.Send(command);
            if (!success) return NotFound();
            return Ok(true);
        }
    }
}
