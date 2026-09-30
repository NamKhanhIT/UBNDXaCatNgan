-- Run with psql through the database administrator's normal local authentication.
-- Required variables: operator_username, target_username, grant_admin (true/false), reason, request_id (UUID).
-- Do not put passwords or connection strings in this file or command history.
-- This operation is deliberately unavailable to ordinary application accounts/API clients.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('workflow.operator', :'operator_username', true);
SELECT set_config('workflow.target', :'target_username', true);
SELECT set_config('workflow.grant', :'grant_admin', true);
SELECT set_config('workflow.reason', :'reason', true);
SELECT set_config('workflow.request', :'request_id', true);
DO $provision$
DECLARE
    operator_id uuid;
    target_id uuid;
    operation_id uuid := current_setting('workflow.request')::uuid;
    grant_admin boolean := current_setting('workflow.grant')::boolean;
    reason text := btrim(current_setting('workflow.reason'));
    details text;
    previous_audit record;
BEGIN
    IF reason = '' OR operation_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
        RAISE EXCEPTION 'A reason and a nonempty request UUID are required';
    END IF;
    SELECT "Id" INTO STRICT operator_id FROM "Users"
        WHERE ("Username" = current_setting('workflow.operator') OR "Email" = current_setting('workflow.operator')) AND NOT "IsDeleted";
    SELECT "Id" INTO STRICT target_id FROM "Users"
        WHERE ("Username" = current_setting('workflow.target') OR "Email" = current_setting('workflow.target')) AND NOT "IsDeleted";
    details := CASE WHEN grant_admin THEN 'Cấp' ELSE 'Thu' END
        || ' quyền quản trị tiếp nhận văn bản. Lý do: ' || reason;
    SELECT "UserId", "EntityId", "Details", "Action" INTO previous_audit FROM "AuditLogs" WHERE "Id" = operation_id;
    IF FOUND THEN
        IF previous_audit."UserId" <> operator_id OR previous_audit."EntityId" <> target_id::text
            OR previous_audit."Details" <> details OR previous_audit."Action" <> 'WorkflowAdminPermission' THEN
            RAISE EXCEPTION 'Request UUID already used for a different operation';
        END IF;
        RETURN;
    END IF;
    INSERT INTO "WorkflowPermissions" ("Id", "UserId", "CanReceiveDocuments", "CanManageWorkflowPermissions",
        "UpdatedById", "Version", "CreatedAt", "UpdatedAt", "IsDeleted")
    VALUES (gen_random_uuid(), target_id, FALSE, grant_admin, operator_id, gen_random_uuid(), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, FALSE)
    ON CONFLICT ("UserId") DO UPDATE SET "CanManageWorkflowPermissions" = EXCLUDED."CanManageWorkflowPermissions",
        "UpdatedById" = operator_id, "Version" = gen_random_uuid(), "UpdatedAt" = CURRENT_TIMESTAMP, "IsDeleted" = FALSE;
    INSERT INTO "AuditLogs" ("Id", "UserId", "Username", "ActingRole", "IsDelegatedAction", "DelegatedFromUserId",
        "Action", "EntityName", "EntityId", "Details", "IpAddress", "CreatedAt", "UpdatedAt", "IsDeleted")
    VALUES (operation_id, operator_id, current_setting('workflow.operator'), 'DatabaseProvisioner', FALSE, NULL,
        'WorkflowAdminPermission', 'User', target_id::text, details, '', CURRENT_TIMESTAMP, NULL, FALSE);
END
$provision$;
COMMIT;
