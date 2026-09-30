using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Api.Controllers;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.TaskAnnotations.DTOs;
using Quanlycongviec.Application.Features.TaskAnnotations.Queries.GetTaskReviewAnnotations;
using Quanlycongviec.Application.Features.Tasks.Commands.ProcessAIStructuredTask;
using Quanlycongviec.Application.Features.Tasks.Queries.CalculateTaskSystemScore;
using Quanlycongviec.Infrastructure.Persistence;

namespace Quanlycongviec.Api.IntegrationTests;

public sealed class WorkflowIdentityTests
{
    [Fact]
    public async Task LegacyTaskRoutes_BindRealActor_IncludingSpoofedAiAssigner()
    {
        var actorId = Guid.NewGuid(); var spoofedLeader = Guid.NewGuid(); var taskId = Guid.NewGuid();
        await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var sender = new Mock<ISender>();
        ProcessAIStructuredTaskCommand? ai = null; GetTaskReviewAnnotationsQuery? annotations = null; CalculateTaskSystemScoreQuery? score = null;
        sender.Setup(s => s.Send(It.IsAny<ProcessAIStructuredTaskCommand>(), It.IsAny<CancellationToken>())).Callback<IRequest<AIGeneratedTaskResultDto>, CancellationToken>((r, _) => ai = (ProcessAIStructuredTaskCommand)r).ReturnsAsync(new AIGeneratedTaskResultDto());
        sender.Setup(s => s.Send(It.IsAny<GetTaskReviewAnnotationsQuery>(), It.IsAny<CancellationToken>())).Callback<IRequest<List<TaskReviewAnnotationDto>>, CancellationToken>((r, _) => annotations = (GetTaskReviewAnnotationsQuery)r).ReturnsAsync(new List<TaskReviewAnnotationDto>());
        sender.Setup(s => s.Send(It.IsAny<CalculateTaskSystemScoreQuery>(), It.IsAny<CancellationToken>())).Callback<IRequest<SystemScoreBreakdown>, CancellationToken>((r, _) => score = (CalculateTaskSystemScoreQuery)r).ReturnsAsync(new SystemScoreBreakdown());
        var controller = new TasksController(sender.Object, Mock.Of<IRealtimePublisherService>(), db)
        { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, actorId.ToString()), new Claim("RankLevel", "5") }, "Fixture")) } } };
        await controller.ProcessAITask(new("Nội dung thử", spoofedLeader, Guid.Empty));
        Assert.Equal(actorId, ai!.AssignerId);
        await controller.GetAnnotations(taskId); Assert.Equal(actorId, annotations!.CurrentUserId);
        await controller.GetSystemScore(taskId); Assert.Equal(actorId, score!.CurrentUserId);
    }
}
