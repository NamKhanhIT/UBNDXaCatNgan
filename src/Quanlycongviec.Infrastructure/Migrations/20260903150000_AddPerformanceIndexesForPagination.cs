using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Quanlycongviec.Infrastructure.Persistence;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260903150000_AddPerformanceIndexesForPagination")]
    public partial class AddPerformanceIndexesForPagination : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_InboxDocuments_IsDeleted_IsUrgent_ReceivedDate",
                table: "InboxDocuments",
                columns: new[] { "IsDeleted", "IsUrgent", "ReceivedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_InboxDocuments_IsDeleted_IsScheduled_ReceivedDate",
                table: "InboxDocuments",
                columns: new[] { "IsDeleted", "IsScheduled", "ReceivedDate" });

            migrationBuilder.CreateIndex(
                name: "IX_InboxDocuments_IsDeleted_Category",
                table: "InboxDocuments",
                columns: new[] { "IsDeleted", "Category" });

            migrationBuilder.CreateIndex(
                name: "IX_InboxDocuments_IsDeleted_AiProcessingStatus",
                table: "InboxDocuments",
                columns: new[] { "IsDeleted", "AiProcessingStatus" });

            migrationBuilder.CreateIndex(
                name: "IX_OutgoingDocuments_IsDeleted_DraftedAt",
                table: "OutgoingDocuments",
                columns: new[] { "IsDeleted", "DraftedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OutgoingDocuments_IsDeleted_Status_DraftedAt",
                table: "OutgoingDocuments",
                columns: new[] { "IsDeleted", "Status", "DraftedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_IsDeleted_CreatedAt",
                table: "TaskItems",
                columns: new[] { "IsDeleted", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_TaskItems_IsDeleted_Status_CreatedAt",
                table: "TaskItems",
                columns: new[] { "IsDeleted", "Status", "CreatedAt" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InboxDocuments_IsDeleted_IsUrgent_ReceivedDate",
                table: "InboxDocuments");

            migrationBuilder.DropIndex(
                name: "IX_InboxDocuments_IsDeleted_IsScheduled_ReceivedDate",
                table: "InboxDocuments");

            migrationBuilder.DropIndex(
                name: "IX_InboxDocuments_IsDeleted_Category",
                table: "InboxDocuments");

            migrationBuilder.DropIndex(
                name: "IX_InboxDocuments_IsDeleted_AiProcessingStatus",
                table: "InboxDocuments");

            migrationBuilder.DropIndex(
                name: "IX_OutgoingDocuments_IsDeleted_DraftedAt",
                table: "OutgoingDocuments");

            migrationBuilder.DropIndex(
                name: "IX_OutgoingDocuments_IsDeleted_Status_DraftedAt",
                table: "OutgoingDocuments");

            migrationBuilder.DropIndex(
                name: "IX_TaskItems_IsDeleted_CreatedAt",
                table: "TaskItems");

            migrationBuilder.DropIndex(
                name: "IX_TaskItems_IsDeleted_Status_CreatedAt",
                table: "TaskItems");
        }
    }
}
