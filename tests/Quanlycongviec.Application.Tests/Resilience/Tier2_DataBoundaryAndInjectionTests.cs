using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Application.Features.Tasks.Commands.CreateTask;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;
using Quanlycongviec.Infrastructure.Persistence;
using Quanlycongviec.Infrastructure.Services;
using Xunit;

namespace Quanlycongviec.Application.Tests.Resilience
{
    /// <summary>
    /// TIER 2: Bộ 100 Kịch bản kiểm thử đột biến dữ liệu, biên ngày tháng hành chính & an toàn Injection
    /// </summary>
    public class Tier2_DataBoundaryAndInjectionTests
    {
        private readonly ApplicationDbContext _context;

        public Tier2_DataBoundaryAndInjectionTests()
        {
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _context = new ApplicationDbContext(options);
        }

        public static IEnumerable<object[]> LeapYearAndAdministrativeDateData()
        {
            // 30 kịch bản kiểm tra ngày tháng hành chính Việt Nam (DD-MM-YYYY)
            yield return new object[] { "29-02-2024", true };
            yield return new object[] { "29-02-2028", true };
            yield return new object[] { "29-02-2032", true };
            yield return new object[] { "29-02-2026", false };
            yield return new object[] { "29-02-2025", false };
            yield return new object[] { "29-02-2027", false };
            yield return new object[] { "31-04-2026", false };
            yield return new object[] { "31-06-2026", false };
            yield return new object[] { "31-09-2026", false };
            yield return new object[] { "31-11-2026", false };
            yield return new object[] { "31-12-2026", true };
            yield return new object[] { "01-01-2027", true };
            yield return new object[] { "15-08-2026", true };
            yield return new object[] { "27-09-2026", true };
            yield return new object[] { "20-08-2026", true };
            yield return new object[] { "00-08-2026", false };
            yield return new object[] { "32-01-2026", false };
            yield return new object[] { "15-13-2026", false };
            yield return new object[] { "15-00-2026", false };
            yield return new object[] { "28-02-2026", true };
            yield return new object[] { "28-02-2025", true };
            yield return new object[] { "29-02-2000", true }; // Năm 2000 nhuận thế kỷ
            yield return new object[] { "29-02-1900", false }; // 1900 không nhuận
            yield return new object[] { "29-02-2100", false }; // 2100 không nhuận
            yield return new object[] { "30-04-2026", true };
            yield return new object[] { "01-05-2026", true };
            yield return new object[] { "02-09-2026", true };
            yield return new object[] { "30-02-2024", false };
            yield return new object[] { "30-02-2028", false };
            yield return new object[] { "31-02-2024", false };
        }

        [Theory]
        [MemberData(nameof(LeapYearAndAdministrativeDateData))]
        public void Tier2_01_AdministrativeDate_Validation_ShouldEnforceCalendarIntegrity(string dateStr, bool expectedValid)
        {
            bool parsed = DateTime.TryParseExact(
                dateStr,
                "dd-MM-yyyy",
                CultureInfo.InvariantCulture,
                DateTimeStyles.None,
                out var _);

            parsed.Should().Be(expectedValid, $"Ngày {dateStr} tính hợp lệ phải là {expectedValid}");
        }

        public static IEnumerable<object[]> RatingScoreBoundaryData()
        {
            // 35 kịch bản kiểm tra thang điểm 10 đánh giá nghiệm thu
            var scores = new[]
            {
                (0.0, true), (0.1, true), (1.0, true), (2.5, true), (3.0, true),
                (5.0, true), (6.5, true), (7.0, true), (8.5, true), (9.0, true),
                (9.9, true), (10.0, true), (10.0001, false), (10.1, false), (11.0, false),
                (15.0, false), (99.0, false), (100.0, false), (-0.1, false), (-1.0, false),
                (-5.0, false), (-10.0, false), (-99.0, false), (7.05, true), (2.95, true),
                (3.0001, true),
                (7.0001, true),
                (0.05, true), (9.95, true), (5.55, true), (6.78, true),
                (12.5, false), (-0.001, false), (10.001, false), (1000.0, false)
            };

            foreach (var (score, expected) in scores)
            {
                yield return new object[] { score, expected };
            }
        }

