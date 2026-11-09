-- Replace the allocation family in the empty migration target schema.
DROP TABLE "global_creation_allocation";


CREATE TABLE "global_creation_allocation" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "request_id" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "request_contract" text NOT NULL,
  "resolution_seed" text NOT NULL,
  "task_resolution" text,
  "materialized_project_id" text,
  "materialized_project_generation" text,
  "time_materialized" integer,
  "rejected_error" text,
  "time_rejected" integer,
  "accepted_project_id" text,
  "accepted_target_id" text,
  "accepted_initial_config_overlay" text,
  "time_accepted" integer,
  "time_project_retained" integer,
  "directory" text NOT NULL,
  "time_created" integer NOT NULL,
  CONSTRAINT "global_creation_allocation_fact_shape" CHECK (length(trim("request_id")) > 0
          AND length("request_fingerprint") = 64
          AND json_type("request_contract") = 'object'
          AND (
            ("kind" = 'global_task' AND json_extract("request_contract", '$.protocol') = 'global-task-project-allocation-v2')
            OR ("kind" = 'global_chat_start' AND json_extract("request_contract", '$.protocol') = 'global-chat-start-request-v2')
            OR ("kind" = 'automation_run' AND json_extract("request_contract", '$.protocol') = 'automation-run-project-v1')
            OR ("kind" IN ('global_chat_create','global_work_create')
              AND json_extract("request_contract", '$.protocol') IS 'global-conversation-create-v1'
              AND json_extract("request_contract", '$.experience') IS CASE "kind" WHEN 'global_chat_create' THEN 'chat' ELSE 'work' END
              AND COALESCE(json_type("request_contract", '$.model') IN ('text','null'), 0)
              AND json_type("resolution_seed", '$.initialConfigOverlay') IS 'object')
          )
          AND json_type("resolution_seed") = 'object'
          AND (
            ("kind" = 'global_task' AND json_type("task_resolution") = 'object')
            OR ("kind" IN ('global_chat_start','automation_run','global_chat_create','global_work_create') AND "task_resolution" IS NULL)
          )
          AND (
            ("materialized_project_id" IS NULL AND "materialized_project_generation" IS NULL AND "time_materialized" IS NULL)
            OR
            (length(trim("materialized_project_id")) > 0
              AND length(trim("materialized_project_generation")) > 0
              AND "time_materialized" IS NOT NULL)
          )
          AND (
            ("rejected_error" IS NULL AND "time_rejected" IS NULL)
            OR (json_type("rejected_error") = 'object'
              AND json_extract("rejected_error", '$.name') IN ('TaskChannelBindingProjectConflictError','TaskChannelBindingGlobalCreationConflictError','GlobalCreationAcceptedTargetConflictError')
              AND json_type("rejected_error", '$.data') = 'object'
              AND "time_rejected" IS NOT NULL)
          )
          AND (
            ("accepted_project_id" IS NULL AND "accepted_target_id" IS NULL
              AND "accepted_initial_config_overlay" IS NULL AND "time_accepted" IS NULL)
            OR
            (length(trim("accepted_project_id")) > 0
              AND length(trim("accepted_target_id")) > 0
              AND json_type("accepted_initial_config_overlay") = 'object'
              AND "time_accepted" IS NOT NULL)
          )
          AND NOT ("rejected_error" IS NOT NULL AND "accepted_target_id" IS NOT NULL)
          AND ("accepted_project_id" IS NULL OR "accepted_project_id" = "materialized_project_id")
          AND ("time_project_retained" IS NULL OR (
            "materialized_project_id" IS NOT NULL
            AND ("accepted_target_id" IS NOT NULL OR "rejected_error" IS NOT NULL)
            AND "time_project_retained" >= "time_materialized"
          ))
          AND length(trim("directory")) > 0)
);

CREATE UNIQUE INDEX "global_creation_allocation_request_idx" ON "global_creation_allocation" ("kind", "request_id");

CREATE UNIQUE INDEX "global_creation_allocation_directory_idx" ON "global_creation_allocation" ("directory");

CREATE TRIGGER global_creation_allocation_identity_immutable_update
BEFORE UPDATE OF id, kind, request_id, request_fingerprint, request_contract, resolution_seed, task_resolution, directory, time_created
ON global_creation_allocation
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: immutable request allocation');
END;

CREATE TRIGGER global_creation_allocation_project_write_once
BEFORE UPDATE OF materialized_project_id, materialized_project_generation, time_materialized
ON global_creation_allocation FOR EACH ROW
WHEN OLD.materialized_project_id IS NOT NULL
  OR OLD.materialized_project_generation IS NOT NULL
  OR OLD.time_materialized IS NOT NULL
  OR NEW.materialized_project_id IS NULL
  OR NEW.materialized_project_generation IS NULL
  OR NEW.time_materialized IS NULL
  OR NOT EXISTS (
    SELECT 1 FROM project
    WHERE id=NEW.materialized_project_id
      AND generation=NEW.materialized_project_generation
  )
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: carrying Project is append-only');
END;

