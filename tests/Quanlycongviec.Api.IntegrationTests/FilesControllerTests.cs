using System;
using System.IO;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Quanlycongviec.Api.Controllers;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Api.IntegrationTests
{
    public class FilesControllerTests
    {
        private readonly ApplicationDbContext _context;
        private readonly Mock<IOcrService> _ocrServiceMock;
        private readonly Mock<IDocumentAiService> _aiServiceMock;
        private readonly IOptions<FileUploadOptions> _uploadOptions;
        private readonly Mock<ILogger<FilesController>> _loggerMock;
        private readonly FilesController _controller;

        public FilesControllerTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
            _ocrServiceMock = new Mock<IOcrService>();
            _aiServiceMock = new Mock<IDocumentAiService>();
            _uploadOptions = Options.Create(new FileUploadOptions
            {
                MaxFileSizeMB = 20,
                AllowedExtensions = "pdf,doc,docx,jpg,jpeg,png,xlsx"
            });
            _loggerMock = new Mock<ILogger<FilesController>>();

            _controller = new FilesController(
                _context,
                _ocrServiceMock.Object,
                _aiServiceMock.Object,
                _uploadOptions,
                _loggerMock.Object
            );

            // Set up user claims
            var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
            }, "TestAuth"));

            _controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };
        }

        [Fact]
        public async Task UploadFile_FileSizeExceeds20MB_ShouldReturnBadRequest()
        {
            // Arrange: 25MB file
            var fileMock = new Mock<IFormFile>();
            fileMock.Setup(f => f.FileName).Returns("large_doc.pdf");
            fileMock.Setup(f => f.Length).Returns(25L * 1024 * 1024);

            // Act
            var result = await _controller.UploadFile(fileMock.Object, Guid.NewGuid());

            // Assert
            var badRequest = result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            badRequest!.StatusCode.Should().Be(400);
        }

        [Fact]
        public async Task UploadFile_DisallowedExtension_ShouldReturnBadRequest()
        {
            // Arrange: .exe file
            var fileMock = new Mock<IFormFile>();
            fileMock.Setup(f => f.FileName).Returns("malware.exe");
            fileMock.Setup(f => f.Length).Returns(1024);

            // Act
            var result = await _controller.UploadFile(fileMock.Object, Guid.NewGuid());

            // Assert
            var badRequest = result as BadRequestObjectResult;
            badRequest.Should().NotBeNull();
            badRequest!.StatusCode.Should().Be(400);
        }

        [Fact]
        public async Task ViewFileInline_PhysicalFileDoesNotExist_ShouldReturn404NotFound()
        {
            // Arrange: Create DocumentAttachment record pointing to non-existent file
            var nonExistentPath = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "non_existent_file_12345.pdf");
            var att = new DocumentAttachment
            {
                Id = Guid.NewGuid(),
                DocumentId = Guid.NewGuid(),
                FileName = "non_existent_file_12345.pdf",
                OriginalFileName = "VanBanGoc.pdf",
                FilePath = nonExistentPath,
                FileType = "pdf",
                FileSize = 1000,
                UploadedAt = DateTime.UtcNow
            };

            _context.DocumentAttachments.Add(att);
            await _context.SaveChangesAsync();

            // Act
            var result = await _controller.ViewFileInline(att.Id);

            // Assert — 404 thật, KHÔNG sinh file giả mạo
            var notFound = result as NotFoundObjectResult;
            notFound.Should().NotBeNull();
            notFound!.StatusCode.Should().Be(404);
        }

        [Fact]
        public async Task DownloadFile_PhysicalFileDoesNotExist_ShouldReturn404NotFound()
        {
            // Arrange
            var att = new DocumentAttachment
            {
                Id = Guid.NewGuid(),
                DocumentId = Guid.NewGuid(),
                FileName = "missing.pdf",
                OriginalFileName = "CongVan123.pdf",
                FilePath = "C:\\invalid_path\\missing.pdf",
                FileType = "pdf",
                FileSize = 2000,
                UploadedAt = DateTime.UtcNow
            };

            _context.DocumentAttachments.Add(att);
            await _context.SaveChangesAsync();

            // Act
            var result = await _controller.DownloadFile(att.Id);

            // Assert
            var notFound = result as NotFoundObjectResult;
            notFound.Should().NotBeNull();
            notFound!.StatusCode.Should().Be(404);
        }
    }
}
