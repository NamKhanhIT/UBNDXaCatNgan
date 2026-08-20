using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    public class MfaEnableCommandHandler : IRequestHandler<MfaEnableCommand, bool>
    {
        private readonly IApplicationDbContext _context;
        private readonly ITotpService _totpService;

        public MfaEnableCommandHandler(IApplicationDbContext context, ITotpService totpService)
        {
            _context = context;
            _totpService = totpService;
        }

        public async Task<bool> Handle(MfaEnableCommand request, CancellationToken cancellationToken)
        {
            var user = await _context.Users.FindAsync(new object[] { request.UserId }, cancellationToken);
            if (user == null)
            {
                throw new KeyNotFoundException("Không tìm thấy người dùng.");
            }

            if (string.IsNullOrWhiteSpace(request.Secret) || string.IsNullOrWhiteSpace(request.Code))
            {
                throw new InvalidOperationException("Thiếu secret hoặc mã OTP.");
            }

            // Bắt buộc xác minh mã OTP đầu tiên trước khi kích hoạt
            if (!_totpService.Validate(request.Secret, request.Code))
            {
                throw new InvalidOperationException("Mã OTP không hợp lệ. Vui lòng kiểm tra lại đồng hồ thiết bị và thử lại.");
            }

            user.MfaSecret = request.Secret.Trim();
            user.MfaEnabled = true;
            await _context.SaveChangesAsync(cancellationToken);

            return true;
        }
    }
}