CREATE TRIGGER global_creation_allocation_project_insert
BEFORE INSERT ON global_creation_allocation FOR EACH ROW
WHEN NEW.materialized_project_id IS NOT NULL
  AND NOT EXISTS (
  SELECT 1 FROM project
  WHERE id=NEW.materialized_project_id
    AND generation=NEW.materialized_project_generation
)
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: carrying Project occurrence is invalid');
END;

CREATE TRIGGER global_creation_allocation_rejection_write_once
BEFORE UPDATE OF rejected_error, time_rejected ON global_creation_allocation
FOR EACH ROW
WHEN OLD.rejected_error IS NOT NULL
  OR OLD.time_rejected IS NOT NULL
  OR NEW.rejected_error IS NULL
  OR NEW.time_rejected IS NULL
  OR NEW.accepted_target_id IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: rejection is append-only');
END;

CREATE TRIGGER global_creation_allocation_acceptance_write_once
BEFORE UPDATE OF accepted_project_id, accepted_target_id, accepted_initial_config_overlay, time_accepted ON global_creation_allocation
FOR EACH ROW
WHEN OLD.accepted_project_id IS NOT NULL
  OR OLD.accepted_target_id IS NOT NULL
  OR OLD.accepted_initial_config_overlay IS NOT NULL
  OR OLD.time_accepted IS NOT NULL
  OR NEW.accepted_project_id IS NULL
  OR NEW.accepted_target_id IS NULL
  OR NEW.accepted_initial_config_overlay IS NULL
  OR NEW.time_accepted IS NULL
  OR OLD.rejected_error IS NOT NULL
  OR NEW.materialized_project_id IS NOT NEW.accepted_project_id
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: aggregate acceptance is append-only');
END;

CREATE TRIGGER global_creation_allocation_project_retention_write_once
BEFORE UPDATE OF time_project_retained ON global_creation_allocation
FOR EACH ROW
WHEN OLD.time_project_retained IS NOT NULL
  OR NEW.time_project_retained IS NULL
  OR (NEW.accepted_target_id IS NULL AND NEW.rejected_error IS NULL)
  OR NOT EXISTS (
    SELECT 1 FROM project
    WHERE id=NEW.materialized_project_id AND generation=NEW.materialized_project_generation
  )
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: Project retention is append-only');
END;

CREATE TRIGGER global_creation_allocation_project_retention_insert
BEFORE INSERT ON global_creation_allocation
FOR EACH ROW WHEN NEW.time_project_retained IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: Project retention must be produced by Project deletion');
END;

CREATE TRIGGER global_creation_allocation_acceptance_target_update
BEFORE UPDATE OF accepted_project_id, accepted_target_id, accepted_initial_config_overlay, time_accepted ON global_creation_allocation
FOR EACH ROW
WHEN NEW.accepted_project_id IS NOT NULL AND NOT (
  (
    NEW.kind='global_task' AND EXISTS (
      SELECT 1 FROM engine_task AS task
      WHERE task.id=NEW.accepted_target_id
        AND task.project_id=NEW.accepted_project_id
        AND task.request_id=NEW.request_id
        AND task.global_creation_allocation_id=NEW.id
    )
  ) OR (
    NEW.kind='global_chat_start' AND EXISTS (
      SELECT 1 FROM session AS target_session
      WHERE target_session.id=NEW.accepted_target_id
        AND target_session.project_id=NEW.accepted_project_id
        AND json_extract(target_session.metadata,'$.globalChatStart.requestID')=NEW.request_id
        AND json_extract(target_session.metadata,'$.globalChatStart.version')=2
        AND json_extract(target_session.metadata,'$.globalChatStart.requestFingerprint')=NEW.request_fingerprint
    )
  ) OR (NEW.kind IN ('global_chat_create','global_work_create') AND EXISTS (
    SELECT 1 FROM session AS target_session
    WHERE target_session.id=NEW.accepted_target_id
      AND target_session.project_id=NEW.accepted_project_id
      AND target_session.kind='assistant'
      AND target_session.parent_id IS NULL
      AND json_extract(target_session.metadata,'$.conversation.surface')='right-sidebar'
      AND json_extract(target_session.metadata,'$.conversation.experience')=json_extract(NEW.request_contract,'$.experience')
      AND json_extract(target_session.metadata,'$.globalConversationCreation.requestID')=NEW.request_id
      AND json_extract(target_session.metadata,'$.globalConversationCreation.version')=1
      AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(json_extract(NEW.resolution_seed,'$.initialConfigOverlay')) EXCEPT SELECT fullkey,type,atom FROM json_tree(NEW.accepted_initial_config_overlay))
    AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(NEW.accepted_initial_config_overlay) EXCEPT SELECT fullkey,type,atom FROM json_tree(json_extract(NEW.resolution_seed,'$.initialConfigOverlay')))
      AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(json_extract(target_session.metadata,'$.configOverlay')) EXCEPT SELECT fullkey,type,atom FROM json_tree(NEW.accepted_initial_config_overlay))
    AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(NEW.accepted_initial_config_overlay) EXCEPT SELECT fullkey,type,atom FROM json_tree(json_extract(target_session.metadata,'$.configOverlay')))
  )) OR (
    NEW.kind='automation_run' AND EXISTS (
      SELECT 1 FROM automation_run AS run
      WHERE run.id=NEW.accepted_target_id AND run.target_project_id=NEW.accepted_project_id
        AND run.target_project_generation=NEW.materialized_project_generation
        AND run.id=json_extract(NEW.request_contract,'$.runID')
        AND run.fire_id=json_extract(NEW.request_contract,'$.fireID')
        AND run.automation_revision_id=json_extract(NEW.request_contract,'$.revisionID')
    )
  )
)
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: accepted target does not match request aggregate');
END;

