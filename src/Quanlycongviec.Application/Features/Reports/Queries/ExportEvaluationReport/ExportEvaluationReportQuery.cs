using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using ClosedXML.Excel;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;

namespace Quanlycongviec.Application.Features.Reports.Queries.ExportEvaluationReport
{
    /// <summary>
    /// 07-09-2026: Xuất báo cáo thi đua. Hỗ trợ 2 format:
    ///   - "csv" (mặc định): UTF-8 BOM CSV, mở được bằng Excel trực tiếp.
    ///   - "xlsx": file .xlsx chuẩn qua ClosedXML — header bold, borders, freeze row, auto-fit.
    /// Period: week | month | quarter | halfyear | year.
    /// </summary>
    public record ExportEvaluationReportQuery(
        string Period,
        DateTime? From,
        DateTime? To,
        Guid CurrentUserId,
        int UserRankLevel,
        Guid? DepartmentId,
        string Format = "csv"
    ) : IRequest<(byte[] FileBytes, string FileName, string ContentType)>;

    public class ExportEvaluationReportQueryHandler
        : IRequestHandler<ExportEvaluationReportQuery, (byte[], string, string)>
    {
        private readonly IApplicationDbContext _context;

        public ExportEvaluationReportQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<(byte[], string, string)> Handle(
            ExportEvaluationReportQuery request,
            CancellationToken cancellationToken)
        {
            // Validate period
            var validPeriods = new[] { "week", "month", "quarter", "halfyear", "year" };
            if (string.IsNullOrEmpty(request.Period) || !validPeriods.Contains(request.Period.ToLowerInvariant()))
            {
                throw new ArgumentException($"Period phải là một trong: {string.Join(", ", validPeriods)}");
            }

            // Validate format
            string format = string.IsNullOrEmpty(request.Format) ? "csv" : request.Format.ToLowerInvariant();
            if (format != "csv" && format != "xlsx")
            {
                throw new ArgumentException("Format phải là 'csv' hoặc 'xlsx'.");
            }

            // Tính from/to theo period (nếu client không truyền)
            var (from, to) = ResolvePeriodRange(request.Period, request.From, request.To);

            // Lấy data giống GetGRADReportQuery
            var users = await _context.Users
                .AsNoTracking()
                .Include(u => u.PrimaryDepartment)
                .Where(u => !u.IsDeleted)
                .ToListAsync(cancellationToken);

            if (request.UserRankLevel is 3 or 4 && request.DepartmentId.HasValue)
            {
                users = users.Where(u => u.PrimaryDepartmentId == request.DepartmentId.Value).ToList();
            }
            else if (request.UserRankLevel > 4 && request.CurrentUserId != Guid.Empty)
            {
                users = users.Where(u => u.Id == request.CurrentUserId).ToList();
            }

            var tasks = await _context.TaskItems
                .AsNoTracking()
                .Where(t => !t.IsDeleted)
                .ToListAsync(cancellationToken);

            // Build (officer → metrics)
            var rows = new System.Collections.Generic.List<OfficerExportRow>();
            foreach (var user in users)
            {
                var userTasks = tasks.Where(t => t.AssigneeId == user.Id).ToList();

                double systemScore;
                var withSys = userTasks.Where(t => t.SystemScore.HasValue).ToList();
                if (withSys.Any())
                {
                    var avg = withSys.Average(t => t.SystemScore!.Value);
                    systemScore = avg > 3.0 ? Math.Round(avg / 10.0, 1) : Math.Round(avg, 1);
                }
                else
                {
                    systemScore = userTasks.Count == 0 ? 0.0
                        : Math.Round(
                            (double)(userTasks.Count - userTasks.Count(t => t.Status != Domain.Enums.TaskStatusEnum.Completed && t.DueDate < DateTime.UtcNow)) / userTasks.Count * 1.5
                            + userTasks.Average(t => t.ProgressPercentage) / 100.0 * 1.0 + 0.5
                          , 1);
                }
                systemScore = Math.Clamp(systemScore, 0.0, 3.0);

                double leaderScore;
                var withEval = userTasks.Where(t => t.EvaluatorScore.HasValue).ToList();
                if (withEval.Any())
                {
                    var avg = withEval.Average(t => t.EvaluatorScore!.Value);
                    leaderScore = avg > 7.0 ? Math.Round(avg / 10.0, 1) : Math.Round(avg, 1);
                }
                else
                {
                    var withRating = userTasks.Where(t => t.RatingScore.HasValue).ToList();
                    leaderScore = withRating.Any()
                        ? Math.Round((withRating.Average(t => t.RatingScore!.Value) / 10.0) * 7.0, 1)
                        : 6.3;
                }
                leaderScore = Math.Clamp(leaderScore, 0.0, 7.0);

                var totalScore = Math.Round(systemScore + leaderScore, 1);
                var grade = totalScore >= 9.0 ? "Hoàn thành xuất sắc"
                    : totalScore >= 7.5 ? "Hoàn thành tốt"
                    : totalScore >= 6.0 ? "Hoàn thành"
                    : "Cần cải thiện";

                rows.Add(new OfficerExportRow
                {
                    Stt = rows.Count + 1,
                    FullName = user.FullName,
                    RoleCode = user.ActiveRoleCode ?? "",
                    DepartmentName = user.PrimaryDepartment?.Name ?? "",
                    TotalTasks = userTasks.Count,
                    Completed = userTasks.Count(t => t.Status == Domain.Enums.TaskStatusEnum.Completed),
                    Overdue = userTasks.Count(t => t.Status != Domain.Enums.TaskStatusEnum.Completed && t.DueDate.HasValue && t.DueDate.Value < DateTime.UtcNow),
                    SystemScore = systemScore,
                    LeaderScore = leaderScore,
                    TotalScore = totalScore,
                    Grade = grade
                });
            }

            string periodLabel = $"{request.Period} ({from:dd-MM-yyyy} → {to:dd-MM-yyyy})";

            if (format == "xlsx")
            {
                return BuildXlsxReport(rows, periodLabel, request.Period, from, to);
            }
            else
            {
                return BuildCsvReport(rows, periodLabel, request.Period, from, to);
            }
        }

        // ── CSV format ──────────────────────────────────────────────────

        private static (byte[], string, string) BuildCsvReport(
            System.Collections.Generic.List<OfficerExportRow> rows,
            string periodLabel,
            string period,
            DateTime from,
            DateTime to)
        {
            var sb = new StringBuilder();
            sb.Append('\uFEFF'); // UTF-8 BOM
            sb.AppendLine("STT,Họ tên,Chức danh,Phòng ban,Tổng việc giao,Hoàn thành đúng hạn,Trễ hạn,Điểm hệ thống (3.0đ),Điểm lãnh đạo (7.0đ),Tổng điểm (10đ),Xếp loại,Kỳ đánh giá");

            foreach (var r in rows)
            {
                sb.AppendLine(string.Join(",", new[]
                {
                    r.Stt.ToString(),
                    EscapeCsv(r.FullName),
                    EscapeCsv(r.RoleCode),
                    EscapeCsv(r.DepartmentName),
                    r.TotalTasks.ToString(),
                    r.Completed.ToString(),
                    r.Overdue.ToString(),
                    r.SystemScore.ToString("F1"),
                    r.LeaderScore.ToString("F1"),
                    r.TotalScore.ToString("F1"),
                    EscapeCsv(r.Grade),
                    EscapeCsv(periodLabel)
                }));
            }

            sb.AppendLine();
            sb.AppendLine("THỐNG KÊ TỔNG HỢP");
            sb.AppendLine($"Tổng số cán bộ,{rows.Count}");
            double avgAll = rows.Count > 0
                ? Math.Round(rows.Average(r => r.LeaderScore), 1)
                : 0.0;
            sb.AppendLine($"Điểm trung bình toàn xã (lãnh đạo),{avgAll:F1}");
            sb.AppendLine($"Số cán bộ Hoàn thành xuất sắc (≥9.0),{rows.Count(r => r.TotalScore >= 9.0)}");
            sb.AppendLine($"Kỳ báo cáo,{period}");
            sb.AppendLine($"Từ ngày,{from:dd-MM-yyyy}");
            sb.AppendLine($"Đến ngày,{to:dd-MM-yyyy}");

            string fileName = $"DanhGiaThiDua_{period}_{from:dd-MM-yyyy}_{to:dd-MM-yyyy}.csv";
            byte[] bytes = Encoding.UTF8.GetBytes(sb.ToString());
            return (bytes, fileName, "text/csv; charset=utf-8");
        }

        // ── XLSX format (ClosedXML) ─────────────────────────────────────

        private static (byte[], string, string) BuildXlsxReport(
            System.Collections.Generic.List<OfficerExportRow> rows,
            string periodLabel,
            string period,
            DateTime from,
            DateTime to)
        {
            using var workbook = new XLWorkbook();

            // ── Sheet 1: Báo cáo tổng hợp ──
            var sheet = workbook.Worksheets.Add("Báo cáo tổng hợp");
            string[] headers = new[]
            {
                "STT", "Họ tên", "Chức danh", "Phòng ban",
                "Tổng việc giao", "Hoàn thành đúng hạn", "Trễ hạn",
                "Điểm hệ thống (3.0đ)", "Điểm lãnh đạo (7.0đ)",
                "Tổng điểm (10đ)", "Xếp loại", "Kỳ đánh giá"
            };

            // Header row
            for (int i = 0; i < headers.Length; i++)
            {
                var cell = sheet.Cell(1, i + 1);
                cell.Value = headers[i];
                cell.Style.Font.Bold = true;
                cell.Style.Font.FontSize = 11;
                cell.Style.Fill.BackgroundColor = XLColor.LightBlue;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            }

            // Data rows
            for (int rIdx = 0; rIdx < rows.Count; rIdx++)
            {
                var r = rows[rIdx];
                int rowNum = rIdx + 2;
                sheet.Cell(rowNum, 1).Value = r.Stt;
                sheet.Cell(rowNum, 2).Value = r.FullName;
                sheet.Cell(rowNum, 3).Value = r.RoleCode;
                sheet.Cell(rowNum, 4).Value = r.DepartmentName;
                sheet.Cell(rowNum, 5).Value = r.TotalTasks;
                sheet.Cell(rowNum, 6).Value = r.Completed;
                sheet.Cell(rowNum, 7).Value = r.Overdue;
                sheet.Cell(rowNum, 8).Value = r.SystemScore;
                sheet.Cell(rowNum, 9).Value = r.LeaderScore;
                sheet.Cell(rowNum, 10).Value = r.TotalScore;
                sheet.Cell(rowNum, 11).Value = r.Grade;
                sheet.Cell(rowNum, 12).Value = periodLabel;

                // Borders for data
                for (int c = 1; c <= headers.Length; c++)
                {
                    sheet.Cell(rowNum, c).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                }
            }

            // Freeze header + auto-fit columns
            sheet.SheetView.FreezeRows(1);
            sheet.Columns().AdjustToContents();

            // Summary block below data
            int summaryStart = rows.Count + 4;
            sheet.Cell(summaryStart, 1).Value = "THỐNG KÊ TỔNG HỢP";
            sheet.Cell(summaryStart, 1).Style.Font.Bold = true;
            sheet.Cell(summaryStart, 1).Style.Font.FontSize = 12;
            sheet.Cell(summaryStart + 1, 1).Value = "Tổng số cán bộ:";
            sheet.Cell(summaryStart + 1, 2).Value = rows.Count;
            sheet.Cell(summaryStart + 2, 1).Value = "Điểm TB toàn xã (lãnh đạo):";
            double avgAll = rows.Count > 0
                ? Math.Round(rows.Average(r => r.LeaderScore), 1)
                : 0.0;
            sheet.Cell(summaryStart + 2, 2).Value = avgAll;
            sheet.Cell(summaryStart + 3, 1).Value = "Số cán bộ Hoàn thành xuất sắc (≥9.0):";
            sheet.Cell(summaryStart + 3, 2).Value = rows.Count(r => r.TotalScore >= 9.0);
            sheet.Cell(summaryStart + 4, 1).Value = "Kỳ báo cáo:";
            sheet.Cell(summaryStart + 4, 2).Value = period;
            sheet.Cell(summaryStart + 5, 1).Value = "Từ ngày:";
            sheet.Cell(summaryStart + 5, 2).Value = from.ToString("dd-MM-yyyy");
            sheet.Cell(summaryStart + 6, 1).Value = "Đến ngày:";
            sheet.Cell(summaryStart + 6, 2).Value = to.ToString("dd-MM-yyyy");

            // ── Sheet 2: Chi tiết cán bộ ──
            var detail = workbook.Worksheets.Add("Chi tiết cán bộ");
            string[] detailHeaders = new[]
            {
                "STT", "Họ tên", "Chức danh", "Phòng ban",
                "Tổng việc", "Hoàn thành", "Trễ hạn",
                "Hệ thống", "Lãnh đạo", "Tổng", "Xếp loại"
            };
            for (int i = 0; i < detailHeaders.Length; i++)
            {
                var cell = detail.Cell(1, i + 1);
                cell.Value = detailHeaders[i];
                cell.Style.Font.Bold = true;
                cell.Style.Fill.BackgroundColor = XLColor.LightGreen;
                cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            }
            for (int rIdx = 0; rIdx < rows.Count; rIdx++)
            {
                var r = rows[rIdx];
                int rowNum = rIdx + 2;
                detail.Cell(rowNum, 1).Value = r.Stt;
                detail.Cell(rowNum, 2).Value = r.FullName;
                detail.Cell(rowNum, 3).Value = r.RoleCode;
                detail.Cell(rowNum, 4).Value = r.DepartmentName;
                detail.Cell(rowNum, 5).Value = r.TotalTasks;
                detail.Cell(rowNum, 6).Value = r.Completed;
                detail.Cell(rowNum, 7).Value = r.Overdue;
                detail.Cell(rowNum, 8).Value = r.SystemScore;
                detail.Cell(rowNum, 9).Value = r.LeaderScore;
                detail.Cell(rowNum, 10).Value = r.TotalScore;
                detail.Cell(rowNum, 11).Value = r.Grade;
                for (int c = 1; c <= detailHeaders.Length; c++)
                {
                    detail.Cell(rowNum, c).Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
                }
            }
            detail.SheetView.FreezeRows(1);
            detail.Columns().AdjustToContents();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            byte[] bytes = stream.ToArray();
            string fileName = $"DanhGiaThiDua_{period}_{from:dd-MM-yyyy}_{to:dd-MM-yyyy}.xlsx";
            return (bytes, fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        }

        // ── Helpers ────────────────────────────────────────────────────

        private static string EscapeCsv(string input)
        {
            if (string.IsNullOrEmpty(input)) return "";
            if (input.Contains(',') || input.Contains('"') || input.Contains('\n') || input.Contains('\r'))
            {
                return $"\"{input.Replace("\"", "\"\"")}\"";
            }
            return input;
        }

