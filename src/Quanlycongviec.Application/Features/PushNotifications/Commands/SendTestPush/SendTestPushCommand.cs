using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.PushNotifications.Commands.SendTestPush
{
    public class SendTestPushCommand : IRequest<bool>
    {
        public Guid UserId { get; set; }
        public string? Endpoint { get; set; }
    }

    public class SendTestPushCommandHandler : IRequestHandler<SendTestPushCommand, bool>
    {
        private readonly IWebPushNotificationService _webPushService;

        public SendTestPushCommandHandler(IWebPushNotificationService webPushService)
        {
            _webPushService = webPushService;
        }

        public async Task<bool> Handle(SendTestPushCommand request, CancellationToken cancellationToken)
        {
            if (!string.IsNullOrWhiteSpace(request.Endpoint))
            {
                return await _webPushService.SendTestNotificationAsync(request.UserId, request.Endpoint, cancellationToken);
            }

            return await _webPushService.SendNotificationAsync(
                request.UserId,
                "UBND Xã Cát Ngạn - Thông Báo Thử Nghiệm",
                $"Thông báo đẩy Web Push đang hoạt động tốt trên các thiết bị đã liên kết của bạn lúc {DateTime.Now:HH:mm:ss dd/MM/yyyy}!",
                "/",
                null,
                cancellationToken);
        }
    }
}
