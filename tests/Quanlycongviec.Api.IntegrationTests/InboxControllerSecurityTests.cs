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
using Quanlycongviec.Application.AI.Models;
using Quanlycongviec.Domain.Entities;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using Xunit;

namespace Quanlycongviec.Api.IntegrationTests
{
    public class InboxControllerSecurityTests
    {
        [Fact]
        public async Task AssignmentSuggestion_OnlySendsEligibleStaffToAi_RejectsInventedRecipient()
        {
            await using var db = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
            var dept = new Department { Name = "Phòng A" }; var other = new Department { Name = "Phòng B" };
            var leader = new User { Username = "deputy", PrimaryDepartmentId = dept.Id };
            var staff = new User { Username = "staff", FullName = "Chuyên viên", PrimaryDepartmentId = dept.Id };
            var outsider = new User { Username = "outsider", PrimaryDepartmentId = other.Id };
            leader.UserRoles.Add(new UserRole { User = leader, Role = new Role { Code = "DEPUTY", RankLevel = 4 } });
            db.Departments.AddRange(dept, other); db.Users.AddRange(leader, staff, outsider);
            var doc = new InboxDocument { Subject = "Công văn thử", ReceivedByUserId = leader.Id }; db.InboxDocuments.Add(doc); await db.SaveChangesAsync();
            List<StaffWorkloadSnapshot>? candidates = null;
            var ai = new Mock<IDocumentAiService>();
            ai.Setup(x => x.SuggestAssignmentAsync(It.IsAny<string>(), It.IsAny<IEnumerable<StaffWorkloadSnapshot>>(), It.IsAny<CancellationToken>()))
                .Callback<string, IEnumerable<StaffWorkloadSnapshot>, CancellationToken>((_, people, _) => candidates = people.ToList())
                .ReturnsAsync(new AssignmentSuggestion { SuggestedUserId = outsider.Id, SuggestedUserName = "Không hợp lệ", Alternatives = new() { new AlternativeCandidate { UserId = outsider.Id } } });
            var taskAuth = new Quanlycongviec.Infrastructure.Services.TaskAuthorizationService(db);
            var controller = new InboxController(Mock.Of<ISender>(), db, ai.Object, Mock.Of<INotificationDispatcher>(), Mock.Of<ILogger<InboxController>>(),
                new Quanlycongviec.Infrastructure.Services.DocumentAccessService(db, taskAuth), taskAuth)
            { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(
                new[] { new Claim(ClaimTypes.NameIdentifier, leader.Id.ToString()) }, "Fixture")) } } };
            var response = Assert.IsType<OkObjectResult>(await controller.SuggestAssignment(doc.Id, default));
            Assert.Equal(staff.Id, Assert.Single(candidates!).UserId);
            var body = JsonSerializer.SerializeToElement(response.Value);
            Assert.Equal(staff.Id, body.GetProperty("data").GetProperty("SuggestedUserId").GetGuid());
            Assert.DoesNotContain(outsider.Id.ToString(), body.GetRawText());
        }

        [Fact]
        public async Task ConfirmClassification_EventRoute_OnlyReturnsSuggestionWithoutCreatingEvent()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options;
            await using var db = new ApplicationDbContext(options);
            var leader = new Quanlycongviec.Domain.Entities.User { Username = "ai_leader", Email = "leader@example.invalid" };
            var role = new Quanlycongviec.Domain.Entities.Role { Code = "LEADER", Name = "Leader", RankLevel = 1 };
            leader.UserRoles.Add(new Quanlycongviec.Domain.Entities.UserRole { User = leader, Role = role, IsPrimary = true });
            var doc = new Quanlycongviec.Domain.Entities.InboxDocument { Subject = "Giấy mời thử", ReceivedByUserId = leader.Id };
            db.Users.Add(leader); db.InboxDocuments.Add(doc); await db.SaveChangesAsync();
            var controller = new InboxController(Mock.Of<ISender>(), db, Mock.Of<IDocumentAiService>(), Mock.Of<INotificationDispatcher>(),
                Mock.Of<ILogger<InboxController>>(), new Quanlycongviec.Infrastructure.Services.DocumentAccessService(db, new Quanlycongviec.Infrastructure.Services.TaskAuthorizationService(db)),
                new Quanlycongviec.Infrastructure.Services.TaskAuthorizationService(db))
            { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(
                new[] { new Claim(ClaimTypes.NameIdentifier, leader.Id.ToString()) }, "Fixture")) } } };
            var result = await controller.ConfirmClassification(doc.Id, new ConfirmClassificationRequest
            { Route = "event", AiTitle = "Gợi ý cuộc họp", EventStartDateTime = DateTime.UtcNow.AddDays(1), EventEndDateTime = DateTime.UtcNow.AddDays(1).AddHours(1) }, default);
            result.Should().BeOfType<OkObjectResult>();
            (await db.CalendarEvents.CountAsync()).Should().Be(0);
            (await db.TaskItems.CountAsync()).Should().Be(0);
        }

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
