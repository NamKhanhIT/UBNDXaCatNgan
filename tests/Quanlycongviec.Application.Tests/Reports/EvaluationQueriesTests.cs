using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Reports.Queries.ExportEvaluationReport;
using Quanlycongviec.Application.Features.Reports.Queries.GetOfficerEvaluationDetail;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Xunit;

namespace Quanlycongviec.Application.Tests.Reports
{
    /// <summary>
    /// 07-09-2026: Tests cho các query mới trong Evaluation feature redesign.
    /// </summary>
    public class EvaluationQueriesTests
    {
        private readonly DbContextOptions<ApplicationDbContext> _dbOptions;

        public EvaluationQueriesTests()
        {
            _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(Guid.NewGuid().ToString())
                .Options;
        }

        // ── ViewDetail ────────────────────────────────────────────────────────

        [Fact]
        public async Task GetOfficerEvaluationDetail_IncludesTasksAndDocuments()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var userId = Guid.NewGuid();
            var otherUserId = Guid.NewGuid();
            var dept = new Department { Name = "Phòng KT" };

            var user = new User { Id = userId, Username = "u1", FullName = "Nguyễn Văn A", Email = "a@test.local", PrimaryDepartmentId = dept.Id };
            context.Users.Add(user);
            context.Departments.Add(dept);

            // Tasks
            for (int i = 0; i < 5; i++)
            {
                context.TaskItems.Add(new TaskItem
                {
                    Title = $"Task {i}",
                    AssigneeId = userId,
                    Status = i % 2 == 0 ? TaskStatusEnum.Completed : TaskStatusEnum.InProgress,
                    ProgressPercentage = i * 20,
                    DueDate = DateTime.UtcNow.AddDays(i),
                    CompletedAt = i % 2 == 0 ? DateTime.UtcNow.AddDays(-1) : null,
                    SystemScore = 2.5,
                });
            }

            // Documents (Inbox) — chỉ tính những doc do user này nhận
            for (int i = 0; i < 3; i++)
            {
                context.InboxDocuments.Add(new InboxDocument
                {
                    DocumentNumber = $"VB-{i}",
                    Subject = $"Văn bản {i}",
                    Sender = "UBND huyện",
                    ReceivedByUserId = userId,
                    ReceivedDate = DateTime.UtcNow.AddDays(-i),
                    Category = "Chỉ đạo",
                    IsUrgent = false,
                    Channel = InboxChannel.Internal,
                });
            }

            await context.SaveChangesAsync();

            var handler = new GetOfficerEvaluationDetailQueryHandler(context);
            var result = await handler.Handle(new GetOfficerEvaluationDetailQuery(userId), CancellationToken.None);

            result.Should().NotBeNull();
            result.UserId.Should().Be(userId);
            result.FullName.Should().Be("Nguyễn Văn A");
            result.RecentTasks.Should().HaveCount(5);
            result.RecentDocuments.Should().HaveCount(3);
            result.DepartmentName.Should().Be("Phòng KT");
            result.FinalScore.Should().BeInRange(0, 10);
        }

        // ── ExcelExport ───────────────────────────────────────────────────────

        [Fact]
        public async Task ExportEvaluationReport_ReturnsBytesWithValidCsvContent()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var user = new User { Username = "u", FullName = "Nguyễn Văn B", Email = "b@test.local" };
            context.Users.Add(user);
            context.TaskItems.Add(new TaskItem
            {
                Title = "Task 1",
                AssigneeId = user.Id,
                Status = TaskStatusEnum.Completed,
                ProgressPercentage = 100,
                SystemScore = 3.0,
            });
            await context.SaveChangesAsync();

            var handler = new ExportEvaluationReportQueryHandler(context);
            var (bytes, fileName, _) = await handler.Handle(
                new ExportEvaluationReportQuery("month", null, null, Guid.NewGuid(), 1, null, "csv"),
                CancellationToken.None);

            bytes.Should().NotBeNull();
            bytes.Should().NotBeEmpty();
            fileName.Should().StartWith("DanhGiaThiDua_");
            fileName.Should().EndWith(".csv");

            // Verify UTF-8 BOM
            bytes[0].Should().Be(0xEF);
            bytes[1].Should().Be(0xBB);
            bytes[2].Should().Be(0xBF);

