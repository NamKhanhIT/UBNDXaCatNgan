using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Notifications.Commands.SendTestSms
{
    public record SendTestSmsCommand(
        Guid UserId,
        string? PhoneNumber = null
    ) : IRequest<SendTestSmsResult>;

    public record SendTestSmsResult(
        bool Success,
        string? Error,
        string? Message,
        string? GatewayStatus
    );

    public class SendTestSmsCommandHandler : IRequestHandler<SendTestSmsCommand, SendTestSmsResult>
    {
        private readonly IApplicationDbContext _context;
        private readonly ISmsNotificationService _smsService;
        private readonly ILogger<SendTestSmsCommandHandler> _logger;

        public SendTestSmsCommandHandler(
            IApplicationDbContext context,
            ISmsNotificationService smsService,
            ILogger<SendTestSmsCommandHandler> logger)
        {
            _context = context;
            _smsService = smsService;
            _logger = logger;
        }

        public async Task<SendTestSmsResult> Handle(SendTestSmsCommand request, CancellationToken cancellationToken)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);
            if (user == null)
            {
                return new SendTestSmsResult(false, "Không tìm thấy thông tin tài khoản người dùng.", null, null);
            }

            string targetPhone = !string.IsNullOrWhiteSpace(request.PhoneNumber)
                ? request.PhoneNumber.Trim()
                : user.ZaloPhoneNumber?.Trim() ?? string.Empty;

            if (string.IsNullOrWhiteSpace(targetPhone))
            {
                return new SendTestSmsResult(false, "Vui lòng cập nhật số điện thoại cá nhân trong hồ sơ trước khi gửi thử nghiệm tin nhắn SMS.", null, null);
            }

            string testMessage = $"[UBND CAP XA] Thu nghiem he thong SMS thong bao cong vu thanh cong cho dong chi {user.FullName}.";
            bool sent = await _smsService.SendSmsAsync(targetPhone, testMessage, cancellationToken);
            string gatewayStatus = _smsService.GetGatewayStatus();

            _logger.LogInformation("Gửi SMS thử nghiệm tới {Phone}: {Sent} ({GatewayStatus})", targetPhone, sent, gatewayStatus);

            return new SendTestSmsResult(
                true,
                null,
                $"Đã phát tin nhắn SMS thử nghiệm thành công tới số '{targetPhone}'!",
                gatewayStatus
            );
        }
    }
}
