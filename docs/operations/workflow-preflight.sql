\set ON_ERROR_STOP on
SELECT current_database() AS database, current_user AS db_user;
SELECT "MigrationId" FROM "__EFMigrationsHistory" ORDER BY "MigrationId";
SELECT 'Users' AS object, count(*) AS records FROM "Users"
UNION ALL SELECT 'TaskItems', count(*) FROM "TaskItems"
UNION ALL SELECT 'InboxDocuments', count(*) FROM "InboxDocuments"
UNION ALL SELECT 'OutgoingDocuments', count(*) FROM "OutgoingDocuments"
UNION ALL SELECT 'DocumentAttachments', count(*) FROM "DocumentAttachments"
UNION ALL SELECT 'CalendarEvents', count(*) FROM "CalendarEvents"
UNION ALL SELECT 'RatingHistories', count(*) FROM "RatingHistories";
SELECT "Status", count(*) FROM "TaskItems" GROUP BY "Status" ORDER BY "Status";
SELECT 'Inbox legacy link' AS source, count(*) AS links FROM "InboxDocuments" WHERE "ScheduledTaskId" IS NOT NULL
UNION ALL SELECT 'Outgoing legacy link', count(*) FROM "OutgoingDocuments" WHERE "RelatedTaskItemId" IS NOT NULL;
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='TaskItems' AND column_name IN ('DueDate','StartDate','CompletedAt') ORDER BY column_name;
