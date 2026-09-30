using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UnifiedDocumentWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(name: "RequiresRealtimeDelivery", table: "Notifications", type: "boolean", nullable: false, defaultValue: false);
            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "AppearancePreferences" text;""");

            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "EmailChangeNewEmail" text;""");

            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "EmailChangeOtpExpiry" timestamp with time zone;""");

            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "EmailChangeOtpHash" text;""");

            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "EmailChangeOtpSentUtc" timestamp with time zone;""");

            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "NotificationPreferences" text;""");

            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PhoneNumberConfirmed" boolean NOT NULL DEFAULT FALSE;""");

            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PhoneOtpExpiry" timestamp with time zone;""");

            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PhoneOtpFailedCount" integer NOT NULL DEFAULT 0;""");

            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PhoneOtpHash" text;""");

            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PhoneOtpSentUtc" timestamp with time zone;""");

            migrationBuilder.Sql("""ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "WorkProfileJson" text;""");

            migrationBuilder.AddColumn<Guid>(
                name: "ParentTaskId",
                table: "TaskItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequiresWorkflowReview",
                table: "TaskItems",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "ReviewerId",
                table: "TaskItems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "Version",
                table: "TaskItems",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<Guid>(
                name: "InboxDocumentId",
                table: "Notifications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RealtimeDeliveredAt",
                table: "Notifications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BusinessStatus",
                table: "InboxDocuments",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "Version",
                table: "InboxDocuments",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "DocumentPresentations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    InboxDocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittedById = table.Column<Guid>(type: "uuid", nullable: false),
                    RecipientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    DecisionNote = table.Column<string>(type: "text", nullable: true),
                    DecidedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentPresentations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DocumentPresentations_InboxDocuments_InboxDocumentId",
                        column: x => x.InboxDocumentId,
                        principalTable: "InboxDocuments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            WorkflowSchemaCompatibility.EnsureEvaluationTables(migrationBuilder);

            migrationBuilder.CreateTable(
                name: "TaskDocumentLinks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TaskItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    InboxDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    OutgoingDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskDocumentLinks", x => x.Id);
                    table.CheckConstraint("CK_TaskDocumentLink_Source", "(\"InboxDocumentId\" IS NULL) <> (\"OutgoingDocumentId\" IS NULL)");
                    table.ForeignKey(
                        name: "FK_TaskDocumentLinks_InboxDocuments_InboxDocumentId",
                        column: x => x.InboxDocumentId,
                        principalTable: "InboxDocuments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TaskDocumentLinks_OutgoingDocuments_OutgoingDocumentId",
                        column: x => x.OutgoingDocumentId,
                        principalTable: "OutgoingDocuments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TaskDocumentLinks_TaskItems_TaskItemId",
                        column: x => x.TaskItemId,
                        principalTable: "TaskItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TaskSubmissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TaskItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmittedById = table.Column<Guid>(type: "uuid", nullable: false),
                    Note = table.Column<string>(type: "text", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DueDateAtSubmission = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsLegacy = table.Column<bool>(type: "boolean", nullable: false),
                    Decision = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ReviewedById = table.Column<Guid>(type: "uuid", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ReviewNote = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskSubmissions_TaskItems_TaskItemId",
                        column: x => x.TaskItemId,
                        principalTable: "TaskItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TaskWorkflowChanges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TaskItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<string>(type: "text", nullable: false),
                    OldValue = table.Column<string>(type: "text", nullable: true),
                    NewValue = table.Column<string>(type: "text", nullable: true),
                    Reason = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskWorkflowChanges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskWorkflowChanges_TaskItems_TaskItemId",
                        column: x => x.TaskItemId,
                        principalTable: "TaskItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowPermissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CanReceiveDocuments = table.Column<bool>(type: "boolean", nullable: false),
                    CanManageWorkflowPermissions = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedById = table.Column<Guid>(type: "uuid", nullable: true),
                    Version = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowPermissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkflowPermissions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "WorkflowRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<Guid>(type: "uuid", nullable: false),
                    Fingerprint = table.Column<string>(type: "text", nullable: false),
                    ResultId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkflowRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TaskSubmissionAttachments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    SubmissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttachmentId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskSubmissionAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskSubmissionAttachments_DocumentAttachments_AttachmentId",
                        column: x => x.AttachmentId,
                        principalTable: "DocumentAttachments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TaskSubmissionAttachments_TaskSubmissions_SubmissionId",
                        column: x => x.SubmissionId,
                        principalTable: "TaskSubmissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });



            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_ParentTaskId",
                table: "TaskItems",
                column: "ParentTaskId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_ReviewerId_Status_IsDeleted",
                table: "TaskItems",
                columns: new[] { "ReviewerId", "Status", "IsDeleted" });







            migrationBuilder.CreateIndex(
                name: "IX_DocumentPresentations_InboxDocumentId_Status",
                table: "DocumentPresentations",
                columns: new[] { "InboxDocumentId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_DocumentPresentations_RecipientId_Status",
                table: "DocumentPresentations",
                columns: new[] { "RecipientId", "Status" });


            migrationBuilder.CreateIndex(
                name: "IX_TaskDocumentLinks_InboxDocumentId",
                table: "TaskDocumentLinks",
                column: "InboxDocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskDocumentLinks_OutgoingDocumentId",
                table: "TaskDocumentLinks",
                column: "OutgoingDocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskDocumentLinks_TaskItemId_InboxDocumentId",
                table: "TaskDocumentLinks",
                columns: new[] { "TaskItemId", "InboxDocumentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskDocumentLinks_TaskItemId_OutgoingDocumentId",
                table: "TaskDocumentLinks",
                columns: new[] { "TaskItemId", "OutgoingDocumentId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskSubmissionAttachments_AttachmentId",
                table: "TaskSubmissionAttachments",
                column: "AttachmentId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TaskSubmissionAttachments_SubmissionId",
                table: "TaskSubmissionAttachments",
                column: "SubmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskSubmissions_TaskItemId_CreatedAt",
                table: "TaskSubmissions",
                columns: new[] { "TaskItemId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TaskWorkflowChanges_TaskItemId",
                table: "TaskWorkflowChanges",
                column: "TaskItemId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowPermissions_UserId",
                table: "WorkflowPermissions",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_WorkflowRequests_UserId_RequestId",
                table: "WorkflowRequests",
                columns: new[] { "UserId", "RequestId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskItems_TaskItems_ParentTaskId",
                table: "TaskItems",
                column: "ParentTaskId",
                principalTable: "TaskItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_TaskItems_Users_ReviewerId",
                table: "TaskItems",
                column: "ReviewerId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
            WorkflowLegacyDataMigration.Backfill(migrationBuilder);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException("This migration preserves historical evidence. Restore a verified pre-migration backup for a database rollback.");
        }
    }
}
