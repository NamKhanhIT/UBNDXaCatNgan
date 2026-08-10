using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRatingHistoryTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_TaskItems_AssigneeId",
                table: "TaskItems");

            migrationBuilder.CreateTable(
                name: "OutgoingDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentNumber = table.Column<string>(type: "text", nullable: true),
                    DocumentType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Title = table.Column<string>(type: "text", nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    DraftedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DraftedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SignedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    SignedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IssuedDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RecipientNote = table.Column<string>(type: "text", nullable: true),
                    AttachmentUrl = table.Column<string>(type: "text", nullable: true),
                    RelatedTaskItemId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsUrgent = table.Column<bool>(type: "boolean", nullable: false),
                    RejectionReason = table.Column<string>(type: "text", nullable: true),
                    IsCorrectionDocument = table.Column<bool>(type: "boolean", nullable: false),
                    OriginalDocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OutgoingDocuments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RatingHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TaskItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    OldScore = table.Column<double>(type: "double precision", nullable: true),
                    NewScore = table.Column<double>(type: "double precision", nullable: false),
                    ScoreDelta = table.Column<double>(type: "double precision", nullable: false),
                    ChangedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChangedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    EvidenceUrl = table.Column<string>(type: "text", nullable: false),
                    ApprovalStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ApprovedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RatingHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RatingHistories_TaskItems_TaskItemId",
                        column: x => x.TaskItemId,
                        principalTable: "TaskItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_FullName",
                table: "Users",
                column: "FullName");

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_AssigneeId_Status_DueDate",
                table: "TaskItems",
                columns: new[] { "AssigneeId", "Status", "DueDate" });

            migrationBuilder.CreateIndex(
                name: "IX_InboxDocuments_Channel",
                table: "InboxDocuments",
                column: "Channel");

            migrationBuilder.CreateIndex(
                name: "IX_InboxDocuments_IsScheduled",
                table: "InboxDocuments",
                column: "IsScheduled");

            migrationBuilder.CreateIndex(
                name: "IX_InboxDocuments_IsUrgent",
                table: "InboxDocuments",
                column: "IsUrgent");

            migrationBuilder.CreateIndex(
                name: "IX_InboxDocuments_ReceivedDate",
                table: "InboxDocuments",
                column: "ReceivedDate");

            migrationBuilder.CreateIndex(
                name: "IX_OutgoingDocuments_DocumentType",
                table: "OutgoingDocuments",
                column: "DocumentType");

            migrationBuilder.CreateIndex(
                name: "IX_OutgoingDocuments_DraftedByUserId",
                table: "OutgoingDocuments",
                column: "DraftedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_OutgoingDocuments_Status",
                table: "OutgoingDocuments",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_RatingHistories_ApprovalStatus",
                table: "RatingHistories",
                column: "ApprovalStatus");

            migrationBuilder.CreateIndex(
                name: "IX_RatingHistories_ChangedByUserId",
                table: "RatingHistories",
                column: "ChangedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_RatingHistories_TaskItemId",
                table: "RatingHistories",
                column: "TaskItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OutgoingDocuments");

            migrationBuilder.DropTable(
                name: "RatingHistories");

            migrationBuilder.DropIndex(
                name: "IX_Users_FullName",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_TaskItems_AssigneeId_Status_DueDate",
                table: "TaskItems");

            migrationBuilder.DropIndex(
                name: "IX_InboxDocuments_Channel",
                table: "InboxDocuments");

            migrationBuilder.DropIndex(
                name: "IX_InboxDocuments_IsScheduled",
                table: "InboxDocuments");

            migrationBuilder.DropIndex(
                name: "IX_InboxDocuments_IsUrgent",
                table: "InboxDocuments");

            migrationBuilder.DropIndex(
                name: "IX_InboxDocuments_ReceivedDate",
                table: "InboxDocuments");

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_AssigneeId",
                table: "TaskItems",
                column: "AssigneeId");
        }
    }
}
