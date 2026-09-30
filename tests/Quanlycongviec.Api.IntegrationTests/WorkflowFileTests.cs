using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Quanlycongviec.Api.Controllers;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Common.Options;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;

namespace Quanlycongviec.Api.IntegrationTests;

public sealed class WorkflowFileTests
{
    [Fact]
    public async Task UploadRetry_AfterDocumentWasPresented_ReturnsPersistedAttachmentWithoutNewWrite()
    {
        await using var f = await Fixture.Create();
        var requestId = Guid.NewGuid();
        var first = Assert.IsType<OkObjectResult>(await f.Controller.UploadFile(f.Pdf(), f.Doc.Id, requestId: requestId));
        f.Doc.BusinessStatus = "Submitted"; f.Doc.Version = Guid.NewGuid();
        await f.Db.SaveChangesAsync();
        var second = Assert.IsType<OkObjectResult>(await f.Controller.UploadFile(f.Pdf(), f.Doc.Id, requestId: requestId));
        Assert.Equal(System.Text.Json.JsonSerializer.SerializeToElement(first.Value).GetProperty("data").GetGuid(),
            System.Text.Json.JsonSerializer.SerializeToElement(second.Value).GetProperty("data").GetGuid());
        Assert.Single(await f.Db.DocumentAttachments.ToListAsync());
        Assert.Single(await f.Db.WorkflowRequests.ToListAsync());
    }

    [Fact]
    public async Task UploadAndAnalyze_WhenOcrFails_PreservesFileForManualAssignment()
    {
        await using var f = await Fixture.Create();
        f.Ocr.Setup(x => x.ExtractTextAsync(It.IsAny<Stream>(), "pdf", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Synthetic OCR outage"));
        var result = Assert.IsType<OkObjectResult>(await f.Controller.UploadAndAnalyze(f.Pdf(), f.Doc.Id, default));
        var payload = System.Text.Json.JsonSerializer.SerializeToElement(result.Value);
        Assert.True(payload.GetProperty("success").GetBoolean());
        Assert.False(string.IsNullOrWhiteSpace(payload.GetProperty("aiError").GetString()));
        var file = await f.Db.DocumentAttachments.SingleAsync();
        Assert.True(File.Exists(file.FilePath));
        Assert.Equal("New", f.Doc.BusinessStatus);
        Assert.Empty(await f.Db.TaskItems.ToListAsync());
    }

    private sealed class Fixture : IAsyncDisposable
    {
        public ApplicationDbContext Db { get; } = new(new DbContextOptionsBuilder<ApplicationDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        public Mock<IOcrService> Ocr { get; } = new();
        public InboxDocument Doc { get; private set; } = null!;
        public FilesController Controller { get; private set; } = null!;
        public static async Task<Fixture> Create()
        {
            var f = new Fixture();
            var user = new User { Username = "file_fixture", Email = "file@example.invalid" };
            f.Db.WorkflowPermissions.Add(new WorkflowPermission { UserId = user.Id, CanReceiveDocuments = true });
            f.Doc = new InboxDocument { Subject = "Văn bản mẫu", ReceivedByUserId = user.Id };
            f.Db.Users.Add(user); f.Db.InboxDocuments.Add(f.Doc); await f.Db.SaveChangesAsync();
            f.Controller = new FilesController(f.Db, f.Ocr.Object, Mock.Of<IDocumentAiService>(),
                Options.Create(new FileUploadOptions { AllowedExtensions = "pdf", MaxFileSizeMB = 20 }),
                NullLogger<FilesController>.Instance, new DocumentAccessService(f.Db, new TaskAuthorizationService(f.Db)))
            { ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext
                { User = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()) }, "Fixture")) } } };
            return f;
        }
        public IFormFile Pdf() => new FormFile(new MemoryStream(System.Text.Encoding.UTF8.GetBytes("%PDF-1.4\nsynthetic test document")), 0, 32, "file", "fixture.pdf");
        public async ValueTask DisposeAsync()
        {
            // Only fixture-owned attachment paths created by this test may be removed.
            foreach (var path in Db.DocumentAttachments.Local.Select(a => a.FilePath).Distinct())
                if (File.Exists(path)) File.Delete(path);
            await Db.DisposeAsync();
        }
    }
}
