START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Notifications" ADD "RequiresRealtimeDelivery" boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "AppearancePreferences" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "EmailChangeNewEmail" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "EmailChangeOtpExpiry" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "EmailChangeOtpHash" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "EmailChangeOtpSentUtc" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "NotificationPreferences" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PhoneNumberConfirmed" boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PhoneOtpExpiry" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PhoneOtpFailedCount" integer NOT NULL DEFAULT 0;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PhoneOtpHash" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "PhoneOtpSentUtc" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS "WorkProfileJson" text;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "TaskItems" ADD "ParentTaskId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "TaskItems" ADD "RequiresWorkflowReview" boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "TaskItems" ADD "ReviewerId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "TaskItems" ADD "Version" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Notifications" ADD "InboxDocumentId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "Notifications" ADD "RealtimeDeliveredAt" timestamp with time zone;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "InboxDocuments" ADD "BusinessStatus" character varying(30) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "InboxDocuments" ADD "Version" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE TABLE "DocumentPresentations" (
        "Id" uuid NOT NULL,
        "InboxDocumentId" uuid NOT NULL,
        "SubmittedById" uuid NOT NULL,
        "RecipientId" uuid NOT NULL,
        "Note" text NOT NULL,
        "Status" character varying(30) NOT NULL,
        "DecisionNote" text,
        "DecidedAt" timestamp with time zone,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_DocumentPresentations" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_DocumentPresentations_InboxDocuments_InboxDocumentId" FOREIGN KEY ("InboxDocumentId") REFERENCES "InboxDocuments" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE TABLE IF NOT EXISTS "MonthlyRatingSummaries" (
        "Id" uuid PRIMARY KEY, "UserId" uuid NOT NULL, "Year" integer NOT NULL, "Month" integer NOT NULL,
        "AverageFinalScore" double precision NOT NULL, "SumSystemScore" double precision NOT NULL,
        "SumEvaluatorScore" double precision NOT NULL, "TasksEvaluated" integer NOT NULL,
        "LastEvaluationAt" timestamp with time zone NOT NULL, "AggregatedAt" timestamp with time zone NOT NULL,
        "TierGrade" text NOT NULL, "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone, "IsDeleted" boolean NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS "IX_MonthlyRatingSummaries_UserId_Year_Month"
        ON "MonthlyRatingSummaries" ("UserId", "Year", "Month");
    CREATE INDEX IF NOT EXISTS "IX_MonthlyRatingSummaries_Year_Month" ON "MonthlyRatingSummaries" ("Year", "Month");
    CREATE TABLE IF NOT EXISTS "RatingPeriods" (
        "Id" uuid PRIMARY KEY, "Title" text NOT NULL, "PeriodType" text NOT NULL,
        "Year" integer NOT NULL, "Quarter" integer, "Month" integer,
        "StartDate" timestamp with time zone NOT NULL, "EndDate" timestamp with time zone NOT NULL,
        "IsClosed" boolean NOT NULL, "ClosedAt" timestamp with time zone,
        "ClosedByUserId" uuid REFERENCES "Users" ("Id"),
        "CreatedAt" timestamp with time zone NOT NULL, "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL);
    CREATE INDEX IF NOT EXISTS "IX_RatingPeriods_ClosedByUserId" ON "RatingPeriods" ("ClosedByUserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE TABLE "TaskDocumentLinks" (
        "Id" uuid NOT NULL,
        "TaskItemId" uuid NOT NULL,
        "InboxDocumentId" uuid,
        "OutgoingDocumentId" uuid,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_TaskDocumentLinks" PRIMARY KEY ("Id"),
        CONSTRAINT "CK_TaskDocumentLink_Source" CHECK (("InboxDocumentId" IS NULL) <> ("OutgoingDocumentId" IS NULL)),
        CONSTRAINT "FK_TaskDocumentLinks_InboxDocuments_InboxDocumentId" FOREIGN KEY ("InboxDocumentId") REFERENCES "InboxDocuments" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_TaskDocumentLinks_OutgoingDocuments_OutgoingDocumentId" FOREIGN KEY ("OutgoingDocumentId") REFERENCES "OutgoingDocuments" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_TaskDocumentLinks_TaskItems_TaskItemId" FOREIGN KEY ("TaskItemId") REFERENCES "TaskItems" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE TABLE "TaskSubmissions" (
        "Id" uuid NOT NULL,
        "TaskItemId" uuid NOT NULL,
        "SubmittedById" uuid NOT NULL,
        "Note" text NOT NULL,
        "SubmittedAt" timestamp with time zone,
        "DueDateAtSubmission" timestamp with time zone,
        "IsLegacy" boolean NOT NULL,
        "Decision" character varying(30) NOT NULL,
        "ReviewedById" uuid,
        "ReviewedAt" timestamp with time zone,
        "ReviewNote" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_TaskSubmissions" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_TaskSubmissions_TaskItems_TaskItemId" FOREIGN KEY ("TaskItemId") REFERENCES "TaskItems" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE TABLE "TaskWorkflowChanges" (
        "Id" uuid NOT NULL,
        "TaskItemId" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "Kind" text NOT NULL,
        "OldValue" text,
        "NewValue" text,
        "Reason" text,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_TaskWorkflowChanges" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_TaskWorkflowChanges_TaskItems_TaskItemId" FOREIGN KEY ("TaskItemId") REFERENCES "TaskItems" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE TABLE "WorkflowPermissions" (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "CanReceiveDocuments" boolean NOT NULL,
        "CanManageWorkflowPermissions" boolean NOT NULL,
        "UpdatedById" uuid,
        "Version" uuid NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_WorkflowPermissions" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_WorkflowPermissions_Users_UserId" FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE TABLE "WorkflowRequests" (
        "Id" uuid NOT NULL,
        "UserId" uuid NOT NULL,
        "RequestId" uuid NOT NULL,
        "Fingerprint" text NOT NULL,
        "ResultId" uuid NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_WorkflowRequests" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE TABLE "TaskSubmissionAttachments" (
        "Id" uuid NOT NULL,
        "SubmissionId" uuid NOT NULL,
        "AttachmentId" uuid NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone,
        "IsDeleted" boolean NOT NULL,
        CONSTRAINT "PK_TaskSubmissionAttachments" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_TaskSubmissionAttachments_DocumentAttachments_AttachmentId" FOREIGN KEY ("AttachmentId") REFERENCES "DocumentAttachments" ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_TaskSubmissionAttachments_TaskSubmissions_SubmissionId" FOREIGN KEY ("SubmissionId") REFERENCES "TaskSubmissions" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE INDEX "IX_TaskItems_ParentTaskId" ON "TaskItems" ("ParentTaskId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE INDEX "IX_TaskItems_ReviewerId_Status_IsDeleted" ON "TaskItems" ("ReviewerId", "Status", "IsDeleted");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE INDEX "IX_DocumentPresentations_InboxDocumentId_Status" ON "DocumentPresentations" ("InboxDocumentId", "Status");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE INDEX "IX_DocumentPresentations_RecipientId_Status" ON "DocumentPresentations" ("RecipientId", "Status");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE INDEX "IX_TaskDocumentLinks_InboxDocumentId" ON "TaskDocumentLinks" ("InboxDocumentId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE INDEX "IX_TaskDocumentLinks_OutgoingDocumentId" ON "TaskDocumentLinks" ("OutgoingDocumentId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE UNIQUE INDEX "IX_TaskDocumentLinks_TaskItemId_InboxDocumentId" ON "TaskDocumentLinks" ("TaskItemId", "InboxDocumentId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE UNIQUE INDEX "IX_TaskDocumentLinks_TaskItemId_OutgoingDocumentId" ON "TaskDocumentLinks" ("TaskItemId", "OutgoingDocumentId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE UNIQUE INDEX "IX_TaskSubmissionAttachments_AttachmentId" ON "TaskSubmissionAttachments" ("AttachmentId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE INDEX "IX_TaskSubmissionAttachments_SubmissionId" ON "TaskSubmissionAttachments" ("SubmissionId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE INDEX "IX_TaskSubmissions_TaskItemId_CreatedAt" ON "TaskSubmissions" ("TaskItemId", "CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE INDEX "IX_TaskWorkflowChanges_TaskItemId" ON "TaskWorkflowChanges" ("TaskItemId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE UNIQUE INDEX "IX_WorkflowPermissions_UserId" ON "WorkflowPermissions" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    CREATE UNIQUE INDEX "IX_WorkflowRequests_UserId_RequestId" ON "WorkflowRequests" ("UserId", "RequestId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "TaskItems" ADD CONSTRAINT "FK_TaskItems_TaskItems_ParentTaskId" FOREIGN KEY ("ParentTaskId") REFERENCES "TaskItems" ("Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    ALTER TABLE "TaskItems" ADD CONSTRAINT "FK_TaskItems_Users_ReviewerId" FOREIGN KEY ("ReviewerId") REFERENCES "Users" ("Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
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
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260912153534_UnifiedDocumentWorkflow') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260912153534_UnifiedDocumentWorkflow', '8.0.11');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260913151308_CalendarWorkflowConfirmation') THEN
    ALTER TABLE "CalendarEvents" ADD "SourceInboxDocumentId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260913151308_CalendarWorkflowConfirmation') THEN
    ALTER TABLE "CalendarEvents" ADD "Version" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260913151308_CalendarWorkflowConfirmation') THEN
    UPDATE "CalendarEvents" SET "Version"=md5('calendar-workflow:' || "Id"::text)::uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260913151308_CalendarWorkflowConfirmation') THEN
    CREATE INDEX "IX_CalendarEvents_SourceInboxDocumentId" ON "CalendarEvents" ("SourceInboxDocumentId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260913151308_CalendarWorkflowConfirmation') THEN
    ALTER TABLE "CalendarEvents" ADD CONSTRAINT "FK_CalendarEvents_InboxDocuments_SourceInboxDocumentId" FOREIGN KEY ("SourceInboxDocumentId") REFERENCES "InboxDocuments" ("Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260913151308_CalendarWorkflowConfirmation') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260913151308_CalendarWorkflowConfirmation', '8.0.11');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260914005800_OutgoingWorkflowConcurrency') THEN
    ALTER TABLE "OutgoingDocuments" ADD "Version" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260914005800_OutgoingWorkflowConcurrency') THEN
    ALTER TABLE "Notifications" ADD "OutgoingDocumentId" uuid;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260914005800_OutgoingWorkflowConcurrency') THEN
    UPDATE "OutgoingDocuments" SET "Version"=md5('outgoing-workflow:' || "Id"::text)::uuid;
    UPDATE "OutgoingDocuments" SET "Status"='Cancelled'
        WHERE "Status"='Rejected' AND "RecallReason" LIKE 'HỦY VĂN BẢN:%';
    UPDATE "OutgoingDocuments" SET "Status"='Recalled'
        WHERE "Status"='Rejected' AND "RecalledAt" IS NOT NULL AND NULLIF(btrim("RecallReason"),'') IS NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260914005800_OutgoingWorkflowConcurrency') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260914005800_OutgoingWorkflowConcurrency', '8.0.11');
    END IF;
END $EF$;
COMMIT;
