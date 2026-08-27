using System;
using MediatR;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    // BẢO MẬT (Audit Đợt 3): Yêu cầu gửi mã OTP MFA qua email công vụ (hỗ trợ cả luồng login và settings)
    public class SendMfaEmailCodeCommand : IRequest<SendMfaEmailCodeResult>
    {
        public string? MfaToken { get; set; }

        // SessionUserId gán từ JWT claim bởi controller
        public Guid SessionUserId { get; set; }
    }

    public class SendMfaEmailCodeResult
    {
        // Thời gian chờ gửi lại (giây)
        public int CooldownSeconds { get; set; }

        // Email người nhận đã che (vd: h*****@ubnd.gov.vn)
        public string MaskedEmail { get; set; } = string.Empty;
    }
}