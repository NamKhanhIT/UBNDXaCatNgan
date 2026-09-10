using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Api.Controllers;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.CreateOutgoingDocument;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;
using Moq;

namespace Quanlycongviec.Api.IntegrationTests
{
    public class TasksControllerSecurityTests
    {
        [Fact]
        public async Task CreateTask_ShouldAlwaysUseAuthenticatedUserAsAssigner()
        {
            var currentUserId = Guid.NewGuid();
            var spoofedAssignerId = Guid.NewGuid();
            var assigneeId = Guid.NewGuid();
            var taskId = Guid.NewGuid();

            var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            await using var context = new ApplicationDbContext(dbOptions);

            var captured = (CreateTaskCommand?)null;
            var senderMock = new Mock<ISender>();
            senderMock
                .Setup(s => s.Send(It.IsAny<CreateTaskCommand>(), It.IsAny<CancellationToken>()))
                .Callback((IRequest<Guid> request, CancellationToken _) => captured = (CreateTaskCommand)request)
                .ReturnsAsync(taskId);

            var controller = new TasksController(senderMock.Object, new NoopRealtimePublisher(), context)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, currentUserId.ToString()),
                            new Claim("RankLevel", "1")
                        }, "TestAuth"))
                    }
                }
            };

            var result = await controller.CreateTask(new CreateTaskCommand
            {
                AssignerId = spoofedAssignerId,
                AssigneeId = assigneeId,
                Title = "Identity boundary",
                Description = "The assigner must come from the authenticated principal."
            });

            result.Should().BeOfType<OkObjectResult>();
            captured.Should().NotBeNull();
            captured!.AssignerId.Should().Be(currentUserId);
        }

        [Fact]
        public async Task CreateOutgoingDocument_ShouldAlwaysUseAuthenticatedUserAsDrafter()
        {
            var currentUserId = Guid.NewGuid();
            var spoofedDrafterId = Guid.NewGuid();
            var captured = (CreateOutgoingDocumentCommand?)null;
            var senderMock = new Mock<ISender>();
            senderMock
                .Setup(s => s.Send(It.IsAny<CreateOutgoingDocumentCommand>(), It.IsAny<CancellationToken>()))
                .Callback((IRequest<Guid> request, CancellationToken _) => captured = (CreateOutgoingDocumentCommand)request)
                .ReturnsAsync(Guid.NewGuid());

            var controller = new OutgoingDocumentsController(senderMock.Object)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, currentUserId.ToString()),
                            new Claim("RankLevel", "1")
                        }, "TestAuth"))
                    }
                }
            };

            var result = await controller.Create(new CreateOutgoingDocumentCommand
            {
                DraftedByUserId = spoofedDrafterId,
                Title = "Identity boundary"
            });

            result.Should().BeOfType<OkObjectResult>();
            captured.Should().NotBeNull();
            captured!.DraftedByUserId.Should().Be(currentUserId);
        }

        private sealed class NoopRealtimePublisher : IRealtimePublisherService
        {
            public Task PublishToUserAsync<T>(Guid userId, string eventName, T data, CancellationToken cancellationToken = default)
                => Task.CompletedTask;

            public Task PublishToUsersAsync<T>(IEnumerable<Guid> userIds, string eventName, T data, CancellationToken cancellationToken = default)
                => Task.CompletedTask;

            public Task PublishToGroupAsync<T>(string groupName, string eventName, T data, CancellationToken cancellationToken = default)
                => Task.CompletedTask;

            public Task BroadcastAsync<T>(string eventName, T data, CancellationToken cancellationToken = default)
                => Task.CompletedTask;
        }
    }
}
