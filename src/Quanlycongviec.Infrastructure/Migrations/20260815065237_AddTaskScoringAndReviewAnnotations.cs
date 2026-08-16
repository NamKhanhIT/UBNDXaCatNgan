using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTaskScoringAndReviewAnnotations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "EvaluatorScore",
                table: "TaskItems",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SubmissionNote",
                table: "TaskItems",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "SystemScore",
                table: "TaskItems",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "NewEvaluatorScore",
                table: "RatingHistories",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "NewSystemScore",
                table: "RatingHistories",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "OldEvaluatorScore",
                table: "RatingHistories",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "OldSystemScore",
                table: "RatingHistories",
                type: "double precision",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TaskReviewAnnotations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TaskItemId = table.Column<Guid>(type: "uuid", nullable: false),
                    AnchorText = table.Column<string>(type: "text", nullable: false),
                    StartOffsetHint = table.Column<int>(type: "integer", nullable: true),
                    CommentText = table.Column<string>(type: "text", nullable: false),
                    Severity = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ResolvedStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ResolvedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TaskReviewAnnotations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TaskReviewAnnotations_TaskItems_TaskItemId",
                        column: x => x.TaskItemId,
                        principalTable: "TaskItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_TaskReviewAnnotations_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TaskReviewAnnotations_Users_ResolvedByUserId",
                        column: x => x.ResolvedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TaskReviewAnnotations_CreatedByUserId",
                table: "TaskReviewAnnotations",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskReviewAnnotations_ResolvedByUserId",
                table: "TaskReviewAnnotations",
                column: "ResolvedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_TaskReviewAnnotations_ResolvedStatus",
                table: "TaskReviewAnnotations",
                column: "ResolvedStatus");

            migrationBuilder.CreateIndex(
                name: "IX_TaskReviewAnnotations_TaskItemId",
                table: "TaskReviewAnnotations",
                column: "TaskItemId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TaskReviewAnnotations");

            migrationBuilder.DropColumn(
                name: "EvaluatorScore",
                table: "TaskItems");

            migrationBuilder.DropColumn(
                name: "SubmissionNote",
                table: "TaskItems");

            migrationBuilder.DropColumn(
                name: "SystemScore",
                table: "TaskItems");

            migrationBuilder.DropColumn(
                name: "NewEvaluatorScore",
                table: "RatingHistories");

            migrationBuilder.DropColumn(
                name: "NewSystemScore",
                table: "RatingHistories");

            migrationBuilder.DropColumn(
                name: "OldEvaluatorScore",
                table: "RatingHistories");

            migrationBuilder.DropColumn(
                name: "OldSystemScore",
                table: "RatingHistories");
        }
    }
}
