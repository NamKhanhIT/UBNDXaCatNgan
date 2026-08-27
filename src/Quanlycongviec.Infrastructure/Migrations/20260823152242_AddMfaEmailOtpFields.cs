using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMfaEmailOtpFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_PrimaryDepartmentId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_TaskItems_DepartmentId",
                table: "TaskItems");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId",
                table: "Notifications");

            migrationBuilder.AddColumn<DateTime>(
                name: "MfaEmailOtpExpiry",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MfaEmailOtpHash",
                table: "Users",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "MfaEmailOtpSentUtc",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_ActiveRoleCode_IsDeleted",
                table: "Users",
                columns: new[] { "ActiveRoleCode", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_PrimaryDepartmentId_IsDeleted",
                table: "Users",
                columns: new[] { "PrimaryDepartmentId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_AssigneeId_Status_IsDeleted",
                table: "TaskItems",
                columns: new[] { "AssigneeId", "Status", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_DepartmentId_Status_IsDeleted",
                table: "TaskItems",
                columns: new[] { "DepartmentId", "Status", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_Status_IsDeleted",
                table: "TaskItems",
                columns: new[] { "Status", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_OutgoingDocuments_DocumentNumber_IssuedDate_IsDeleted",
                table: "OutgoingDocuments",
                columns: new[] { "DocumentNumber", "IssuedDate", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_OutgoingDocuments_SignedByUserId_IsDeleted",
                table: "OutgoingDocuments",
                columns: new[] { "SignedByUserId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_IsRead_CreatedAt",
                table: "Notifications",
                columns: new[] { "UserId", "IsRead", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_InboxDocuments_AiSuggestedDepartmentId_IsDeleted",
                table: "InboxDocuments",
                columns: new[] { "AiSuggestedDepartmentId", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_InboxDocuments_DocumentNumber_ReceivedDate_IsDeleted",
                table: "InboxDocuments",
                columns: new[] { "DocumentNumber", "ReceivedDate", "IsDeleted" });

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_DepartmentId_StartDateTime_EndDateTime",
                table: "CalendarEvents",
                columns: new[] { "DepartmentId", "StartDateTime", "EndDateTime" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_ActiveRoleCode_IsDeleted",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_Users_PrimaryDepartmentId_IsDeleted",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_TaskItems_AssigneeId_Status_IsDeleted",
                table: "TaskItems");

            migrationBuilder.DropIndex(
                name: "IX_TaskItems_DepartmentId_Status_IsDeleted",
                table: "TaskItems");

            migrationBuilder.DropIndex(
                name: "IX_TaskItems_Status_IsDeleted",
                table: "TaskItems");

            migrationBuilder.DropIndex(
                name: "IX_OutgoingDocuments_DocumentNumber_IssuedDate_IsDeleted",
                table: "OutgoingDocuments");

            migrationBuilder.DropIndex(
                name: "IX_OutgoingDocuments_SignedByUserId_IsDeleted",
                table: "OutgoingDocuments");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_UserId_IsRead_CreatedAt",
                table: "Notifications");

            migrationBuilder.DropIndex(
                name: "IX_InboxDocuments_AiSuggestedDepartmentId_IsDeleted",
                table: "InboxDocuments");

            migrationBuilder.DropIndex(
                name: "IX_InboxDocuments_DocumentNumber_ReceivedDate_IsDeleted",
                table: "InboxDocuments");

            migrationBuilder.DropIndex(
                name: "IX_CalendarEvents_DepartmentId_StartDateTime_EndDateTime",
                table: "CalendarEvents");

            migrationBuilder.DropColumn(
                name: "MfaEmailOtpExpiry",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MfaEmailOtpHash",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "MfaEmailOtpSentUtc",
                table: "Users");

            migrationBuilder.CreateIndex(
                name: "IX_Users_PrimaryDepartmentId",
                table: "Users",
                column: "PrimaryDepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_DepartmentId",
                table: "TaskItems",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId",
                table: "Notifications",
                column: "UserId");
        }
    }
}
