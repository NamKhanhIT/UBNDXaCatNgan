using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMonthlyRatingSummaries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MonthlyRatingSummaries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Month = table.Column<int>(type: "integer", nullable: false),
                    AverageFinalScore = table.Column<double>(type: "double precision", nullable: false),
                    SumSystemScore = table.Column<double>(type: "double precision", nullable: false),
                    SumEvaluatorScore = table.Column<double>(type: "double precision", nullable: false),
                    TasksEvaluated = table.Column<int>(type: "integer", nullable: false),
                    LastEvaluationAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    AggregatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    TierGrade = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MonthlyRatingSummaries", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MonthlyRatingSummaries_UserId_Year_Month",
                table: "MonthlyRatingSummaries",
                columns: new[] { "UserId", "Year", "Month" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MonthlyRatingSummaries_Year_Month",
                table: "MonthlyRatingSummaries",
                columns: new[] { "Year", "Month" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MonthlyRatingSummaries");
        }
    }
}
