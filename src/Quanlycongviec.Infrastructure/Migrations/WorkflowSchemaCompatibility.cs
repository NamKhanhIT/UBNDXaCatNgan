using Microsoft.EntityFrameworkCore.Migrations;

namespace Quanlycongviec.Infrastructure.Migrations;

internal static class WorkflowSchemaCompatibility
{
    // Earlier releases represented these tables in the model without a discoverable EF migration.
    // Existing manually provisioned tables and all historical evaluation values remain intact.
    public static void EnsureEvaluationTables(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        CREATE TABLE IF NOT EXISTS "MonthlyRatingSummaries" (
            "Id" uuid PRIMARY KEY, "UserId" uuid NOT NULL, "Year" integer NOT NULL, "Month" integer NOT NULL,
            "AverageFinalScore" double precision NOT NULL, "SumSystemScore" double precision NOT NULL,
            "SumEvaluatorScore" double precision NOT NULL, "TasksEvaluated" integer NOT NULL,
            "LastEvaluationAt" timestamp with time zone NOT NULL, "AggregatedAt" timestamp with time zone NOT NULL,
            "TierGrade" text NOT NULL, "CreatedAt" timestamp with time zone NOT NULL,
            "UpdatedAt" timestamp with time zone, "IsDeleted" boolean NOT NULL);
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_MonthlyRatingSummaries_UserId_Year_Month"
            ON "MonthlyRatingSummaries" ("UserId", "Year", "Month");
        CREATE INDEX IF NOT EXISTS "IX_MonthlyRatingSummaries_Year_Month" ON "MonthlyRatingSummaries" ("Year", "Month");
        CREATE TABLE IF NOT EXISTS "RatingPeriods" (
            "Id" uuid PRIMARY KEY, "Title" text NOT NULL, "PeriodType" text NOT NULL,
            "Year" integer NOT NULL, "Quarter" integer, "Month" integer,
            "StartDate" timestamp with time zone NOT NULL, "EndDate" timestamp with time zone NOT NULL,
            "IsClosed" boolean NOT NULL, "ClosedAt" timestamp with time zone,
            "ClosedByUserId" uuid REFERENCES "Users" ("Id"),
            "CreatedAt" timestamp with time zone NOT NULL, "UpdatedAt" timestamp with time zone,
            "IsDeleted" boolean NOT NULL);
        CREATE INDEX IF NOT EXISTS "IX_RatingPeriods_ClosedByUserId" ON "RatingPeriods" ("ClosedByUserId");
        """);
}
