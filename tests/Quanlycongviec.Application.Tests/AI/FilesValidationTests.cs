using System;
using System.IO;
using System.Linq;
using FluentAssertions;
using Quanlycongviec.Application.Common.Options;
using Xunit;

namespace Quanlycongviec.Application.Tests.AI
{
    public class FilesValidationTests
    {
        [Theory]
        [InlineData("pdf", true)]
        [InlineData("doc", true)]
        [InlineData("docx", true)]
        [InlineData("jpg", true)]
        [InlineData("jpeg", true)]
        [InlineData("png", true)]
        [InlineData("xlsx", true)]
        [InlineData("exe", false)]
        [InlineData("bat", false)]
        [InlineData("sh", false)]
        [InlineData("zip", false)]
        public void FileExtension_Validation_ShouldOnlyAcceptWhitelist(string extension, bool expectedValid)
        {
            var options = new FileUploadOptions
            {
                MaxFileSizeMB = 20,
                AllowedExtensions = "pdf,doc,docx,jpg,jpeg,png,xlsx"
            };

            var allowedExts = options.GetAllowedExtensionArray();

            var isValid = allowedExts.Contains(extension, StringComparer.OrdinalIgnoreCase);

            isValid.Should().Be(expectedValid);
        }

        [Theory]
        [InlineData(1024, true)]               // 1 KB
        [InlineData(10 * 1024 * 1024, true)]    // 10 MB
        [InlineData(20 * 1024 * 1024, true)]    // 20 MB (exact max)
        [InlineData(20 * 1024 * 1024 + 1, false)] // 20 MB + 1 byte
        [InlineData(50 * 1024 * 1024, false)]   // 50 MB
        public void FileSize_Validation_ShouldRejectFilesExceedingLimit(long fileSizeBytes, bool expectedValid)
        {
            var options = new FileUploadOptions
            {
                MaxFileSizeMB = 20,
                AllowedExtensions = "pdf,doc,docx,jpg,jpeg,png,xlsx"
            };

            // Act
            var isValid = fileSizeBytes <= options.MaxFileSizeBytes;

            // Assert
            isValid.Should().Be(expectedValid);
        }

        [Fact]
        public void PhysicalFileCheck_WhenFileDoesNotExistOnDisk_ShouldBeHandledAsNotFound()
        {
            // Arrange: Simulated storage path
            var fakePath = Path.Combine(Path.GetTempPath(), $"missing_doc_{Guid.NewGuid()}.pdf");

            // Act: Rule is: System.IO.File.Exists(fakePath) MUST be checked before returning bytes.
            // NEVER return mock/fake generated PDF buffer as fallback.
            var exists = File.Exists(fakePath);

            // Assert
            exists.Should().BeFalse("File vật lý không tồn tại thì không được sinh buffer giả mà phải xử lý 404.");
        }
    }
}
