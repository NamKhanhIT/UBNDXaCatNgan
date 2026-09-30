\set ON_ERROR_STOP on
SELECT "MigrationId" FROM "__EFMigrationsHistory" WHERE "MigrationId" >= '20260912153534' ORDER BY "MigrationId";
SELECT 'Users' AS object, count(*) AS records FROM "Users"
UNION ALL SELECT 'TaskItems', count(*) FROM "TaskItems"
UNION ALL SELECT 'InboxDocuments', count(*) FROM "InboxDocuments"
UNION ALL SELECT 'OutgoingDocuments', count(*) FROM "OutgoingDocuments"
UNION ALL SELECT 'DocumentAttachments', count(*) FROM "DocumentAttachments"
UNION ALL SELECT 'CalendarEvents', count(*) FROM "CalendarEvents";
SELECT 'Unlinked incoming legacy pairs' AS audit, count(*) AS defects FROM "InboxDocuments" d
WHERE d."ScheduledTaskId" IS NOT NULL AND EXISTS(SELECT FROM "TaskItems" t WHERE t."Id"=d."ScheduledTaskId")
AND NOT EXISTS(SELECT FROM "TaskDocumentLinks" l WHERE l."TaskItemId"=d."ScheduledTaskId" AND l."InboxDocumentId"=d."Id")
UNION ALL SELECT 'Unlinked outgoing legacy pairs', count(*) FROM "OutgoingDocuments" d
WHERE d."RelatedTaskItemId" IS NOT NULL AND EXISTS(SELECT FROM "TaskItems" t WHERE t."Id"=d."RelatedTaskItemId")
AND NOT EXISTS(SELECT FROM "TaskDocumentLinks" l WHERE l."TaskItemId"=d."RelatedTaskItemId" AND l."OutgoingDocumentId"=d."Id")
UNION ALL SELECT 'Calendar without version', count(*) FROM "CalendarEvents" WHERE "Version"='00000000-0000-0000-0000-000000000000'
UNION ALL SELECT 'Outgoing without version', count(*) FROM "OutgoingDocuments" WHERE "Version"='00000000-0000-0000-0000-000000000000';
SELECT "Status", "RequiresWorkflowReview", count(*) FROM "TaskItems" GROUP BY "Status", "RequiresWorkflowReview" ORDER BY "Status";
SELECT "IsLegacy", "Decision", count(*) FROM "TaskSubmissions" GROUP BY "IsLegacy", "Decision";
