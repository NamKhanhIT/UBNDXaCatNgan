using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Quanlycongviec.Api.Controllers;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Inbox.Commands.CreateInboxDocument;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Api.IntegrationTests
{
    public class InboxControllerSecurityTests
    {
        [Fact]
        public async Task CreateInboxDocument_ShouldAlwaysUseAuthenticatedUserAsReceivedByUserId()
        {
            var currentUserId = Guid.NewGuid();
            var spoofedReceivedByUserId = Guid.NewGuid();
            var createdDocId = Guid.NewGuid();

            var dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            await using var context = new ApplicationDbContext(dbOptions);

            var captured = (CreateInboxDocumentCommand?)null;
            var senderMock = new Mock<ISender>();
            senderMock
                .Setup(s => s.Send(It.IsAny<CreateInboxDocumentCommand>(), It.IsAny<CancellationToken>()))
                .Callback((IRequest<Guid> request, CancellationToken _) => captured = (CreateInboxDocumentCommand)request)
                .ReturnsAsync(createdDocId);

            var aiServiceMock = new Mock<IDocumentAiService>();
            var notificationDispatcherMock = new Mock<INotificationDispatcher>();
            var loggerMock = new Mock<ILogger<InboxController>>();
            var documentAccessMock = new Mock<IDocumentAccessService>();
            var taskAuthMock = new Mock<ITaskAuthorizationService>();

            var controller = new InboxController(
                senderMock.Object,
                context,
                aiServiceMock.Object,
                notificationDispatcherMock.Object,
                loggerMock.Object,
                documentAccessMock.Object,
                taskAuthMock.Object
            )
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

            var command = new CreateInboxDocumentCommand
            {
                ReceivedByUserId = spoofedReceivedByUserId,
                Subject = "Chỉ đạo quan trọng",
                Sender = "Cơ quan cấp trên"
            };

            var result = await controller.CreateInboxDocument(command, CancellationToken.None);

            result.Should().BeOfType<CreatedAtActionResult>();
            captured.Should().NotBeNull();
            captured!.ReceivedByUserId.Should().Be(currentUserId);
            captured.ReceivedByUserId.Should().NotBe(spoofedReceivedByUserId);
        }
    }
}
