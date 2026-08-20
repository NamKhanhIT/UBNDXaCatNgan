using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Auth.Commands.Mfa
{
    public class MfaDisableCommandHandler : IRequestHandler<MfaDisableCommand, bool>
    {
        private readonly IApplicationDbContext _context;
        private readonly ITotpService _totpService;

        public MfaDisableCommandHandler(IApplicationDbContext context, ITotpService totpService)
        {
            _context = context;
            _totpService = totpService;
        }

        public async Task<bool> Handle(MfaDisableCommand request, CancellationToken cancellationToken)
        {
            var user = await _context.Users.FindAsync(new object[] { request.UserId }, cancellationToken);
            if (user == null)
            {
                throw new KeyNotFoundException("Không tìm thấy người dùng.");
            }

            if (!user.MfaEnabled)
            {
                throw new InvalidOperationException("Tài khoản chưa bật xác thực 2 yếu tố.");
            }

            // Yêu cầu mã OTP hiện tại để chứng minh quyền sở hữu tài khoản
            if (!_totpService.Validate(user.MfaSecret ?? string.Empty, request.Code))
            {
                throw new InvalidOperationException("Mã OTP không hợp lệ. Không thể tắt xác thực 2 yếu tố.");
            }

            user.MfaSecret = null;
            user.MfaEnabled = false;
            await _context.SaveChangesAsync(cancellationToken);

            return true;
        }
    }
}