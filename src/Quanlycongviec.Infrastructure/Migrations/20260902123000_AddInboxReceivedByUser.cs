using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Quanlycongviec.Infrastructure.Persistence;

#nullable disable

namespace Quanlycongviec.Infrastructure.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20260902123000_AddInboxReceivedByUser")]
    public partial class AddInboxReceivedByUser : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ReceivedByUserId",
                table: "InboxDocuments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_InboxDocuments_ReceivedByUserId",
                table: "InboxDocuments",
                column: "ReceivedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_InboxDocuments_Users_ReceivedByUserId",
                table: "InboxDocuments",
                column: "ReceivedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InboxDocuments_Users_ReceivedByUserId",
                table: "InboxDocuments");
            migrationBuilder.DropIndex(
                name: "IX_InboxDocuments_ReceivedByUserId",
                table: "InboxDocuments");
            migrationBuilder.DropColumn(
                name: "ReceivedByUserId",
                table: "InboxDocuments");
        }
    }
}
