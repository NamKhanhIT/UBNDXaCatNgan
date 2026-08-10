using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentNumbering : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DocumentSequenceNumber",
                table: "OutgoingDocuments",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentSymbol",
                table: "OutgoingDocuments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecallReason",
                table: "OutgoingDocuments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RecalledAt",
                table: "OutgoingDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RecalledByUserId",
                table: "OutgoingDocuments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AttachmentUrl",
                table: "InboxDocuments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentSymbol",
                table: "InboxDocuments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "IssuedDate",
                table: "InboxDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IssuingAgency",
                table: "InboxDocuments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignerName",
                table: "InboxDocuments",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "DocumentNumberSequences",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Year = table.Column<int>(type: "integer", nullable: false),
                    Symbol = table.Column<string>(type: "text", nullable: false),
                    AgencyCode = table.Column<string>(type: "text", nullable: true),
                    CurrentNumber = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentNumberSequences", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DocumentNumberSequences_Year_Symbol",
                table: "DocumentNumberSequences",
                columns: new[] { "Year", "Symbol" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DocumentNumberSequences");

            migrationBuilder.DropColumn(
                name: "DocumentSequenceNumber",
                table: "OutgoingDocuments");

            migrationBuilder.DropColumn(
                name: "DocumentSymbol",
                table: "OutgoingDocuments");

            migrationBuilder.DropColumn(
                name: "RecallReason",
                table: "OutgoingDocuments");

            migrationBuilder.DropColumn(
                name: "RecalledAt",
                table: "OutgoingDocuments");

            migrationBuilder.DropColumn(
                name: "RecalledByUserId",
                table: "OutgoingDocuments");

            migrationBuilder.DropColumn(
                name: "AttachmentUrl",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "DocumentSymbol",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "IssuedDate",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "IssuingAgency",
                table: "InboxDocuments");

            migrationBuilder.DropColumn(
                name: "SignerName",
                table: "InboxDocuments");
        }
    }
}
