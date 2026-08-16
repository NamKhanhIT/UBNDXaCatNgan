using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Quanlycongviec.Infrastructure.AI;
using Xunit;

namespace Quanlycongviec.Application.Tests.AI
{
    public class OcrAndSignatureServiceTests
    {
        [Theory]
        [InlineData("pdf", true)]
        [InlineData("PDF", true)]
        [InlineData(".pdf", true)]
        [InlineData("docx", true)]
        [InlineData("doc", true)]
        [InlineData("jpg", true)]
        [InlineData("jpeg", true)]
        [InlineData("png", true)]
        [InlineData("xlsx", true)]
        [InlineData("xls", false)]
        [InlineData("exe", false)]
        [InlineData("zip", false)]
        [InlineData("mp4", false)]
        [InlineData("dll", false)]
        public void CompositeOcrService_SupportsFileType_ShouldValidateCorrectly(string ext, bool expectedSupported)
        {
            // Arrange
            var logger = new Mock<ILogger<CompositeOcrService>>();
            var service = new CompositeOcrService(logger.Object);

            // Act
            var isSupported = service.SupportsFileType(ext);

            // Assert
            isSupported.Should().Be(expectedSupported);
        }

        [Fact]
        public async Task CompositeOcrService_ExtractTextAsync_UnsupportedType_ShouldThrowNotSupportedException()
        {
            // Arrange
            var logger = new Mock<ILogger<CompositeOcrService>>();
            var service = new CompositeOcrService(logger.Object);

            using var stream = new MemoryStream(Encoding.UTF8.GetBytes("fake bytes"));

            // Act
            Func<Task> act = async () => await service.ExtractTextAsync(stream, "unknown_ext", CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<NotSupportedException>()
                .WithMessage("*Không hỗ trợ trích xuất text từ file .unknown_ext*");
        }

        [Fact]
        public void NoOpSignatureProvider_IsConfigured_ShouldReturnFalse()
        {
            // Arrange
            var logger = new Mock<ILogger<NoOpSignatureProvider>>();
            var provider = new NoOpSignatureProvider(logger.Object);

            // Act & Assert
            provider.IsConfigured.Should().BeFalse(
                "Vì giai đoạn này chưa tích hợp thiết bị/nhà cung cấp token ký số thật (VNPT-CA/Viettel-CA).");
        }

        [Fact]
        public async Task NoOpSignatureProvider_SignDocumentAsync_ShouldReturnHandledFailureWithoutCrashing()
        {
            // Arrange
            var logger = new Mock<ILogger<NoOpSignatureProvider>>();
            var provider = new NoOpSignatureProvider(logger.Object);
            var docId = Guid.NewGuid();
            var signerId = Guid.NewGuid();

            // Act
            var result = await provider.SignDocumentAsync(docId, signerId, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Success.Should().BeFalse();
            result.ErrorMessage.Should().Contain("Chữ ký số chưa được cấu hình");
        }
    }
}
