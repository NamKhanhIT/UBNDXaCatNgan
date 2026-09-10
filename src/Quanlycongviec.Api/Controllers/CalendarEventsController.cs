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

            // Gửi thông báo đến những người tham gia qua INotificationDispatcher (thay vì Broadcast dữ liệu nhạy cảm qua Clients.All)
            if (command.ParticipantUserIds != null && command.ParticipantUserIds.Count > 0)
            {
                // Bugfix 10-09-2026: StartDateTime được lưu ở Kind=Utc, nếu format trực tiếp sẽ in giờ UTC.
                // Convert sang giờ Việt Nam (UTC+7) trước khi hiển thị trong message thông báo.
                var vietnamTz = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time")
                    ?? TimeZoneInfo.CreateCustomTimeZone("VN", TimeSpan.FromHours(7), "Vietnam", "Vietnam");
                var startLocal = TimeZoneInfo.ConvertTimeFromUtc(command.StartDateTime, vietnamTz);
                var endLocal = TimeZoneInfo.ConvertTimeFromUtc(command.EndDateTime, vietnamTz);

                var notifications = command.ParticipantUserIds
                    .Where(uid => uid != command.OrganizerId)
                    .Select(uid => new Notification
                    {
                        Id = Guid.NewGuid(),
                        UserId = uid,
                        Type = NotificationType.EventReminder,
                        Title = $"Lịch mới: {command.Title}",
                        Message = $"Đồng chí có lịch [{command.Title}] diễn ra từ {startLocal:dd-MM-yyyy HH:mm} đến {endLocal:dd-MM-yyyy HH:mm}.",
                        SentAt = DateTime.UtcNow,
                        IsRead = false
                    })
                    .ToList();

                if (notifications.Count > 0)
                {
                    await _notificationDispatcher.DispatchBatchAsync(notifications);
                }
            }

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
