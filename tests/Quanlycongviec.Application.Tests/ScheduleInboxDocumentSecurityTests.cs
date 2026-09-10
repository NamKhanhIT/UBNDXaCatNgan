using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Inbox.Commands.ScheduleDocument;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Services;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests
{
    public class ScheduleInboxDocumentSecurityTests
    {
        [Fact]
        public async Task Handle_ShouldRejectUnknownAssignerBeforeCreatingTask()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
            var document = new InboxDocument
            {
                DocumentNumber = "1/UBND",
                Subject = "Schedule security",
                Sender = "Source"
            };
            context.InboxDocuments.Add(document);
            await context.SaveChangesAsync();

            var handler = new ScheduleInboxDocumentCommandHandler(
                context,
                new TaskAuthorizationService(context));
            Func<Task> act = () => handler.Handle(
                new ScheduleInboxDocumentCommand(
                    document.Id,
                    DateTime.UtcNow.AddDays(1),
                    "Sang",
                    Guid.NewGuid(),
                    Guid.NewGuid()),
                CancellationToken.None);

            await act.Should().ThrowAsync<UnauthorizedAccessException>();
            (await context.TaskItems.CountAsync()).Should().Be(0);
        }
    }
}