            var content = System.Text.Encoding.UTF8.GetString(bytes);
            content.Should().Contain("Nguyễn Văn B");
            content.Should().Contain("STT,Họ tên");
        }

        [Theory]
        [InlineData("week")]
        [InlineData("month")]
        [InlineData("quarter")]
        [InlineData("halfyear")]
        [InlineData("year")]
        public async Task ExportEvaluationReport_AcceptsAllValidPeriods(string period)
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var handler = new ExportEvaluationReportQueryHandler(context);
            var (bytes, fileName, _) = await handler.Handle(
                new ExportEvaluationReportQuery(period, null, null, Guid.NewGuid(), 1, null, "csv"),
                CancellationToken.None);

            bytes.Should().NotBeEmpty();
            fileName.Should().Contain($"_{period}_");
        }

        [Fact]
        public async Task ExportEvaluationReport_InvalidPeriod_ThrowsArgumentException()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var handler = new ExportEvaluationReportQueryHandler(context);

            var act = () => handler.Handle(
                new ExportEvaluationReportQuery("daily", null, null, Guid.NewGuid(), 1, null, "csv"),
                CancellationToken.None);

            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*Period*");
        }

        // ── 07-09-2026: Tests cho format=xlsx ─────────────────────────────────

        [Fact]
        public async Task ExportEvaluationReport_XlsxFormat_ReturnsValidXlsxBytes()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var user = new User { Username = "u", FullName = "Nguyễn Văn X", Email = "x@test.local" };
            context.Users.Add(user);
            context.TaskItems.Add(new TaskItem
            {
                Title = "Task X",
                AssigneeId = user.Id,
                Status = TaskStatusEnum.Completed,
                ProgressPercentage = 100,
                SystemScore = 3.0,
                EvaluatorScore = 7.0,
                RatingScore = 10.0
            });
            await context.SaveChangesAsync();

            var handler = new ExportEvaluationReportQueryHandler(context);
            var (bytes, fileName, contentType) = await handler.Handle(
                new ExportEvaluationReportQuery("month", null, null, Guid.NewGuid(), 1, null, "xlsx"),
                CancellationToken.None);

            bytes.Should().NotBeNull();
            bytes.Should().NotBeEmpty();
            fileName.Should().StartWith("DanhGiaThiDua_");
            fileName.Should().EndWith(".xlsx");
            contentType.Should().Contain("spreadsheetml");

            // XLSX là ZIP-based OOXML: magic bytes = "PK\x03\x04"
            bytes[0].Should().Be(0x50); // 'P'
            bytes[1].Should().Be(0x4B); // 'K'
            bytes[2].Should().Be(0x03);
            bytes[3].Should().Be(0x04);
        }

        [Fact]
        public async Task ExportEvaluationReport_CsvFormat_DefaultsToCsvMimeType()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var handler = new ExportEvaluationReportQueryHandler(context);
            var (bytes, fileName, contentType) = await handler.Handle(
                new ExportEvaluationReportQuery("month", null, null, Guid.NewGuid(), 1, null, "csv"),
                CancellationToken.None);

            contentType.Should().Contain("text/csv");
            // Verify UTF-8 BOM
            bytes[0].Should().Be(0xEF);
            bytes[1].Should().Be(0xBB);
            bytes[2].Should().Be(0xBF);
        }

        [Fact]
        public async Task ExportEvaluationReport_XlsxFormat_EmptyData_StillProducesValidWorkbook()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var handler = new ExportEvaluationReportQueryHandler(context);
            var (bytes, fileName, contentType) = await handler.Handle(
                new ExportEvaluationReportQuery("month", null, null, Guid.NewGuid(), 1, null, "xlsx"),
                CancellationToken.None);

            bytes.Should().NotBeEmpty();
            fileName.Should().EndWith(".xlsx");
            contentType.Should().Contain("spreadsheetml");
            // ZIP magic
            bytes[0].Should().Be(0x50);
            bytes[1].Should().Be(0x4B);
        }

        [Fact]
        public async Task ExportEvaluationReport_InvalidFormat_Throws()
        {
            await using var context = new ApplicationDbContext(_dbOptions);
            var handler = new ExportEvaluationReportQueryHandler(context);

            var act = () => handler.Handle(
                new ExportEvaluationReportQuery("month", null, null, Guid.NewGuid(), 1, null, "pdf"),
                CancellationToken.None);

            await act.Should().ThrowAsync<ArgumentException>()
                .WithMessage("*Format*");
        }
    }
}
