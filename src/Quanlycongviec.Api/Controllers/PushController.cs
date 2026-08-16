using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Quanlycongviec.Application.Features.PushNotifications.Commands.SendTestPush;
using Quanlycongviec.Application.Features.PushNotifications.Commands.SubscribePush;
using Quanlycongviec.Application.Features.PushNotifications.Commands.UnsubscribePush;
using Quanlycongviec.Application.Features.PushNotifications.DTOs;
using Quanlycongviec.Application.Features.PushNotifications.Queries.GetMyPushSubscriptions;
using Quanlycongviec.Application.Features.PushNotifications.Queries.GetVapidPublicKey;

namespace Quanlycongviec.Api.Controllers
{
    [ApiController]
    [Route("api/v1/[controller]")]
    public class PushController : ControllerBase
    {
        private readonly IMediator _mediator;

        public PushController(IMediator mediator)
        {
            _mediator = mediator;
        }

        private Guid GetCurrentUserId()
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (Guid.TryParse(userIdStr, out var userId))
            {
                return userId;
            }
            // Fallback user ID for demo / unauthenticated dev environment
            return Guid.Parse("a0000000-0000-0000-0000-000000000001");
        }

        /// <summary>
        /// Lấy VAPID Public Key để cấu hình PushManager phía trình duyệt
        /// </summary>
        [HttpGet("vapid-public-key")]
        [AllowAnonymous]
        public async Task<ActionResult<object>> GetVapidPublicKey()
        {
            var publicKey = await _mediator.Send(new GetVapidPublicKeyQuery());
            return Ok(new { success = true, data = new { publicKey }, publicKey });
        }

        /// <summary>
        /// Đăng ký nhận thông báo đẩy từ thiết bị của cán bộ
        /// </summary>
        [HttpPost("subscribe")]
        public async Task<ActionResult<object>> Subscribe([FromBody] SubscribePushRequest request)
        {
            var userId = GetCurrentUserId();
            var result = await _mediator.Send(new SubscribePushCommand
            {
                UserId = userId,
                Endpoint = request.Endpoint,
                P256dhKey = request.P256dhKey,
                AuthKey = request.AuthKey,
                DeviceLabel = request.DeviceLabel
            });

            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Hủy đăng ký nhận thông báo đẩy trên thiết bị này
        /// </summary>
        [HttpDelete("subscribe")]
        public async Task<ActionResult<object>> Unsubscribe([FromQuery] string? endpoint, [FromQuery] Guid? subscriptionId)
        {
            var userId = GetCurrentUserId();
            var success = await _mediator.Send(new UnsubscribePushCommand
            {
                UserId = userId,
                Endpoint = endpoint,
                SubscriptionId = subscriptionId
            });

            return Ok(new { success = true, data = new { success } });
        }

        /// <summary>
        /// Lấy danh sách các thiết bị đã liên kết nhận thông báo của cán bộ hiện tại
        /// </summary>
        [HttpGet("subscriptions")]
        public async Task<ActionResult<object>> GetMySubscriptions()
        {
            var userId = GetCurrentUserId();
            var result = await _mediator.Send(new GetMyPushSubscriptionsQuery(userId));
            return Ok(new { success = true, data = result });
        }

        /// <summary>
        /// Gửi thông báo thử nghiệm tới thiết bị
        /// </summary>
        [HttpPost("test")]
        public async Task<ActionResult<object>> SendTest([FromBody] SendTestPushRequest? request)
        {
            var userId = GetCurrentUserId();
            var success = await _mediator.Send(new SendTestPushCommand
            {
                UserId = userId,
                Endpoint = request?.Endpoint
            });

            return Ok(new { success = true, data = new { success, message = success ? "Đã gửi thông báo đẩy thử nghiệm thành công." : "Không tìm thấy thiết bị hoạt động để gửi." } });
        }
    }

    public class SubscribePushRequest
    {
        public string Endpoint { get; set; } = string.Empty;
        public string P256dhKey { get; set; } = string.Empty;
        public string AuthKey { get; set; } = string.Empty;
        public string? DeviceLabel { get; set; }
    }

    public class SendTestPushRequest
    {
        public string? Endpoint { get; set; }
    }
}
