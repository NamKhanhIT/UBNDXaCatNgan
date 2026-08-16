using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using Quanlycongviec.Application.AI.Models;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.AI;
using Xunit;

namespace Quanlycongviec.Application.Tests.AI
{
    public class OllamaAndApiAiServiceTests
    {
        private readonly Mock<ILogger<OllamaDocumentAiService>> _ollamaLoggerMock;
        private readonly Mock<ILogger<ApiCompatibleDocumentAiService>> _apiLoggerMock;
        private readonly IOptions<AiProviderOptions> _options;

        public OllamaAndApiAiServiceTests()
        {
            _ollamaLoggerMock = new Mock<ILogger<OllamaDocumentAiService>>();
            _apiLoggerMock = new Mock<ILogger<ApiCompatibleDocumentAiService>>();
            _options = Options.Create(new AiProviderOptions
            {
                Type = "Ollama",
                ConfidenceThreshold = 0.6,
                Ollama = new OllamaOptions
                {
                    BaseUrl = "http://localhost:11434",
                    Model = "qwen3.6:35b-a3b"
                },
                Api = new ApiOptions
                {
                    BaseUrl = "https://api.openai.com/v1",
                    ApiKey = "sk-test",
                    Model = "gpt-4o",
                    DataSovereigntyAcknowledged = true
                }
            });
        }

        private HttpClient CreateMockHttpClient(string responseContent, HttpStatusCode statusCode = HttpStatusCode.OK)
        {
            var handlerMock = new Mock<HttpMessageHandler>();
            handlerMock
                .Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>()
                )
                .ReturnsAsync(new HttpResponseMessage
                {
                    StatusCode = statusCode,
                    Content = new StringContent(responseContent)
                });

            return new HttpClient(handlerMock.Object)
            {
                BaseAddress = new Uri("http://localhost:11434")
            };
        }

        #region Ollama Tests

