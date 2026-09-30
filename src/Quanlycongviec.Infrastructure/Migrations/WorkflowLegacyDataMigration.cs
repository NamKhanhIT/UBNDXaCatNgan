using Microsoft.EntityFrameworkCore.Migrations;

namespace Quanlycongviec.Infrastructure.Migrations;

internal static class WorkflowLegacyDataMigration
{
    public static void Backfill(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        INSERT INTO "TaskDocumentLinks" ("Id","TaskItemId","InboxDocumentId","OutgoingDocumentId","CreatedAt","UpdatedAt","IsDeleted")
        SELECT md5('workflow-inbox:' || d."Id"::text || ':' || t."Id"::text)::uuid,
            t."Id",d."Id",NULL,d."CreatedAt",NULL,d."IsDeleted"
        FROM "InboxDocuments" d JOIN "TaskItems" t ON t."Id"=d."ScheduledTaskId"
        ON CONFLICT DO NOTHING;

        INSERT INTO "TaskDocumentLinks" ("Id","TaskItemId","InboxDocumentId","OutgoingDocumentId","CreatedAt","UpdatedAt","IsDeleted")
        SELECT md5('workflow-outgoing:' || d."Id"::text || ':' || t."Id"::text)::uuid,
            t."Id",NULL,d."Id",d."CreatedAt",NULL,d."IsDeleted"
        FROM "OutgoingDocuments" d JOIN "TaskItems" t ON t."Id"=d."RelatedTaskItemId"
        ON CONFLICT DO NOTHING;

        UPDATE "InboxDocuments" d SET "Version"=gen_random_uuid(),
            "BusinessStatus"=CASE WHEN EXISTS (SELECT 1 FROM "TaskDocumentLinks" l WHERE l."InboxDocumentId"=d."Id" AND NOT l."IsDeleted") THEN 'Assigned' ELSE 'New' END;
        UPDATE "TaskItems" SET "Version"=gen_random_uuid();

        WITH ranks AS (
            SELECT u."Id", u."PrimaryDepartmentId", u."ActiveRoleCode",
                COALESCE(MIN(r."RankLevel") FILTER (WHERE NOT ur."IsDeleted" AND NOT r."IsDeleted"),5) AS rank
            FROM "Users" u LEFT JOIN "UserRoles" ur ON ur."UserId"=u."Id"
            LEFT JOIN "Roles" r ON r."Id"=ur."RoleId" WHERE NOT u."IsDeleted"
            GROUP BY u."Id",u."PrimaryDepartmentId",u."ActiveRoleCode"
        )
        UPDATE "TaskItems" t SET "ReviewerId"=t."AssignerId"
        FROM ranks assigner, ranks assignee
        WHERE assigner."Id"=t."AssignerId" AND assignee."Id"=t."AssigneeId"
            AND assigner."Id"<>assignee."Id" AND assigner.rank<=4 AND assigner.rank<assignee.rank
            AND (assigner.rank<=2 OR assigner."ActiveRoleCode"='ChanhVanPhong'
                OR assigner."PrimaryDepartmentId"=assignee."PrimaryDepartmentId");

        UPDATE "TaskItems" t SET "RequiresWorkflowReview"=
            t."Status" NOT IN ('Completed','Cancelled') AND
            (t."ReviewerId" IS NULL OR t."DueDate" IS NULL OR NULLIF(btrim(t."Requirements"),'') IS NULL
                OR NOT EXISTS (SELECT 1 FROM "Users" u WHERE u."Id"=t."AssigneeId" AND NOT u."IsDeleted"));

        -- Preserve available evidence without inventing submission dates or deadline snapshots.
        INSERT INTO "TaskSubmissions" ("Id","TaskItemId","SubmittedById","Note","SubmittedAt","DueDateAtSubmission",
            "IsLegacy","Decision","ReviewedById","ReviewedAt","ReviewNote","CreatedAt","UpdatedAt","IsDeleted")
        SELECT md5('workflow-legacy-submission:' || t."Id"::text)::uuid,t."Id",t."AssigneeId",
            COALESCE(t."SubmissionNote",''),NULL,NULL,TRUE,
            CASE WHEN t."Status"='Completed' THEN 'Accepted' WHEN t."Status" IN ('InReview','PendingUBMTTQReview') THEN 'Pending' ELSE 'Historical' END,
            NULL,NULL,t."RejectionReason",CURRENT_TIMESTAMP,NULL,t."IsDeleted"
        FROM "TaskItems" t WHERE NULLIF(btrim(t."SubmissionNote"),'') IS NOT NULL OR t."Status" IN ('InReview','PendingUBMTTQReview')
        ON CONFLICT DO NOTHING;

        INSERT INTO "TaskWorkflowChanges" ("Id","TaskItemId","UserId","Kind","OldValue","NewValue","Reason","CreatedAt","UpdatedAt","IsDeleted")
        SELECT md5('workflow-retire-mttq:' || t."Id"::text)::uuid,t."Id",t."AssignerId",'LegacyMigration',
            'PendingUBMTTQReview','InReview','Ngừng bước phản biện UBMTTQ; chuyển sang chờ nghiệm thu, giữ nguyên bằng chứng cũ.',
            CURRENT_TIMESTAMP,NULL,FALSE FROM "TaskItems" t WHERE t."Status"='PendingUBMTTQReview'
        ON CONFLICT DO NOTHING;
        UPDATE "TaskItems" SET "Status"='InReview' WHERE "Status"='PendingUBMTTQReview';

        INSERT INTO "TaskWorkflowChanges" ("Id","TaskItemId","UserId","Kind","OldValue","NewValue","Reason","CreatedAt","UpdatedAt","IsDeleted")
        SELECT md5('workflow-legacy-return:' || t."Id"::text)::uuid,t."Id",t."AssignerId",'LegacyRejection',
            NULL,NULL,t."RejectionReason",CURRENT_TIMESTAMP,NULL,FALSE FROM "TaskItems" t
        WHERE NULLIF(btrim(t."RejectionReason"),'') IS NOT NULL AND t."Status"<>'InProgress'
        ON CONFLICT DO NOTHING;
        UPDATE "TaskItems" SET "RejectionReason"=NULL WHERE "Status" IN ('Todo','InReview','Completed');
        """);
}
