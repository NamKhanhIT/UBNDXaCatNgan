using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Commands.ProcessAIStructuredTask
{
    public record ProcessAIStructuredTaskCommand(
        string MeetingNotesOrDocumentText,
        Guid AssignerId,
        Guid FallbackAssigneeId
    ) : IRequest<AIGeneratedTaskResultDto>;

    public class AIGeneratedTaskResultDto
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Priority { get; set; } = "Medium";
        public string DeadlineDate { get; set; } = string.Empty;
        public string SourceCitation { get; set; } = string.Empty;
        public bool PassedVerification { get; set; } = true;
        public Guid? CreatedTaskId { get; set; }
    }

    public class ProcessAIStructuredTaskCommandHandler(IApplicationDbContext context,
        ITaskAuthorizationService? authorizationService = null, IDocumentAiService? aiService = null)
        : IRequestHandler<ProcessAIStructuredTaskCommand, AIGeneratedTaskResultDto>
    {
        public async Task<AIGeneratedTaskResultDto> Handle(ProcessAIStructuredTaskCommand request, CancellationToken ct)
        {
            var actor = await new Quanlycongviec.Application.Common.Services.WorkflowAccess(context).ActorAsync(request.AssignerId, ct);
            if (actor == null || actor.Rank > 4 || authorizationService == null) throw new UnauthorizedAccessException("Không có quyền chuẩn bị giao việc.");
            if (request.FallbackAssigneeId != Guid.Empty && !await authorizationService.CanAssignTaskAsync(actor.Id, request.FallbackAssigneeId, null, ct))
                throw new UnauthorizedAccessException("Người thực hiện không thuộc phạm vi giao việc.");
            if (string.IsNullOrWhiteSpace(request.MeetingNotesOrDocumentText)) throw new ArgumentException("Vui lòng cung cấp nội dung cần phân tích.");
            if (aiService == null) throw new InvalidOperationException("Dịch vụ AI chưa sẵn sàng. Bạn có thể nhập công việc thủ công.");
            var departments = await context.Departments.Where(d => !d.IsDeleted)
                .Select(d => new Quanlycongviec.Application.AI.Models.DepartmentOption { Id = d.Id, Name = d.Name }).ToListAsync(ct);
            var analysis = await aiService.AnalyzeDocumentAsync(request.MeetingNotesOrDocumentText, departments, ct);
            return new AIGeneratedTaskResultDto
            {
                Title = analysis.Title ?? string.Empty, Description = analysis.Summary ?? string.Empty,
                Priority = string.Empty, DeadlineDate = analysis.DeadlineDate?.ToString("O") ?? string.Empty,
                SourceCitation = string.Empty, PassedVerification = false, CreatedTaskId = null
            };
        }
    }
}