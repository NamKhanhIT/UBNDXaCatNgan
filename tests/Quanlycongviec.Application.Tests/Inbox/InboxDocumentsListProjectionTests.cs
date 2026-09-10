using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common;
using Quanlycongviec.Application.Features.Inbox.DTOs;
using Quanlycongviec.Application.Features.Inbox.Queries.GetInboxDocumentsPaginated;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Inbox
{
    public class InboxDocumentsListProjectionTests
    {
        private static ApplicationDbContext BuildContext()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
            return new ApplicationDbContext(options);
        }

        [Fact]
        public async Task Handle_ShouldNotExposeReceivedByUserId_InListResponse()
        {
            await using var ctx = BuildContext();
            var clerk = new User { Username = "clerk", FullName = "Cán bộ tiếp nhận", Email = "clerk@test.local" };
            ctx.Users.Add(clerk);
            ctx.InboxDocuments.Add(new InboxDocument
            {
                DocumentNumber = "VB-001",
                Subject = "Văn bản test",
                Sender = "Người gửi",
                ReceivedDate = DateTime.UtcNow,
                ReceivedByUserId = clerk.Id,  // This should NOT appear in list
                IsDeleted = false,
                IsUrgent = false,
                IsScheduled = false,
                Channel = InboxChannel.Internal
            });
            await ctx.SaveChangesAsync();

            var handler = new GetInboxDocumentsPaginatedQueryHandler(ctx);
            var result = await handler.Handle(new GetInboxDocumentsPaginatedQuery
            {
                Page = 1, PageSize = 10,
                CurrentUserId = clerk.Id,
                UserRankLevel = 1  // Leader rank
            }, CancellationToken.None);

            result.Items.Should().HaveCount(1);
            result.Items[0].ReceivedByUserId.Should().BeNull("ReceivedByUserId is internal clerk metadata and must not be exposed in list");
        }

        [Fact]
        public async Task Handle_ShouldNotExposeCitizenPii_InListResponse()
        {
            await using var ctx = BuildContext();
            var clerk = new User { Username = "clerk2", FullName = "Cán bộ 2", Email = "clerk2@test.local" };
            ctx.Users.Add(clerk);
            ctx.InboxDocuments.Add(new InboxDocument
            {
                DocumentNumber = "VB-002",
                Subject = "Yêu cầu dịch vụ công",
                Sender = "Công dân",
                ReceivedDate = DateTime.UtcNow,
                ReceivedByUserId = clerk.Id,
                CitizenName = "Nguyễn Văn A",   // PII - must NOT appear
                CitizenPhone = "0909123456",       // PII - must NOT appear
                IsDeleted = false,
                IsUrgent = false,
                IsScheduled = false,
                Channel = InboxChannel.PublicService
            });
            await ctx.SaveChangesAsync();

            var handler = new GetInboxDocumentsPaginatedQueryHandler(ctx);
            var result = await handler.Handle(new GetInboxDocumentsPaginatedQuery
            {
                Page = 1, PageSize = 10,
                CurrentUserId = clerk.Id,
                UserRankLevel = 1
            }, CancellationToken.None);

            result.Items.Should().HaveCount(1);
            result.Items[0].CitizenName.Should().BeNull("CitizenName is PII and must not be exposed in list");
            result.Items[0].CitizenPhone.Should().BeNull("CitizenPhone is PII and must not be exposed in list");
        }

        [Fact]
        public async Task Handle_ShouldReturnEmpty_WhenCallerIdentityMissing()
        {
            await using var ctx = BuildContext();
            ctx.InboxDocuments.Add(new InboxDocument
            {
                DocumentNumber = "VB-003",
                Subject = "Any doc",
                Sender = "Anyone",
                ReceivedDate = DateTime.UtcNow,
                IsDeleted = false,
                IsUrgent = false,
                IsScheduled = false,
                Channel = InboxChannel.Internal
            });
            await ctx.SaveChangesAsync();

            var handler = new GetInboxDocumentsPaginatedQueryHandler(ctx);
            // Null CurrentUserId
            var result = await handler.Handle(new GetInboxDocumentsPaginatedQuery
            {
                Page = 1, PageSize = 10,
                CurrentUserId = null,
                UserRankLevel = 1
            }, CancellationToken.None);

            result.Items.Should().BeEmpty("query without caller identity must return empty list");
        }
    }
}
