using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.ReadReceipts.Queries.GetReadReceipts
{
    public class GetReadReceiptsQuery : IRequest<ReadReceiptsResultDto>
    {
        public string TargetEntityType { get; set; } = string.Empty;
        public string TargetEntityId { get; set; } = string.Empty;
    }

    public class ReadReceiptItemDto
    {
        public Guid UserId { get; set; }
        public string UserFullName { get; set; } = string.Empty;
        public DateTime ReadAt { get; set; }
    }

    public class ReadReceiptsResultDto
    {
        public List<ReadReceiptItemDto> Readers { get; set; } = new();
        public int ReadCount { get; set; }
    }

    public class GetReadReceiptsQueryHandler : IRequestHandler<GetReadReceiptsQuery, ReadReceiptsResultDto>
    {
        private readonly IApplicationDbContext _context;

        public GetReadReceiptsQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<ReadReceiptsResultDto> Handle(GetReadReceiptsQuery request, CancellationToken cancellationToken)
        {
            var readers = await _context.ReadReceipts
                .Where(r => r.TargetEntityType == request.TargetEntityType
                    && r.TargetEntityId == request.TargetEntityId)
                .Include(r => r.User)
                .OrderByDescending(r => r.ReadAt)
                .Select(r => new ReadReceiptItemDto
                {
                    UserId = r.UserId,
                    UserFullName = r.User != null ? r.User.FullName : "Không rõ",
                    ReadAt = r.ReadAt
                })
                .ToListAsync(cancellationToken);

            return new ReadReceiptsResultDto
            {
                Readers = readers,
                ReadCount = readers.Count
            };
        }
    }
}
