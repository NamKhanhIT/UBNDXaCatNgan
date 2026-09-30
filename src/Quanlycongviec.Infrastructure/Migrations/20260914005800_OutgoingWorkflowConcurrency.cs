using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class OutgoingWorkflowConcurrency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "Version",
                table: "OutgoingDocuments",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "OutgoingDocumentId",
                table: "Notifications",
                type: "uuid",
                nullable: true);
            migrationBuilder.Sql("""
                UPDATE "OutgoingDocuments" SET "Version"=md5('outgoing-workflow:' || "Id"::text)::uuid;
                UPDATE "OutgoingDocuments" SET "Status"='Cancelled'
                    WHERE "Status"='Rejected' AND "RecallReason" LIKE 'HỦY VĂN BẢN:%';
                UPDATE "OutgoingDocuments" SET "Status"='Recalled'
                    WHERE "Status"='Rejected' AND "RecalledAt" IS NOT NULL AND NULLIF(btrim("RecallReason"),'') IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Version",
                table: "OutgoingDocuments");

            migrationBuilder.DropColumn(
                name: "OutgoingDocumentId",
                table: "Notifications");
        }
    }
}
