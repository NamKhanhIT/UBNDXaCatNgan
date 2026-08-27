using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Api.IntegrationTests
{
    // =====================================================================
    // BẢO MẬT (Audit Đợt 4 - P4B): Unit test Cloudflare Turnstile validator.
    // Các nhánh: dev-chưa-cấu-hình · token trống · hợp lệ · bị từ chối · lỗi mạng.
    // =====================================================================
    public class TurnstileValidatorTests
    {
        private sealed class StubHandler : HttpMessageHandler
        {
            private readonly HttpResponseMessage _response;
            public int Calls { get; private set; }

            public StubHandler(HttpResponseMessage response) => _response = response;

            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                Calls++;
                return Task.FromResult(_response);
            }
        }

        private sealed class ThrowingHandler : HttpMessageHandler
        {
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
                => throw new HttpRequestException("mạng đứt");
        }

        private static TurnstileValidator Build(string secret, HttpMessageHandler handler) =>
            new(
                new HttpClient(handler),
                Options.Create(new TurnstileOptions { SecretKey = secret }),
                NullLogger<TurnstileValidator>.Instance);

        [Fact]
        public async Task Empty_SecretKey_DevMode_Always_Passes()
        {
            var validator = Build(string.Empty, new StubHandler(new HttpResponseMessage(HttpStatusCode.Forbidden)));

            (await validator.ValidateAsync(null, null, CancellationToken.None)).Should().BeTrue();
            (await validator.ValidateAsync("any-token", "1.2.3.4", CancellationToken.None)).Should().BeTrue();
        }

        [Fact]
        public async Task Configured_Empty_Token_Fails_Closed()
        {
            var validator = Build("secret", new StubHandler(SuccessResponse()));

            (await validator.ValidateAsync(null, null, CancellationToken.None)).Should().BeFalse();
            (await validator.ValidateAsync("   ", null, CancellationToken.None)).Should().BeFalse();
        }

        [Fact]
        public async Task Configured_Valid_Token_Passes_And_Calls_Siteverify()
        {
            var handler = new StubHandler(SuccessResponse());
            var validator = Build("secret", handler);

            var ok = await validator.ValidateAsync("good-token", "1.2.3.4", CancellationToken.None);

            ok.Should().BeTrue();
            handler.Calls.Should().Be(1);
        }

        [Fact]
        public async Task Configured_Rejected_Token_Fails()
        {
            var body = "{\"success\":false,\"error-codes\":[\"invalid-input-response\"]}";
            var validator = Build("secret",
                new StubHandler(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(body) }));

            (await validator.ValidateAsync("bad-token", null, CancellationToken.None)).Should().BeFalse();
        }

        [Fact]
        public async Task Configured_Non200_Response_Fails()
        {
            var validator = Build("secret",
                new StubHandler(new HttpResponseMessage(HttpStatusCode.InternalServerError)));

            (await validator.ValidateAsync("token", null, CancellationToken.None)).Should().BeFalse();
        }

        [Fact]
        public async Task Network_Error_Fails_Closed_When_Configured()
        {
            var validator = Build("secret", new ThrowingHandler());

            (await validator.ValidateAsync("token", null, CancellationToken.None)).Should().BeFalse(
                "Cloudflare unreachable phải fail-closed khi đã cấu hình");
        }

        private static HttpResponseMessage SuccessResponse() =>
            new(HttpStatusCode.OK) { Content = new StringContent("{\"success\":true}") };
    }
}
