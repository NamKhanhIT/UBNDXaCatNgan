using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Inbox.Commands.CreateInboxDocument;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests
{
    public class CreateInboxDocumentCommandTests
    {
        [Fact]
        public async Task Handle_WithValidCommand_ShouldCreateDocumentAndRecordAuditLog()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

            var userId = Guid.NewGuid();
            var user = new User { Id = userId, Username = "intake_test", Email = "intake@example.invalid" };
            WorkflowTestData.AddAssignmentRoles(context, new User { Username = "leader_test", Email = "leader@example.invalid" }, user);
            context.WorkflowPermissions.Add(new WorkflowPermission { UserId = userId, CanReceiveDocuments = true });
            await context.SaveChangesAsync();
            var handler = new CreateInboxDocumentCommandHandler(context);

            var command = new CreateInboxDocumentCommand
            {
                ReceivedByUserId = userId,
                RequestId = Guid.NewGuid(),
                DocumentNumber = "123/UBND-VP",
                DocumentSymbol = "UBND-VP",
                Subject = "Chỉ đạo phòng chống thiên tai",
                Sender = "UBND Huyện Thanh Chương",
                IssuingAgency = "UBND Huyện Thanh Chương",
                IsUrgent = true,
                Channel = InboxChannel.Internal,
                IssuedDate = DateTime.UtcNow.AddDays(-1)
            };

            var docId = await handler.Handle(command, CancellationToken.None);

            docId.Should().NotBeEmpty();

            var doc = await context.InboxDocuments.FindAsync(docId);
            doc.Should().NotBeNull();
            doc!.Subject.Should().Be("Chỉ đạo phòng chống thiên tai");
            doc.Sender.Should().Be("UBND Huyện Thanh Chương");
            doc.ReceivedByUserId.Should().Be(userId);
            doc.IsUrgent.Should().BeTrue();
            doc.AiProcessingStatus.Should().Be("Pending");

            var auditLog = await context.AuditLogs.FirstOrDefaultAsync(a => a.EntityId == docId.ToString());
            auditLog.Should().NotBeNull();
            auditLog!.UserId.Should().Be(userId);
            auditLog.Action.Should().Be("CreateInboxDocument");
        }

        [Fact]
        public async Task Handle_WithoutReceivedByUserId_ShouldThrowUnauthorizedAccessException()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

            var handler = new CreateInboxDocumentCommandHandler(context);

            var command = new CreateInboxDocumentCommand
            {
                ReceivedByUserId = Guid.Empty,
                Subject = "Văn bản không xác thực",
                Sender = "Cơ quan cấp trên"
            };

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>();
        }

        [Fact]
        public async Task Handle_WithEmptySubject_ShouldThrowArgumentException()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

            var handler = new CreateInboxDocumentCommandHandler(context);

            var command = new CreateInboxDocumentCommand
            {
                ReceivedByUserId = Guid.NewGuid(),
                Subject = "   ",
                Sender = "Cơ quan cấp trên"
            };

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>();
        }

        [Fact]
        public async Task Handle_WithEmptySender_ShouldThrowArgumentException()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);

            var handler = new CreateInboxDocumentCommandHandler(context);

            var command = new CreateInboxDocumentCommand
            {
                ReceivedByUserId = Guid.NewGuid(),
                Subject = "Văn bản hợp lệ",
                Sender = "   "
            };

            var act = () => handler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<ArgumentException>();
        }
    }
}
