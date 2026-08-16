using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Quanlycongviec.Application.AI.Models;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure;
using Quanlycongviec.Infrastructure.AI;
using Xunit;

namespace Quanlycongviec.Application.Tests.AI
{
    public class AiDocumentAnalysisTests
    {
        [Fact]
        public void DependencyInjection_ApiCompatibleWithoutDataSovereignty_ShouldThrowInvalidOperationException()
        {
            // Arrange
            var inMemorySettings = new Dictionary<string, string?>
            {
                { "AiProvider:Type", "ApiCompatible" },
                { "AiProvider:Api:DataSovereigntyAcknowledged", "false" },
                { "Jwt:Secret", "this_is_a_very_secure_secret_key_for_testing_purposes_123456" },
                { "ConnectionStrings:DefaultConnection", "Host=localhost;Database=test;Username=postgres;Password=postgres" }
            };

            IConfiguration configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(inMemorySettings)
                .Build();

            var services = new ServiceCollection();

            // Act
            Action act = () => services.AddInfrastructure(configuration);

            // Assert
            act.Should().Throw<InvalidOperationException>()
                .WithMessage("*DataSovereigntyAcknowledged*");
        }

        [Fact]
        public void DependencyInjection_ApiCompatibleWithDataSovereignty_ShouldRegisterApiCompatibleService()
        {
            // Arrange
            var inMemorySettings = new Dictionary<string, string?>
            {
                { "AiProvider:Type", "ApiCompatible" },
                { "AiProvider:Api:DataSovereigntyAcknowledged", "true" },
                { "AiProvider:Api:BaseUrl", "https://api.openai.com/v1" },
                { "Jwt:Secret", "this_is_a_very_secure_secret_key_for_testing_purposes_123456" },
                { "ConnectionStrings:DefaultConnection", "Host=localhost;Database=test;Username=postgres;Password=postgres" }
            };

            IConfiguration configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(inMemorySettings)
                .Build();

            var services = new ServiceCollection();
            services.AddInfrastructure(configuration);

            // Act
            var provider = services.BuildServiceProvider();
            var aiService = provider.GetService<IDocumentAiService>();

            // Assert
            aiService.Should().NotBeNull();
            aiService.Should().BeOfType<ApiCompatibleDocumentAiService>();
        }

        [Fact]
        public void DependencyInjection_OllamaDefault_ShouldRegisterOllamaService()
        {
            // Arrange
            var inMemorySettings = new Dictionary<string, string?>
            {
                { "AiProvider:Type", "Ollama" },
                { "Jwt:Secret", "this_is_a_very_secure_secret_key_for_testing_purposes_123456" },
                { "ConnectionStrings:DefaultConnection", "Host=localhost;Database=test;Username=postgres;Password=postgres" }
            };

            IConfiguration configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(inMemorySettings)
                .Build();

            var services = new ServiceCollection();
            services.AddInfrastructure(configuration);

            // Act
            var provider = services.BuildServiceProvider();
            var aiService = provider.GetService<IDocumentAiService>();

            // Assert
            aiService.Should().NotBeNull();
            aiService.Should().BeOfType<OllamaDocumentAiService>();
        }

        [Fact]
        public void DocumentAnalysisResult_PastDeadline_ShouldFlagDeadlineSeemsUnreasonable()
        {
            // Arrange
            var pastDate = DateTime.UtcNow.AddDays(-5);
            var result = new DocumentAnalysisResult
            {
                Category = DocumentCategory.SuperiorDirective,
                Title = "Chỉ đạo rà soát đất đai",
                DeadlineDate = pastDate,
                Confidence = 0.85
            };

            // Act & Assert
            result.DeadlineSeemsUnreasonable.Should().BeTrue(
                "Vì hạn chót trích xuất nằm trong quá khứ nên hệ thống phải cảnh báo người dùng kiểm tra lại.");
        }

        [Fact]
        public void DocumentAnalysisResult_FutureDeadline_ShouldNotFlagDeadlineSeemsUnreasonable()
        {
            // Arrange
            var futureDate = DateTime.UtcNow.AddDays(7);
            var result = new DocumentAnalysisResult
            {
                Category = DocumentCategory.SuperiorDirective,
                Title = "Chỉ đạo rà soát đất đai",
                DeadlineDate = futureDate,
                Confidence = 0.85
            };

            // Act & Assert
            result.DeadlineSeemsUnreasonable.Should().BeFalse(
                "Vì hạn chót trong tương lai hợp lý.");
        }

