using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Quanlycongviec.Api.Middleware;
using Xunit;

public class WorkflowCancellationTests
{
    [Theory]
    [InlineData(true, 499)]
    [InlineData(false, 500)]
    public async Task ClientCancellation_IsNotReportedAsServerFailure(bool aborted, int expectedStatus)
    {
        var context = new DefaultHttpContext { RequestAborted = new CancellationToken(aborted) };
        context.Response.Body = new MemoryStream();
        var middleware = new ApiExceptionHandlingMiddleware(_ => throw new OperationCanceledException("Fixture cancellation"),
            NullLogger<ApiExceptionHandlingMiddleware>.Instance, new Mock<IHostEnvironment>().Object);
        await middleware.InvokeAsync(context);
        Assert.Equal(expectedStatus, context.Response.StatusCode);
        if (aborted) Assert.Equal(0, context.Response.Body.Length);
    }
}
