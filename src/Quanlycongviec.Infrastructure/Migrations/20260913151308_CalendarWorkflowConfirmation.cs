using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CalendarWorkflowConfirmation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "SourceInboxDocumentId",
                table: "CalendarEvents",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Version",
                table: "CalendarEvents",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.Sql("""UPDATE "CalendarEvents" SET "Version"=md5('calendar-workflow:' || "Id"::text)::uuid;""");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_SourceInboxDocumentId",
                table: "CalendarEvents",
                column: "SourceInboxDocumentId");

            migrationBuilder.AddForeignKey(
                name: "FK_CalendarEvents_InboxDocuments_SourceInboxDocumentId",
                table: "CalendarEvents",
                column: "SourceInboxDocumentId",
                principalTable: "InboxDocuments",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CalendarEvents_InboxDocuments_SourceInboxDocumentId",
                table: "CalendarEvents");

            migrationBuilder.DropIndex(
                name: "IX_CalendarEvents_SourceInboxDocumentId",
                table: "CalendarEvents");

            migrationBuilder.DropColumn(
                name: "SourceInboxDocumentId",
                table: "CalendarEvents");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "CalendarEvents");
        }
    }
}
