using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocumentsPaginated;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests
{
    public class InboxQueryTests
    {
        [Fact]
        public async Task Handle_ShouldUseStableIdTieBreakForReceivedDate()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
            var received = DateTime.UtcNow;
            var leader = new User { Username = "inbox_leader", Email = "leader@example.invalid" };
            WorkflowTestData.AddAssignmentRoles(context, leader, new User { Username = "inbox_officer", Email = "officer@example.invalid" });
            var olderId = Guid.Parse("00000000-0000-0000-0000-000000000001");
            var newerId = Guid.Parse("00000000-0000-0000-0000-000000000002");
            context.InboxDocuments.AddRange(
                new InboxDocument { Id = olderId, DocumentNumber = "1", Subject = "Older id", Sender = "A", ReceivedDate = received },
                new InboxDocument { Id = newerId, DocumentNumber = "2", Subject = "Newer id", Sender = "B", ReceivedDate = received });
            await context.SaveChangesAsync();

            var result = await new GetInboxDocumentsPaginatedQueryHandler(context).Handle(
                new GetInboxDocumentsPaginatedQuery
                {
                    Page = 1,
                    PageSize = 10,
                    CurrentUserId = leader.Id,
                    UserRankLevel = 1
                }, CancellationToken.None);

            result.Items.Select(x => x.Id).Should().ContainInOrder(newerId, olderId);
        }

        [Fact]
        public async Task QueryWithoutCallerIdentity_ShouldReturnNoDocuments()
        {
            await using var context = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options);
            context.InboxDocuments.Add(new InboxDocument
            {
                DocumentNumber = "1",
                Subject = "Protected inbox",
                Sender = "Source"
            });
            await context.SaveChangesAsync();

            var result = await new GetInboxDocumentsPaginatedQueryHandler(context).Handle(
                new GetInboxDocumentsPaginatedQuery(), CancellationToken.None);

            result.TotalCount.Should().Be(0);
            result.Items.Should().BeEmpty();
        }
    }
}
