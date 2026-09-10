using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocumentById;
using Quanlycongviec.Application.Features.OutgoingDocuments.Queries.GetOutgoingDocumentById;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests
{
    public class DocumentDetailAuthorizationTests
    {
        [Fact]
        public async Task InboxDetail_ShouldHideDocumentFromUnrelatedUser()
        {
            await using var context = CreateContext();
            var owner = new User { Username = "owner", FullName = "Owner", Email = "owner@test.local" };
            var unrelated = new User { Username = "unrelated", FullName = "Unrelated", Email = "unrelated@test.local" };
            var doc = new InboxDocument { DocumentNumber = "1", Subject = "Restricted inbox", Sender = "Source" };
            context.Users.AddRange(owner, unrelated);
            context.InboxDocuments.Add(doc);
            context.DocumentAttachments.Add(new DocumentAttachment
            {
                DocumentId = doc.Id,
                TargetType = "Inbox",
                UploadedByUserId = owner.Id,
                FileName = "restricted.pdf",
                OriginalFileName = "restricted.pdf"
            });
            await context.SaveChangesAsync();

            var access = new DocumentAccessService(context, new TaskAuthorizationService(context));
            var result = await new GetInboxDocumentByIdQueryHandler(context, access).Handle(
                new GetInboxDocumentByIdQuery { Id = doc.Id, CurrentUserId = unrelated.Id },
                CancellationToken.None);

            result.Should().BeNull();
        }

        [Fact]
        public async Task OutgoingDetail_ShouldHideDocumentFromUnrelatedUser()
        {
            await using var context = CreateContext();
            var owner = new User { Username = "out_owner", FullName = "Owner", Email = "out.owner@test.local" };
            var unrelated = new User { Username = "out_unrelated", FullName = "Unrelated", Email = "out.unrelated@test.local" };
            var doc = new OutgoingDocument
            {
                Title = "Restricted outgoing",
                Content = "Private content",
                DraftedByUserId = owner.Id
            };
            context.Users.AddRange(owner, unrelated);
            context.OutgoingDocuments.Add(doc);
            await context.SaveChangesAsync();

            var access = new DocumentAccessService(context, new TaskAuthorizationService(context));
            var result = await new GetOutgoingDocumentByIdQueryHandler(context, access).Handle(
                new GetOutgoingDocumentByIdQuery { Id = doc.Id, CurrentUserId = unrelated.Id },
                CancellationToken.None);

            result.Should().BeNull();
        }

        private static ApplicationDbContext CreateContext() => new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
    }
}
