using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;

namespace Quanlycongviec.Application.Features.ReadReceipts.Commands.MarkRead
{
    public class MarkReadReceiptCommand : IRequest<MarkReadReceiptResult>
    {
        public Guid UserId { get; set; }
        public string TargetEntityType { get; set; } = string.Empty; // "Task", "Notification", "InboxDocument"
        public string TargetEntityId { get; set; } = string.Empty;
    }

    public class MarkReadReceiptResult
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
        public bool AlreadyRead { get; set; }
    }

    public class MarkReadReceiptCommandHandler : IRequestHandler<MarkReadReceiptCommand, MarkReadReceiptResult>
    {
        private readonly IApplicationDbContext _context;

        public MarkReadReceiptCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<MarkReadReceiptResult> Handle(MarkReadReceiptCommand request, CancellationToken cancellationToken)
        {
            // Kiểm tra đã đọc chưa (unique constraint)
            var existing = await _context.ReadReceipts
                .FirstOrDefaultAsync(r =>
                    r.UserId == request.UserId &&
                    r.TargetEntityType == request.TargetEntityType &&
                    r.TargetEntityId == request.TargetEntityId,
                    cancellationToken);

            if (existing != null)
            {
                return new MarkReadReceiptResult
                {
                    Success = true,
                    Message = "Đã xác nhận đã xem trước đó.",
                    AlreadyRead = true
                };
            }

            _context.ReadReceipts.Add(new ReadReceipt
            {
                UserId = request.UserId,
                TargetEntityType = request.TargetEntityType,
                TargetEntityId = request.TargetEntityId,
                ReadAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync(cancellationToken);

            return new MarkReadReceiptResult
            {
                Success = true,
                Message = "Đã xác nhận đã xem.",
                AlreadyRead = false
            };
        }
    }
}
