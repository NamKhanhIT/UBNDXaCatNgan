using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Inbox.Commands.ScheduleDocument
{
    public class ScheduleInboxDocumentCommand : IRequest<Guid>
    {
        public Guid DocumentId { get; set; }
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid? ReviewerId { get; set; }
        public string? Requirements { get; set; }
        public DateTime ScheduledDate { get; set; }
        public string ScheduledShift { get; set; } = "Sang"; // Sang / Chieu / Toi
        public Guid AssignerId { get; set; }
        public Guid AssigneeId { get; set; }

        public ScheduleInboxDocumentCommand(Guid documentId, DateTime scheduledDate, string scheduledShift, Guid assignerId, Guid assigneeId)
        {
            DocumentId = documentId;
            ScheduledDate = scheduledDate;
            ScheduledShift = scheduledShift;
            AssignerId = assignerId;
            AssigneeId = assigneeId;
        }
    }

    public class ScheduleInboxDocumentCommandHandler(IApplicationDbContext context, ITaskAuthorizationService taskAuthorization,
        INotificationDispatcher? notificationDispatcher = null) : IRequestHandler<ScheduleInboxDocumentCommand, Guid>
    {
        public async Task<Guid> Handle(ScheduleInboxDocumentCommand request, CancellationToken ct)
        {
            var doc = await context.InboxDocuments.FirstOrDefaultAsync(d => d.Id == request.DocumentId && !d.IsDeleted, ct)
                ?? throw new ArgumentException("Không tìm thấy văn bản.");
            return await new Quanlycongviec.Application.Common.Services.TaskCreationWorkflow(context, taskAuthorization, notificationDispatcher)
                .CreateAsync(new Quanlycongviec.Application.Features.Tasks.Commands.CreateTask.CreateTaskCommand
                {
                    RequestId = request.RequestId, AssignerId = request.AssignerId, AssigneeId = request.AssigneeId,
                    ReviewerId = request.ReviewerId, Title = doc.Subject, Requirements = request.Requirements,
                    DueDate = request.ScheduledDate, Documents = new() { new() { Id = doc.Id, Kind = "Inbox", Version = request.Version } }
                }, ct);
        }
    }
}