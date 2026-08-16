using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.PushNotifications.Queries.GetVapidPublicKey
{
    public class GetVapidPublicKeyQuery : IRequest<string>
    {
    }

    public class GetVapidPublicKeyQueryHandler : IRequestHandler<GetVapidPublicKeyQuery, string>
    {
        private readonly IWebPushNotificationService _webPushService;

        public GetVapidPublicKeyQueryHandler(IWebPushNotificationService webPushService)
        {
            _webPushService = webPushService;
        }

        public Task<string> Handle(GetVapidPublicKeyQuery request, CancellationToken cancellationToken)
        {
            var key = _webPushService.GetVapidPublicKey();
            return Task.FromResult(key);
        }
    }
}
