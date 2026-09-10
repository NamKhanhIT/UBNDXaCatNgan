using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Inbox.Commands.CreateInboxDocument
{
    public sealed class CreateInboxDocumentCommand : IRequest<Guid>
    {
        public Guid ReceivedByUserId { get; set; }
        public string DocumentNumber { get; set; } = string.Empty;
        public string? DocumentSymbol { get; set; }
        public string Subject { get; set; } = string.Empty;
        public string Sender { get; set; } = string.Empty;
        public string? IssuingAgency { get; set; }
        public bool IsUrgent { get; set; }
        public InboxChannel Channel { get; set; } = InboxChannel.Internal;
        public DateTime? IssuedDate { get; set; }
    }

    public sealed class CreateInboxDocumentCommandHandler
        : IRequestHandler<CreateInboxDocumentCommand, Guid>
    {
        private readonly IApplicationDbContext _context;

        public CreateInboxDocumentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Guid> Handle(
            CreateInboxDocumentCommand request,
            CancellationToken cancellationToken)
        {
            if (request.ReceivedByUserId == Guid.Empty)
                throw new UnauthorizedAccessException("Invalid authenticated session.");
            if (string.IsNullOrWhiteSpace(request.Subject))
                throw new ArgumentException("Document subject is required.", nameof(request.Subject));
            if (string.IsNullOrWhiteSpace(request.Sender))
                throw new ArgumentException("Document sender is required.", nameof(request.Sender));

            var document = new InboxDocument
            {
                Id = Guid.NewGuid(),
                DocumentNumber = request.DocumentNumber?.Trim() ?? string.Empty,
                DocumentSymbol = string.IsNullOrWhiteSpace(request.DocumentSymbol) ? null : request.DocumentSymbol.Trim(),
                Subject = request.Subject.Trim(),
                Sender = request.Sender.Trim(),
                IssuingAgency = string.IsNullOrWhiteSpace(request.IssuingAgency) ? null : request.IssuingAgency.Trim(),
                IsUrgent = request.IsUrgent,
                Channel = request.Channel,
                IssuedDate = request.IssuedDate,
                ReceivedDate = DateTime.UtcNow,
                ReceivedByUserId = request.ReceivedByUserId,
                AiProcessingStatus = "Pending"
            };

            _context.InboxDocuments.Add(document);
            _context.AuditLogs.Add(new AuditLog
            {
                UserId = request.ReceivedByUserId,
                Action = "CreateInboxDocument",
                EntityName = nameof(InboxDocument),
                EntityId = document.Id.ToString(),
                Details = $"Tiếp nhận văn bản đến [{document.Subject}]"
            });
            await _context.SaveChangesAsync(cancellationToken);
            return document.Id;
        }
    }
}
