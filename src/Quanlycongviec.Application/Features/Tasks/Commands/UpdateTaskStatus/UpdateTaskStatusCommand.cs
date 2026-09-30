using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Commands.UpdateTaskStatus
{
    public class UpdateTaskStatusCommand : IRequest<bool>
    {
        public Guid TaskId { get; set; }
        public Guid RequestId { get; set; }
        public Guid? Version { get; set; }
        public Guid? SubmissionId { get; set; }
        public List<Guid> AttachmentIds { get; set; } = new();
        public string Status { get; set; } = string.Empty;
        public double? RatingScore { get; set; }
        public double? SystemScore { get; set; }
        public double? EvaluatorScore { get; set; }
        public string? SubmissionNote { get; set; }
        public string? RejectionReason { get; set; }
        public string? ApprovalNote { get; set; }
        public DateTime? NewExtendedDueDate { get; set; }
        public Guid CurrentUserId { get; set; }

        public UpdateTaskStatusCommand() { }

        public UpdateTaskStatusCommand(
            Guid taskId,
            string status,
            Guid currentUserId,
            double? ratingScore = null,
            string? rejectionReason = null,
            DateTime? newExtendedDueDate = null,
            double? systemScore = null,
            double? evaluatorScore = null,
            string? submissionNote = null,
            string? approvalNote = null)
        {
            TaskId = taskId;
            Status = status;
            CurrentUserId = currentUserId;
            RatingScore = ratingScore;
            RejectionReason = rejectionReason;
            NewExtendedDueDate = newExtendedDueDate;
            SystemScore = systemScore;
            EvaluatorScore = evaluatorScore;
            SubmissionNote = submissionNote;
            ApprovalNote = approvalNote;
        }
    }

    public class UpdateTaskStatusCommandHandler : IRequestHandler<UpdateTaskStatusCommand, bool>
    {
        private readonly Quanlycongviec.Application.Common.Services.TaskExecutionWorkflow _workflow;
        public UpdateTaskStatusCommandHandler(IApplicationDbContext context, ISystemScoreCalculator calculator,
            ITaskAuthorizationService authService, INotificationDispatcher? notificationDispatcher = null)
        {
            _workflow = new(context, authService, notificationDispatcher);
        }
        public Task<bool> Handle(UpdateTaskStatusCommand request, CancellationToken cancellationToken) =>
            _workflow.ChangeStatusAsync(request, cancellationToken);
    }
}