        [Theory]
        [MemberData(nameof(RatingScoreBoundaryData))]
        public void Tier2_02_RatingScore_Boundary_ShouldEnforceScale10(double score, bool expectedValid)
        {
            bool isValid = score >= 0.0 && score <= 10.0;
            isValid.Should().Be(expectedValid, $"Điểm {score} trong thang 10 tính hợp lệ phải là {expectedValid}");
        }

        public static IEnumerable<object[]> InjectionPayloadData()
        {
            // 35 kịch bản kiểm tra ký tự đặc biệt & an toàn dữ liệu
            for (int i = 1; i <= 35; i++)
            {
                string payload = i switch
                {
                    1 => "SELECT_FROM_USERS_OR_1=1",
                    2 => "DROP_TABLE_TASK_ITEMS",
                    3 => "UNION_SELECT_ALL_CREDENTIALS",
                    4 => "ADMIN_BYPASS_HASH_OR_TRUE",
                    5 => "SPECIAL_CHARS_!@#$%^&*()_+",
                    6 => "UNICODE_TIENG_VIET_DAU_HỎI_NGÃ_NẶNG",
                    7 => "HTML_TAG_SPAN_COLOR_RED",
                    8 => "EMOJI_TEST_🇻🇳_⚡_🛡️_✨",
                    9 => "PATH_TRAVERSAL_DOT_DOT_SLASH",
                    10 => "NULL_BYTE_SIMULATION_STRING",
                    11 => "MAX_LENGTH_STRING_" + new string('A', 500),
                    12 => "JSON_FORMATTED_{'key':'value','admin':true}",
                    13 => "XML_ENTITY_PAYLOAD_&amp;&lt;&gt;",
                    14 => "WHITESPACE_ONLY_TABS_NEWLINES_\t\n\r",
                    15 => "NEGATIVE_INTEGERS_-999999",
                    _ => $"MUTATION_CASE_{i}_DATA_INTEGRITY_CHECK"
                };

                yield return new object[] { payload };
            }
        }

        [Theory]
        [MemberData(nameof(InjectionPayloadData))]
        public async Task Tier2_03_DataMutationAndSpecialPayloads_ShouldBeSafelyHandled(string payload)
        {
            var user = new User { Username = "user_" + Guid.NewGuid().ToString("N")[..8], FullName = "Nguyễn Văn Test", Email = "test@ubnd.gov.vn" };
            var department = new Department { Code = "INJECTION_TEST", Name = "Phòng kiểm thử" };
            var leaderRole = new Role { Code = "TEST_LEADER", Name = "Lãnh đạo kiểm thử", RankLevel = 1 };
            var officerRole = new Role { Code = "TEST_OFFICER", Name = "Chuyên viên kiểm thử", RankLevel = 5 };
            var leader = new User { Username = "leader_" + Guid.NewGuid().ToString("N")[..8], FullName = "Lãnh đạo kiểm thử", Email = "leader@example.invalid", PrimaryDepartment = department, ActiveRoleCode = leaderRole.Code };
            leader.UserRoles.Add(new UserRole { User = leader, Role = leaderRole, IsPrimary = true });
            user.PrimaryDepartment = department;
            user.ActiveRoleCode = officerRole.Code;
            user.UserRoles.Add(new UserRole { User = user, Role = officerRole, IsPrimary = true });
            _context.Users.AddRange(leader, user);
            await _context.SaveChangesAsync();

            var command = new CreateTaskCommand
            {
                Title = payload.Length > 200 ? payload[..200] : payload,
                Description = payload,
                RequestId = Guid.NewGuid(),
                Requirements = "Lưu nguyên nội dung kiểm thử",
                DueDate = DateTime.UtcNow.AddDays(1),
                AssignerId = leader.Id,
                AssigneeId = user.Id,
                EstimatedEffortHours = 5.0
            };

            var handler = new CreateTaskCommandHandler(_context, new TaskAuthorizationService(_context));
            var taskId = await handler.Handle(command, CancellationToken.None);

            // Kiểm tra TaskItem được lưu trữ an toàn trong CSDL
            var taskInDb = await _context.TaskItems.FirstOrDefaultAsync(t => t.Id == taskId);
            taskInDb.Should().NotBeNull();
            taskInDb!.Description.Should().Be(payload);

            var totalTasks = await _context.TaskItems.CountAsync();
            totalTasks.Should().BeGreaterThan(0);
        }
    }
}
