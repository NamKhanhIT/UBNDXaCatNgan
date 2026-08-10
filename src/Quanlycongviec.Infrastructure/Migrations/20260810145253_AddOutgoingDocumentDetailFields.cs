using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOutgoingDocumentDetailFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AutoCreateTask",
                table: "OutgoingDocuments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "DestinationLevel",
                table: "OutgoingDocuments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ResponseDeadline",
                table: "OutgoingDocuments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SecurityLevel",
                table: "OutgoingDocuments",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "UrgencyLevel",
                table: "OutgoingDocuments",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AutoCreateTask",
                table: "OutgoingDocuments");

            migrationBuilder.DropColumn(
                name: "DestinationLevel",
                table: "OutgoingDocuments");

            migrationBuilder.DropColumn(
                name: "ResponseDeadline",
                table: "OutgoingDocuments");

            migrationBuilder.DropColumn(
                name: "SecurityLevel",
                table: "OutgoingDocuments");

            migrationBuilder.DropColumn(
                name: "UrgencyLevel",
                table: "OutgoingDocuments");
        }
    }
}