        [Fact]
        public async Task Ollama_AnalyzeDocumentAsync_ValidResponse_ShouldParseAllFields()
        {
            // Arrange
            var deptId = Guid.NewGuid();
            var departments = new List<DepartmentOption>
            {
                new DepartmentOption { Id = deptId, Name = "Phòng Kinh tế - Hạ tầng" }
            };

            var aiJson = JsonSerializer.Serialize(new
            {
                category = "SuperiorDirective",
                title = "Chỉ đạo xử lý vi phạm hành lang an toàn giao thông",
                summary = "Yêu cầu các xã giải tỏa dứt điểm các điểm lấn chiếm vỉa hè, lòng đường.",
                deadlineDate = "2026-09-01",
                eventStartDateTime = (string?)null,
                eventEndDateTime = (string?)null,
                subjects = new[] { "Đội trật tự đô thị", "Công an xã", "Trưởng thôn" },
                objectives = "Giải tỏa 100% các điểm lấn chiếm trước 01/09/2026",
                suggestedDepartmentId = deptId.ToString(),
                confidence = 0.95
            });

            var ollamaApiResponse = JsonSerializer.Serialize(new
            {
                model = "qwen3.6:35b-a3b",
                message = new { role = "assistant", content = aiJson },
                done = true
            });

            var httpClient = CreateMockHttpClient(ollamaApiResponse);
            var service = new OllamaDocumentAiService(httpClient, _options, _ollamaLoggerMock.Object);

            // Act
            var result = await service.AnalyzeDocumentAsync("Nội dung văn bản mẫu...", departments, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Category.Should().Be(DocumentCategory.SuperiorDirective);
            result.Title.Should().Be("Chỉ đạo xử lý vi phạm hành lang an toàn giao thông");
            result.Summary.Should().Contain("giải tỏa dứt điểm");
            result.DeadlineDate.Should().Be(new DateTime(2026, 9, 1));
            result.Subjects.Should().HaveCount(3);
            result.Subjects.Should().Contain("Công an xã");
            result.SuggestedDepartmentId.Should().Be(deptId);
            result.SuggestedDepartmentName.Should().Be("Phòng Kinh tế - Hạ tầng");
            result.Confidence.Should().Be(0.95);
            result.LowConfidence.Should().BeFalse();
        }

        [Fact]
        public async Task Ollama_AnalyzeDocumentAsync_AntiHallucination_MissingFieldsShouldBeNull()
        {
            // Arrange
            var departments = new List<DepartmentOption>
            {
                new DepartmentOption { Id = Guid.NewGuid(), Name = "Văn phòng HĐND & UBND" }
            };

            // AI trả về các trường không có trong văn bản là null
            var aiJson = JsonSerializer.Serialize(new
            {
                category = "Other",
                title = "Thông báo chung",
                summary = (string?)null,
                deadlineDate = (string?)null,
                objectives = (string?)null,
                suggestedDepartmentId = (string?)null,
                confidence = 0.75
            });

            var ollamaApiResponse = JsonSerializer.Serialize(new
            {
                model = "qwen3.6:35b-a3b",
                message = new { role = "assistant", content = aiJson },
                done = true
            });

            var httpClient = CreateMockHttpClient(ollamaApiResponse);
            var service = new OllamaDocumentAiService(httpClient, _options, _ollamaLoggerMock.Object);

            // Act
            var result = await service.AnalyzeDocumentAsync("Văn bản ngắn không có hạn chót...", departments, CancellationToken.None);

            // Assert
            result.Title.Should().Be("Thông báo chung");
            result.Summary.Should().BeNull("Không được tự bịa tóm tắt");
            result.DeadlineDate.Should().BeNull("Không được tự bịa hạn chót");
            result.Objectives.Should().BeNull();
            result.SuggestedDepartmentId.Should().BeNull();
            result.Subjects.Should().BeEmpty();
        }

        [Fact]
        public async Task Ollama_SuggestAssignmentAsync_ShouldMatchCandidateAndAlternatives()
        {
            // Arrange
            var user1Id = Guid.NewGuid();
            var user2Id = Guid.NewGuid();
            var deptId = Guid.NewGuid();

            var candidates = new List<StaffWorkloadSnapshot>
            {
                new StaffWorkloadSnapshot
                {
                    UserId = user1Id,
                    FullName = "Trần Thị Mai",
                    RoleName = "Trưởng phòng Địa chính",
                    DepartmentName = "Phòng Kinh tế - Hạ tầng",
                    DepartmentId = deptId,
                    Expertise = "Đất đai, Quy hoạch",
                    YearsOfExperience = 8,
                    ActiveTasksCount = 2,
                    WorkloadPercentage = 20.0
                },
                new StaffWorkloadSnapshot
                {
                    UserId = user2Id,
                    FullName = "Phạm Đức Minh",
                    RoleName = "Chuyên viên",
                    DepartmentName = "Phòng Kinh tế - Hạ tầng",
                    DepartmentId = deptId,
                    Expertise = "Xây dựng",
                    YearsOfExperience = 3,
                    ActiveTasksCount = 4,
                    WorkloadPercentage = 40.0
                }
            };

            var aiJson = JsonSerializer.Serialize(new
            {
                suggestedUserId = user1Id.ToString(),
                suggestedUserName = "Trần Thị Mai",
                reason = "Đồng chí Mai có 8 năm kinh nghiệm chuyên sâu về địa chính và tải việc hiện tại thấp (20%).",
                suggestedDepartmentId = deptId.ToString(),
                suggestedDepartmentName = "Phòng Kinh tế - Hạ tầng",
                confidence = 0.9,
                alternatives = new[]
                {
                    new { userId = user2Id.ToString(), fullName = "Phạm Đức Minh", reason = "Có chuyên môn xây dựng hỗ trợ." }
                }
            });

            var ollamaApiResponse = JsonSerializer.Serialize(new
            {
                message = new { role = "assistant", content = aiJson }
            });

            var httpClient = CreateMockHttpClient(ollamaApiResponse);
            var service = new OllamaDocumentAiService(httpClient, _options, _ollamaLoggerMock.Object);

            // Act
            var suggestion = await service.SuggestAssignmentAsync("Kiểm tra ranh giới đất", candidates, CancellationToken.None);

            // Assert
            suggestion.Should().NotBeNull();
            suggestion.SuggestedUserId.Should().Be(user1Id);
            suggestion.SuggestedUserName.Should().Be("Trần Thị Mai");
            suggestion.Reason.Should().Contain("8 năm kinh nghiệm");
            suggestion.Confidence.Should().Be(0.9);
            suggestion.Alternatives.Should().HaveCount(1);
            suggestion.Alternatives.First().UserId.Should().Be(user2Id);
        }

        [Fact]
        public async Task Ollama_SuggestAssignmentAsync_InvalidUserIdFromAi_ShouldFallbackToLowestWorkload()
        {
            // Arrange
            var user1Id = Guid.NewGuid();
            var user2Id = Guid.NewGuid();

            var candidates = new List<StaffWorkloadSnapshot>
            {
                new StaffWorkloadSnapshot
                {
                    UserId = user1Id,
                    FullName = "Cán bộ tải cao",
                    ActiveTasksCount = 5,
                    WorkloadPercentage = 80.0
                },
                new StaffWorkloadSnapshot
                {
                    UserId = user2Id,
                    FullName = "Cán bộ tải thấp",
                    ActiveTasksCount = 1,
                    WorkloadPercentage = 10.0 // Lowest workload
                }
            };

            // AI trả về ID rác hoặc người không tồn tại
            var aiJson = JsonSerializer.Serialize(new
            {
                suggestedUserId = Guid.NewGuid().ToString(),
                suggestedUserName = "Người Không Tồn Tại",
                reason = "Lý do bất kỳ",
                confidence = 0.5
            });

            var ollamaApiResponse = JsonSerializer.Serialize(new
            {
                message = new { role = "assistant", content = aiJson }
            });

            var httpClient = CreateMockHttpClient(ollamaApiResponse);
            var service = new OllamaDocumentAiService(httpClient, _options, _ollamaLoggerMock.Object);

            // Act
            var suggestion = await service.SuggestAssignmentAsync("Nhiệm vụ bất kỳ", candidates, CancellationToken.None);

            // Assert — Fallback phải chọn người có tải việc thấp nhất
            suggestion.SuggestedUserId.Should().Be(user2Id);
            suggestion.SuggestedUserName.Should().Be("Cán bộ tải thấp");
            suggestion.Reason.Should().Contain("tải việc thấp nhất");
        }

        [Fact]
        public async Task Ollama_SuggestProgressChecklistAsync_ShouldParseItemsOrdered()
        {
            // Arrange
            var aiJson = JsonSerializer.Serialize(new
            {
                items = new[]
                {
                    new { title = "Khảo sát thực địa", order = 1 },
                    new { title = "Lập biên bản vi phạm", order = 2 },
                    new { title = "Báo cáo Chủ tịch xã", order = 3 }
                }
            });

            var ollamaApiResponse = JsonSerializer.Serialize(new
            {
                message = new { role = "assistant", content = aiJson }
            });

            var httpClient = CreateMockHttpClient(ollamaApiResponse);
            var service = new OllamaDocumentAiService(httpClient, _options, _ollamaLoggerMock.Object);

            // Act
            var checklist = await service.SuggestProgressChecklistAsync("Xử lý vi phạm đất đai", CancellationToken.None);

            // Assert
            checklist.Should().HaveCount(3);
            checklist[0].Title.Should().Be("Khảo sát thực địa");
            checklist[0].Order.Should().Be(1);
            checklist[1].Title.Should().Be("Lập biên bản vi phạm");
            checklist[2].Title.Should().Be("Báo cáo Chủ tịch xã");
        }

        [Fact]
        public async Task Ollama_InvalidJsonContent_ShouldThrowInvalidOperationException()
        {
            // Arrange: Ollama trả về văn bản thường thay vì JSON
            var ollamaApiResponse = JsonSerializer.Serialize(new
            {
                message = new { role = "assistant", content = "Đây không phải JSON hợp lệ..." }
            });

            var httpClient = CreateMockHttpClient(ollamaApiResponse);
            var service = new OllamaDocumentAiService(httpClient, _options, _ollamaLoggerMock.Object);

            // Act
            Func<Task> act = async () => await service.AnalyzeDocumentAsync("text", new List<DepartmentOption>(), CancellationToken.None);

            // Assert
            await act.Should().ThrowAsync<InvalidOperationException>()
                .WithMessage("*JSON không hợp lệ*");
        }

        #endregion

        #region ApiCompatible Tests

        [Fact]
        public async Task ApiCompatible_AnalyzeDocumentAsync_OpenAiFormat_ShouldParseCorrectly()
        {
            // Arrange
            var deptId = Guid.NewGuid();
            var departments = new List<DepartmentOption>
            {
                new DepartmentOption { Id = deptId, Name = "Văn phòng HĐND & UBND" }
            };

            var aiJson = JsonSerializer.Serialize(new
            {
                category = "MeetingInvitation",
                title = "Thư mời họp HĐND xã kỳ họp bất thường",
                summary = "Họp thông qua tờ trình điều chỉnh ngân sách xã năm 2026.",
                eventStartDateTime = "2026-08-20T08:00:00",
                eventEndDateTime = "2026-08-20T11:30:00",
                suggestedDepartmentId = deptId.ToString(),
                confidence = 0.98
            });

            // OpenAI Chat Completions response format
            var openAiResponse = JsonSerializer.Serialize(new
            {
                id = "chatcmpl-123",
                choices = new[]
                {
                    new
                    {
                        message = new { role = "assistant", content = aiJson },
                        finish_reason = "stop"
                    }
                }
            });

            var httpClient = CreateMockHttpClient(openAiResponse);
            var service = new ApiCompatibleDocumentAiService(httpClient, _options, _apiLoggerMock.Object);

            // Act
            var result = await service.AnalyzeDocumentAsync("Thư mời họp...", departments, CancellationToken.None);

            // Assert
            result.Should().NotBeNull();
            result.Category.Should().Be(DocumentCategory.MeetingInvitation);
            result.Title.Should().Be("Thư mời họp HĐND xã kỳ họp bất thường");
            result.EventStartDateTime.Should().Be(new DateTime(2026, 8, 20, 8, 0, 0));
            result.SuggestedDepartmentId.Should().Be(deptId);
            result.Confidence.Should().Be(0.98);
        }

        [Fact]
        public async Task ApiCompatible_SuggestProgressChecklistAsync_ShouldParseItems()
        {
            // Arrange
            var aiJson = JsonSerializer.Serialize(new
            {
                items = new[]
                {
                    new { title = "Chuẩn bị tài liệu kỳ họp", order = 1 },
                    new { title = "Gửi giấy mời tới đại biểu", order = 2 }
                }
            });

            var openAiResponse = JsonSerializer.Serialize(new
            {
                choices = new[]
                {
                    new { message = new { content = aiJson } }
                }
            });

            var httpClient = CreateMockHttpClient(openAiResponse);
            var service = new ApiCompatibleDocumentAiService(httpClient, _options, _apiLoggerMock.Object);

            // Act
            var checklist = await service.SuggestProgressChecklistAsync("Tổ chức kỳ họp", CancellationToken.None);

            // Assert
            checklist.Should().HaveCount(2);
            checklist[0].Title.Should().Be("Chuẩn bị tài liệu kỳ họp");
            checklist[1].Title.Should().Be("Gửi giấy mời tới đại biểu");
        }

        #endregion
    }
}
