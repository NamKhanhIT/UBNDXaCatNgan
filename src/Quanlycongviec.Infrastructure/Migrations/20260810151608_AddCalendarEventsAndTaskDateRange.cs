using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCalendarEventsAndTaskDateRange : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "StartDate",
                table: "TaskItems",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CalendarEventId",
                table: "ReminderLogs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CalendarEventId",
                table: "Notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CalendarEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Description = table.Column<string>(type: "text", nullable: false),
                    EventType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    StartDateTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EndDateTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsAllDay = table.Column<bool>(type: "boolean", nullable: false),
                    Location = table.Column<string>(type: "text", nullable: true),
                    OrganizerId = table.Column<Guid>(type: "uuid", nullable: false),
                    DepartmentId = table.Column<Guid>(type: "uuid", nullable: true),
                    ColorTag = table.Column<string>(type: "text", nullable: true),
                    RelatedTaskItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CalendarEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CalendarEvents_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CalendarEvents_TaskItems_RelatedTaskItemId",
                        column: x => x.RelatedTaskItemId,
                        principalTable: "TaskItems",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CalendarEvents_Users_OrganizerId",
                        column: x => x.OrganizerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EventParticipants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    HasResponded = table.Column<bool>(type: "boolean", nullable: false),
                    ResponseStatus = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventParticipants_CalendarEvents_EventId",
                        column: x => x.EventId,
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_EventParticipants_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "EventReminderOffsets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EventId = table.Column<Guid>(type: "uuid", nullable: false),
                    MinutesBefore = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventReminderOffsets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EventReminderOffsets_CalendarEvents_EventId",
                        column: x => x.EventId,
                        principalTable: "CalendarEvents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReminderLogs_CalendarEventId",
                table: "ReminderLogs",
                column: "CalendarEventId");

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_CalendarEventId",
                table: "Notifications",
                column: "CalendarEventId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_DepartmentId",
                table: "CalendarEvents",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_OrganizerId",
                table: "CalendarEvents",
                column: "OrganizerId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_RelatedTaskItemId",
                table: "CalendarEvents",
                column: "RelatedTaskItemId");

            migrationBuilder.CreateIndex(
                name: "IX_CalendarEvents_StartDateTime_EndDateTime",
                table: "CalendarEvents",
                columns: new[] { "StartDateTime", "EndDateTime" });

            migrationBuilder.CreateIndex(
                name: "IX_EventParticipants_EventId_UserId",
                table: "EventParticipants",
                columns: new[] { "EventId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_EventParticipants_UserId",
                table: "EventParticipants",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_EventReminderOffsets_EventId",
                table: "EventReminderOffsets",
                column: "EventId");

            migrationBuilder.AddForeignKey(
                name: "FK_Notifications_CalendarEvents_CalendarEventId",
                table: "Notifications",
                column: "CalendarEventId",
                principalTable: "CalendarEvents",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_ReminderLogs_CalendarEvents_CalendarEventId",
                table: "ReminderLogs",
                column: "CalendarEventId",
                principalTable: "CalendarEvents",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Notifications_CalendarEvents_CalendarEventId",
                table: "Notifications");

            migrationBuilder.DropForeignKey(
                name: "FK_ReminderLogs_CalendarEvents_CalendarEventId",
                table: "ReminderLogs");

            migrationBuilder.DropTable(
                name: "EventParticipants");

            migrationBuilder.DropTable(
                name: "EventReminderOffsets");

            migrationBuilder.DropTable(
                name: "CalendarEvents");

            migrationBuilder.DropIndex(
                name: "IX_ReminderLogs_CalendarEventId",
                table: "ReminderLogs");

            migrationBuilder.DropIndex(
                name: "IX_Notifications_CalendarEventId",
                table: "Notifications");

            migrationBuilder.DropColumn(
                name: "StartDate",
                table: "TaskItems");

            migrationBuilder.DropColumn(
                name: "CalendarEventId",
                table: "ReminderLogs");

            migrationBuilder.DropColumn(
                name: "CalendarEventId",
                table: "Notifications");
        }
    }
}
