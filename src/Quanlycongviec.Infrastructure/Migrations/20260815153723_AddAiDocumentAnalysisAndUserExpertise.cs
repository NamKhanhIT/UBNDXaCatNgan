using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAiDocumentAnalysisAndUserExpertise : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Expertise",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "YearsOfExperience",
                table: "Users",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "AiCategory",
                table: "InboxDocuments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "AiConfidenceScore",
                table: "InboxDocuments",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AiEventEndDateTime",
                table: "InboxDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AiEventStartDateTime",
                table: "InboxDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AiExtractedDeadline",
                table: "InboxDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AiExtractedSubjects",
                table: "InboxDocuments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AiObjectives",
                table: "InboxDocuments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AiProcessingStatus",
                table: "InboxDocuments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AiReviewedAt",
                table: "InboxDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AiReviewedByUserId",
                table: "InboxDocuments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "AiSuggestedDepartmentId",
                table: "InboxDocuments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AiSummary",
                table: "InboxDocuments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AiTitle",
                table: "InboxDocuments",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Expertise",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "YearsOfExperience",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "AiCategory",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiConfidenceScore",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiEventEndDateTime",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiEventStartDateTime",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiExtractedDeadline",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiExtractedSubjects",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiObjectives",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiProcessingStatus",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiReviewedAt",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiReviewedByUserId",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiSuggestedDepartmentId",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiSummary",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "AiTitle",
                table: "InboxDocuments");
        }
    }
}
