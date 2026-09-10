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
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
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
                _loggerMock.Object,
                new AllowAllDocumentAccessService()
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

        [Fact]
        public async Task ViewFileInline_UserOutsideDocumentScope_ShouldReturn404()
        {
            var path = Path.Combine(Path.GetTempPath(), $"ubnd-idor-{Guid.NewGuid():N}.pdf");
            await File.WriteAllBytesAsync(path, new byte[] { 0x25, 0x50, 0x44, 0x46 });

            try
            {
                var att = new DocumentAttachment
                {
                    DocumentId = Guid.NewGuid(),
                    FileName = Path.GetFileName(path),
                    OriginalFileName = "restricted.pdf",
                    FilePath = path,
                    FileType = "pdf",
                    FileSize = 4,
                    UploadedAt = DateTime.UtcNow,
                    UploadedByUserId = Guid.NewGuid()
                };
                _context.DocumentAttachments.Add(att);
                await _context.SaveChangesAsync();

                var restrictedController = new FilesController(
                    _context,
                    _ocrServiceMock.Object,
                    _aiServiceMock.Object,
                    _uploadOptions,
                    _loggerMock.Object,
                    new Quanlycongviec.Infrastructure.Services.DocumentAccessService(
                        _context,
                        new Quanlycongviec.Infrastructure.Services.TaskAuthorizationService(_context)))
                {
                    ControllerContext = _controller.ControllerContext
                };

                var result = await restrictedController.ViewFileInline(att.Id);

                result.Should().BeOfType<NotFoundResult>();
            }
            finally
            {
                if (File.Exists(path)) File.Delete(path);
            }
        }

        [Fact]
        public async Task UploadFile_PdfExtensionWithInvalidMagicBytes_ShouldReturnBadRequest()
        {
            await using var content = new MemoryStream(System.Text.Encoding.UTF8.GetBytes("not a pdf"));
            var file = new FormFile(content, 0, content.Length, "file", "spoofed.pdf")
            {
                Headers = new HeaderDictionary(),
                ContentType = "application/pdf"
            };

            var result = await _controller.UploadFile(file, Guid.NewGuid());

            result.Should().BeOfType<BadRequestObjectResult>();
        }

        private FilesController CreateControllerForUser(Guid userId)
        {
            var controller = new FilesController(
                _context,
                _ocrServiceMock.Object,
                _aiServiceMock.Object,
                _uploadOptions,
                _loggerMock.Object,
                new DocumentAccessService(_context, new TaskAuthorizationService(_context)))
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext
                    {
                        User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                        {
                            new Claim(ClaimTypes.NameIdentifier, userId.ToString())
                        }, "TestAuth"))
                    }
                }
            };
            return controller;
        }

        [Fact]
        public async Task UploadFile_TargetTypeTask_ByAssignee_ShouldSucceed_AndAllowAssignerToDownload_AndRejectUnauthorizedUser()
        {
            // Arrange
            var deptA = new Department { Id = Guid.NewGuid(), Name = "Phòng Tư pháp", Code = "TP" };
            var deptB = new Department { Id = Guid.NewGuid(), Name = "Phòng Địa chính", Code = "DC" };
            _context.Departments.AddRange(deptA, deptB);

            var roleAssigner = new Role { Id = Guid.NewGuid(), Name = "Trưởng phòng", Code = "TruongPhong", RankLevel = 3 };
            var roleAssignee = new Role { Id = Guid.NewGuid(), Name = "Chuyên viên", Code = "ChuyenVien", RankLevel = 5 };
            _context.Roles.AddRange(roleAssigner, roleAssignee);

            var userAssigner = new User
            {
                Id = Guid.NewGuid(),
                Username = "truongphong",
                FullName = "Nguyễn Văn Trưởng",
                PrimaryDepartmentId = deptA.Id,
                ActiveRoleCode = "TruongPhong"
            };
            userAssigner.UserRoles.Add(new UserRole { UserId = userAssigner.Id, RoleId = roleAssigner.Id, Role = roleAssigner });

            var userAssignee = new User
            {
                Id = Guid.NewGuid(),
                Username = "chuyenvien",
                FullName = "Trần Thị Chuyên Viên",
                PrimaryDepartmentId = deptA.Id,
                ActiveRoleCode = "ChuyenVien"
            };
            userAssignee.UserRoles.Add(new UserRole { UserId = userAssignee.Id, RoleId = roleAssignee.Id, Role = roleAssignee });

            var userUnauthorized = new User
            {
                Id = Guid.NewGuid(),
                Username = "otherdept",
                FullName = "Lê Văn Ngoài",
                PrimaryDepartmentId = deptB.Id,
                ActiveRoleCode = "ChuyenVien"
            };
            userUnauthorized.UserRoles.Add(new UserRole { UserId = userUnauthorized.Id, RoleId = roleAssignee.Id, Role = roleAssignee });

            _context.Users.AddRange(userAssigner, userAssignee, userUnauthorized);

            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Soạn thảo kế hoạch kiểm tra",
                AssignerId = userAssigner.Id,
                AssigneeId = userAssignee.Id,
                DepartmentId = deptA.Id,
                Status = TaskStatusEnum.InProgress,
                Priority = TaskPriority.Medium,
                Type = TaskType.BAU,
                CreatedAt = DateTime.UtcNow
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            var assigneeController = CreateControllerForUser(userAssignee.Id);
            var assignerController = CreateControllerForUser(userAssigner.Id);
            var unauthorizedController = CreateControllerForUser(userUnauthorized.Id);

            // Valid PDF stream (%PDF-1.4)
            var validPdfContent = new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xC7, 0xEC, 0x8F, 0xA2, 0x0A };
            await using var stream = new MemoryStream(validPdfContent);
            var formFile = new FormFile(stream, 0, stream.Length, "file", "ketqua_nhiemvu.pdf")
            {
                Headers = new HeaderDictionary(),
                ContentType = "application/pdf"
            };

            // Act 1: Assignee uploads file with TargetType=Task
            var uploadResult = await assigneeController.UploadFile(formFile, task.Id, targetType: "Task", attachmentType: "Result");

            // Assert 1: Upload succeeds
            uploadResult.Should().BeOfType<OkObjectResult>();
            var okObj = uploadResult as OkObjectResult;
            okObj.Should().NotBeNull();

            var attachment = await _context.DocumentAttachments
                .FirstOrDefaultAsync(a => a.DocumentId == task.Id && a.TargetType == "Task");
            attachment.Should().NotBeNull();
            attachment!.UploadedByUserId.Should().Be(userAssignee.Id);
            attachment.AttachmentType.Should().Be("Result");

            try
            {
                // Act 2 & Assert 2: Assigner (Trưởng phòng) can download attachment
                var assignerResult = await assignerController.DownloadFile(attachment.Id);
                assignerResult.Should().BeOfType<FileContentResult>();
                var fileContent = assignerResult as FileContentResult;
                fileContent.Should().NotBeNull();
                fileContent!.FileDownloadName.Should().Be("ketqua_nhiemvu.pdf");

                // Act 3 & Assert 3: Unauthorized user is rejected with 404
                var unauthorizedDownload = await unauthorizedController.DownloadFile(attachment.Id);
                unauthorizedDownload.Should().BeOfType<NotFoundResult>();

                var unauthorizedView = await unauthorizedController.ViewFileInline(attachment.Id);
                unauthorizedView.Should().BeOfType<NotFoundResult>();
            }
            finally
            {
                if (File.Exists(attachment.FilePath))
                {
                    File.Delete(attachment.FilePath);
                }
            }
        }

        [Fact]
        public async Task UploadFile_TargetTypeTask_WhenUploadFails_TaskStatusRemainsUnchanged()
        {
            // Arrange
            var user = new User { Id = Guid.NewGuid(), Username = "cv1", FullName = "Chuyên viên 1" };
            _context.Users.Add(user);

            var task = new TaskItem
            {
                Id = Guid.NewGuid(),
                Title = "Nhiệm vụ đang thực hiện",
                AssigneeId = user.Id,
                AssignerId = Guid.NewGuid(),
                Status = TaskStatusEnum.InProgress,
                CreatedAt = DateTime.UtcNow
            };
            _context.TaskItems.Add(task);
            await _context.SaveChangesAsync();

            var controller = CreateControllerForUser(user.Id);

            // Invalid file (corrupt PDF content)
            await using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes("not a valid pdf"));
            var corruptFile = new FormFile(stream, 0, stream.Length, "file", "fake_doc.pdf")
            {
                Headers = new HeaderDictionary(),
                ContentType = "application/pdf"
            };

            // Act: Attempt upload
            var result = await controller.UploadFile(corruptFile, task.Id, targetType: "Task", attachmentType: "Result");

            // Assert: Upload fails
            result.Should().BeOfType<BadRequestObjectResult>();

            // Verify task status in database is untouched
            var reloadedTask = await _context.TaskItems.FindAsync(task.Id);
            reloadedTask.Should().NotBeNull();
            reloadedTask!.Status.Should().Be(TaskStatusEnum.InProgress);
        }
    }
}