CREATE TRIGGER global_creation_allocation_acceptance_target_insert
BEFORE INSERT ON global_creation_allocation
FOR EACH ROW
WHEN NEW.accepted_project_id IS NOT NULL AND NOT (
  (NEW.kind='global_task' AND EXISTS (
    SELECT 1 FROM engine_task AS task
    WHERE task.id=NEW.accepted_target_id
      AND task.project_id=NEW.accepted_project_id
      AND task.request_id=NEW.request_id
      AND task.global_creation_allocation_id=NEW.id
  )) OR
  (NEW.kind='global_chat_start' AND EXISTS (
    SELECT 1 FROM session AS target_session
    WHERE target_session.id=NEW.accepted_target_id
      AND target_session.project_id=NEW.accepted_project_id
      AND json_extract(target_session.metadata,'$.globalChatStart.requestID')=NEW.request_id
      AND json_extract(target_session.metadata,'$.globalChatStart.version')=2
      AND json_extract(target_session.metadata,'$.globalChatStart.requestFingerprint')=NEW.request_fingerprint
  )) OR (NEW.kind IN ('global_chat_create','global_work_create') AND EXISTS (
    SELECT 1 FROM session AS target_session
    WHERE target_session.id=NEW.accepted_target_id
      AND target_session.project_id=NEW.accepted_project_id
      AND target_session.kind='assistant'
      AND target_session.parent_id IS NULL
      AND json_extract(target_session.metadata,'$.conversation.surface')='right-sidebar'
      AND json_extract(target_session.metadata,'$.conversation.experience')=json_extract(NEW.request_contract,'$.experience')
      AND json_extract(target_session.metadata,'$.globalConversationCreation.requestID')=NEW.request_id
      AND json_extract(target_session.metadata,'$.globalConversationCreation.version')=1
      AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(json_extract(NEW.resolution_seed,'$.initialConfigOverlay')) EXCEPT SELECT fullkey,type,atom FROM json_tree(NEW.accepted_initial_config_overlay))
    AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(NEW.accepted_initial_config_overlay) EXCEPT SELECT fullkey,type,atom FROM json_tree(json_extract(NEW.resolution_seed,'$.initialConfigOverlay')))
      AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(json_extract(target_session.metadata,'$.configOverlay')) EXCEPT SELECT fullkey,type,atom FROM json_tree(NEW.accepted_initial_config_overlay))
    AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(NEW.accepted_initial_config_overlay) EXCEPT SELECT fullkey,type,atom FROM json_tree(json_extract(target_session.metadata,'$.configOverlay')))
  )) OR (NEW.kind='automation_run' AND EXISTS (
    SELECT 1 FROM automation_run AS run
    WHERE run.id=NEW.accepted_target_id AND run.target_project_id=NEW.accepted_project_id
      AND run.target_project_generation=NEW.materialized_project_generation
      AND run.id=json_extract(NEW.request_contract,'$.runID')
      AND run.fire_id=json_extract(NEW.request_contract,'$.fireID')
      AND run.automation_revision_id=json_extract(NEW.request_contract,'$.revisionID')
  ))
)
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: accepted target does not match request aggregate');
END;

CREATE TRIGGER global_creation_allocation_no_delete
BEFORE DELETE ON global_creation_allocation
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: immutable request allocation');
END;
