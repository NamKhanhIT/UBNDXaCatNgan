using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.CreateOutgoingDocument;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.RejectOutgoingDocument;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.SignAndIssue;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.SubmitForSignature;
using Quanlycongviec.Application.Features.OutgoingDocuments.Commands.UpdateOutgoingDocument;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.OutgoingDocuments
{
    public class OutgoingDocumentsTests
    {
        private readonly ApplicationDbContext _context;

        public OutgoingDocumentsTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        [Fact]
        public async Task UpdateOutgoingDocument_WhenStatusNotDraft_ShouldThrowException()
        {
            // Arrange
            var user = new User { Username = "namnv", FullName = "Nguyên Văn Nam", Email = "nam@catngan.gov.vn" };
            _context.Users.Add(user);

            var doc = new OutgoingDocument
            {
                Id = Guid.NewGuid(),
                Title = "Nghị quyết hội nghị UBND xã",
                DocumentType = DocumentTypeEnum.QuyetDinh,
                Status = OutgoingDocumentStatusEnum.PendingSignature, // Đã trình ký
                DraftedByUserId = user.Id
            };
            _context.OutgoingDocuments.Add(doc);
            await _context.SaveChangesAsync();

            var updateHandler = new UpdateOutgoingDocumentCommandHandler(_context);
            var command = new UpdateOutgoingDocumentCommand
            {
                Id = doc.Id,
                Title = "Thử sửa nghị quyết",
                DocumentType = DocumentTypeEnum.QuyetDinh,
                UserId = user.Id
            };

            // Act & Assert
            var act = async () => await updateHandler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("*không được chỉnh sửa trực tiếp*");
        }

        [Fact]
        public async Task SignAndIssue_ShouldAutoGenerateSequentialDocumentNumber()
        {
            // Arrange
            var leader = new User { Username = "chutich", FullName = "Nguyễn Đình Hùng", Email = "hung@catngan.gov.vn", ActiveRoleCode = "ChuTichUBND" };
            var drafter = new User { Username = "namnv", FullName = "Nguyễn Văn Nam", Email = "nam@catngan.gov.vn" };
            _context.Users.AddRange(leader, drafter);

            var doc1 = new OutgoingDocument { Id = Guid.NewGuid(), Title = "Quyết định 1", DocumentType = DocumentTypeEnum.QuyetDinh, Status = OutgoingDocumentStatusEnum.PendingSignature, DraftedByUserId = drafter.Id };
            var doc2 = new OutgoingDocument { Id = Guid.NewGuid(), Title = "Quyết định 2", DocumentType = DocumentTypeEnum.QuyetDinh, Status = OutgoingDocumentStatusEnum.PendingSignature, DraftedByUserId = drafter.Id };

            _context.OutgoingDocuments.AddRange(doc1, doc2);
            await _context.SaveChangesAsync();

            var signHandler = new SignAndIssueOutgoingDocumentCommandHandler(_context);

            // Act 1: Sign first Quyết định
            var num1 = await signHandler.Handle(new SignAndIssueOutgoingDocumentCommand { Id = doc1.Id, UserId = leader.Id, UserRankLevel = 1 }, CancellationToken.None);

            // Act 2: Sign second Quyết định
            var num2 = await signHandler.Handle(new SignAndIssueOutgoingDocumentCommand { Id = doc2.Id, UserId = leader.Id, UserRankLevel = 1 }, CancellationToken.None);

            // Assert
            num1.Should().Be("01/QĐ-UBND");
            num2.Should().Be("02/QĐ-UBND");

            var updatedDoc1 = await _context.OutgoingDocuments.FindAsync(doc1.Id);
            updatedDoc1!.Status.Should().Be(OutgoingDocumentStatusEnum.Issued);
            updatedDoc1.DocumentNumber.Should().Be("01/QĐ-UBND");
        }

        [Fact]
        public async Task SignAndIssue_WhenUserNotAuthorized_ShouldFail()
        {
            // Arrange
            var chuyenVien = new User { Username = "namnv", FullName = "Nguyễn Văn Nam", Email = "nam@catngan.gov.vn" };
            _context.Users.Add(chuyenVien);

            var doc = new OutgoingDocument { Id = Guid.NewGuid(), Title = "Tờ trình ngân sách", DocumentType = DocumentTypeEnum.ToTrinh, Status = OutgoingDocumentStatusEnum.PendingSignature, DraftedByUserId = chuyenVien.Id };
            _context.OutgoingDocuments.Add(doc);
            await _context.SaveChangesAsync();

            var signHandler = new SignAndIssueOutgoingDocumentCommandHandler(_context);
            var command = new SignAndIssueOutgoingDocumentCommand { Id = doc.Id, UserId = chuyenVien.Id, UserRankLevel = 5 }; // RankLevel 5 = Chuyên viên

            // Act & Assert
            var act = async () => await signHandler.Handle(command, CancellationToken.None);
            await act.Should().ThrowAsync<UnauthorizedAccessException>()
                .WithMessage("*không có thẩm quyền ký*");
        }
    }
}