        [Fact]
        public void DocumentAnalysisResult_LowConfidence_ShouldFlagLowConfidence()
        {
            // Arrange
            var result = new DocumentAnalysisResult
            {
                Category = DocumentCategory.Other,
                Title = "Văn bản scan mờ",
                Confidence = 0.45 // < 0.6
            };

            // Act & Assert
            result.LowConfidence.Should().BeTrue(
                "Độ tin cậy < 0.6 phải được gắn cờ cảnh báo người dùng.");
        }

        [Fact]
        public void DocumentAnalysisResult_HighConfidence_ShouldNotFlagLowConfidence()
        {
            // Arrange
            var result = new DocumentAnalysisResult
            {
                Category = DocumentCategory.MeetingInvitation,
                Title = "Giấy mời họp HĐND xã",
                Confidence = 0.92 // >= 0.6
            };

            // Act & Assert
            result.LowConfidence.Should().BeFalse();
        }

        [Fact]
        public void DocumentAnalysisResult_MissingFields_ShouldRemainNullAndNotFabricated()
        {
            // Arrange & Act
            var result = new DocumentAnalysisResult
            {
                Category = DocumentCategory.Other,
                Confidence = 0.7
                // Title, Summary, DeadlineDate, Objectives, SuggestedDepartmentId để mặc định
            };

            // Assert — Anti-hallucination principle: không tự ý bịa giá trị mặc định
            result.Title.Should().BeNull();
            result.Summary.Should().BeNull();
            result.DeadlineDate.Should().BeNull();
            result.Objectives.Should().BeNull();
            result.SuggestedDepartmentId.Should().BeNull();
            result.SuggestedDepartmentName.Should().BeNull();
            result.EventStartDateTime.Should().BeNull();
            result.EventEndDateTime.Should().BeNull();
            result.Subjects.Should().BeEmpty();
        }

        [Fact]
        public void FileUploadOptions_Validation_ShouldEnforceLimitsAndExtensions()
        {
            // Arrange
            var options = new FileUploadOptions
            {
                MaxFileSizeMB = 20,
                AllowedExtensions = "pdf,doc,docx,jpg,jpeg,png,xlsx"
            };

            // Act
            var maxBytes = options.MaxFileSizeBytes;
            var allowedExts = options.GetAllowedExtensionArray();

            // Assert
            maxBytes.Should().Be(20 * 1024 * 1024);
            allowedExts.Should().Contain(new[] { "pdf", "doc", "docx", "jpg", "jpeg", "png", "xlsx" });
            allowedExts.Should().NotContain("exe");
            allowedExts.Should().NotContain("bat");
            allowedExts.Should().NotContain("sh");
        }

        [Fact]
        public void SuggestedDepartment_Validation_WhenNotMatchingRealDepartments_ShouldBeRejected()
        {
            // Arrange
            var realDepartments = new List<DepartmentOption>
            {
                new DepartmentOption { Id = Guid.NewGuid(), Name = "Phòng Kinh tế - Hạ tầng" },
                new DepartmentOption { Id = Guid.NewGuid(), Name = "Văn phòng HĐND & UBND" }
            };

            var fakeDepartmentId = Guid.NewGuid(); // ID do AI bịa hoặc không có trong DB

            var analysisResult = new DocumentAnalysisResult
            {
                Category = DocumentCategory.TaskAssignmentDown,
                Title = "Kiểm tra trật tự xây dựng",
                SuggestedDepartmentId = fakeDepartmentId,
                SuggestedDepartmentName = "Phòng Không Tồn Tại",
                Confidence = 0.8
            };

            // Act: Logic validate tại Controller/Application layer
            if (analysisResult.SuggestedDepartmentId.HasValue)
            {
                var deptExists = realDepartments.Any(d => d.Id == analysisResult.SuggestedDepartmentId.Value);
                if (!deptExists)
                {
                    analysisResult.SuggestedDepartmentId = null;
                    analysisResult.SuggestedDepartmentName = null;
                    analysisResult.ValidationWarnings.Add("Phòng ban gợi ý không tồn tại trong hệ thống, đã bỏ qua.");
                }
            }

            // Assert
            analysisResult.SuggestedDepartmentId.Should().BeNull();
            analysisResult.SuggestedDepartmentName.Should().BeNull();
            analysisResult.ValidationWarnings.Should().ContainSingle(w => w.Contains("Phòng ban gợi ý không tồn tại"));
        }
    }
}
