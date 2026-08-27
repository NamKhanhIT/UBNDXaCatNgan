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
        private readonly Quanlycongviec.Application.Common.Interfaces.IRealtimePublisherService _realtimePublisher;

        public CalendarEventsController(
            IMediator mediator,
            Quanlycongviec.Application.Common.Interfaces.IRealtimePublisherService realtimePublisher)
        {
            _mediator = mediator;
            _realtimePublisher = realtimePublisher;
        }

        // BẢO MẬT (Audit X1 + L3): dùng extension dùng chung — bỏ fallback GUID admin cứng
        private Guid GetCurrentUserId() => User.GetUserId();

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

            // Phát sự kiện CalendarEventCreated
            await _realtimePublisher.BroadcastAsync("CalendarEventCreated", new
            {
                id,
                title = command.Title,
                startDateTime = command.StartDateTime,
                endDateTime = command.EndDateTime,
                eventType = command.EventType.ToString(),
                departmentId = command.DepartmentId,
                organizerId = command.OrganizerId
            });

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