        private static (DateTime from, DateTime to) ResolvePeriodRange(string period, DateTime? from, DateTime? to)
        {
            var now = DateTime.UtcNow;
            if (from.HasValue && to.HasValue) return (from.Value, to.Value);

            switch (period.ToLowerInvariant())
            {
                case "week":
                {
                    var dayOfWeek = (int)now.DayOfWeek;
                    var weekStart = now.AddDays(-(dayOfWeek == 0 ? 6 : dayOfWeek - 1)).Date;
                    return (weekStart, weekStart.AddDays(6));
                }
                case "month":
                {
                    var monthStart = new DateTime(now.Year, now.Month, 1);
                    var monthEnd = monthStart.AddMonths(1).AddDays(-1);
                    return (monthStart, monthEnd);
                }
                case "quarter":
                {
                    var q = (now.Month - 1) / 3;
                    var qStart = new DateTime(now.Year, q * 3 + 1, 1);
                    var qEnd = qStart.AddMonths(3).AddDays(-1);
                    return (qStart, qEnd);
                }
                case "halfyear":
                {
                    var half = (now.Month - 1) / 6;
                    var hStart = new DateTime(now.Year, half * 6 + 1, 1);
                    var hEnd = hStart.AddMonths(6).AddDays(-1);
                    return (hStart, hEnd);
                }
                case "year":
                default:
                {
                    return (new DateTime(now.Year, 1, 1), new DateTime(now.Year, 12, 31));
                }
            }
        }

        private class OfficerExportRow
        {
            public int Stt { get; set; }
            public string FullName { get; set; } = string.Empty;
            public string RoleCode { get; set; } = string.Empty;
            public string DepartmentName { get; set; } = string.Empty;
            public int TotalTasks { get; set; }
            public int Completed { get; set; }
            public int Overdue { get; set; }
            public double SystemScore { get; set; }
            public double LeaderScore { get; set; }
            public double TotalScore { get; set; }
            public string Grade { get; set; } = string.Empty;
        }
    }
}
