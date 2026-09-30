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
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    [Authorize]
    public class CalendarEventsController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly INotificationDispatcher _notificationDispatcher;

        public CalendarEventsController(
            IMediator mediator,
            INotificationDispatcher notificationDispatcher)
        {
            _mediator = mediator;
            _notificationDispatcher = notificationDispatcher;
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
                CurrentUserId = GetCurrentUserId(),
                From = from,
                To = to,
                DepartmentId = departmentId,
                UserId = userId
            };
            var result = await _mediator.Send(query);
            return Ok(new { success = true, data = result });
        }

        [HttpPost]
        public async Task<ActionResult<Guid>> Create([FromBody] CreateCalendarEventCommand command)
        {
            command.OrganizerId = GetCurrentUserId();
            var id = await _mediator.Send(command);
            return Ok(new { success = true, data = id });
        }

        [HttpGet("{id:guid}")]
        public async Task<IActionResult> Detail(Guid id)
        {
            var items = await _mediator.Send(new GetCalendarEventsQuery { CurrentUserId = GetCurrentUserId(), EventId = id });
            var result = items.SingleOrDefault();
            return result == null ? NotFound(new { success = false, error = "Không tìm thấy lịch trong phạm vi quyền." })
                : Ok(new { success = true, data = result });
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
            return Ok(new { success = true, data = true });
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<bool>> Delete(Guid id, [FromBody] DeleteCalendarEventCommand input)
        {
            var command = new DeleteCalendarEventCommand
            {
                Id = id,
                UserId = GetCurrentUserId(), RequestId = input.RequestId, Version = input.Version
            };

            var success = await _mediator.Send(command);
            if (!success) return NotFound();
            return Ok(new { success = true, data = true });
        }
    }
}
