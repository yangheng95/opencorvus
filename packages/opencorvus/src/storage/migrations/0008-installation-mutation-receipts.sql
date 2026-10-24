CREATE TABLE IF NOT EXISTS "automation_definition_tombstone" (
  "id" text PRIMARY KEY NOT NULL,
  "definition_id" text NOT NULL,
  "revision" integer NOT NULL,
  "tool_part_id" text,
  "tool_input_digest" text,
  "time_created" integer NOT NULL,
  CONSTRAINT "automation_tombstone_tool_causation_shape" CHECK (
      ("tool_part_id" IS NULL AND "tool_input_digest" IS NULL)
      OR ("tool_part_id" IS NOT NULL AND "tool_input_digest" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "automation_definition_tombstone_revision_idx" ON "automation_definition_tombstone" ("definition_id", "revision");
CREATE INDEX IF NOT EXISTS "automation_definition_tombstone_latest_idx" ON "automation_definition_tombstone" ("definition_id", "revision");
CREATE UNIQUE INDEX IF NOT EXISTS "automation_definition_tombstone_tool_occurrence_idx" ON "automation_definition_tombstone" ("tool_part_id") WHERE "tool_part_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "automation_delay_settlement" (
  "definition_id" text PRIMARY KEY NOT NULL,
  "disposition" text NOT NULL,
  "assistant_message_id" text NOT NULL,
  "accepted_input_message_ids" text NOT NULL,
  "fire_id" text,
  "time_created" integer NOT NULL,
  CONSTRAINT "automation_delay_settlement_shape" CHECK (
      ("disposition"='input_accepted')
      OR ("disposition"='due_accepted' AND "fire_id" IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS "automation_delay_settlement_assistant_idx" ON "automation_delay_settlement" ("assistant_message_id");

CREATE TABLE IF NOT EXISTS "automation_fire_attempt_receipt" (
  "attempt_id" text PRIMARY KEY NOT NULL,
  "outcome" text NOT NULL,
  "retry_at" integer,
  "error" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("attempt_id") REFERENCES "automation_fire_attempt"("id") ON DELETE RESTRICT,
  CONSTRAINT "automation_fire_attempt_receipt_shape" CHECK (
      ("outcome"='reserved' AND "retry_at" IS NULL AND "error" IS NULL)
      OR ("outcome"='retry_wait' AND "retry_at" IS NOT NULL AND "error" IS NOT NULL)
      OR ("outcome"='failed' AND "retry_at" IS NULL AND "error" IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS "automation_fire_attempt" (
  "id" text PRIMARY KEY NOT NULL,
  "fire_id" text NOT NULL,
  "ordinal" integer NOT NULL,
  "owner_occurrence_id" text NOT NULL,
  "lease_id" text NOT NULL,
  "lease_grant_ordinal" integer NOT NULL,
  "lease_expires_at" integer NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("fire_id") REFERENCES "automation_fire"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("lease_id") REFERENCES "engine_control_activation_lease"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("lease_id", "lease_grant_ordinal") REFERENCES "engine_control_activation_lease_grant"("lease_id", "ordinal") ON DELETE RESTRICT,
  CONSTRAINT "automation_fire_attempt_positive_ordinal" CHECK ("ordinal">0),
  CONSTRAINT "automation_fire_attempt_positive_lease_grant_ordinal" CHECK ("lease_grant_ordinal">0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "automation_fire_attempt_ordinal_idx" ON "automation_fire_attempt" ("fire_id", "ordinal");
CREATE INDEX IF NOT EXISTS "automation_fire_attempt_owner_idx" ON "automation_fire_attempt" ("owner_occurrence_id");

CREATE TABLE IF NOT EXISTS "automation_fire_frontier" (
  "definition_id" text PRIMARY KEY NOT NULL,
  "automation_revision_id" text NOT NULL,
  "fire_id" text NOT NULL,
  "available_at" integer NOT NULL,
  FOREIGN KEY ("automation_revision_id") REFERENCES "automation"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("fire_id") REFERENCES "automation_fire"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "automation_fire_frontier_fire_idx" ON "automation_fire_frontier" ("fire_id");
CREATE INDEX IF NOT EXISTS "automation_fire_frontier_due_idx" ON "automation_fire_frontier" ("available_at", "definition_id", "fire_id");

CREATE TABLE IF NOT EXISTS "automation_fire" (
  "id" text PRIMARY KEY NOT NULL,
  "automation_revision_id" text NOT NULL,
  "scheduled_due_at" integer NOT NULL,
  "origin" text NOT NULL,
  "tool_part_id" text,
  "input_digest" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("automation_revision_id") REFERENCES "automation"("id") ON DELETE RESTRICT,
  CONSTRAINT "automation_fire_origin_shape" CHECK (
      ("origin"='scheduled' AND "tool_part_id" IS NULL AND "input_digest" IS NULL)
      OR ("origin"='manual_api' AND "tool_part_id" IS NULL AND "input_digest" IS NULL)
      OR ("origin"='manual_tool' AND "tool_part_id" IS NOT NULL AND "input_digest" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "automation_fire_scheduled_occurrence_idx" ON "automation_fire" ("automation_revision_id", "scheduled_due_at") WHERE "origin"='scheduled';
CREATE UNIQUE INDEX IF NOT EXISTS "automation_fire_tool_occurrence_idx" ON "automation_fire" ("tool_part_id") WHERE "tool_part_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "automation_fire_revision_frontier_idx" ON "automation_fire" ("automation_revision_id", "scheduled_due_at", "time_created", "id");
CREATE INDEX IF NOT EXISTS "automation_fire_due_idx" ON "automation_fire" ("scheduled_due_at");

CREATE TABLE IF NOT EXISTS "automation_project_target" (
  "automation_revision_id" text NOT NULL,
  "project_id" text NOT NULL,
  "position" integer NOT NULL,
  PRIMARY KEY ("automation_revision_id", "project_id"),
  FOREIGN KEY ("automation_revision_id") REFERENCES "automation"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "automation_project_target_project_idx" ON "automation_project_target" ("project_id");

CREATE TABLE IF NOT EXISTS "automation_run_receipt" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL,
  "outcome" text NOT NULL,
  "disposition" text,
  "closure_event_id" text,
  "retry_at" integer,
  "error" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("run_id") REFERENCES "automation_run"("id") ON DELETE CASCADE,
  FOREIGN KEY ("closure_event_id") REFERENCES "protocol_event"("id") ON DELETE RESTRICT,
  CONSTRAINT "automation_run_receipt_shape" CHECK (
      ("outcome"='retry_wait' AND "disposition" IS NULL AND "closure_event_id" IS NULL AND "retry_at" IS NOT NULL AND "error" IS NOT NULL)
      OR ("outcome"='succeeded' AND "disposition" IS NULL AND "closure_event_id" IS NULL AND "retry_at" IS NULL AND "error" IS NULL)
      OR ("outcome"='failed' AND "disposition" IS NULL AND "closure_event_id" IS NULL AND "retry_at" IS NULL AND "error" IS NOT NULL)
      OR ("outcome"='disposition' AND "disposition"='mission_closed' AND "closure_event_id" IS NOT NULL AND "retry_at" IS NULL AND "error" IS NULL)
      OR ("outcome"='disposition' AND "disposition" IN ('target_deleted','superseded','owner_unresolved') AND "closure_event_id" IS NULL AND "retry_at" IS NULL AND "error" IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS "automation_run_receipt_run_idx" ON "automation_run_receipt" ("run_id", "time_created");
CREATE UNIQUE INDEX IF NOT EXISTS "automation_run_terminal_receipt_idx" ON "automation_run_receipt" ("run_id") WHERE "outcome" <> 'retry_wait';

CREATE TABLE IF NOT EXISTS "automation_run" (
  "id" text PRIMARY KEY NOT NULL,
  "automation_revision_id" text NOT NULL,
  "fire_id" text NOT NULL,
  "target_project_id" text,
  "target_project_generation" text,
  "mission_opened_event_id" text,
  "mission_disposition" text,
  "mission_closure_event_id" text,
  "started_at" integer NOT NULL,
  FOREIGN KEY ("automation_revision_id") REFERENCES "automation"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("fire_id") REFERENCES "automation_fire"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("mission_opened_event_id") REFERENCES "protocol_event"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("mission_closure_event_id") REFERENCES "protocol_event"("id") ON DELETE RESTRICT,
  CONSTRAINT "automation_run_mission_reservation_shape" CHECK (
      ("mission_opened_event_id" IS NULL AND "mission_disposition" IS NULL AND "mission_closure_event_id" IS NULL)
      OR ("mission_opened_event_id" IS NOT NULL AND "mission_disposition" IS NULL AND "mission_closure_event_id" IS NULL)
      OR ("mission_opened_event_id" IS NULL AND "mission_disposition"='mission_closed' AND "mission_closure_event_id" IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS "automation_run_automation_idx" ON "automation_run" ("automation_revision_id");
CREATE INDEX IF NOT EXISTS "automation_run_fire_idx" ON "automation_run" ("fire_id");
CREATE INDEX IF NOT EXISTS "automation_run_project_idx" ON "automation_run" ("target_project_id");
CREATE INDEX IF NOT EXISTS "automation_run_started_at_idx" ON "automation_run" ("started_at");

CREATE TABLE IF NOT EXISTS "automation" (
  "id" text PRIMARY KEY NOT NULL,
  "definition_id" text NOT NULL,
  "revision" integer NOT NULL,
  "project_id" text,
  "session_id" text,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "scope" text,
  "recurrence" text,
  "execution_mode" text NOT NULL DEFAULT 'local',
  "model_provider_id" text,
  "model_id" text,
  "reasoning_effort" text,
  "surface" text,
  "prompt" text NOT NULL,
  "agent" text NOT NULL DEFAULT 'default',
  "status" text NOT NULL DEFAULT 'active',
  "due_at" integer,
  "tool_part_id" text,
  "tool_input_digest" text,
  "time_created" integer NOT NULL,
  CONSTRAINT "automation_definition_tool_causation_shape" CHECK (
      ("tool_part_id" IS NULL AND "tool_input_digest" IS NULL)
      OR ("tool_part_id" IS NOT NULL AND "tool_input_digest" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "automation_definition_revision_idx" ON "automation" ("definition_id", "revision");
CREATE INDEX IF NOT EXISTS "automation_definition_latest_idx" ON "automation" ("definition_id", "revision");
CREATE INDEX IF NOT EXISTS "automation_session_delay_frontier_idx" ON "automation" ("session_id", "kind", "status", "definition_id", "revision", "id");
CREATE INDEX IF NOT EXISTS "automation_project_idx" ON "automation" ("project_id");
CREATE INDEX IF NOT EXISTS "automation_due_at_idx" ON "automation" ("due_at");
CREATE UNIQUE INDEX IF NOT EXISTS "automation_definition_tool_occurrence_idx" ON "automation" ("tool_part_id") WHERE "tool_part_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "bus_publication_attempt_receipt" (
  "id" text PRIMARY KEY NOT NULL,
  "occurrence_id" text NOT NULL,
  "error" text NOT NULL,
  "retry_at" integer NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("occurrence_id") REFERENCES "bus_publication_outbox"("occurrence_id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "bus_publication_attempt_receipt_idx" ON "bus_publication_attempt_receipt" ("occurrence_id", "time_created");

CREATE TABLE IF NOT EXISTS "bus_publication_delivery_receipt" (
  "id" text PRIMARY KEY NOT NULL,
  "occurrence_id" text NOT NULL,
  "phase" text NOT NULL,
  "subscriber_id" text NOT NULL,
  "outcome" text NOT NULL,
  "error" text,
  "retry_at" integer,
  "time_created" integer NOT NULL,
  CONSTRAINT "bus_publication_delivery_receipt_shape" CHECK (
      ("outcome"='succeeded' AND "error" IS NULL AND "retry_at" IS NULL)
      OR ("outcome"='ignored' AND "retry_at" IS NULL)
      OR ("outcome"='failed' AND "error" IS NOT NULL AND "retry_at" IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS "bus_publication_delivery_receipt_idx" ON "bus_publication_delivery_receipt" ("occurrence_id", "phase", "subscriber_id", "time_created");
CREATE UNIQUE INDEX IF NOT EXISTS "bus_publication_delivery_terminal_idx" ON "bus_publication_delivery_receipt" ("occurrence_id", "phase", "subscriber_id") WHERE "outcome" IN ('succeeded','ignored');

CREATE TABLE IF NOT EXISTS "bus_publication_delivery" (
  "occurrence_id" text NOT NULL,
  "phase" text NOT NULL,
  "subscriber_id" text NOT NULL,
  "effect_contract" text,
  "time_created" integer NOT NULL,
  PRIMARY KEY ("occurrence_id", "phase", "subscriber_id"),
  FOREIGN KEY ("occurrence_id") REFERENCES "bus_publication_outbox"("occurrence_id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "bus_publication_delivery_phase_idx" ON "bus_publication_delivery" ("occurrence_id", "phase");

CREATE TABLE IF NOT EXISTS "bus_publication_outbox" (
  "occurrence_id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "directory" text NOT NULL,
  "event_type" text NOT NULL,
  "properties" text NOT NULL,
  "causation" text,
  "time_created" integer NOT NULL,
  CONSTRAINT "bus_publication_outbox_task_status_is_projection" CHECK ("event_type" <> 'task.updated' OR json_type("properties", '$.status') IS NULL)
);
CREATE INDEX IF NOT EXISTS "bus_publication_outbox_project_idx" ON "bus_publication_outbox" ("project_id", "time_created");
CREATE INDEX IF NOT EXISTS "bus_publication_outbox_message_move_idx" ON "bus_publication_outbox" ("project_id", json_extract("properties", '$.info.id'), json_extract("properties", '$.sourceSessionID'), json_extract("properties", '$.info.sessionID')) WHERE "event_type" = 'message.moved';
CREATE INDEX IF NOT EXISTS "bus_publication_outbox_part_removal_idx" ON "bus_publication_outbox" ("project_id", json_extract("properties", '$.messageID'), json_extract("properties", '$.sessionID'), json_extract("properties", '$.partID'), json_extract("properties", '$.partType')) WHERE "event_type" = 'message.part.removed';

CREATE TABLE IF NOT EXISTS "bus_publication_owner" (
  "occurrence_id" text PRIMARY KEY NOT NULL,
  "project_generation" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("occurrence_id") REFERENCES "bus_publication_outbox"("occurrence_id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "bus_publication_phase_receipt" (
  "id" text PRIMARY KEY NOT NULL,
  "occurrence_id" text NOT NULL,
  "phase" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("occurrence_id") REFERENCES "bus_publication_outbox"("occurrence_id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "bus_publication_phase_receipt_idx" ON "bus_publication_phase_receipt" ("occurrence_id", "phase");

CREATE TABLE IF NOT EXISTS "channel_ingress_accepted" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "project_generation" text,
  "effect" text,
  "platform" text NOT NULL,
  "request_id" text NOT NULL,
  "input" text NOT NULL,
  "time_created" integer NOT NULL,
  CONSTRAINT "channel_ingress_payload_owner_shape" CHECK (
      json_type("input", '$.platform') IS NULL
      AND json_type("input", '$.request_id') IS NULL
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "channel_ingress_accepted_source_idx" ON "channel_ingress_accepted" ("project_id", "platform", "request_id");
CREATE INDEX IF NOT EXISTS "channel_ingress_accepted_project_time_idx" ON "channel_ingress_accepted" ("project_id", "time_created");

CREATE TABLE IF NOT EXISTS "channel_ingress_outcome" (
  "request_id" text PRIMARY KEY NOT NULL,
  "result" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("request_id") REFERENCES "channel_ingress_accepted"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "control_account" (
  "email" text NOT NULL,
  "url" text NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "token_expiry" integer,
  "active" integer NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  PRIMARY KEY ("email", "url")
);

CREATE TABLE IF NOT EXISTS "database_authority" (
  "key" text PRIMARY KEY NOT NULL,
  "instance_id" text NOT NULL,
  "time_created" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "decision_log" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "goal_id" text,
  "phase" text NOT NULL,
  "key" text NOT NULL,
  "value" text NOT NULL,
  "reason" text NOT NULL,
  "time_created" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "decision_log_task_idx" ON "decision_log" ("task_id");
CREATE INDEX IF NOT EXISTS "decision_log_task_key_idx" ON "decision_log" ("task_id", "key");

CREATE TABLE IF NOT EXISTS "engine_artifact_catalog_revision" (
  "revision" integer PRIMARY KEY NOT NULL
);

CREATE TABLE IF NOT EXISTS "engine_artifact" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "kind" text NOT NULL,
  "label" text NOT NULL,
  "payload" text,
  "payload_sha256" text NOT NULL DEFAULT '74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b',
  "payload_bytes" integer NOT NULL DEFAULT 4,
  "payload_block_sha256s" text NOT NULL,
  "payload_block_index_sha256" text NOT NULL,
  "catalog_artifact_type" text,
  "catalog_schema_diagnostic" text,
  "catalog_producer" text,
  "catalog_import_source_task_id" text,
  "catalog_resource_count" integer NOT NULL DEFAULT 0,
  "catalog_resource_media_types" text NOT NULL DEFAULT '[]',
  "catalog_search_text" text NOT NULL DEFAULT '',
  "catalog_search_text_truncated" integer NOT NULL DEFAULT 0,
  "catalog_metadata_sha256" text NOT NULL,
  "catalog_revision" integer NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE,
  FOREIGN KEY ("catalog_revision") REFERENCES "engine_artifact_catalog_revision"("revision") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "engine_artifact_partition_authority_idx" ON "engine_artifact" ("id", "task_id", "kind");
CREATE UNIQUE INDEX IF NOT EXISTS "engine_artifact_catalog_revision_idx" ON "engine_artifact" ("catalog_revision");
CREATE INDEX IF NOT EXISTS "engine_artifact_task_kind_latest_idx" ON "engine_artifact" ("task_id", "kind", "time_created", "id");
CREATE INDEX IF NOT EXISTS "engine_artifact_invalid_task_process_binding_idx" ON "engine_artifact" ("id") WHERE 
  kind = 'task_execution_capsule_binding'
  AND CASE
    WHEN payload IS NULL OR json_valid(payload) = 0 OR json_type(payload) <> 'object' THEN 1
    WHEN (
  json_extract(payload, '$.protocol') = 'task-native-process-binding-v2'
  AND json_remove(
    payload,
    '$.protocol', '$.task_id', '$.project_id', '$.package_revision_sha256', '$.mode',
    '$.logical_workspace_root', '$.workspace_root', '$.initial_tree_sha256', '$.time_created'
  ) = '{}'
  AND json_type(payload, '$.task_id') = 'text' AND length(json_extract(payload, '$.task_id')) > 0
  AND json_type(payload, '$.project_id') = 'text' AND length(json_extract(payload, '$.project_id')) > 0
  AND json_type(payload, '$.package_revision_sha256') = 'text' AND length(json_extract(payload, '$.package_revision_sha256')) = 64 AND json_extract(payload, '$.package_revision_sha256') NOT GLOB '*[^a-f0-9]*'
  AND json_type(payload, '$.mode') = 'text'
  AND json_extract(payload, '$.mode') = 'native'
  AND json_type(payload, '$.logical_workspace_root') = 'text' AND length(json_extract(payload, '$.logical_workspace_root')) > 0
  AND json_type(payload, '$.workspace_root') = 'text' AND length(json_extract(payload, '$.workspace_root')) > 0
  AND json_type(payload, '$.initial_tree_sha256') = 'text' AND length(json_extract(payload, '$.initial_tree_sha256')) = 64 AND json_extract(payload, '$.initial_tree_sha256') NOT GLOB '*[^a-f0-9]*'
  AND json_type(payload, '$.time_created') = 'integer' AND json_extract(payload, '$.time_created') BETWEEN 0 AND 9007199254740991
) OR (
  json_extract(payload, '$.protocol') = 'task-execution-capsule-binding-v2'
  AND json_remove(
    payload,
    '$.protocol', '$.task_id', '$.project_id', '$.package_revision_sha256',
    '$.runtime_descriptor_sha256', '$.runtime_identity_sha256', '$.logical_workspace_root',
    '$.workspace', '$.network', '$.resources', '$.time_created'
  ) = '{}'
  AND json_type(payload, '$.task_id') = 'text' AND length(json_extract(payload, '$.task_id')) > 0
  AND json_type(payload, '$.project_id') = 'text' AND length(json_extract(payload, '$.project_id')) > 0
  AND json_type(payload, '$.package_revision_sha256') = 'text' AND length(json_extract(payload, '$.package_revision_sha256')) = 64 AND json_extract(payload, '$.package_revision_sha256') NOT GLOB '*[^a-f0-9]*'
  AND json_type(payload, '$.runtime_descriptor_sha256') = 'text' AND length(json_extract(payload, '$.runtime_descriptor_sha256')) = 64 AND json_extract(payload, '$.runtime_descriptor_sha256') NOT GLOB '*[^a-f0-9]*'
  AND json_type(payload, '$.runtime_identity_sha256') = 'text' AND length(json_extract(payload, '$.runtime_identity_sha256')) = 64 AND json_extract(payload, '$.runtime_identity_sha256') NOT GLOB '*[^a-f0-9]*'
  AND json_type(payload, '$.logical_workspace_root') = 'text' AND length(json_extract(payload, '$.logical_workspace_root')) > 0
  AND json_type(payload, '$.workspace') = 'object'
  AND json_remove(json_extract(payload, '$.workspace'), '$.root', '$.initial_tree_sha256', '$.access') = '{}'
  AND json_type(payload, '$.workspace.root') = 'text' AND length(json_extract(payload, '$.workspace.root')) > 0
  AND json_type(payload, '$.workspace.initial_tree_sha256') = 'text' AND length(json_extract(payload, '$.workspace.initial_tree_sha256')) = 64 AND json_extract(payload, '$.workspace.initial_tree_sha256') NOT GLOB '*[^a-f0-9]*'
  AND json_type(payload, '$.workspace.access') = 'text'
  AND json_extract(payload, '$.workspace.access') = 'read_write'
  AND json_type(payload, '$.network') = 'text'
  AND json_extract(payload, '$.network') = 'none'
  AND json_type(payload, '$.resources') = 'object'
  AND json_remove(
    json_extract(payload, '$.resources'),
    '$.memory_max_bytes', '$.tasks_max', '$.nofile_max', '$.tmpfs_max_bytes', '$.cpu_quota_percent'
  ) = '{}'
  AND json_type(payload, '$.resources.memory_max_bytes') = 'integer' AND json_extract(payload, '$.resources.memory_max_bytes') BETWEEN 1 AND 9007199254740991
  AND json_type(payload, '$.resources.tasks_max') = 'integer' AND json_extract(payload, '$.resources.tasks_max') BETWEEN 1 AND 9007199254740991
  AND json_type(payload, '$.resources.nofile_max') = 'integer' AND json_extract(payload, '$.resources.nofile_max') BETWEEN 1 AND 9007199254740991
  AND json_type(payload, '$.resources.tmpfs_max_bytes') = 'integer' AND json_extract(payload, '$.resources.tmpfs_max_bytes') BETWEEN 1 AND 9007199254740991
  AND json_type(payload, '$.resources.cpu_quota_percent') IN ('integer', 'real')
  AND json_extract(payload, '$.resources.cpu_quota_percent') > 0
  AND json_extract(payload, '$.resources.cpu_quota_percent') <= 100
  AND json_type(payload, '$.time_created') = 'integer' AND json_extract(payload, '$.time_created') BETWEEN 0 AND 9007199254740991
) THEN 0
    ELSE 1
  END = 1
;
CREATE UNIQUE INDEX IF NOT EXISTS "engine_dispatch_lineage_direct_tool_occurrence_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.tool_part_id'), json_extract("payload", '$.tool_call_id')) WHERE "kind" = 'dispatch_lineage' AND json_extract("payload", '$.tool_name') = 'dispatch_agent';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_dispatch_lineage_collection_member_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.tool_part_id'), json_extract("payload", '$.tool_call_id'), json_extract("payload", '$.collection_member_index')) WHERE "kind" = 'dispatch_lineage' AND json_extract("payload", '$.tool_name') = 'dispatch_agents';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_dispatch_lineage_dispatch_id_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.dispatch_id')) WHERE "kind" = 'dispatch_lineage';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_dispatch_settlement_dispatch_id_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.dispatch_id')) WHERE "kind" = 'dispatch_settlement';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_dispatch_delivery_disposition_dispatch_id_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.dispatch_id')) WHERE "kind" = 'dispatch_delivery_disposition';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_task_root_ingress_disposition_ingress_idx" ON "engine_artifact" ("task_id", "kind", json_extract("payload", '$.ingress_id')) WHERE "kind" = 'task_root_ingress_disposition';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_dispatch_lineage_coordination_action_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.coordination_action_id')) WHERE "kind" = 'dispatch_lineage' AND json_type("payload", '$.coordination_action_id') = 'text';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_artifact_task_completion_decision_time_idx" ON "engine_artifact" ("task_id", "time_created") WHERE "kind" = 'task_completion_decision';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_agent_coordination_worker_occurrence_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.session_id'), json_extract("payload", '$.message_id'), json_extract("payload", '$.tool_call_id')) WHERE "kind" = 'agent_coordination_request' AND json_extract("payload", '$.origin') = 'worker_handoff';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_agent_coordination_worker_lineage_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.dispatch_lineage_id')) WHERE "kind" = 'agent_coordination_request' AND json_extract("payload", '$.origin') = 'worker_handoff';
CREATE INDEX IF NOT EXISTS "engine_agent_coordination_request_session_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.execution_epoch'), json_extract("payload", '$.session_id'), "time_created", "id") WHERE "kind" = 'agent_coordination_request';
CREATE INDEX IF NOT EXISTS "engine_agent_coordination_request_epoch_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.execution_epoch'), "time_created", "id") WHERE "kind" = 'agent_coordination_request';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_agent_coordination_frontier_winner_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.request_id'), json_extract("payload", '$.frontier_id')) WHERE "kind" = 'agent_coordination_response';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_agent_coordination_response_tool_occurrence_idx" ON "engine_artifact" (json_extract("payload", '$.orchestrator_tool_part_id')) WHERE "kind" = 'agent_coordination_response';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_agent_coordination_action_response_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.response_id')) WHERE "kind" = 'agent_coordination_action';
CREATE INDEX IF NOT EXISTS "engine_agent_coordination_action_request_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.request_id'), "time_created", "id") WHERE "kind" = 'agent_coordination_action';
CREATE INDEX IF NOT EXISTS "engine_agent_coordination_outcome_action_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.action_id'), "time_created", "id") WHERE "kind" = 'agent_coordination_action_outcome';
CREATE INDEX IF NOT EXISTS "engine_agent_coordination_outcome_request_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.request_id'), json_extract("payload", '$.status'), "time_created", "id") WHERE "kind" = 'agent_coordination_action_outcome';
CREATE UNIQUE INDEX IF NOT EXISTS "engine_agent_coordination_action_terminal_idx" ON "engine_artifact" ("task_id", json_extract("payload", '$.action_id')) WHERE "kind" = 'agent_coordination_action_outcome' AND json_extract("payload", '$.status') IN ('completed','failed');

CREATE TABLE IF NOT EXISTS "engine_artifact_version" (
  "artifact_id" text NOT NULL,
  "task_id" text NOT NULL,
  "kind" text NOT NULL,
  "label" text NOT NULL,
  "payload" text NOT NULL,
  "payload_sha256" text NOT NULL,
  "payload_bytes" integer NOT NULL,
  "payload_block_sha256s" text NOT NULL,
  "payload_block_index_sha256" text NOT NULL,
  "catalog_artifact_type" text,
  "catalog_schema_diagnostic" text,
  "catalog_producer" text,
  "catalog_import_source_task_id" text,
  "catalog_resource_count" integer NOT NULL,
  "catalog_resource_media_types" text NOT NULL,
  "catalog_search_text" text NOT NULL,
  "catalog_search_text_truncated" integer NOT NULL,
  "catalog_metadata_sha256" text NOT NULL,
  "catalog_revision" integer NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  PRIMARY KEY ("artifact_id", "catalog_revision"),
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE,
  FOREIGN KEY ("catalog_revision") REFERENCES "engine_artifact_catalog_revision"("revision") ON DELETE RESTRICT,
  FOREIGN KEY ("artifact_id", "task_id", "kind") REFERENCES "engine_artifact"("id", "task_id", "kind") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "engine_artifact_version_catalog_revision_idx" ON "engine_artifact_version" ("catalog_revision");
CREATE INDEX IF NOT EXISTS "engine_artifact_version_task_revision_idx" ON "engine_artifact_version" ("task_id", "catalog_revision", "artifact_id");
CREATE INDEX IF NOT EXISTS "engine_artifact_version_artifact_sha_idx" ON "engine_artifact_version" ("artifact_id", "payload_sha256", "catalog_revision" DESC);

CREATE TABLE IF NOT EXISTS "engine_browser_preview_target_identity" (
  "task_id" text NOT NULL,
  "canonical_url" text NOT NULL,
  "artifact_id" text NOT NULL,
  PRIMARY KEY ("task_id", "canonical_url"),
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE,
  FOREIGN KEY ("artifact_id") REFERENCES "engine_artifact"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "engine_browser_preview_target_identity_artifact_idx" ON "engine_browser_preview_target_identity" ("artifact_id");

CREATE TABLE IF NOT EXISTS "engine_build_observation_cleanup_receipt" (
  "id" text PRIMARY KEY NOT NULL,
  "observation_id" text NOT NULL,
  "outcome" text NOT NULL,
  "error" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("observation_id") REFERENCES "engine_build_observation_cleanup"("observation_id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "engine_build_observation_cleanup_receipt_idx" ON "engine_build_observation_cleanup_receipt" ("observation_id", "time_created");

CREATE TABLE IF NOT EXISTS "engine_build_observation_cleanup" (
  "observation_id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "git_dir" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "engine_build_observation_cleanup_task_idx" ON "engine_build_observation_cleanup" ("task_id");

CREATE TABLE IF NOT EXISTS "engine_channel_binding" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "platform" text NOT NULL,
  "channel" text NOT NULL,
  "thread" text NOT NULL,
  "payload" text,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "engine_channel_task_idx" ON "engine_channel_binding" ("task_id");
CREATE UNIQUE INDEX IF NOT EXISTS "engine_channel_binding_thread_idx" ON "engine_channel_binding" ("platform", "channel", "thread");

CREATE TABLE IF NOT EXISTS "engine_control_activation_lease_grant" (
  "lease_id" text NOT NULL,
  "ordinal" integer NOT NULL,
  "expires_at" integer NOT NULL,
  "time_created" integer NOT NULL,
  PRIMARY KEY ("lease_id", "ordinal"),
  FOREIGN KEY ("lease_id") REFERENCES "engine_control_activation_lease"("id") ON DELETE RESTRICT,
  CONSTRAINT "engine_control_activation_lease_grant_positive_ordinal" CHECK ("ordinal">0),
  CONSTRAINT "engine_control_activation_lease_grant_future_expiry" CHECK ("expires_at">"time_created")
);
CREATE INDEX IF NOT EXISTS "engine_control_activation_lease_grant_time_idx" ON "engine_control_activation_lease_grant" ("lease_id", "time_created", "ordinal");

CREATE TABLE IF NOT EXISTS "engine_control_activation_lease" (
  "id" text PRIMARY KEY NOT NULL,
  "target" text NOT NULL,
  "target_id" text NOT NULL,
  "owner_occurrence_id" text NOT NULL,
  "time_activated" integer NOT NULL,
  "expires_at" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "engine_control_activation_owner_idx" ON "engine_control_activation_lease" ("target", "target_id", "owner_occurrence_id");
CREATE INDEX IF NOT EXISTS "engine_control_activation_target_idx" ON "engine_control_activation_lease" ("target", "target_id", "time_activated", "id");
CREATE INDEX IF NOT EXISTS "engine_control_activation_expiry_idx" ON "engine_control_activation_lease" ("expires_at");

CREATE TABLE IF NOT EXISTS "engine_git_checkpoint_outcome" (
  "request_id" text PRIMARY KEY NOT NULL,
  "result" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("request_id") REFERENCES "engine_git_checkpoint_request"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "engine_git_checkpoint_request" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "stage" text NOT NULL,
  "operation_key" text NOT NULL,
  "input" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "engine_git_checkpoint_request_operation_idx" ON "engine_git_checkpoint_request" ("task_id", "operation_key");
CREATE INDEX IF NOT EXISTS "engine_git_checkpoint_request_task_time_idx" ON "engine_git_checkpoint_request" ("task_id", "time_created");

CREATE TABLE IF NOT EXISTS "engine_goal" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "requirement_set_artifact_id" text,
  "requirement_set_artifact_revision" integer,
  "requirement_set_artifact_sha256" text,
  "contract_graph_artifact_id" text,
  "contract_graph_artifact_revision" integer,
  "contract_graph_artifact_sha256" text,
  "supersede_of" text,
  "title" text NOT NULL,
  "slug" text NOT NULL,
  "objective" text NOT NULL,
  "acceptance_specs" text NOT NULL DEFAULT '[]',
  "owned_paths" text NOT NULL DEFAULT '[]',
  "kind" text NOT NULL DEFAULT 'feature',
  "priority" text NOT NULL DEFAULT 'blocking',
  "source" text NOT NULL DEFAULT 'orchestrator',
  "order_index" integer NOT NULL DEFAULT 0,
  "metadata" text,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE,
  FOREIGN KEY ("supersede_of") REFERENCES "engine_goal"("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "engine_goal_task_idx" ON "engine_goal" ("task_id");
CREATE INDEX IF NOT EXISTS "engine_goal_requirement_set_idx" ON "engine_goal" ("requirement_set_artifact_id");
CREATE INDEX IF NOT EXISTS "engine_goal_contract_graph_idx" ON "engine_goal" ("contract_graph_artifact_id");
CREATE INDEX IF NOT EXISTS "engine_goal_supersede_idx" ON "engine_goal" ("supersede_of");

CREATE TABLE IF NOT EXISTS "engine_interaction_outcome" (
  "id" text PRIMARY KEY NOT NULL,
  "interaction_id" text NOT NULL,
  "source_occurrence_id" text,
  "outcome" text,
  "response" text,
  "time_created" integer,
  FOREIGN KEY ("interaction_id") REFERENCES "engine_interaction_request"("id") ON DELETE CASCADE,
  CONSTRAINT "engine_interaction_outcome_owner_shape" CHECK (
      ("source_occurrence_id" IS NOT NULL AND "outcome" IS NULL AND "response" IS NULL AND "time_created" IS NULL)
      OR
      ("source_occurrence_id" IS NULL AND "outcome" IS NOT NULL AND "response" IS NOT NULL AND "time_created" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "engine_interaction_outcome_request_idx" ON "engine_interaction_outcome" ("interaction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "engine_interaction_outcome_source_idx" ON "engine_interaction_outcome" ("source_occurrence_id") WHERE "source_occurrence_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "engine_interaction_request" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text,
  "source_kind" text,
  "source_id" text,
  "session_id" text,
  "external_id" text,
  "request_type" text,
  "title" text,
  "body" text,
  "payload" text,
  "time_created" integer,
  CONSTRAINT "engine_interaction_request_owner_shape" CHECK (
      ("source_kind" IS NOT NULL AND "source_id" IS NOT NULL AND "task_id" IS NULL AND "session_id" IS NULL AND "external_id" IS NULL
        AND "request_type" IS NULL AND "title" IS NULL AND "body" IS NULL
        AND "payload" IS NULL AND "time_created" IS NULL)
      OR
      ("source_kind" IS NULL AND "source_id" IS NULL AND "task_id" IS NOT NULL AND "session_id" IS NOT NULL AND "external_id" IS NOT NULL
        AND "request_type" IS NOT NULL AND "title" IS NOT NULL AND "body" IS NOT NULL
        AND "payload" IS NOT NULL AND "time_created" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "engine_interaction_external_idx" ON "engine_interaction_request" ("external_id") WHERE "external_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "engine_interaction_source_idx" ON "engine_interaction_request" ("source_kind", "source_id") WHERE "source_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "engine_metric_result" (
  "id" text PRIMARY KEY NOT NULL,
  "metric_spec_id" text NOT NULL,
  "task_id" text NOT NULL,
  "iteration" integer NOT NULL,
  "delivery_slice_revision_id" text,
  "raw_value" real,
  "normalized_value" real,
  "met_target" integer,
  "met_floor" integer,
  "evidence_ref" text NOT NULL,
  "evidence_fresh" integer NOT NULL,
  "computed_at" integer NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("metric_spec_id") REFERENCES "engine_metric_spec"("id") ON DELETE CASCADE,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "engine_metric_result_task_iter_idx" ON "engine_metric_result" ("task_id", "iteration");
CREATE INDEX IF NOT EXISTS "engine_metric_result_spec_idx" ON "engine_metric_result" ("metric_spec_id");

CREATE TABLE IF NOT EXISTS "engine_metric_spec" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "scope" text NOT NULL,
  "goal_id" text,
  "name" text NOT NULL,
  "description" text NOT NULL,
  "unit" text NOT NULL,
  "direction" text NOT NULL,
  "target" real NOT NULL,
  "floor" real NOT NULL,
  "weight" real NOT NULL,
  "observation_class" text NOT NULL,
  "evaluator_kind" text NOT NULL,
  "evaluator_config" text NOT NULL,
  "source" text NOT NULL,
  "frozen_at" integer NOT NULL,
  "created_by" text NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE,
  FOREIGN KEY ("goal_id") REFERENCES "engine_goal"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "engine_metric_spec_task_idx" ON "engine_metric_spec" ("task_id");
CREATE INDEX IF NOT EXISTS "engine_metric_spec_scope_idx" ON "engine_metric_spec" ("task_id", "scope");
CREATE INDEX IF NOT EXISTS "engine_metric_spec_source_idx" ON "engine_metric_spec" ("task_id", "source");
CREATE INDEX IF NOT EXISTS "engine_metric_spec_goal_idx" ON "engine_metric_spec" ("goal_id");

CREATE TABLE IF NOT EXISTS "engine_progress_snapshot" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "summary" text NOT NULL,
  "payload" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE,
  CONSTRAINT "engine_progress_excludes_git_projection" CHECK (
      json_extract("payload", '$.kind') IS NULL OR json_extract("payload", '$.kind') <> 'git'
    )
);
CREATE INDEX IF NOT EXISTS "engine_progress_task_idx" ON "engine_progress_snapshot" ("task_id");

CREATE TABLE IF NOT EXISTS "engine_task_creation_contract" (
  "task_id" text PRIMARY KEY NOT NULL,
  "fingerprint" text NOT NULL,
  "contract" text NOT NULL,
  "creator_tool_part_id" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE,
  FOREIGN KEY ("creator_tool_part_id") REFERENCES "tool_part_request"("id") ON DELETE RESTRICT,
  CONSTRAINT "engine_task_creation_contract_fingerprint_shape" CHECK (length("fingerprint") = 64
          AND json_type("contract") = 'object'
          AND json_extract("contract", '$.protocol') = 'task-creation-contract-v2'
          AND json_type("contract", '$.request') = 'object'
          AND json_type("contract", '$.resolved') = 'object'
          AND "creator_tool_part_id" IS json_extract("contract", '$.request.input.creator.tool_part_id')
          AND "creator_tool_part_id" IS json_extract("contract", '$.resolved.creator.tool_part_id'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "engine_task_creation_contract_tool_part_idx" ON "engine_task_creation_contract" ("creator_tool_part_id");

CREATE TABLE IF NOT EXISTS "engine_task_root_ingress_policy" (
  "id" text PRIMARY KEY NOT NULL,
  "semantic_turn_limit" integer NOT NULL,
  "activation_limit" integer NOT NULL,
  "absolute_deadline" integer,
  "time_created" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "engine_task_root_ingress" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "project_id" text NOT NULL,
  "execution_epoch" integer NOT NULL,
  "sequence" integer NOT NULL,
  "source" text NOT NULL,
  "source_id" text NOT NULL,
  "inline_payload" text,
  "policy_id" text NOT NULL,
  "time_accepted" integer NOT NULL,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  FOREIGN KEY ("policy_id") REFERENCES "engine_task_root_ingress_policy"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "engine_task_root_ingress_sequence_idx" ON "engine_task_root_ingress" ("task_id", "execution_epoch", "sequence");
CREATE UNIQUE INDEX IF NOT EXISTS "engine_task_root_ingress_source_idx" ON "engine_task_root_ingress" ("task_id", "source", "source_id");
CREATE INDEX IF NOT EXISTS "engine_task_root_ingress_epoch_idx" ON "engine_task_root_ingress" ("task_id", "execution_epoch", "sequence");
CREATE INDEX IF NOT EXISTS "engine_task_root_ingress_frontier_idx" ON "engine_task_root_ingress" ("project_id");

CREATE TABLE IF NOT EXISTS "engine_task" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "session_id" text,
  "request_id" text,
  "global_creation_allocation_id" text,
  "source" text NOT NULL DEFAULT 'api',
  "product_pillar" text NOT NULL,
  "title" text NOT NULL,
  "request" text NOT NULL,
  "attachments" text,
  "system_artifacts" text NOT NULL DEFAULT '[]',
  "priority" text NOT NULL DEFAULT 'normal',
  "budget" text,
  "metadata" text,
  "time_archived" integer,
  "time_pinned" integer,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE SET NULL,
  CONSTRAINT "engine_task_excludes_git_projection" CHECK (json_type("metadata", '$.git') IS NULL)
);
CREATE INDEX IF NOT EXISTS "engine_task_project_idx" ON "engine_task" ("project_id");
CREATE INDEX IF NOT EXISTS "engine_task_time_created_idx" ON "engine_task" ("time_created", "id");
CREATE INDEX IF NOT EXISTS "engine_task_project_time_created_idx" ON "engine_task" ("project_id", "time_created", "id");
CREATE INDEX IF NOT EXISTS "engine_task_time_archived_idx" ON "engine_task" ("time_archived");
CREATE INDEX IF NOT EXISTS "engine_task_time_pinned_idx" ON "engine_task" ("time_pinned");
CREATE UNIQUE INDEX IF NOT EXISTS "engine_task_project_request_idx" ON "engine_task" ("project_id", "request_id");
CREATE UNIQUE INDEX IF NOT EXISTS "engine_task_global_creation_allocation_idx" ON "engine_task" ("global_creation_allocation_id");

CREATE TABLE IF NOT EXISTS "engine_task_wait_registration" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "project_id" text NOT NULL,
  "execution_epoch" integer NOT NULL,
  "due_at" integer NOT NULL,
  "reason" text NOT NULL,
  "tool_part_id" text NOT NULL,
  "creator_ingress_id" text NOT NULL,
  "creator_activation_id" text NOT NULL,
  "input_digest" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  FOREIGN KEY ("creator_ingress_id") REFERENCES "engine_task_root_ingress"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "engine_task_wait_tool_occurrence_idx" ON "engine_task_wait_registration" ("tool_part_id");
CREATE INDEX IF NOT EXISTS "engine_task_wait_task_epoch_due_idx" ON "engine_task_wait_registration" ("task_id", "execution_epoch", "due_at");
CREATE INDEX IF NOT EXISTS "engine_task_wait_due_frontier_idx" ON "engine_task_wait_registration" ("project_id");

CREATE TABLE IF NOT EXISTS "engine_task_wait_settlement" (
  "wait_id" text PRIMARY KEY NOT NULL,
  "ingress_id" text NOT NULL,
  "disposition" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("wait_id") REFERENCES "engine_task_wait_registration"("id") ON DELETE CASCADE,
  FOREIGN KEY ("ingress_id") REFERENCES "engine_task_root_ingress"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "engine_task_wait_settlement_ingress_idx" ON "engine_task_wait_settlement" ("ingress_id");

CREATE TABLE IF NOT EXISTS "event_job_definition_tombstone" (
  "id" text PRIMARY KEY NOT NULL,
  "definition_id" text NOT NULL,
  "revision" integer NOT NULL,
  "tool_part_id" text,
  "tool_input_digest" text,
  "time_created" integer NOT NULL,
  CONSTRAINT "event_job_tombstone_tool_causation_shape" CHECK (
      ("tool_part_id" IS NULL AND "tool_input_digest" IS NULL)
      OR ("tool_part_id" IS NOT NULL AND "tool_input_digest" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_job_definition_tombstone_revision_idx" ON "event_job_definition_tombstone" ("definition_id", "revision");
CREATE INDEX IF NOT EXISTS "event_job_definition_tombstone_latest_idx" ON "event_job_definition_tombstone" ("definition_id", "revision");
CREATE UNIQUE INDEX IF NOT EXISTS "event_job_definition_tombstone_tool_occurrence_idx" ON "event_job_definition_tombstone" ("tool_part_id") WHERE "tool_part_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "event_job_fire_receipt" (
  "id" text PRIMARY KEY NOT NULL,
  "fire_id" text NOT NULL,
  "definition_id" text NOT NULL,
  "queue_position" integer NOT NULL,
  "outcome" text NOT NULL,
  "disposition" text,
  "closure_event_id" text,
  "message_id" text,
  "retry_at" integer,
  "error" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("fire_id") REFERENCES "event_job_fire"("id") ON DELETE CASCADE,
  FOREIGN KEY ("closure_event_id") REFERENCES "protocol_event"("id") ON DELETE RESTRICT,
  CONSTRAINT "event_job_fire_receipt_shape" CHECK (
      ("outcome"='retry_wait' AND "disposition" IS NULL AND "closure_event_id" IS NULL AND "message_id" IS NULL AND "retry_at" IS NOT NULL AND "error" IS NOT NULL)
      OR ("outcome"='succeeded' AND "disposition" IS NULL AND "closure_event_id" IS NULL AND "message_id" IS NOT NULL AND "retry_at" IS NULL AND "error" IS NULL)
      OR ("outcome"='disposition' AND "disposition" IN ('causal_cycle','cooldown','job_disabled','target_deleted','owner_unresolved') AND "closure_event_id" IS NULL AND "message_id" IS NULL AND "retry_at" IS NULL)
      OR ("outcome"='disposition' AND "disposition"='mission_closed' AND "closure_event_id" IS NOT NULL AND "message_id" IS NULL AND "retry_at" IS NULL AND "error" IS NULL)
    ),
  CONSTRAINT "event_job_fire_receipt_queue_position_positive" CHECK ("queue_position">0)
);
CREATE INDEX IF NOT EXISTS "event_job_fire_receipt_fire_idx" ON "event_job_fire_receipt" ("fire_id", "outcome", "time_created", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "event_job_fire_terminal_receipt_idx" ON "event_job_fire_receipt" ("fire_id") WHERE "outcome" <> 'retry_wait';
CREATE UNIQUE INDEX IF NOT EXISTS "event_job_fire_terminal_frontier_idx" ON "event_job_fire_receipt" ("definition_id", "queue_position") WHERE "outcome" <> 'retry_wait';
CREATE INDEX IF NOT EXISTS "event_job_fire_success_frontier_idx" ON "event_job_fire_receipt" ("definition_id", "queue_position") WHERE "outcome" = 'succeeded';

CREATE TABLE IF NOT EXISTS "event_job_fire" (
  "id" text PRIMARY KEY NOT NULL,
  "definition_id" text NOT NULL,
  "queue_position" integer NOT NULL,
  "event_job_revision_id" text NOT NULL,
  "event_occurrence_id" text NOT NULL,
  "project_generation" text,
  "causation_fire_id" text,
  "causal_cycle" integer NOT NULL DEFAULT 0,
  "created_session_id" text,
  "mission_opened_event_id" text,
  "mission_disposition" text,
  "mission_closure_event_id" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("event_job_revision_id") REFERENCES "event_job"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("event_occurrence_id") REFERENCES "event_occurrence"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("mission_opened_event_id") REFERENCES "protocol_event"("id") ON DELETE RESTRICT,
  FOREIGN KEY ("mission_closure_event_id") REFERENCES "protocol_event"("id") ON DELETE RESTRICT,
  CONSTRAINT "event_job_fire_mission_reservation_shape" CHECK (
      ("mission_opened_event_id" IS NULL AND "mission_disposition" IS NULL AND "mission_closure_event_id" IS NULL)
      OR ("mission_opened_event_id" IS NOT NULL AND "mission_disposition" IS NULL AND "mission_closure_event_id" IS NULL)
      OR ("mission_opened_event_id" IS NULL AND "mission_disposition"='mission_closed' AND "mission_closure_event_id" IS NOT NULL)
    ),
  CONSTRAINT "event_job_fire_queue_position_positive" CHECK ("queue_position">0),
  CONSTRAINT "event_job_fire_causal_cycle_shape" CHECK ("causal_cycle"=0 OR "causation_fire_id" IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_job_fire_occurrence_idx" ON "event_job_fire" ("event_job_revision_id", "event_occurrence_id");
CREATE UNIQUE INDEX IF NOT EXISTS "event_job_fire_definition_frontier_idx" ON "event_job_fire" ("definition_id", "queue_position");
CREATE INDEX IF NOT EXISTS "event_job_fire_revision_idx" ON "event_job_fire" ("event_job_revision_id");
CREATE INDEX IF NOT EXISTS "event_job_fire_causation_idx" ON "event_job_fire" ("causation_fire_id");
CREATE UNIQUE INDEX IF NOT EXISTS "event_job_fire_target_session_idx" ON "event_job_fire" ("created_session_id") WHERE "created_session_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "event_job" (
  "id" text PRIMARY KEY NOT NULL,
  "definition_id" text NOT NULL,
  "revision" integer NOT NULL,
  "project_id" text NOT NULL,
  "session_id" text,
  "name" text NOT NULL,
  "event_type" text NOT NULL,
  "match_json" text,
  "prompt" text NOT NULL,
  "agent" text NOT NULL DEFAULT 'default',
  "enabled" integer NOT NULL DEFAULT 1,
  "one_shot" integer NOT NULL DEFAULT 0,
  "cooldown_ms" integer NOT NULL DEFAULT 0,
  "tool_part_id" text,
  "tool_input_digest" text,
  "time_created" integer NOT NULL,
  CONSTRAINT "event_job_tool_causation_shape" CHECK (
      ("tool_part_id" IS NULL AND "tool_input_digest" IS NULL)
      OR ("tool_part_id" IS NOT NULL AND "tool_input_digest" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "event_job_definition_revision_idx" ON "event_job" ("definition_id", "revision");
CREATE INDEX IF NOT EXISTS "event_job_project_definition_latest_idx" ON "event_job" ("project_id", "definition_id", "revision", "id");
CREATE INDEX IF NOT EXISTS "event_job_type_idx" ON "event_job" ("event_type");
CREATE INDEX IF NOT EXISTS "event_job_enabled_idx" ON "event_job" ("enabled");
CREATE UNIQUE INDEX IF NOT EXISTS "event_job_tool_occurrence_idx" ON "event_job" ("tool_part_id") WHERE "tool_part_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "event_occurrence" (
  "id" text PRIMARY KEY NOT NULL,
  "bus_outbox_id" text,
  "project_id" text,
  "event_type" text,
  "properties" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("bus_outbox_id") REFERENCES "bus_publication_outbox"("occurrence_id") ON DELETE RESTRICT,
  CONSTRAINT "event_occurrence_owner_shape" CHECK (
      ("bus_outbox_id" IS NOT NULL AND "project_id" IS NULL AND "event_type" IS NULL AND "properties" IS NULL)
      OR ("bus_outbox_id" IS NULL AND "project_id" IS NOT NULL AND "event_type" IS NOT NULL AND "properties" IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS "expert_squad_mutation_receipt" (
  "artifact_id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "envelope" text NOT NULL,
  "time_created" integer NOT NULL,
  CONSTRAINT "expert_squad_mutation_receipt_identity" CHECK (coalesce((
      json_type("envelope") = 'object'
      AND json_extract("envelope", '$.artifact_type') = 'evolution-lab/promotion-receipt'
      AND json_extract("envelope", '$.schema_version') = 1
      AND json_extract("envelope", '$.producer.owner_kind') = 'core'
      AND json_extract("envelope", '$.producer.component_id') = 'expert-squad-package-manager'
      AND json_type("envelope", '$.import_lineage') IS NULL
      AND json_extract("envelope", '$.payload.authorization.task_id') = "task_id"
      AND json_extract("envelope", '$.producer.operation_id') = json_extract("envelope", '$.payload.authorization.message_id')
    ), 0))
);
CREATE INDEX IF NOT EXISTS "expert_squad_mutation_receipt_task_idx" ON "expert_squad_mutation_receipt" ("task_id", "artifact_id");

CREATE TABLE IF NOT EXISTS "global_creation_allocation" (
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
          )
          AND json_type("resolution_seed") = 'object'
          AND (
            ("kind" = 'global_task' AND json_type("task_resolution") = 'object')
            OR ("kind" IN ('global_chat_start','automation_run') AND "task_resolution" IS NULL)
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
CREATE UNIQUE INDEX IF NOT EXISTS "global_creation_allocation_request_idx" ON "global_creation_allocation" ("kind", "request_id");
CREATE UNIQUE INDEX IF NOT EXISTS "global_creation_allocation_directory_idx" ON "global_creation_allocation" ("directory");

CREATE TABLE IF NOT EXISTS "interactive_artifact" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL,
  "payload" text NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("message_id") REFERENCES "message"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "interactive_artifact_message_idx" ON "interactive_artifact" ("message_id");

CREATE TABLE IF NOT EXISTS "memory_chunk" (
  "id" text PRIMARY KEY NOT NULL,
  "file_id" text NOT NULL,
  "project_id" text NOT NULL,
  "content" text NOT NULL,
  "token_count" integer NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("file_id") REFERENCES "memory_file"("id") ON DELETE CASCADE,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "memory_chunk_file_idx" ON "memory_chunk" ("file_id");
CREATE INDEX IF NOT EXISTS "memory_chunk_project_idx" ON "memory_chunk" ("project_id");

CREATE TABLE IF NOT EXISTS "memory_embedding" (
  "chunk_id" text PRIMARY KEY NOT NULL,
  "embedding" blob NOT NULL,
  "model" text NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("chunk_id") REFERENCES "memory_chunk"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "memory_file" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "title" text NOT NULL,
  "source" text NOT NULL,
  "kind" text NOT NULL DEFAULT 'note',
  "key" text,
  "importance" integer NOT NULL DEFAULT 60,
  "confidence" integer NOT NULL DEFAULT 75,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "memory_file_project_idx" ON "memory_file" ("project_id");
CREATE INDEX IF NOT EXISTS "memory_file_kind_idx" ON "memory_file" ("kind");
CREATE INDEX IF NOT EXISTS "memory_file_key_idx" ON "memory_file" ("key");

CREATE TABLE IF NOT EXISTS "message" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  "data" text NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "message_session_idx" ON "message" ("session_id");
CREATE INDEX IF NOT EXISTS "message_session_time_idx" ON "message" ("session_id", "time_created");
CREATE INDEX IF NOT EXISTS "message_session_unfinished_assistant_idx" ON "message" ("session_id", "time_created", "id") WHERE json_extract("data", '$.role') = 'assistant' AND json_extract("data", '$.time.completed') IS NULL;

CREATE TABLE IF NOT EXISTS "part" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  "data" text NOT NULL,
  FOREIGN KEY ("message_id") REFERENCES "message"("id") ON DELETE CASCADE,
  CONSTRAINT "part_excludes_tool_effect_state" CHECK (json_extract("data", '$.type') NOT IN ('tool', 'tool-request', 'tool-outcome'))
);
CREATE INDEX IF NOT EXISTS "part_message_idx" ON "part" ("message_id");
CREATE INDEX IF NOT EXISTS "part_message_time_idx" ON "part" ("message_id", "time_created");
CREATE INDEX IF NOT EXISTS "part_type_time_idx" ON "part" (json_extract("data", '$.type'), "time_created", "id");

CREATE TABLE IF NOT EXISTS "permission_execution_result" (
  "attempt_id" text PRIMARY KEY NOT NULL,
  "result" text NOT NULL,
  "time_created" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "permission_execution_result_artifact_read_reference_idx" ON "permission_execution_result" (
        CASE
          WHEN json_extract("result", '$.kind') = 'json'
            AND json_valid(json_extract("result", '$.value.output'))
          THEN json_extract(json_extract("result", '$.value.output'), '$.artifact_read_ref')
        END
      );

CREATE TABLE IF NOT EXISTS "permission_ledger" (
  "id" text PRIMARY KEY NOT NULL,
  "request_id" text NOT NULL,
  "project_id" text,
  "session_id" text,
  "task_id" text,
  "message_id" text,
  "tool_call_id" text,
  "attempt_id" text,
  "event_type" text NOT NULL,
  "mode" text,
  "policy_revision" text,
  "provider_kind" text,
  "provider_id" text,
  "provider_digest" text,
  "tool_name" text,
  "effect_class" text,
  "scope_version" text,
  "scope" text,
  "fingerprint" text,
  "summary" text,
  "decision_scope" text,
  "source_event_id" text,
  "decision_slot" text,
  "outcome_slot" text,
  "actor_id" text,
  "reason" text,
  "metadata" text,
  "time_created" integer NOT NULL,
  CONSTRAINT "permission_ledger_request_owner_shape" CHECK (
      ("event_type"='requested'
        AND "project_id" IS NOT NULL AND "session_id" IS NOT NULL
        AND "message_id" IS NOT NULL AND "tool_call_id" IS NOT NULL
        AND "mode" IS NOT NULL AND "policy_revision" IS NOT NULL
        AND "provider_kind" IS NOT NULL AND "provider_id" IS NOT NULL
        AND "provider_digest" IS NOT NULL AND "tool_name" IS NOT NULL
        AND "effect_class" IS NOT NULL AND "scope_version" IS NOT NULL
        AND "scope" IS NOT NULL AND "fingerprint" IS NOT NULL AND "summary" IS NOT NULL)
      OR
      ("event_type"<>'requested'
        AND "project_id" IS NULL AND "session_id" IS NULL AND "task_id" IS NULL
        AND "message_id" IS NULL AND "tool_call_id" IS NULL
        AND "mode" IS NULL AND "policy_revision" IS NULL
        AND "provider_kind" IS NULL AND "provider_id" IS NULL
        AND "provider_digest" IS NULL AND "tool_name" IS NULL
        AND "effect_class" IS NULL AND "scope_version" IS NULL
        AND "scope" IS NULL AND "fingerprint" IS NULL AND "summary" IS NULL)
    )
);
CREATE INDEX IF NOT EXISTS "permission_ledger_project_time_idx" ON "permission_ledger" ("project_id", "time_created");
CREATE INDEX IF NOT EXISTS "permission_ledger_request_idx" ON "permission_ledger" ("request_id", "time_created");
CREATE INDEX IF NOT EXISTS "permission_ledger_fingerprint_idx" ON "permission_ledger" ("project_id", "fingerprint", "time_created");
CREATE INDEX IF NOT EXISTS "permission_ledger_session_idx" ON "permission_ledger" ("session_id", "time_created");
CREATE UNIQUE INDEX IF NOT EXISTS "permission_ledger_decision_slot_idx" ON "permission_ledger" ("decision_slot");
CREATE UNIQUE INDEX IF NOT EXISTS "permission_ledger_attempt_start_idx" ON "permission_ledger" ("attempt_id") WHERE "event_type" = 'execution_started';
CREATE UNIQUE INDEX IF NOT EXISTS "permission_ledger_outcome_slot_idx" ON "permission_ledger" ("outcome_slot");

CREATE TABLE IF NOT EXISTS "permission_policy" (
  "session_id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "mode" text NOT NULL,
  "revision" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "permission_policy_project_idx" ON "permission_policy" ("project_id", "time_created");

CREATE TABLE IF NOT EXISTS "project_directory_admission" (
  "directory_key" text PRIMARY KEY NOT NULL,
  "directory" text NOT NULL,
  "generation" text NOT NULL,
  "operation_id" text NOT NULL,
  "kind" text NOT NULL,
  "owner_occurrence_id" text NOT NULL,
  "owner_pid" integer NOT NULL,
  "owner_process_instance_id" text NOT NULL,
  "time_created" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "project_directory_admission_generation_idx" ON "project_directory_admission" ("generation");
CREATE INDEX IF NOT EXISTS "project_directory_admission_operation_idx" ON "project_directory_admission" ("operation_id");
CREATE INDEX IF NOT EXISTS "project_directory_admission_owner_idx" ON "project_directory_admission" ("owner_occurrence_id");

CREATE TABLE IF NOT EXISTS "project_maintenance_fence" (
  "project_id" text PRIMARY KEY NOT NULL,
  "project_generation" text NOT NULL,
  "operation_id" text NOT NULL,
  "kind" text NOT NULL,
  "owner_occurrence_id" text NOT NULL,
  "owner_pid" integer NOT NULL,
  "owner_process_instance_id" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "project_maintenance_fence_operation_idx" ON "project_maintenance_fence" ("operation_id");
CREATE INDEX IF NOT EXISTS "project_maintenance_fence_owner_idx" ON "project_maintenance_fence" ("owner_occurrence_id");

CREATE TABLE IF NOT EXISTS "project" (
  "id" text PRIMARY KEY NOT NULL,
  "worktree" text NOT NULL,
  "name" text,
  "icon_url" text,
  "icon_color" text,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  "time_pinned" integer,
  "time_initialized" integer,
  "sandboxes" text NOT NULL,
  "commands" text,
  "generation" text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "project_generation_idx" ON "project" ("generation");

CREATE TABLE IF NOT EXISTS "protocol_delivery_receipt" (
  "id" text PRIMARY KEY NOT NULL,
  "inbox_id" text NOT NULL,
  "receipt" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("inbox_id") REFERENCES "protocol_inbox"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "protocol_delivery_receipt_inbox_idx" ON "protocol_delivery_receipt" ("inbox_id", "time_created");
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_delivery_receipt_terminal_idx" ON "protocol_delivery_receipt" ("inbox_id") WHERE json_extract("receipt", '$.kind') <> 'retry_wait';

CREATE TABLE IF NOT EXISTS "protocol_event" (
  "id" text PRIMARY KEY NOT NULL,
  "kind" text NOT NULL,
  "type" text NOT NULL,
  "aggregate_type" text NOT NULL,
  "aggregate_id" text NOT NULL,
  "project_id" text,
  "task_id" text,
  "session_id" text,
  "interaction_id" text,
  "stream_id" text,
  "source" text NOT NULL,
  "target" text,
  "causation_id" text,
  "correlation_id" text,
  "reply_to" text,
  "seq" integer NOT NULL,
  "deadline_ms" integer,
  "emitted_at" integer NOT NULL,
  "payload" text,
  CONSTRAINT "protocol_event_task_identity_shape" CHECK ("aggregate_type" <> 'task' OR "task_id" IS NULL),
  CONSTRAINT "protocol_event_session_identity_shape" CHECK ("aggregate_type" <> 'session' OR "session_id" IS NULL),
  CONSTRAINT "protocol_event_payload_envelope_shape" CHECK (
      json_type("payload", '$.taskID') IS NULL
      AND json_type("payload", '$.sessionID') IS NULL
      AND json_type("payload", '$.interactionID') IS NULL
      AND json_type("payload", '$.orderKey') IS NULL
      AND ("type" <> 'task.updated' OR json_type("payload", '$.status') IS NULL)
      AND ("type" NOT IN ('task.completed','task.failed','task.cancelled') OR json_type("payload", '$.timeCompleted') IS NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_event_aggregate_seq_idx" ON "protocol_event" ("aggregate_type", "aggregate_id", "seq");
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_event_mailbox_invocation_idx" ON "protocol_event" ("type", "aggregate_id", "session_id", "correlation_id") WHERE "type" = 'mailbox.message';
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_event_scheduler_reply_idx" ON "protocol_event" ("reply_to") WHERE "type" = 'scheduler.message' AND "kind" = 'reply' AND "reply_to" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_event_task_epoch_open_idx" ON "protocol_event" ("aggregate_id", json_extract("payload", '$.execution_epoch')) WHERE "aggregate_type" = 'task' AND "type" IN ('task.execution.opened', 'task.execution.reopened');
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_event_task_epoch_terminal_idx" ON "protocol_event" ("aggregate_id", json_extract("payload", '$.execution_epoch')) WHERE "aggregate_type" = 'task' AND "type" IN ('task.cancelled', 'task.completed', 'task.failed');
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_event_task_epoch_boundary_request_idx" ON "protocol_event" ("aggregate_id", json_extract("payload", '$.execution_epoch')) WHERE "aggregate_type" = 'task' AND "type" IN ('task.cancellation.requested');
CREATE INDEX IF NOT EXISTS "protocol_event_task_cancellation_frontier_idx" ON "protocol_event" ("project_id", "aggregate_type", "type");
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_event_task_deleted_idx" ON "protocol_event" ("aggregate_id") WHERE "aggregate_type" = 'task' AND "type" = 'task.deleted';
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_event_session_deleted_idx" ON "protocol_event" ("aggregate_id") WHERE "aggregate_type" = 'session' AND "type" = 'session.deleted';
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_event_mission_delete_retention_idx" ON "protocol_event" ("aggregate_id") WHERE "aggregate_type" = 'session' AND "type" = 'mission.retention.delete_requested';
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_event_mission_operation_boundary_idx" ON "protocol_event" ("aggregate_id", "correlation_id", "type") WHERE "aggregate_type" = 'session' AND "type" IN ('mission.execution.opened','mission.execution.closing','mission.execution.closed') AND "correlation_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "protocol_event_task_idx" ON "protocol_event" ("task_id", "seq");
CREATE INDEX IF NOT EXISTS "protocol_event_session_idx" ON "protocol_event" ("session_id", "seq");
CREATE INDEX IF NOT EXISTS "protocol_event_interaction_idx" ON "protocol_event" ("interaction_id", "seq");
CREATE INDEX IF NOT EXISTS "protocol_event_stream_idx" ON "protocol_event" ("stream_id", "seq");
CREATE INDEX IF NOT EXISTS "protocol_event_type_idx" ON "protocol_event" ("type");
CREATE INDEX IF NOT EXISTS "protocol_event_task_type_session_status_idx" ON "protocol_event" ("task_id", "type", "session_id", "emitted_at", "seq");
CREATE INDEX IF NOT EXISTS "protocol_event_session_type_status_order_idx" ON "protocol_event" ("session_id", "type", "emitted_at", "seq");

CREATE TABLE IF NOT EXISTS "protocol_inbox" (
  "id" text PRIMARY KEY NOT NULL,
  "envelope_id" text NOT NULL,
  "actor" text NOT NULL,
  "actor_id" text NOT NULL,
  "visible_at" integer NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("envelope_id") REFERENCES "protocol_event"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "protocol_inbox_envelope_actor_idx" ON "protocol_inbox" ("envelope_id", "actor", "actor_id");
CREATE INDEX IF NOT EXISTS "protocol_inbox_visible_idx" ON "protocol_inbox" ("actor", "actor_id", "visible_at", "envelope_id");

CREATE TABLE IF NOT EXISTS "provider_activity_outcome" (
  "id" text PRIMARY KEY NOT NULL,
  "request_id" text NOT NULL,
  "data" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("request_id") REFERENCES "provider_activity_request"("id") ON DELETE CASCADE,
  CONSTRAINT "provider_activity_outcome_fact_shape" CHECK (
      json_extract("data", '$.outcome') IN ('done', 'failed', 'aborted')
      AND json_type("data", '$.status') IS NULL
      AND json_type("data", '$.attempt') IS NULL
      AND (
        json_type("data", '$.attempt_count') IS NULL
        OR (
          json_type("data", '$.attempt_count')='integer'
          AND json_extract("data", '$.attempt_count') >= 1
        )
      )
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "provider_activity_outcome_request_idx" ON "provider_activity_outcome" ("request_id");

CREATE TABLE IF NOT EXISTS "provider_activity_request" (
  "id" text PRIMARY KEY NOT NULL,
  "assistant_message_id" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("assistant_message_id") REFERENCES "message"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "provider_activity_request_message_idx" ON "provider_activity_request" ("assistant_message_id", "time_created", "id");

CREATE TABLE IF NOT EXISTS "provider_usage_event" (
  "id" text PRIMARY KEY NOT NULL,
  "occurred_at" integer NOT NULL,
  "provider_id" text NOT NULL,
  "model_id" text NOT NULL,
  "purpose" text NOT NULL,
  "input_tokens" integer NOT NULL,
  "output_tokens" integer NOT NULL,
  "reasoning_tokens" integer NOT NULL,
  "cache_read_tokens" integer NOT NULL,
  "cache_write_tokens" integer NOT NULL,
  "total_tokens" integer NOT NULL,
  "cost_usd" real NOT NULL,
  "billing_status" text NOT NULL,
  "session_id" text,
  "agent_id" text
);
CREATE INDEX IF NOT EXISTS "provider_usage_event_time_idx" ON "provider_usage_event" ("occurred_at", "id");
CREATE INDEX IF NOT EXISTS "provider_usage_event_session_time_idx" ON "provider_usage_event" ("session_id", "occurred_at", "id");
CREATE INDEX IF NOT EXISTS "provider_usage_event_provider_time_idx" ON "provider_usage_event" ("provider_id", "occurred_at", "id");
CREATE INDEX IF NOT EXISTS "provider_usage_event_model_time_idx" ON "provider_usage_event" ("provider_id", "model_id", "occurred_at", "id");

CREATE TABLE IF NOT EXISTS "quick_note" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text,
  "content" text NOT NULL,
  "summary" text NOT NULL,
  "tags" text NOT NULL DEFAULT '[]',
  "status" text NOT NULL DEFAULT 'draft',
  "user_id" text,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL
);
CREATE INDEX IF NOT EXISTS "quick_note_project_idx" ON "quick_note" ("project_id");
CREATE INDEX IF NOT EXISTS "quick_note_user_idx" ON "quick_note" ("user_id");
CREATE INDEX IF NOT EXISTS "quick_note_status_idx" ON "quick_note" ("status");

CREATE TABLE IF NOT EXISTS "runtime_execution_capacity_lease" (
  "resource_key" text NOT NULL,
  "slot" integer NOT NULL,
  "lease_id" text NOT NULL,
  "owner_id" text NOT NULL,
  "time_acquired" integer NOT NULL,
  "expires_at" integer NOT NULL,
  PRIMARY KEY ("resource_key", "slot"),
  CONSTRAINT "runtime_execution_capacity_resource_digest" CHECK (length("resource_key") = 64 AND "resource_key" NOT GLOB '*[^0-9a-f]*'),
  CONSTRAINT "runtime_execution_capacity_slot_range" CHECK ("slot" BETWEEN 0 AND 63),
  CONSTRAINT "runtime_execution_capacity_lease_id_nonempty" CHECK (length("lease_id") > 0),
  CONSTRAINT "runtime_execution_capacity_owner_id_nonempty" CHECK (length("owner_id") > 0),
  CONSTRAINT "runtime_execution_capacity_time_nonnegative" CHECK ("time_acquired" >= 0),
  CONSTRAINT "runtime_execution_capacity_expiry_order" CHECK ("expires_at" >= "time_acquired")
);
CREATE INDEX IF NOT EXISTS "runtime_execution_capacity_expiry_idx" ON "runtime_execution_capacity_lease" ("expires_at");

CREATE TABLE IF NOT EXISTS "session_control_event" (
  "id" text PRIMARY KEY NOT NULL,
  "control_id" text NOT NULL,
  "kind" text NOT NULL,
  "payload" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("control_id") REFERENCES "session_control_record"("id") ON DELETE CASCADE,
  CONSTRAINT "session_control_event_shape" CHECK (
      ("kind"='amended' AND "payload" IS NOT NULL)
      OR ("kind"='consumed' AND "payload" IS NULL)
      OR ("kind"='failed' AND json_type("payload", '$.error')='text')
    )
);
CREATE INDEX IF NOT EXISTS "session_control_event_control_idx" ON "session_control_event" ("control_id", "time_created");
CREATE UNIQUE INDEX IF NOT EXISTS "session_control_event_terminal_idx" ON "session_control_event" ("control_id") WHERE "kind" IN ('consumed', 'failed');

CREATE TABLE IF NOT EXISTS "session_control_record" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "kind" text NOT NULL,
  "source" text,
  "payload" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_control_session_idx" ON "session_control_record" ("session_id");
CREATE INDEX IF NOT EXISTS "session_control_kind_idx" ON "session_control_record" ("kind");

CREATE TABLE IF NOT EXISTS "session_prompt_owner" (
  "session_id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "directory" text NOT NULL,
  "generation" text NOT NULL,
  "owner_pid" integer NOT NULL,
  "owner_process_instance_id" text NOT NULL,
  "owner_occurrence_id" text NOT NULL,
  "time_acquired" integer NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_prompt_owner_project_idx" ON "session_prompt_owner" ("project_id");

CREATE TABLE IF NOT EXISTS "session_share" (
  "session_id" text PRIMARY KEY NOT NULL,
  "id" text NOT NULL,
  "secret" text NOT NULL,
  "url" text NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "parent_id" text,
  "slug" text NOT NULL,
  "directory" text NOT NULL,
  "title" text NOT NULL,
  "version" text NOT NULL,
  "kind" text NOT NULL,
  "share_url" text,
  "summary_additions" integer,
  "summary_deletions" integer,
  "summary_files" integer,
  "permission" text,
  "metadata" text,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  "time_archived" integer,
  "time_pinned" integer,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_project_idx" ON "session" ("project_id");
CREATE INDEX IF NOT EXISTS "session_parent_idx" ON "session" ("parent_id", "time_created", "id");
CREATE INDEX IF NOT EXISTS "session_kind_idx" ON "session" ("kind");
CREATE INDEX IF NOT EXISTS "session_time_pinned_idx" ON "session" ("time_pinned");
CREATE UNIQUE INDEX IF NOT EXISTS "session_mission_identity_idx" ON "session" ("project_id", "directory", json_extract("metadata", '$.mission.id')) WHERE "kind" = 'mission';

CREATE TABLE IF NOT EXISTS "task_plan" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "parent_id" text,
  "goal" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "priority" integer NOT NULL DEFAULT 0,
  "notes" text,
  "progress_pct" integer NOT NULL DEFAULT 0,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "task_plan_session_idx" ON "task_plan" ("session_id");
CREATE INDEX IF NOT EXISTS "task_plan_parent_idx" ON "task_plan" ("parent_id");
CREATE INDEX IF NOT EXISTS "task_plan_status_idx" ON "task_plan" ("status");

CREATE TABLE IF NOT EXISTS "todo_snapshot" (
  "session_id" text PRIMARY KEY NOT NULL,
  "revision" integer NOT NULL,
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "todo" (
  "session_id" text NOT NULL,
  "content" text NOT NULL,
  "status" text NOT NULL,
  "priority" text NOT NULL,
  "position" integer NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  PRIMARY KEY ("session_id", "position"),
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "todo_session_idx" ON "todo" ("session_id");

CREATE TABLE IF NOT EXISTS "tool_part_outcome" (
  "id" text PRIMARY KEY NOT NULL,
  "request_part_id" text NOT NULL,
  "data" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("request_part_id") REFERENCES "tool_part_request"("id") ON DELETE CASCADE,
  CONSTRAINT "tool_part_outcome_fact_shape" CHECK (
      json_type("data", '$.time.end') IN ('integer', 'real')
      AND json_type("data", '$.input') IS NULL AND json_type("data", '$.status') IS NULL
      AND (
        COALESCE((json_extract("data", '$.outcome')='completed'
          AND json_type("data", '$.title')='text'
          AND json_type("data", '$.metadata')='object'
          AND json_type("data", '$.failure') IS NULL
          AND ((json_type("data", '$.output')='text' AND json_type("data", '$.resultAttemptID') IS NULL)
            OR (json_type("data", '$.output') IS NULL AND json_type("data", '$.resultAttemptID')='text'))),0)
        OR
        COALESCE((json_extract("data", '$.outcome')='failed'
          AND json_type("data", '$.failure')='object'
          AND json_type("data", '$.output') IS NULL
          AND json_type("data", '$.resultAttemptID') IS NULL
          AND json_type("data", '$.title') IS NULL),0)
      )
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS "tool_part_outcome_request_idx" ON "tool_part_outcome" ("request_part_id");
CREATE INDEX IF NOT EXISTS "tool_part_outcome_artifact_read_reference_idx" ON "tool_part_outcome" (
        CASE
          WHEN json_valid(json_extract("data", '$.output'))
          THEN json_extract(json_extract("data", '$.output'), '$.artifact_read_ref')
        END
      );
CREATE INDEX IF NOT EXISTS "tool_part_outcome_result_attempt_idx" ON "tool_part_outcome" (json_extract("data", '$.resultAttemptID'));

CREATE TABLE IF NOT EXISTS "tool_part_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "request_part_id" text NOT NULL,
  "title" text,
  "metadata" text,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("request_part_id") REFERENCES "tool_part_request"("id") ON DELETE CASCADE,
  CONSTRAINT "tool_part_progress_fact_shape" CHECK (
      ("title" IS NOT NULL OR "metadata" IS NOT NULL)
      AND ("metadata" IS NULL OR json_type("metadata") = 'object')
    )
);
CREATE INDEX IF NOT EXISTS "tool_part_progress_request_idx" ON "tool_part_progress" ("request_part_id", "time_created", "id");

CREATE TABLE IF NOT EXISTS "tool_part_request" (
  "id" text PRIMARY KEY NOT NULL,
  "message_id" text NOT NULL,
  "data" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("message_id") REFERENCES "message"("id") ON DELETE CASCADE,
  CONSTRAINT "tool_part_request_fact_shape" CHECK (
      json_extract("data", '$.type') = 'tool-request'
      AND json_type("data", '$.callID') = 'text'
      AND json_type("data", '$.tool') = 'text'
      AND json_type("data", '$.time.start') IN ('integer', 'real')
      AND json_type("data", '$.state') IS NULL
    )
);
CREATE INDEX IF NOT EXISTS "tool_part_request_message_idx" ON "tool_part_request" ("message_id", "time_created");
CREATE UNIQUE INDEX IF NOT EXISTS "tool_part_request_call_idx" ON "tool_part_request" ("message_id", json_extract("data", '$.callID'));

CREATE TABLE IF NOT EXISTS "workbench_brief_snapshot" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "content" text NOT NULL,
  "inputs" text,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("task_id") REFERENCES "engine_task"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "workbench_brief_task_idx" ON "workbench_brief_snapshot" ("task_id");

CREATE TABLE IF NOT EXISTS "worker_turn_descriptor" (
  "id" text PRIMARY KEY NOT NULL,
  "task_id" text NOT NULL,
  "project_id" text NOT NULL,
  "session_id" text NOT NULL,
  "hash" text NOT NULL,
  "agent" text NOT NULL,
  "payload" text NOT NULL,
  "time_created" integer NOT NULL,
  "time_updated" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  FOREIGN KEY ("session_id") REFERENCES "session"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "worker_turn_descriptor_session_idx" ON "worker_turn_descriptor" ("session_id");
CREATE INDEX IF NOT EXISTS "worker_turn_descriptor_hash_idx" ON "worker_turn_descriptor" ("hash");
CREATE INDEX IF NOT EXISTS "worker_turn_descriptor_task_frontier_idx" ON "worker_turn_descriptor" ("task_id");
CREATE INDEX IF NOT EXISTS "worker_turn_descriptor_project_frontier_idx" ON "worker_turn_descriptor" ("project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "worker_turn_descriptor_dispatch_idx" ON "worker_turn_descriptor" ("session_id", json_extract("payload", '$.dispatchTurn.current_dispatch_id'));

CREATE TABLE IF NOT EXISTS "workspace_lifecycle_admission" (
  "occurrence_id" text PRIMARY KEY NOT NULL,
  "project_id" text NOT NULL,
  "project_generation" text NOT NULL,
  "workspace_id" text NOT NULL,
  "lifecycle" text NOT NULL,
  "authority" text NOT NULL,
  "owner_occurrence_id" text NOT NULL,
  "owner_pid" integer NOT NULL,
  "owner_process_instance_id" text NOT NULL,
  "time_created" integer NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE,
  CONSTRAINT "workspace_lifecycle_admission_kind_shape" CHECK ("lifecycle" IN ('creating', 'deleting') AND "authority" IN ('public', 'project_delete') AND ("lifecycle" <> 'creating' OR "authority" = 'public'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_lifecycle_admission_project_workspace_idx" ON "workspace_lifecycle_admission" ("project_id", "workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_lifecycle_admission_project_kind_idx" ON "workspace_lifecycle_admission" ("project_id", "lifecycle", "authority");
CREATE INDEX IF NOT EXISTS "workspace_lifecycle_admission_owner_idx" ON "workspace_lifecycle_admission" ("owner_occurrence_id");

CREATE TABLE IF NOT EXISTS "workspace" (
  "id" text PRIMARY KEY NOT NULL,
  "branch" text,
  "project_id" text NOT NULL,
  "config" text NOT NULL,
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE
);


CREATE TRIGGER IF NOT EXISTS expert_squad_mutation_receipt_no_update
BEFORE UPDATE ON expert_squad_mutation_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'expert_squad_mutation_receipt: installation commit history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS expert_squad_mutation_receipt_no_delete
BEFORE DELETE ON expert_squad_mutation_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'expert_squad_mutation_receipt: installation commit history is immutable'); END;

CREATE TRIGGER IF NOT EXISTS project_generation_required_insert
BEFORE INSERT ON project
FOR EACH ROW
WHEN length(NEW.generation) != 36
  OR length(replace(NEW.generation, '-', '')) != 32
  OR substr(NEW.generation, 9, 1) != '-'
  OR substr(NEW.generation, 14, 1) != '-'
  OR substr(NEW.generation, 19, 1) != '-'
  OR substr(NEW.generation, 24, 1) != '-'
  OR lower(replace(NEW.generation, '-', '')) GLOB '*[^0-9a-f]*'
  OR (
    NEW.generation NOT IN (
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff'
    )
    AND substr(lower(NEW.generation), 15, 1) NOT BETWEEN '1' AND '8'
  )
  OR (
    NEW.generation NOT IN (
      '00000000-0000-0000-0000-000000000000',
      'ffffffff-ffff-ffff-ffff-ffffffffffff'
    )
    AND instr('89ab', substr(lower(NEW.generation), 20, 1)) = 0
  )
BEGIN
  SELECT RAISE(ABORT, 'project: generation must be a UUID');
END;

CREATE TRIGGER IF NOT EXISTS project_generation_immutable_update
BEFORE UPDATE OF generation ON project
FOR EACH ROW
WHEN NEW.generation IS NOT OLD.generation
BEGIN
  SELECT RAISE(ABORT, 'project: generation is immutable');
END;

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_identity_immutable_update
BEFORE UPDATE OF id, kind, request_id, request_fingerprint, request_contract, resolution_seed, task_resolution, directory, time_created
ON global_creation_allocation
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: immutable request allocation');
END;

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_project_write_once
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

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_project_insert
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

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_rejection_write_once
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

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_acceptance_write_once
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

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_pending_project_no_delete
BEFORE DELETE ON project FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM global_creation_allocation
  WHERE materialized_project_id=OLD.id
    AND materialized_project_generation=OLD.generation
    AND accepted_target_id IS NULL
    AND rejected_error IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'project: pending global creation allocation owns this Project');
END;

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_project_retention_write_once
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

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_project_retention_insert
BEFORE INSERT ON global_creation_allocation
FOR EACH ROW WHEN NEW.time_project_retained IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: Project retention must be produced by Project deletion');
END;

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_project_retention_delete
BEFORE DELETE ON project FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM global_creation_allocation
  WHERE materialized_project_id=OLD.id
    AND materialized_project_generation=OLD.generation
    AND (accepted_target_id IS NOT NULL OR rejected_error IS NOT NULL)
    AND time_project_retained IS NULL
)
BEGIN
  UPDATE global_creation_allocation
  SET time_project_retained=MAX(
    OLD.time_updated,
    COALESCE(time_accepted,time_rejected,time_materialized,OLD.time_updated)
  )
  WHERE materialized_project_id=OLD.id
    AND materialized_project_generation=OLD.generation
    AND (accepted_target_id IS NOT NULL OR rejected_error IS NOT NULL)
    AND time_project_retained IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_acceptance_target_update
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
  ) OR (
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

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_acceptance_target_insert
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

CREATE TRIGGER IF NOT EXISTS global_creation_allocation_no_delete
BEFORE DELETE ON global_creation_allocation
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'global_creation_allocation: immutable request allocation');
END;

CREATE TRIGGER IF NOT EXISTS engine_task_creation_contract_no_update
BEFORE UPDATE ON engine_task_creation_contract
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'engine_task_creation_contract: immutable accepted contract');
END;

CREATE TRIGGER IF NOT EXISTS engine_task_creation_contract_no_delete
BEFORE DELETE ON engine_task_creation_contract
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id=OLD.task_id)
BEGIN
  SELECT RAISE(ABORT, 'engine_task_creation_contract: immutable accepted contract');
END;

CREATE TRIGGER IF NOT EXISTS engine_task_request_identity_append_only
BEFORE UPDATE OF request_id ON engine_task
FOR EACH ROW
WHEN OLD.request_id IS NOT NULL OR NEW.request_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'engine_task: accepted request identity is append-only');
END;

CREATE TRIGGER IF NOT EXISTS engine_task_global_creation_allocation_append_only
BEFORE UPDATE OF global_creation_allocation_id ON engine_task
FOR EACH ROW
WHEN OLD.global_creation_allocation_id IS NOT NULL OR NEW.global_creation_allocation_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'engine_task: Global creation allocation identity is append-only');
END;

CREATE TRIGGER IF NOT EXISTS engine_channel_binding_no_update
BEFORE UPDATE ON engine_channel_binding
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'engine_channel_binding: immutable accepted channel claim');
END;

CREATE TRIGGER IF NOT EXISTS engine_channel_binding_no_delete
BEFORE DELETE ON engine_channel_binding
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id=OLD.task_id)
BEGIN
  SELECT RAISE(ABORT, 'engine_channel_binding: immutable accepted channel claim');
END;

CREATE TRIGGER IF NOT EXISTS engine_task_creation_contract_tool_lineage_insert
BEFORE INSERT ON engine_task_creation_contract FOR EACH ROW
WHEN NEW.creator_tool_part_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM tool_part_request AS request
  JOIN message AS creator_message ON creator_message.id=request.message_id
  JOIN message AS caller_message
    ON caller_message.id=json_extract(creator_message.data,'$.parentID')
   AND caller_message.session_id=creator_message.session_id
   AND json_extract(caller_message.data,'$.role')='user'
  JOIN session AS creator_session ON creator_session.id=creator_message.session_id
  JOIN engine_task AS task ON task.id=NEW.task_id
  WHERE request.id=NEW.creator_tool_part_id
    AND json_extract(request.data,'$.tool')='panel_create_task'
    AND json_type(request.data,'$.input.action') IS NULL
    AND json_extract(creator_message.data,'$.role')='assistant'
    AND json_extract(NEW.contract,'$.request.input.creator.tool_part_id')=request.id
    AND json_extract(NEW.contract,'$.request.input.creator.message_id')=request.message_id
    AND json_extract(NEW.contract,'$.request.input.creator.tool_call_id')=json_extract(request.data,'$.callID')
    AND json_extract(NEW.contract,'$.request.input.creator.session_id')=creator_message.session_id
    AND json_extract(NEW.contract,'$.protocol')='task-creation-contract-v2'
    AND json_extract(NEW.contract,'$.request.protocol')='task-create-request-v1'
    AND json_extract(NEW.contract,'$.request.input.request')=json_extract(request.data,'$.input.request')
    AND json_extract(NEW.contract,'$.request.input.requested_project') IS NULL
    AND json_extract(NEW.contract,'$.request.input.requested_directory') IS json_extract(request.data,'$.input.directory')
    AND json_extract(NEW.contract,'$.request.input.explicit_source') IS json_extract(request.data,'$.input.source')
    AND json_extract(NEW.contract,'$.request.input.explicit_product_pillar') IS json_extract(request.data,'$.input.productPillar')
    AND json_extract(NEW.contract,'$.request.input.explicit_title') IS (
      CASE
        WHEN length(trim(json_extract(request.data,'$.input.title'))) > 0
        THEN trim(json_extract(request.data,'$.input.title'))
        ELSE NULL
      END
    )
    AND json_extract(NEW.contract,'$.request.input.explicit_priority') IS json_extract(request.data,'$.input.priority')
    AND json_extract(NEW.contract,'$.request.input.explicit_model') IS json_extract(request.data,'$.input.model')
    AND json_extract(NEW.contract,'$.request.input.explicit_prompt_profile') IS json_extract(request.data,'$.input.promptProfile')
    AND json_extract(NEW.contract,'$.request.input.expected_package_digest') IS json_extract(request.data,'$.input.expectedPackageDigest')
    AND json_type(NEW.contract,'$.request.input.attachments')='array'
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.v')+1),type,atom
      FROM json_tree(
        json_object('v',json(COALESCE((
          SELECT json_group_array(json_object(
            'url',json_extract(caller_part.data,'$.url'),
            'mime',json_extract(caller_part.data,'$.mime'),
            'filename',json_extract(caller_part.data,'$.filename')
          ))
          FROM (
            SELECT data FROM part
            WHERE message_id=caller_message.id AND json_extract(data,'$.type')='file'
            ORDER BY time_created,id
          ) AS caller_part
        ),'[]'))),'$.v')
      EXCEPT
      SELECT substr(fullkey,length('$.request.input.attachments')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.attachments')
    )
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.request.input.attachments')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.attachments')
      EXCEPT
      SELECT substr(fullkey,length('$.v')+1),type,atom
      FROM json_tree(
        json_object('v',json(COALESCE((
          SELECT json_group_array(json_object(
            'url',json_extract(caller_part.data,'$.url'),
            'mime',json_extract(caller_part.data,'$.mime'),
            'filename',json_extract(caller_part.data,'$.filename')
          ))
          FROM (
            SELECT data FROM part
            WHERE message_id=caller_message.id AND json_extract(data,'$.type')='file'
            ORDER BY time_created,id
          ) AS caller_part
        ),'[]'))),'$.v')
    )
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.v')+1),type,atom
      FROM json_tree(json_object('v',json_extract(request.data,'$.input.budget')),'$.v')
      EXCEPT
      SELECT substr(fullkey,length('$.request.input.budget')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.budget')
    )
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.request.input.budget')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.budget')
      EXCEPT
      SELECT substr(fullkey,length('$.v')+1),type,atom
      FROM json_tree(json_object('v',json_extract(request.data,'$.input.budget')),'$.v')
    )
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.v')+1),type,atom
      FROM json_tree(json_object('v',json_extract(request.data,'$.input.checks')),'$.v')
      EXCEPT
      SELECT substr(fullkey,length('$.request.input.checks')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.checks')
    )
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.request.input.checks')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.checks')
      EXCEPT
      SELECT substr(fullkey,length('$.v')+1),type,atom
      FROM json_tree(json_object('v',json_extract(request.data,'$.input.checks')),'$.v')
    )
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.v')+1),type,atom
      FROM json_tree(json_object('v',json_extract(request.data,'$.input.metadata')),'$.v')
      EXCEPT
      SELECT substr(fullkey,length('$.request.input.metadata')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.metadata')
    )
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.request.input.metadata')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.metadata')
      EXCEPT
      SELECT substr(fullkey,length('$.v')+1),type,atom
      FROM json_tree(json_object('v',json_extract(request.data,'$.input.metadata')),'$.v')
    )
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.v')+1),type,atom
      FROM json_tree(json_object('v',COALESCE(json_extract(request.data,'$.input.artifact_sources'),json('[]'))),'$.v')
      EXCEPT
      SELECT substr(fullkey,length('$.request.input.artifact_sources')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.artifact_sources')
    )
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.request.input.artifact_sources')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.artifact_sources')
      EXCEPT
      SELECT substr(fullkey,length('$.v')+1),type,atom
      FROM json_tree(json_object('v',COALESCE(json_extract(request.data,'$.input.artifact_sources'),json('[]'))),'$.v')
    )
    AND json_extract(NEW.contract,'$.request.input.creator.actor') IN ('mission','control_agent','right_sidebar_conversation')
    AND (
      (json_extract(NEW.contract,'$.request.input.creator.actor')='mission'
        AND creator_session.kind='mission'
        AND json_extract(creator_session.metadata,'$.mission.id')=json_extract(NEW.contract,'$.request.input.creator.mission_id')
        AND EXISTS (
          SELECT 1 FROM protocol_event AS opened
          WHERE opened.id=json_extract(NEW.contract,'$.request.input.creator.opened_occurrence.event_id')
            AND opened.aggregate_type='session'
            AND opened.aggregate_id=creator_session.id
            AND opened.type='mission.execution.opened'
            AND opened.correlation_id=json_extract(NEW.contract,'$.request.input.creator.opened_occurrence.operation_id')
            AND json_extract(opened.payload,'$.missionID')=json_extract(NEW.contract,'$.request.input.creator.mission_id')
        ))
      OR (json_extract(NEW.contract,'$.request.input.creator.actor')='control_agent'
        AND creator_session.kind='assistant'
        AND json_type(creator_session.metadata,'$.conversation') IS NULL)
      OR (json_extract(NEW.contract,'$.request.input.creator.actor')='right_sidebar_conversation'
        AND creator_session.kind='assistant'
        AND json_extract(creator_session.metadata,'$.conversation.surface')='right-sidebar'
        AND json_extract(creator_session.metadata,'$.conversation.experience') IN ('chat','work'))
    )
    AND creator_session.project_id=task.project_id
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.input')+1),type,atom
      FROM json_tree(request.data,'$.input')
      EXCEPT
      SELECT substr(fullkey,length('$.request.input.creator.tool_input')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.creator.tool_input')
    )
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.request.input.creator.tool_input')+1),type,atom
      FROM json_tree(NEW.contract,'$.request.input.creator.tool_input')
      EXCEPT
      SELECT substr(fullkey,length('$.input')+1),type,atom
      FROM json_tree(request.data,'$.input')
    )
    AND (
      json_type(request.data,'$.input.request_id') IS NULL
      OR task.request_id=json_extract(request.data,'$.input.request_id')
    )
)
BEGIN
  SELECT RAISE(ABORT, 'engine_task_creation_contract: invalid panel Tool creator lineage');
END;

CREATE TRIGGER IF NOT EXISTS session_panel_creation_immutable_update
BEFORE UPDATE OF metadata ON session
FOR EACH ROW
WHEN json_type(OLD.metadata,'$.panelCreation') IS NOT NULL
  AND json_extract(NEW.metadata,'$.panelCreation') IS NOT json_extract(OLD.metadata,'$.panelCreation')
BEGIN
  SELECT RAISE(ABORT, 'session: panel creation occurrence is immutable');
END;

CREATE TRIGGER IF NOT EXISTS session_panel_creation_insert_only_update
BEFORE UPDATE OF metadata ON session
FOR EACH ROW
WHEN json_type(OLD.metadata,'$.panelCreation') IS NULL
  AND json_type(NEW.metadata,'$.panelCreation') IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'session: panel creation occurrence must be bound at insert');
END;

CREATE UNIQUE INDEX IF NOT EXISTS session_panel_creation_tool_part_idx
ON session(json_extract(metadata,'$.panelCreation.tool_part_id'))
WHERE json_type(metadata,'$.panelCreation') IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS session_panel_creation_lineage_insert
BEFORE INSERT ON session
FOR EACH ROW
WHEN json_type(NEW.metadata,'$.panelCreation') IS NOT NULL AND NOT EXISTS (
  SELECT 1
  FROM tool_part_request AS request
  JOIN message AS assistant_message ON assistant_message.id=request.message_id
  JOIN session AS creator_session ON creator_session.id=assistant_message.session_id
  JOIN message AS caller_message
    ON caller_message.id=json_extract(assistant_message.data,'$.parentID')
   AND caller_message.session_id=creator_session.id
  WHERE request.id=json_extract(NEW.metadata,'$.panelCreation.tool_part_id')
    AND json_extract(NEW.metadata,'$.panelCreation.protocol')='panel-creation-v1'
    AND json_extract(NEW.metadata,'$.panelCreation.operation') IN ('wake_mission','wake_work')
    AND json_extract(request.data,'$.tool')=('panel_' || json_extract(NEW.metadata,'$.panelCreation.operation'))
    AND json_extract(request.data,'$.callID')=json_extract(NEW.metadata,'$.panelCreation.tool_call_id')
    AND request.message_id=json_extract(NEW.metadata,'$.panelCreation.message_id')
    AND json_type(request.data,'$.input.action') IS NULL
    AND json_extract(assistant_message.data,'$.role')='assistant'
    AND caller_message.id=json_extract(NEW.metadata,'$.panelCreation.caller_user_message_id')
    AND json_extract(caller_message.data,'$.role')='user'
    AND creator_session.project_id=NEW.project_id
    AND (SELECT COUNT(*) FROM json_each(json_extract(NEW.metadata,'$.panelCreation')))=8
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.input')+1),type,atom
      FROM json_tree(request.data,'$.input')
      EXCEPT
      SELECT substr(fullkey,length('$.panelCreation.input')+1),type,atom
      FROM json_tree(NEW.metadata,'$.panelCreation.input')
    )
    AND NOT EXISTS (
      SELECT substr(fullkey,length('$.panelCreation.input')+1),type,atom
      FROM json_tree(NEW.metadata,'$.panelCreation.input')
      EXCEPT
      SELECT substr(fullkey,length('$.input')+1),type,atom
      FROM json_tree(request.data,'$.input')
    )
    AND json_extract(NEW.metadata,'$.panelCreation.target_id') = (
      CASE json_extract(NEW.metadata,'$.panelCreation.operation')
        WHEN 'wake_mission' THEN 'chat-p-' || lower(substr(json_extract(NEW.metadata,'$.panelCreation.tool_part_id'),-17))
        WHEN 'wake_work' THEN 'ses_p' || lower(substr(json_extract(NEW.metadata,'$.panelCreation.tool_part_id'),-19))
      END
    )
    AND (
      (json_extract(NEW.metadata,'$.panelCreation.operation')='wake_work'
        AND NEW.id=json_extract(NEW.metadata,'$.panelCreation.target_id')
        AND NEW.kind='assistant'
        AND json_extract(NEW.metadata,'$.conversation.surface')='right-sidebar'
        AND json_extract(NEW.metadata,'$.conversation.experience')='work')
      OR
      (json_extract(NEW.metadata,'$.panelCreation.operation')='wake_mission'
        AND NEW.kind='mission'
        AND json_extract(NEW.metadata,'$.mission.id')=json_extract(NEW.metadata,'$.panelCreation.target_id'))
    )
)
BEGIN
  SELECT RAISE(ABORT, 'session: invalid panel creation occurrence');
END;

CREATE TRIGGER IF NOT EXISTS project_promotion_fence_update
BEFORE UPDATE ON project
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM project_maintenance_fence
  WHERE project_id = OLD.id AND kind = 'promotion'
)
BEGIN
  SELECT RAISE(ABORT, 'project_promotion_fenced');
END;

CREATE TRIGGER IF NOT EXISTS project_promotion_fence_delete
BEFORE DELETE ON project
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM project_maintenance_fence
  WHERE project_id = OLD.id AND kind = 'promotion'
)
BEGIN
  SELECT RAISE(ABORT, 'project_promotion_fenced');
END;

CREATE TRIGGER IF NOT EXISTS session_project_promotion_fence_insert
BEFORE INSERT ON session
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM project_maintenance_fence
  WHERE project_id = NEW.project_id AND kind = 'promotion'
)
BEGIN
  SELECT RAISE(ABORT, 'project_promotion_fenced');
END;

CREATE TRIGGER IF NOT EXISTS session_project_promotion_fence_update
BEFORE UPDATE ON session
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM project_maintenance_fence
  WHERE project_id IN (OLD.project_id, NEW.project_id) AND kind = 'promotion'
)
BEGIN
  SELECT RAISE(ABORT, 'project_promotion_fenced');
END;

CREATE TRIGGER IF NOT EXISTS session_project_promotion_fence_delete
BEFORE DELETE ON session
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM project_maintenance_fence
  WHERE project_id = OLD.project_id AND kind = 'promotion'
)
BEGIN
  SELECT RAISE(ABORT, 'project_promotion_fenced');
END;

-- A Mission Session is a complete durable domain identity at its first
-- observable commit. Mutable Mission state may be added later, but the launch
-- identity cannot be manufactured or rewritten afterward. cwd may move only
-- together with session.directory so Project relocation remains one atomic
-- identity-preserving operation.
CREATE TRIGGER IF NOT EXISTS session_mission_identity_required_insert
BEFORE INSERT ON session
FOR EACH ROW
WHEN NEW.kind = 'mission'
  AND (
    json_type(NEW.metadata, '$.mission') IS NOT 'object'
    OR json_type(NEW.metadata, '$.mission.id') IS NOT 'text'
    OR length(json_extract(NEW.metadata, '$.mission.id')) NOT BETWEEN 1 AND 64
    OR json_extract(NEW.metadata, '$.mission.id') GLOB '*[^a-z0-9-]*'
    OR json_type(NEW.metadata, '$.mission.channelKey') IS NOT 'text'
    OR json_extract(NEW.metadata, '$.mission.channelKey') IS NOT 'mission:' || json_extract(NEW.metadata, '$.mission.id')
    OR json_type(NEW.metadata, '$.mission.cwd') IS NOT 'text'
    OR length(json_extract(NEW.metadata, '$.mission.cwd')) < 1
    OR json_extract(NEW.metadata, '$.mission.cwd') IS NOT NEW.directory
    OR json_type(NEW.metadata, '$.mission.productPillar') IS NOT 'text'
    OR json_extract(NEW.metadata, '$.mission.productPillar') NOT IN ('code', 'work')
    OR json_type(NEW.metadata, '$.mission.visibleExpertSquadIDs') IS NOT 'array'
    OR json_array_length(NEW.metadata, '$.mission.visibleExpertSquadIDs') < 1
    OR EXISTS (
      SELECT 1 FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs') AS squad
      WHERE squad.type IS NOT 'text'
        OR length(squad.value) NOT BETWEEN 1 AND 64
        OR squad.value NOT GLOB '[a-z]*'
        OR squad.value GLOB '*[^a-z0-9-]*'
        OR squad.value GLOB '*--*'
        OR substr(squad.value, -1) = '-'
    )
    OR (
      SELECT count(*) FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs')
    ) IS NOT (
      SELECT count(DISTINCT value) FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs')
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'session: mission identity metadata is incomplete');
END;

CREATE TRIGGER IF NOT EXISTS session_mission_identity_required_update
BEFORE UPDATE ON session
FOR EACH ROW
WHEN NEW.kind = 'mission'
  AND (
    json_type(NEW.metadata, '$.mission') IS NOT 'object'
    OR json_type(NEW.metadata, '$.mission.id') IS NOT 'text'
    OR length(json_extract(NEW.metadata, '$.mission.id')) NOT BETWEEN 1 AND 64
    OR json_extract(NEW.metadata, '$.mission.id') GLOB '*[^a-z0-9-]*'
    OR json_type(NEW.metadata, '$.mission.channelKey') IS NOT 'text'
    OR json_extract(NEW.metadata, '$.mission.channelKey') IS NOT 'mission:' || json_extract(NEW.metadata, '$.mission.id')
    OR json_type(NEW.metadata, '$.mission.cwd') IS NOT 'text'
    OR length(json_extract(NEW.metadata, '$.mission.cwd')) < 1
    OR json_extract(NEW.metadata, '$.mission.cwd') IS NOT NEW.directory
    OR json_type(NEW.metadata, '$.mission.productPillar') IS NOT 'text'
    OR json_extract(NEW.metadata, '$.mission.productPillar') NOT IN ('code', 'work')
    OR json_type(NEW.metadata, '$.mission.visibleExpertSquadIDs') IS NOT 'array'
    OR json_array_length(NEW.metadata, '$.mission.visibleExpertSquadIDs') < 1
    OR EXISTS (
      SELECT 1 FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs') AS squad
      WHERE squad.type IS NOT 'text'
        OR length(squad.value) NOT BETWEEN 1 AND 64
        OR squad.value NOT GLOB '[a-z]*'
        OR squad.value GLOB '*[^a-z0-9-]*'
        OR squad.value GLOB '*--*'
        OR substr(squad.value, -1) = '-'
    )
    OR (
      SELECT count(*) FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs')
    ) IS NOT (
      SELECT count(DISTINCT value) FROM json_each(NEW.metadata, '$.mission.visibleExpertSquadIDs')
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'session: mission identity metadata is incomplete');
END;

CREATE TRIGGER IF NOT EXISTS session_mission_identity_immutable_update
BEFORE UPDATE ON session
FOR EACH ROW
WHEN (OLD.kind = 'mission' OR NEW.kind = 'mission')
  AND (
    NEW.kind IS NOT OLD.kind
    OR json_extract(NEW.metadata, '$.mission.id') IS NOT json_extract(OLD.metadata, '$.mission.id')
    OR json_extract(NEW.metadata, '$.mission.channelKey') IS NOT json_extract(OLD.metadata, '$.mission.channelKey')
    OR json_extract(NEW.metadata, '$.mission.productPillar') IS NOT json_extract(OLD.metadata, '$.mission.productPillar')
    OR json_extract(NEW.metadata, '$.mission.visibleExpertSquadIDs') IS NOT json_extract(OLD.metadata, '$.mission.visibleExpertSquadIDs')
    OR (
      json_extract(NEW.metadata, '$.mission.cwd') IS NOT json_extract(OLD.metadata, '$.mission.cwd')
      AND NEW.directory IS OLD.directory
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'session: mission identity metadata is immutable');
END;

CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
  content,
  chunk_id UNINDEXED,
  project_id UNINDEXED
);

-- Completion output identity follows actual workers, independently of optional
-- workflow references. This current payload shape is a schema-epoch boundary.
CREATE TRIGGER IF NOT EXISTS engine_task_completion_decision_payload_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'task_completion_decision'
  AND (
    json_type(NEW.payload) IS NOT 'object'
    OR (SELECT count(*) FROM json_each(NEW.payload)) != 10
    OR EXISTS (
      SELECT 1 FROM json_each(NEW.payload)
      WHERE key NOT IN (
        'orchestrator_session_id','orchestrator_message_id','tool_call_id','tool_part_id',
        'evidence_locators','deliverable_artifact_locators','worker_artifact_locators',
        'accepted_delivery_slice_revision_ids','workflow_binding','time_recorded'
      )
    )
    OR json_type(NEW.payload, '$.worker_artifact_locators') IS NOT 'array'
    OR json_type(NEW.payload, '$.evidence_locators') IS NOT 'array'
    OR json_type(NEW.payload, '$.deliverable_artifact_locators') IS NOT 'array'
    OR json_type(NEW.payload, '$.accepted_delivery_slice_revision_ids') IS NOT 'array'
    OR json_type(NEW.payload, '$.workflow_binding') IS NOT 'object'
    OR json_type(NEW.payload, '$.time_recorded') IS NOT 'integer'
    OR json_extract(NEW.payload, '$.time_recorded') != NEW.time_created
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: task_completion_decision requires exact actual-worker output and completion identity');
END;

-- Dispatch lineage is immutable physical-execution authority. Adapter input
-- and the exact delivery-owner disposition are required JSON (JavaScript
-- Object Notation) objects; changing this trigger is also the physical schema
-- breakpoint for any future breaking lineage-payload contract.
CREATE TRIGGER IF NOT EXISTS engine_dispatch_lineage_payload_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'dispatch_lineage'
  AND (
    json_type(NEW.payload) IS NOT 'object'
    OR EXISTS (
      SELECT 1
      FROM json_each(NEW.payload) AS field
      WHERE field.key NOT IN (
        'dispatch_id','task_id','execution_epoch','orchestrator_session_id','orchestrator_message_id',
        'tool_part_id','tool_call_id','tool_name','collection_member_index','collection_member_count',
        'child_session_id','target_agent_id','projected_worker_identity','work_scope',
        'delivery_slice_revision_ids','workflow_binding','workflow_node_id','workflow_occurrence_id',
        'coordination_action_id','continuation_of_dispatch_id','delivery_owner','adapter_input','time_created'
      )
    )
    OR (SELECT count(*) FROM json_each(NEW.payload))
      != (SELECT count(DISTINCT field.key) FROM json_each(NEW.payload) AS field)
    OR json_type(NEW.payload, '$.adapter_input') IS NOT 'object'
    OR (SELECT count(*) FROM json_each(NEW.payload, '$.adapter_input'))
      != (SELECT count(DISTINCT field.key) FROM json_each(NEW.payload, '$.adapter_input') AS field)
    OR json_type(NEW.payload, '$.delivery_owner') IS NOT 'object'
    OR json_type(NEW.payload, '$.orchestrator_session_id') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.orchestrator_session_id'))) = 0
    OR json_type(NEW.payload, '$.orchestrator_message_id') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.orchestrator_message_id'))) = 0
    OR json_type(NEW.payload, '$.tool_part_id') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.tool_part_id'))) = 0
    OR json_type(NEW.payload, '$.tool_call_id') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.tool_call_id'))) = 0
    OR json_type(NEW.payload, '$.tool_name') IS NOT 'text'
    OR NOT (
      COALESCE((
        json_extract(NEW.payload, '$.tool_name') = 'dispatch_agent'
        AND json_type(NEW.payload, '$.collection_member_index') IS NULL
        AND json_type(NEW.payload, '$.collection_member_count') IS NULL
      ), 0)
      OR COALESCE((
        json_extract(NEW.payload, '$.tool_name') = 'dispatch_agents'
        AND json_type(NEW.payload, '$.collection_member_index') = 'integer'
        AND json_extract(NEW.payload, '$.collection_member_index') >= 0
        AND json_extract(NEW.payload, '$.collection_member_index') <= 9007199254740991
        AND json_type(NEW.payload, '$.collection_member_count') = 'integer'
        AND json_extract(NEW.payload, '$.collection_member_count') > 0
        AND json_extract(NEW.payload, '$.collection_member_count') <= 9007199254740991
        AND json_extract(NEW.payload, '$.collection_member_index') < json_extract(NEW.payload, '$.collection_member_count')
      ), 0)
    )
    OR json_extract(NEW.payload, '$.delivery_owner.kind') != 'runtime_process'
    OR json_type(NEW.payload, '$.delivery_owner.process_occurrence_id') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.delivery_owner.process_occurrence_id'))) = 0
    OR (SELECT count(*) FROM json_each(NEW.payload, '$.delivery_owner')) != 2
    OR json_type(NEW.payload, '$.dispatch_id') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.dispatch_id'))) = 0
    OR json_type(NEW.payload, '$.child_session_id') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.child_session_id'))) = 0
    OR json_type(NEW.payload, '$.target_agent_id') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.target_agent_id'))) = 0
    OR json_type(NEW.payload, '$.projected_worker_identity') IS NOT 'object'
    OR (SELECT count(*) FROM json_each(NEW.payload, '$.projected_worker_identity')) != 7
    OR EXISTS (
      SELECT 1
      FROM json_each(NEW.payload, '$.projected_worker_identity') AS field
      WHERE field.key NOT IN (
        'agentID','baseRole','sessionKind','dispatchAdapterID','runtimeTemplateABIVersion',
        'dispatchAdapterABIVersion','projectionHash'
      )
    )
    OR json_type(NEW.payload, '$.projected_worker_identity.agentID') IS NOT 'text'
    OR json_extract(NEW.payload, '$.projected_worker_identity.agentID') IN ('orchestrator','shared')
    OR substr(json_extract(NEW.payload, '$.projected_worker_identity.agentID'), 1, 1) NOT GLOB '[a-z]'
    OR json_extract(NEW.payload, '$.projected_worker_identity.agentID') GLOB '*[^a-z0-9-]*'
    OR json_extract(NEW.payload, '$.projected_worker_identity.agentID') GLOB '*--*'
    OR json_extract(NEW.payload, '$.projected_worker_identity.agentID') GLOB '*-'
    OR json_type(NEW.payload, '$.projected_worker_identity.baseRole') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.projected_worker_identity.baseRole'))) = 0
    OR json_type(NEW.payload, '$.projected_worker_identity.sessionKind') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.projected_worker_identity.sessionKind'))) = 0
    OR json_type(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID'))) = 0
    OR NOT (
      (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'delegated-worker'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'delegated-worker'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'delegated_worker')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'intent-analysis'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'intent-analysis'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'analyze_intent')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'requirements'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'requirements'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'requirements')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'architect'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'architect'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'architect')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'goal-workload-analyst'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'goal-workload-analyst'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'workload_analysis')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'build'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'build'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'build')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'explore'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'explore'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'explore')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'deep-research'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'deep-research'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'deep_research')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'frontend-research'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'frontend-research'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'frontend_research')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'frontend-design'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'frontend-design'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'frontend_design')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'visual-qa'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'visual-qa'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'visual_qa')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'integrity'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'integrity'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'integrity')
      OR (json_extract(NEW.payload, '$.projected_worker_identity.baseRole') = 'fact-check'
        AND json_extract(NEW.payload, '$.projected_worker_identity.sessionKind') = 'fact-check'
        AND json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterID') = 'fact_check')
    )
    OR json_type(NEW.payload, '$.projected_worker_identity.runtimeTemplateABIVersion') IS NOT 'integer'
    OR json_extract(NEW.payload, '$.projected_worker_identity.runtimeTemplateABIVersion') != 1
    OR json_type(NEW.payload, '$.projected_worker_identity.dispatchAdapterABIVersion') IS NOT 'integer'
    OR json_extract(NEW.payload, '$.projected_worker_identity.dispatchAdapterABIVersion') != 1
    OR json_type(NEW.payload, '$.projected_worker_identity.projectionHash') IS NOT 'text'
    OR length(json_extract(NEW.payload, '$.projected_worker_identity.projectionHash')) != 64
    OR json_extract(NEW.payload, '$.projected_worker_identity.projectionHash') GLOB '*[^0-9a-f]*'
    OR json_type(NEW.payload, '$.work_scope') IS NOT 'object'
    OR (SELECT count(*) FROM json_each(NEW.payload, '$.work_scope')) != 1
    OR json_extract(NEW.payload, '$.work_scope.kind') IS NOT 'task'
    OR json_extract(NEW.payload, '$.target_agent_id') IS NOT json_extract(NEW.payload, '$.projected_worker_identity.agentID')
    OR json_type(NEW.payload, '$.delivery_slice_revision_ids') IS NOT 'array'
    OR EXISTS (
      SELECT 1
      FROM json_each(NEW.payload, '$.delivery_slice_revision_ids') AS revision
      WHERE revision.type != 'text' OR substr(revision.value, 1, 3) != 'gol'
    )
    OR json_type(NEW.payload, '$.workflow_occurrence_id') IS NOT 'text'
    OR length(trim(json_extract(NEW.payload, '$.workflow_occurrence_id'))) = 0
    OR json_type(NEW.payload, '$.task_id') IS NOT 'text'
    OR json_extract(NEW.payload, '$.task_id') != NEW.task_id
    OR json_type(NEW.payload, '$.execution_epoch') IS NOT 'integer'
    OR json_extract(NEW.payload, '$.execution_epoch') NOT BETWEEN 1 AND 9007199254740991
    OR json_type(NEW.payload, '$.time_created') NOT IN ('integer','real')
    OR json_extract(NEW.payload, '$.time_created') <= 0
    OR json_extract(NEW.payload, '$.time_created') > 9007199254740991
    OR json_extract(NEW.payload, '$.time_created') IS NOT NEW.time_created
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: dispatch_lineage requires exact Tool occurrence, workflow lineage, adapter_input and delivery_owner objects');
END;

CREATE TRIGGER IF NOT EXISTS engine_dispatch_lineage_creator_occurrence_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'dispatch_lineage'
  AND NOT EXISTS (
    SELECT 1
    FROM tool_part_request request
    JOIN message creator
      ON creator.id = request.message_id
     AND creator.id = json_extract(NEW.payload, '$.orchestrator_message_id')
     AND creator.session_id = json_extract(NEW.payload, '$.orchestrator_session_id')
     AND json_extract(creator.data, '$.role') = 'assistant'
     AND json_extract(creator.data, '$.author') = 'orchestrator'
    JOIN engine_control_activation_lease activation
      ON activation.id = json_extract(creator.data, '$.activationID')
     AND activation.target = 'task_root_ingress'
    JOIN engine_task_root_ingress ingress
      ON ingress.id = activation.target_id
     AND ingress.task_id = NEW.task_id
     AND ingress.execution_epoch = json_extract(NEW.payload, '$.execution_epoch')
    WHERE request.id = json_extract(NEW.payload, '$.tool_part_id')
      AND json_extract(request.data, '$.callID') = json_extract(NEW.payload, '$.tool_call_id')
      AND json_extract(request.data, '$.tool') = json_extract(NEW.payload, '$.tool_name')
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: dispatch_lineage requires exact Task-root Tool creator occurrence');
END;

CREATE TRIGGER IF NOT EXISTS engine_dispatch_lineage_workflow_binding_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'dispatch_lineage'
  AND NOT (
    json_type(NEW.payload, '$.workflow_binding') = 'object'
    AND json_type(NEW.payload, '$.workflow_binding.package_revision') = 'object'
    AND (SELECT count(*) FROM json_each(NEW.payload, '$.workflow_binding.package_revision')) = 6
    AND json_extract(NEW.payload, '$.workflow_binding.package_revision.scope') IN ('built_in','project','global')
    AND (
      (
        json_extract(NEW.payload, '$.workflow_binding.package_revision.scope') = 'project'
        AND json_type(NEW.payload, '$.workflow_binding.package_revision.project_id') = 'text'
        AND length(trim(json_extract(NEW.payload, '$.workflow_binding.package_revision.project_id'))) > 0
      )
      OR (
        json_extract(NEW.payload, '$.workflow_binding.package_revision.scope') IN ('built_in','global')
        AND json_type(NEW.payload, '$.workflow_binding.package_revision.project_id') = 'null'
      )
    )
    AND json_type(NEW.payload, '$.workflow_binding.package_revision.namespace') = 'text'
    AND length(trim(json_extract(NEW.payload, '$.workflow_binding.package_revision.namespace'))) > 0
    AND json_type(NEW.payload, '$.workflow_binding.package_revision.id') = 'text'
    AND length(trim(json_extract(NEW.payload, '$.workflow_binding.package_revision.id'))) > 0
    AND json_type(NEW.payload, '$.workflow_binding.package_revision.version') = 'text'
    AND length(trim(json_extract(NEW.payload, '$.workflow_binding.package_revision.version'))) > 0
    AND json_type(NEW.payload, '$.workflow_binding.package_revision.package_digest') = 'text'
    AND length(json_extract(NEW.payload, '$.workflow_binding.package_revision.package_digest')) = 64
    AND json_extract(NEW.payload, '$.workflow_binding.package_revision.package_digest') NOT GLOB '*[^0-9a-f]*'
    AND (
      (
        json_extract(NEW.payload, '$.workflow_binding.kind') = 'direct'
        AND (SELECT count(*) FROM json_each(NEW.payload, '$.workflow_binding')) = 2
        AND json_type(NEW.payload, '$.workflow_node_id') = 'null'
      )
      OR (
        json_extract(NEW.payload, '$.workflow_binding.kind') = 'virtual_workflow'
        AND (SELECT count(*) FROM json_each(NEW.payload, '$.workflow_binding')) = 4
        AND json_type(NEW.payload, '$.workflow_binding.workflow_id') = 'text'
        AND length(trim(json_extract(NEW.payload, '$.workflow_binding.workflow_id'))) > 0
        AND json_type(NEW.payload, '$.workflow_binding.nodes') = 'array'
        AND json_array_length(json_extract(NEW.payload, '$.workflow_binding.nodes')) > 0
        AND NOT EXISTS (
          SELECT 1 FROM json_each(NEW.payload, '$.workflow_binding.nodes') AS node
          WHERE node.type != 'object'
            OR (SELECT count(*) FROM json_each(node.value)) != 3
            OR json_type(node.value, '$.node_id') != 'text'
            OR length(trim(json_extract(node.value, '$.node_id'))) = 0
            OR json_type(node.value, '$.agent_id') != 'text'
            OR length(trim(json_extract(node.value, '$.agent_id'))) = 0
            OR json_type(node.value, '$.depends_on') != 'array'
            OR EXISTS (SELECT 1 FROM json_each(node.value, '$.depends_on') WHERE type != 'text' OR length(trim(value)) = 0)
        )
        AND (
          SELECT count(*) FROM json_each(NEW.payload, '$.workflow_binding.nodes')
        ) = (
          SELECT count(DISTINCT json_extract(value, '$.node_id'))
          FROM json_each(NEW.payload, '$.workflow_binding.nodes')
        )
        AND json_type(NEW.payload, '$.workflow_node_id') = 'text'
        AND length(trim(json_extract(NEW.payload, '$.workflow_node_id'))) > 0
        AND EXISTS (
          SELECT 1 FROM json_each(NEW.payload, '$.workflow_binding.nodes') AS selected
          WHERE json_extract(selected.value, '$.node_id') = json_extract(NEW.payload, '$.workflow_node_id')
            AND json_extract(selected.value, '$.agent_id') = json_extract(NEW.payload, '$.target_agent_id')
        )
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: dispatch_lineage workflow binding is incomplete or selects the wrong target');
END;

CREATE TRIGGER IF NOT EXISTS engine_dispatch_lineage_source_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'dispatch_lineage'
  AND NOT (
    (
      json_type(NEW.payload, '$.continuation_of_dispatch_id') IS NULL
      AND json_type(NEW.payload, '$.coordination_action_id') IS NULL
      AND json_extract(NEW.payload, '$.workflow_occurrence_id') = json_extract(NEW.payload, '$.dispatch_id')
    )
    OR (
      json_type(NEW.payload, '$.continuation_of_dispatch_id') = 'text'
      AND length(trim(json_extract(NEW.payload, '$.continuation_of_dispatch_id'))) > 0
      AND json_type(NEW.payload, '$.coordination_action_id') IS NULL
      AND EXISTS (
        SELECT 1 FROM engine_artifact AS source
        WHERE source.task_id = NEW.task_id
          AND source.kind = 'dispatch_lineage'
          AND json_extract(source.payload, '$.dispatch_id') = json_extract(NEW.payload, '$.continuation_of_dispatch_id')
          AND json_extract(source.payload, '$.child_session_id') = json_extract(NEW.payload, '$.child_session_id')
          AND json_extract(source.payload, '$.target_agent_id') = json_extract(NEW.payload, '$.target_agent_id')
          AND json_extract(source.payload, '$.workflow_binding') = json_extract(NEW.payload, '$.workflow_binding')
          AND json_extract(source.payload, '$.workflow_node_id') IS json_extract(NEW.payload, '$.workflow_node_id')
          AND json_extract(source.payload, '$.workflow_occurrence_id') = json_extract(NEW.payload, '$.workflow_occurrence_id')
      )
    )
    OR (
      json_type(NEW.payload, '$.continuation_of_dispatch_id') = 'text'
      AND length(trim(json_extract(NEW.payload, '$.continuation_of_dispatch_id'))) > 0
      AND json_type(NEW.payload, '$.coordination_action_id') = 'text'
      AND length(trim(json_extract(NEW.payload, '$.coordination_action_id'))) > 0
      AND EXISTS (
        SELECT 1
        FROM engine_artifact AS action
        JOIN engine_artifact AS request
          ON request.task_id = action.task_id
          AND request.id = json_extract(action.payload, '$.request_id')
          AND request.kind = 'agent_coordination_request'
        JOIN engine_artifact AS source
          ON source.task_id = action.task_id
          AND source.id = json_extract(request.payload, '$.dispatch_lineage_id')
          AND source.kind = 'dispatch_lineage'
        WHERE action.task_id = NEW.task_id
          AND action.id = json_extract(NEW.payload, '$.coordination_action_id')
          AND action.kind = 'agent_coordination_action'
          AND json_extract(action.payload, '$.action') = 'redispatch_worker'
          AND json_extract(action.payload, '$.execution_epoch') = json_extract(NEW.payload, '$.execution_epoch')
          AND json_extract(action.payload, '$.execution_epoch') = (
            SELECT MAX(json_extract(opened.payload,'$.execution_epoch'))
            FROM protocol_event opened
            WHERE opened.aggregate_type='task'
              AND opened.aggregate_id=NEW.task_id
              AND opened.type IN ('task.execution.opened','task.execution.reopened')
          )
          AND NOT EXISTS (
            SELECT 1 FROM protocol_event boundary
            WHERE boundary.aggregate_type='task'
              AND boundary.aggregate_id=NEW.task_id
              AND boundary.type IN ('task.completed','task.failed','task.cancelled','task.deleted')
              AND (
                boundary.type='task.deleted'
                OR json_extract(boundary.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
              )
          )
          AND NOT EXISTS (
            SELECT 1 FROM engine_artifact outcome
            WHERE outcome.task_id=action.task_id
              AND outcome.kind='agent_coordination_action_outcome'
              AND json_extract(outcome.payload,'$.action_id')=action.id
              AND json_extract(outcome.payload,'$.status') IN ('completed','failed')
          )
          AND json_extract(action.payload, '$.target_session_id') = json_extract(NEW.payload, '$.child_session_id')
          AND json_extract(action.payload, '$.target_agent') = json_extract(NEW.payload, '$.target_agent_id')
          AND json_extract(request.payload, '$.session_id') = json_extract(NEW.payload, '$.child_session_id')
          AND json_extract(source.payload, '$.dispatch_id') = json_extract(NEW.payload, '$.continuation_of_dispatch_id')
          AND json_extract(source.payload, '$.child_session_id') = json_extract(NEW.payload, '$.child_session_id')
          AND json_extract(source.payload, '$.target_agent_id') = json_extract(NEW.payload, '$.target_agent_id')
          AND json_extract(source.payload, '$.workflow_binding') = json_extract(NEW.payload, '$.workflow_binding')
          AND json_extract(source.payload, '$.workflow_node_id') IS json_extract(NEW.payload, '$.workflow_node_id')
          AND json_extract(source.payload, '$.workflow_occurrence_id') = json_extract(NEW.payload, '$.workflow_occurrence_id')
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: dispatch_lineage source authority is incomplete or unrelated');
END;

CREATE TRIGGER IF NOT EXISTS engine_dispatch_lineage_immutable
BEFORE UPDATE ON engine_artifact
FOR EACH ROW
WHEN OLD.kind IN ('dispatch_lineage','dispatch_settlement','dispatch_delivery_disposition','task_root_ingress_disposition')
  OR NEW.kind IN ('dispatch_lineage','dispatch_settlement','dispatch_delivery_disposition','task_root_ingress_disposition')
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: scheduling occurrence facts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS engine_dispatch_settlement_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'dispatch_settlement'
  AND NOT (
    json_type(NEW.payload) = 'object'
    AND (SELECT COUNT(*) FROM json_each(NEW.payload)) = 6
    AND json_type(NEW.payload, '$.task_id') = 'text'
    AND json_extract(NEW.payload, '$.task_id') = NEW.task_id
    AND length(json_extract(NEW.payload, '$.task_id')) BETWEEN 1 AND 512
    AND json_type(NEW.payload, '$.dispatch_lineage_id') = 'text'
    AND length(json_extract(NEW.payload, '$.dispatch_lineage_id')) BETWEEN 1 AND 512
    AND json_type(NEW.payload, '$.dispatch_id') = 'text'
    AND length(json_extract(NEW.payload, '$.dispatch_id')) BETWEEN 1 AND 512
    AND json_type(NEW.payload, '$.session_id') = 'text'
    AND length(json_extract(NEW.payload, '$.session_id')) BETWEEN 1 AND 512
    AND json_type(NEW.payload, '$.time_created') = 'integer'
    AND json_extract(NEW.payload, '$.time_created') BETWEEN 1 AND 9007199254740991
    AND EXISTS (
      SELECT 1 FROM engine_artifact lineage
      WHERE lineage.id = json_extract(NEW.payload, '$.dispatch_lineage_id')
        AND lineage.task_id = NEW.task_id
        AND lineage.kind = 'dispatch_lineage'
        AND json_extract(lineage.payload, '$.dispatch_id') = json_extract(NEW.payload, '$.dispatch_id')
        AND json_extract(lineage.payload, '$.child_session_id') = json_extract(NEW.payload, '$.session_id')
    )
    AND json_type(NEW.payload, '$.outcome') = 'object'
    AND json_extract(NEW.payload, '$.outcome.kind') IN (
      'terminal_success','domain_incomplete','domain_blocked','coordination','partial','infrastructure_failure'
    )
    AND (
      json_extract(NEW.payload, '$.outcome.session_id') = json_extract(NEW.payload, '$.session_id')
      OR (
        json_extract(NEW.payload, '$.outcome.kind') = 'infrastructure_failure'
        AND json_type(NEW.payload, '$.outcome.session_id') IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM worker_turn_descriptor descriptor
          WHERE descriptor.session_id = json_extract(NEW.payload, '$.session_id')
            AND json_extract(descriptor.payload, '$.dispatchTurn.current_dispatch_id') = json_extract(NEW.payload, '$.dispatch_id')
        )
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM json_each(NEW.payload, '$.outcome') field
      WHERE field.key NOT IN (
        'kind','session_id','final_message_id','domain','domain_artifact','blocking_question',
        'coordination_request','dispatch_lineage_id','failed_operation','operation','message',
        'recovery_authority','error_name','failure_issues','infrastructure_error','worker_turn'
      )
    )
    AND (
      (
        json_extract(NEW.payload, '$.outcome.kind') = 'terminal_success'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome')) = 3
        AND json_type(NEW.payload, '$.outcome.final_message_id') = 'text'
        AND length(json_extract(NEW.payload, '$.outcome.session_id')) BETWEEN 1 AND 512
        AND length(json_extract(NEW.payload, '$.outcome.final_message_id')) BETWEEN 1 AND 512
      )
      OR (
        json_extract(NEW.payload, '$.outcome.kind') = 'domain_incomplete'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome')) = 5
        AND json_type(NEW.payload, '$.outcome.final_message_id') = 'text'
        AND json_type(NEW.payload, '$.outcome.domain') = 'text'
        AND length(json_extract(NEW.payload, '$.outcome.session_id')) BETWEEN 1 AND 512
        AND length(json_extract(NEW.payload, '$.outcome.final_message_id')) BETWEEN 1 AND 512
        AND length(json_extract(NEW.payload, '$.outcome.domain')) BETWEEN 1 AND 512
        AND json_type(NEW.payload, '$.outcome.domain_artifact') = 'object'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome.domain_artifact')) = 4
        AND json_extract(NEW.payload, '$.outcome.domain_artifact.source') = 'engine_artifact'
        AND json_type(NEW.payload, '$.outcome.domain_artifact.artifact_id') = 'text'
        AND length(json_extract(NEW.payload, '$.outcome.domain_artifact.artifact_id')) BETWEEN 1 AND 512
        AND json_type(NEW.payload, '$.outcome.domain_artifact.catalog_revision') = 'integer'
        AND json_extract(NEW.payload, '$.outcome.domain_artifact.catalog_revision') BETWEEN 1 AND 9007199254740991
        AND json_type(NEW.payload, '$.outcome.domain_artifact.expected_sha256') = 'text'
        AND length(json_extract(NEW.payload, '$.outcome.domain_artifact.expected_sha256')) = 64
        AND json_extract(NEW.payload, '$.outcome.domain_artifact.expected_sha256') NOT GLOB '*[^a-f0-9]*'
        AND NOT EXISTS (
          SELECT 1 FROM json_each(NEW.payload, '$.outcome.domain_artifact') field
          WHERE field.key NOT IN ('source','artifact_id','catalog_revision','expected_sha256')
        )
        AND EXISTS (
          SELECT 1 FROM engine_artifact domain_artifact
          WHERE domain_artifact.id = json_extract(NEW.payload, '$.outcome.domain_artifact.artifact_id')
            AND domain_artifact.task_id = NEW.task_id
            AND domain_artifact.catalog_revision = json_extract(NEW.payload, '$.outcome.domain_artifact.catalog_revision')
            AND domain_artifact.payload_sha256 = json_extract(NEW.payload, '$.outcome.domain_artifact.expected_sha256')
        )
      )
      OR (
        json_extract(NEW.payload, '$.outcome.kind') = 'domain_blocked'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome')) = 6
        AND json_type(NEW.payload, '$.outcome.final_message_id') = 'text'
        AND json_type(NEW.payload, '$.outcome.domain') = 'text'
        AND length(json_extract(NEW.payload, '$.outcome.session_id')) BETWEEN 1 AND 512
        AND length(json_extract(NEW.payload, '$.outcome.final_message_id')) BETWEEN 1 AND 512
        AND length(json_extract(NEW.payload, '$.outcome.domain')) BETWEEN 1 AND 512
        AND json_type(NEW.payload, '$.outcome.domain_artifact') = 'object'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome.domain_artifact')) = 4
        AND json_extract(NEW.payload, '$.outcome.domain_artifact.source') = 'engine_artifact'
        AND json_type(NEW.payload, '$.outcome.domain_artifact.artifact_id') = 'text'
        AND length(json_extract(NEW.payload, '$.outcome.domain_artifact.artifact_id')) BETWEEN 1 AND 512
        AND json_type(NEW.payload, '$.outcome.domain_artifact.catalog_revision') = 'integer'
        AND json_extract(NEW.payload, '$.outcome.domain_artifact.catalog_revision') BETWEEN 1 AND 9007199254740991
        AND json_type(NEW.payload, '$.outcome.domain_artifact.expected_sha256') = 'text'
        AND length(json_extract(NEW.payload, '$.outcome.domain_artifact.expected_sha256')) = 64
        AND json_extract(NEW.payload, '$.outcome.domain_artifact.expected_sha256') NOT GLOB '*[^a-f0-9]*'
        AND NOT EXISTS (
          SELECT 1 FROM json_each(NEW.payload, '$.outcome.domain_artifact') field
          WHERE field.key NOT IN ('source','artifact_id','catalog_revision','expected_sha256')
        )
        AND EXISTS (
          SELECT 1 FROM engine_artifact domain_artifact
          WHERE domain_artifact.id = json_extract(NEW.payload, '$.outcome.domain_artifact.artifact_id')
            AND domain_artifact.task_id = NEW.task_id
            AND domain_artifact.catalog_revision = json_extract(NEW.payload, '$.outcome.domain_artifact.catalog_revision')
            AND domain_artifact.payload_sha256 = json_extract(NEW.payload, '$.outcome.domain_artifact.expected_sha256')
        )
        AND json_type(NEW.payload, '$.outcome.blocking_question') = 'object'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome.blocking_question')) = 2
        AND json_type(NEW.payload, '$.outcome.blocking_question.request_id') = 'text'
        AND length(json_extract(NEW.payload, '$.outcome.blocking_question.request_id')) BETWEEN 5 AND 512
        AND substr(json_extract(NEW.payload, '$.outcome.blocking_question.request_id'),1,4) = 'que_'
        AND substr(json_extract(NEW.payload, '$.outcome.blocking_question.request_id'),5,1) GLOB '[A-Za-z0-9-]'
        AND substr(json_extract(NEW.payload, '$.outcome.blocking_question.request_id'),-1,1) GLOB '[A-Za-z0-9]'
        AND json_extract(NEW.payload, '$.outcome.blocking_question.request_id') NOT GLOB '*[^A-Za-z0-9._-]*'
        AND json_extract(NEW.payload, '$.outcome.blocking_question.status') IN ('rejected','expired')
        AND NOT EXISTS (
          SELECT 1 FROM json_each(NEW.payload, '$.outcome.blocking_question') field
          WHERE field.key NOT IN ('request_id','status')
        )
      )
      OR (
        json_extract(NEW.payload, '$.outcome.kind') = 'coordination'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome')) = 4
        AND json_extract(NEW.payload, '$.outcome.dispatch_lineage_id') = json_extract(NEW.payload, '$.dispatch_lineage_id')
        AND json_type(NEW.payload, '$.outcome.coordination_request') = 'object'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome.coordination_request')) = 2
        AND json_extract(NEW.payload, '$.outcome.coordination_request.source') = 'coordination_request'
        AND json_type(NEW.payload, '$.outcome.coordination_request.request_id') = 'text'
        AND length(json_extract(NEW.payload, '$.outcome.coordination_request.request_id')) BETWEEN 5 AND 512
        AND substr(json_extract(NEW.payload, '$.outcome.coordination_request.request_id'),1,4) = 'art_'
        AND substr(json_extract(NEW.payload, '$.outcome.coordination_request.request_id'),5,1) GLOB '[A-Za-z0-9-]'
        AND substr(json_extract(NEW.payload, '$.outcome.coordination_request.request_id'),-1,1) GLOB '[A-Za-z0-9]'
        AND json_extract(NEW.payload, '$.outcome.coordination_request.request_id') NOT GLOB '*[^A-Za-z0-9._-]*'
        AND NOT EXISTS (
          SELECT 1 FROM json_each(NEW.payload, '$.outcome.coordination_request') field
          WHERE field.key NOT IN ('source','request_id')
        )
      )
      OR (
        json_extract(NEW.payload, '$.outcome.kind') = 'partial'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome')) IN (4,5)
        AND json_type(NEW.payload, '$.outcome.final_message_id') = 'text'
        AND json_type(NEW.payload, '$.outcome.failed_operation') = 'text'
        AND length(json_extract(NEW.payload, '$.outcome.session_id')) BETWEEN 1 AND 512
        AND length(json_extract(NEW.payload, '$.outcome.final_message_id')) BETWEEN 1 AND 512
        AND length(json_extract(NEW.payload, '$.outcome.failed_operation')) BETWEEN 1 AND 512
        AND NOT EXISTS (
          SELECT 1 FROM json_each(NEW.payload, '$.outcome') field
          WHERE field.key NOT IN ('kind','session_id','final_message_id','failed_operation','infrastructure_error')
        )
        AND (
          json_type(NEW.payload, '$.outcome.infrastructure_error') IS NULL
          OR (
            json_type(NEW.payload, '$.outcome.infrastructure_error') = 'object'
            AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome.infrastructure_error')) = 4
            AND json_extract(NEW.payload, '$.outcome.infrastructure_error.source') = 'engine_artifact'
            AND json_type(NEW.payload, '$.outcome.infrastructure_error.artifact_id') = 'text'
            AND length(json_extract(NEW.payload, '$.outcome.infrastructure_error.artifact_id')) BETWEEN 1 AND 512
            AND json_type(NEW.payload, '$.outcome.infrastructure_error.catalog_revision') = 'integer'
            AND json_extract(NEW.payload, '$.outcome.infrastructure_error.catalog_revision') BETWEEN 1 AND 9007199254740991
            AND json_type(NEW.payload, '$.outcome.infrastructure_error.expected_sha256') = 'text'
            AND length(json_extract(NEW.payload, '$.outcome.infrastructure_error.expected_sha256')) = 64
            AND json_extract(NEW.payload, '$.outcome.infrastructure_error.expected_sha256') NOT GLOB '*[^a-f0-9]*'
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload, '$.outcome.infrastructure_error') field
              WHERE field.key NOT IN ('source','artifact_id','catalog_revision','expected_sha256')
            )
            AND EXISTS (
              SELECT 1 FROM engine_artifact source
              WHERE source.id = json_extract(NEW.payload, '$.outcome.infrastructure_error.artifact_id')
                AND source.task_id = NEW.task_id
                AND source.catalog_revision = json_extract(NEW.payload, '$.outcome.infrastructure_error.catalog_revision')
                AND source.payload_sha256 = json_extract(NEW.payload, '$.outcome.infrastructure_error.expected_sha256')
            )
          )
        )
      )
      OR (
        json_extract(NEW.payload, '$.outcome.kind') = 'infrastructure_failure'
        AND json_type(NEW.payload, '$.outcome.operation') = 'text'
        AND json_type(NEW.payload, '$.outcome.message') = 'text'
        AND length(json_extract(NEW.payload, '$.outcome.operation')) BETWEEN 1 AND 512
        AND length(json_extract(NEW.payload, '$.outcome.message')) BETWEEN 1 AND 4096
        AND length(json_extract(NEW.payload, '$.outcome.session_id')) BETWEEN 1 AND 512
        AND NOT EXISTS (
          SELECT 1 FROM json_each(NEW.payload, '$.outcome') field
          WHERE field.key NOT IN (
            'kind','operation','message','recovery_authority','session_id','final_message_id',
            'error_name','failure_issues','infrastructure_error','worker_turn'
          )
        )
        AND json_type(NEW.payload, '$.outcome.recovery_authority') = 'object'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome.recovery_authority')) = 3
        AND NOT EXISTS (
          SELECT 1 FROM json_each(NEW.payload, '$.outcome.recovery_authority') field
          WHERE field.key NOT IN ('occurrence_status','dispatch_lineage_id','dispatch_id')
        )
        AND json_extract(NEW.payload, '$.outcome.recovery_authority.occurrence_status') = 'occurrence_committed'
        AND json_extract(NEW.payload, '$.outcome.recovery_authority.dispatch_lineage_id')
          = json_extract(NEW.payload, '$.dispatch_lineage_id')
        AND json_extract(NEW.payload, '$.outcome.recovery_authority.dispatch_id')
          = json_extract(NEW.payload, '$.dispatch_id')
        AND (
          json_type(NEW.payload, '$.outcome.final_message_id') IS NULL
          OR (
            json_type(NEW.payload, '$.outcome.final_message_id') = 'text'
            AND length(json_extract(NEW.payload, '$.outcome.final_message_id')) BETWEEN 1 AND 512
          )
        )
        AND (
          json_type(NEW.payload, '$.outcome.error_name') IS NULL
          OR (
            json_type(NEW.payload, '$.outcome.error_name') = 'text'
            AND length(json_extract(NEW.payload, '$.outcome.error_name')) BETWEEN 1 AND 512
          )
        )
        AND (
          json_type(NEW.payload, '$.outcome.failure_issues') IS NULL
          OR (
            json_type(NEW.payload, '$.outcome.failure_issues') = 'array'
            AND json_array_length(NEW.payload, '$.outcome.failure_issues') > 0
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload, '$.outcome.failure_issues') issue
              WHERE json_type(issue.value) <> 'object'
                OR (SELECT COUNT(*) FROM json_each(issue.value)) NOT IN (2,3)
                OR EXISTS (
                  SELECT 1 FROM json_each(issue.value) field
                  WHERE field.key NOT IN ('code','path','message')
                )
                OR json_type(issue.value, '$.path') <> 'array'
                OR EXISTS (
                  SELECT 1 FROM json_each(issue.value, '$.path') segment
                  WHERE segment.type NOT IN ('text','integer')
                    OR (segment.type = 'integer' AND segment.atom NOT BETWEEN -9007199254740991 AND 9007199254740991)
                )
                OR json_type(issue.value, '$.message') <> 'text'
                OR length(json_extract(issue.value, '$.message')) NOT BETWEEN 1 AND 4096
                OR (
                  json_type(issue.value, '$.code') IS NOT NULL
                  AND (
                    json_type(issue.value, '$.code') <> 'text'
                    OR length(json_extract(issue.value, '$.code')) NOT BETWEEN 1 AND 512
                  )
                )
            )
          )
        )
        AND (
          json_type(NEW.payload, '$.outcome.worker_turn') IS NULL
          OR (
            json_type(NEW.payload, '$.outcome.worker_turn') = 'object'
            AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome.worker_turn')) IN (3,4)
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload, '$.outcome.worker_turn') field
              WHERE field.key NOT IN ('descriptor_id','descriptor_hash','input_message_id','current_dispatch_id')
            )
            AND json_type(NEW.payload, '$.outcome.worker_turn.descriptor_id') = 'text'
            AND length(json_extract(NEW.payload, '$.outcome.worker_turn.descriptor_id')) BETWEEN 1 AND 512
            AND json_type(NEW.payload, '$.outcome.worker_turn.descriptor_hash') = 'text'
            AND length(json_extract(NEW.payload, '$.outcome.worker_turn.descriptor_hash')) BETWEEN 1 AND 512
            AND json_type(NEW.payload, '$.outcome.worker_turn.input_message_id') = 'text'
            AND length(json_extract(NEW.payload, '$.outcome.worker_turn.input_message_id')) BETWEEN 1 AND 512
            AND (
              json_type(NEW.payload, '$.outcome.worker_turn.current_dispatch_id') IS NULL
              OR (
                json_type(NEW.payload, '$.outcome.worker_turn.current_dispatch_id') = 'text'
                AND length(json_extract(NEW.payload, '$.outcome.worker_turn.current_dispatch_id')) BETWEEN 1 AND 512
              )
            )
          )
        )
        AND (
          json_type(NEW.payload, '$.outcome.infrastructure_error') IS NULL
          OR (
            json_type(NEW.payload, '$.outcome.infrastructure_error') = 'object'
            AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.outcome.infrastructure_error')) = 4
            AND json_extract(NEW.payload, '$.outcome.infrastructure_error.source') = 'engine_artifact'
            AND json_type(NEW.payload, '$.outcome.infrastructure_error.artifact_id') = 'text'
            AND length(json_extract(NEW.payload, '$.outcome.infrastructure_error.artifact_id')) BETWEEN 1 AND 512
            AND json_type(NEW.payload, '$.outcome.infrastructure_error.catalog_revision') = 'integer'
            AND json_extract(NEW.payload, '$.outcome.infrastructure_error.catalog_revision') BETWEEN 1 AND 9007199254740991
            AND json_type(NEW.payload, '$.outcome.infrastructure_error.expected_sha256') = 'text'
            AND length(json_extract(NEW.payload, '$.outcome.infrastructure_error.expected_sha256')) = 64
            AND json_extract(NEW.payload, '$.outcome.infrastructure_error.expected_sha256') NOT GLOB '*[^a-f0-9]*'
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload, '$.outcome.infrastructure_error') field
              WHERE field.key NOT IN ('source','artifact_id','catalog_revision','expected_sha256')
            )
            AND EXISTS (
              SELECT 1 FROM engine_artifact source
              WHERE source.id = json_extract(NEW.payload, '$.outcome.infrastructure_error.artifact_id')
                AND source.task_id = NEW.task_id
                AND source.kind = 'task-infrastructure-error'
                AND source.catalog_revision = json_extract(NEW.payload, '$.outcome.infrastructure_error.catalog_revision')
                AND source.payload_sha256 = json_extract(NEW.payload, '$.outcome.infrastructure_error.expected_sha256')
            )
          )
        )
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: dispatch settlement requires exact final outcome and lineage authority');
END;

CREATE TRIGGER IF NOT EXISTS engine_dispatch_delivery_disposition_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'dispatch_delivery_disposition'
  AND NOT (
    json_type(NEW.payload) = 'object'
    AND (SELECT COUNT(*) FROM json_each(NEW.payload)) = 8
    AND json_type(NEW.payload, '$.task_id') = 'text'
    AND json_extract(NEW.payload, '$.task_id') = NEW.task_id
    AND json_type(NEW.payload, '$.dispatch_lineage_id') = 'text'
    AND json_type(NEW.payload, '$.dispatch_id') = 'text'
    AND json_type(NEW.payload, '$.infrastructure_source_artifact_id') = 'text'
    AND json_type(NEW.payload, '$.execution_epoch') = 'integer'
    AND json_extract(NEW.payload, '$.execution_epoch') BETWEEN 1 AND 9007199254740991
    AND json_type(NEW.payload, '$.budget_artifact_id') = 'text'
    AND json_extract(NEW.payload, '$.disposition') = 'budget_suppressed'
    AND json_type(NEW.payload, '$.time_created') = 'integer'
    AND json_extract(NEW.payload, '$.time_created') BETWEEN 1 AND 9007199254740991
    AND EXISTS (
      SELECT 1 FROM engine_artifact lineage
      WHERE lineage.id = json_extract(NEW.payload, '$.dispatch_lineage_id')
        AND lineage.task_id = NEW.task_id
        AND lineage.kind = 'dispatch_lineage'
        AND json_extract(lineage.payload, '$.dispatch_id') = json_extract(NEW.payload, '$.dispatch_id')
    )
    AND EXISTS (
      SELECT 1 FROM engine_artifact source
      WHERE source.id = json_extract(NEW.payload, '$.infrastructure_source_artifact_id')
        AND source.task_id = NEW.task_id
        AND source.kind = 'task-infrastructure-error'
    )
    AND EXISTS (
      SELECT 1 FROM engine_artifact settlement
      JOIN engine_artifact lineage
        ON lineage.id = json_extract(NEW.payload, '$.dispatch_lineage_id')
       AND lineage.task_id = NEW.task_id
       AND lineage.kind = 'dispatch_lineage'
      JOIN engine_artifact settlement_source
        ON settlement_source.id = json_extract(NEW.payload, '$.infrastructure_source_artifact_id')
       AND settlement_source.task_id = NEW.task_id
       AND settlement_source.kind = 'task-infrastructure-error'
      WHERE settlement.task_id = NEW.task_id
        AND settlement.kind = 'dispatch_settlement'
        AND json_extract(settlement.payload, '$.dispatch_id') = json_extract(NEW.payload, '$.dispatch_id')
        AND json_extract(settlement.payload, '$.dispatch_lineage_id') = json_extract(NEW.payload, '$.dispatch_lineage_id')
        AND json_extract(settlement.payload, '$.session_id') = json_extract(lineage.payload, '$.child_session_id')
        AND json_extract(settlement.payload, '$.outcome.kind') = 'infrastructure_failure'
        AND json_extract(settlement.payload, '$.outcome.recovery_authority.occurrence_status') = 'occurrence_committed'
        AND json_extract(settlement.payload, '$.outcome.recovery_authority.dispatch_lineage_id')
          = json_extract(NEW.payload, '$.dispatch_lineage_id')
        AND json_extract(settlement.payload, '$.outcome.recovery_authority.dispatch_id')
          = json_extract(NEW.payload, '$.dispatch_id')
        AND json_extract(settlement.payload, '$.outcome.infrastructure_error.artifact_id') = json_extract(NEW.payload, '$.infrastructure_source_artifact_id')
        AND json_extract(settlement.payload, '$.outcome.infrastructure_error.source') = 'engine_artifact'
        AND json_extract(settlement.payload, '$.outcome.infrastructure_error.catalog_revision') = settlement_source.catalog_revision
        AND json_extract(settlement.payload, '$.outcome.infrastructure_error.expected_sha256') = settlement_source.payload_sha256
    )
    AND EXISTS (
      SELECT 1 FROM engine_artifact budget
      WHERE budget.id = json_extract(NEW.payload, '$.budget_artifact_id')
        AND budget.task_id = NEW.task_id
        AND budget.kind = 'task-infrastructure-error'
        AND json_extract(budget.payload, '$.operation') = 'infrastructure-failure-budget-exhausted'
        AND json_extract(budget.payload, '$.context.epoch') = json_extract(NEW.payload, '$.execution_epoch')
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: dispatch delivery disposition requires exact lineage, settlement, source, epoch, and budget authority');
END;

CREATE TRIGGER IF NOT EXISTS engine_task_root_ingress_disposition_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'task_root_ingress_disposition'
  AND NOT (
    WITH dispatch_receipts AS (
      SELECT request.id, (WITH dispatch_output AS (SELECT (CASE WHEN json_type(outcome.data, '$.resultAttemptID') = 'text' THEN (
    SELECT CASE WHEN json_extract(receipt.result, '$.kind') = 'json' THEN
      CASE WHEN json_type(receipt.result, '$.value.output') = 'text' THEN json_extract(receipt.result, '$.value.output')
        WHEN json_type(receipt.result, '$.value.text') = 'text' THEN json_extract(receipt.result, '$.value.text')
        ELSE json_extract(receipt.result, '$.value') END
      END
    FROM permission_execution_result receipt
    WHERE receipt.attempt_id = json_extract(outcome.data, '$.resultAttemptID')
  ) ELSE json_extract(outcome.data, '$.output') END) AS value),
    dispatch_members AS (
      SELECT member.value, member.type,
        CASE WHEN member.type='object' THEN CASE WHEN json_type(member.value,'$.outcome')='object' THEN EXISTS (
    SELECT 1 FROM engine_artifact lineage
    WHERE lineage.task_id = NEW.task_id AND lineage.kind = 'dispatch_lineage'
      AND json_extract(lineage.payload, '$.tool_part_id') = request.id
      AND json_extract(lineage.payload, '$.tool_call_id') = json_extract(request.data, '$.callID')
      AND json_extract(lineage.payload, '$.child_session_id') = json_extract(json_extract(member.value, '$.outcome'), '$.session_id')
      AND json_extract(lineage.payload, '$.collection_member_index') = json_extract(member.value, '$.member_index')
        AND json_extract(lineage.payload, '$.target_agent_id') = json_extract(member.value, '$.target')
      AND (
        (json_extract(json_extract(member.value, '$.outcome'), '$.kind') = 'accepted'
          AND (SELECT COUNT(*) FROM json_each(json_extract(member.value, '$.outcome'))) = 3
          AND json_type(json_extract(member.value, '$.outcome'), '$.session_id') = 'text'
          AND json_type(json_extract(member.value, '$.outcome'), '$.dispatch_lineage_id') = 'text'
          AND json_extract(json_extract(member.value, '$.outcome'), '$.dispatch_lineage_id') = lineage.id
          AND EXISTS (SELECT 1 FROM worker_turn_descriptor descriptor
            WHERE descriptor.session_id = json_extract(json_extract(member.value, '$.outcome'), '$.session_id')
              AND json_extract(descriptor.payload, '$.dispatchTurn.current_dispatch_id') = json_extract(lineage.payload, '$.dispatch_id')))
        OR (json_extract(json_extract(member.value, '$.outcome'), '$.kind') IN ('terminal_success','domain_incomplete','domain_blocked','coordination','partial')
          AND EXISTS (SELECT 1 FROM engine_artifact settlement
            WHERE settlement.task_id = NEW.task_id AND settlement.kind = 'dispatch_settlement'
              AND json_extract(settlement.payload, '$.dispatch_lineage_id') = lineage.id
              AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(json_extract(member.value, '$.outcome')) EXCEPT SELECT fullkey,type,atom FROM json_tree(json_extract(settlement.payload, '$.outcome')))
              AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(json_extract(settlement.payload, '$.outcome')) EXCEPT SELECT fullkey,type,atom FROM json_tree(json_extract(member.value, '$.outcome')))))
      )
  ) ELSE 0 END ELSE 0 END AS witnessed,
        CASE WHEN member.type='object' THEN CASE WHEN json_type(member.value,'$.outcome')='object' THEN EXISTS (SELECT 1 FROM engine_artifact settled
    WHERE settled.task_id=NEW.task_id AND settled.kind='dispatch_settlement'
      AND json_extract(settled.payload,'$.dispatch_lineage_id')=json_extract(json_extract(member.value, '$.outcome'),'$.recovery_authority.dispatch_lineage_id')
      AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(json_extract(member.value, '$.outcome')) EXCEPT SELECT fullkey,type,atom FROM json_tree(json_extract(settled.payload,'$.outcome')))
      AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(json_extract(settled.payload,'$.outcome')) EXCEPT SELECT fullkey,type,atom FROM json_tree(json_extract(member.value, '$.outcome')))) ELSE 0 END ELSE 0 END AS settled,
        CASE WHEN member.type='object' THEN CASE WHEN json_type(member.value,'$.outcome')='object' THEN (json_type(json_extract(member.value, '$.outcome'))='object'
    AND json_extract(json_extract(member.value, '$.outcome'),'$.kind')='infrastructure_failure'
    AND (json_type(json_extract(member.value, '$.outcome'), '$.operation')='text' AND length(json_extract(json_extract(member.value, '$.outcome'), '$.operation')) BETWEEN 1 AND 512) AND (json_type(json_extract(member.value, '$.outcome'), '$.message')='text' AND length(json_extract(json_extract(member.value, '$.outcome'), '$.message')) BETWEEN 1 AND 4096)
    AND json_type(json_extract(member.value, '$.outcome'),'$.recovery_authority')='object'
    AND (SELECT COUNT(*) FROM json_each(json_extract(member.value, '$.outcome'),'$.recovery_authority'))=1
    AND json_extract(json_extract(member.value, '$.outcome'),'$.recovery_authority.occurrence_status')='occurrence_not_committed'
    AND NOT EXISTS (SELECT 1 FROM json_each(json_extract(member.value, '$.outcome')) f WHERE f.key NOT IN ('kind','operation','message','recovery_authority','session_id','final_message_id','error_name','failure_issues','infrastructure_error','worker_turn'))
    AND (json_type(json_extract(member.value, '$.outcome'), '$.session_id') IS NULL OR (json_type(json_extract(member.value, '$.outcome'), '$.session_id')='text' AND length(json_extract(json_extract(member.value, '$.outcome'), '$.session_id')) BETWEEN 1 AND 512)) AND (json_type(json_extract(member.value, '$.outcome'), '$.final_message_id') IS NULL OR (json_type(json_extract(member.value, '$.outcome'), '$.final_message_id')='text' AND length(json_extract(json_extract(member.value, '$.outcome'), '$.final_message_id')) BETWEEN 1 AND 512)) AND (json_type(json_extract(member.value, '$.outcome'), '$.error_name') IS NULL OR (json_type(json_extract(member.value, '$.outcome'), '$.error_name')='text' AND length(json_extract(json_extract(member.value, '$.outcome'), '$.error_name')) BETWEEN 1 AND 512))
    AND (json_type(json_extract(member.value, '$.outcome'),'$.failure_issues') IS NULL OR (json_type(json_extract(member.value, '$.outcome'),'$.failure_issues')='array' AND json_array_length(json_extract(member.value, '$.outcome'),'$.failure_issues')>0
      AND NOT EXISTS (SELECT 1 FROM json_each(json_extract(member.value, '$.outcome'),'$.failure_issues') issue WHERE NOT COALESCE((json_type(issue.value)='object'
        AND NOT EXISTS (SELECT 1 FROM json_each(issue.value) f WHERE f.key NOT IN ('code','path','message'))
        AND (json_type(issue.value, '$.code') IS NULL OR (json_type(issue.value, '$.code')='text' AND length(json_extract(issue.value, '$.code')) BETWEEN 1 AND 512)) AND (json_type(issue.value, '$.message')='text' AND length(json_extract(issue.value, '$.message')) BETWEEN 1 AND 4096)
        AND json_type(issue.value,'$.path')='array'
        AND NOT EXISTS (SELECT 1 FROM json_each(issue.value,'$.path') p WHERE p.type NOT IN ('text','integer') OR (p.type='integer' AND p.atom NOT BETWEEN -9007199254740991 AND 9007199254740991))),0))))
    AND (json_type(json_extract(member.value, '$.outcome'),'$.worker_turn') IS NULL OR (json_type(json_extract(member.value, '$.outcome'),'$.worker_turn')='object'
      AND NOT EXISTS (SELECT 1 FROM json_each(json_extract(member.value, '$.outcome'),'$.worker_turn') f WHERE f.key NOT IN ('descriptor_id','descriptor_hash','input_message_id','current_dispatch_id'))
      AND (json_type(json_extract(member.value, '$.outcome'), '$.worker_turn.descriptor_id')='text' AND length(json_extract(json_extract(member.value, '$.outcome'), '$.worker_turn.descriptor_id')) BETWEEN 1 AND 512) AND (json_type(json_extract(member.value, '$.outcome'), '$.worker_turn.descriptor_hash')='text' AND length(json_extract(json_extract(member.value, '$.outcome'), '$.worker_turn.descriptor_hash')) BETWEEN 1 AND 512) AND (json_type(json_extract(member.value, '$.outcome'), '$.worker_turn.input_message_id')='text' AND length(json_extract(json_extract(member.value, '$.outcome'), '$.worker_turn.input_message_id')) BETWEEN 1 AND 512)
      AND (json_type(json_extract(member.value, '$.outcome'), '$.worker_turn.current_dispatch_id') IS NULL OR (json_type(json_extract(member.value, '$.outcome'), '$.worker_turn.current_dispatch_id')='text' AND length(json_extract(json_extract(member.value, '$.outcome'), '$.worker_turn.current_dispatch_id')) BETWEEN 1 AND 512))))
    AND (json_type(json_extract(member.value, '$.outcome'),'$.infrastructure_error') IS NULL OR (json_type(json_extract(member.value, '$.outcome'),'$.infrastructure_error')='object'
      AND (SELECT COUNT(*) FROM json_each(json_extract(member.value, '$.outcome'),'$.infrastructure_error'))=4
      AND json_extract(json_extract(member.value, '$.outcome'),'$.infrastructure_error.source')='engine_artifact'
      AND (json_type(json_extract(member.value, '$.outcome'), '$.infrastructure_error.artifact_id')='text' AND length(json_extract(json_extract(member.value, '$.outcome'), '$.infrastructure_error.artifact_id')) BETWEEN 1 AND 512)
      AND json_type(json_extract(member.value, '$.outcome'),'$.infrastructure_error.catalog_revision')='integer' AND json_extract(json_extract(member.value, '$.outcome'),'$.infrastructure_error.catalog_revision') BETWEEN 1 AND 9007199254740991
      AND json_type(json_extract(member.value, '$.outcome'),'$.infrastructure_error.expected_sha256')='text'
      AND length(json_extract(json_extract(member.value, '$.outcome'),'$.infrastructure_error.expected_sha256'))=64
      AND json_extract(json_extract(member.value, '$.outcome'),'$.infrastructure_error.expected_sha256') NOT GLOB '*[^a-f0-9]*'))) ELSE 0 END ELSE 0 END AS uncommitted_failure
      FROM dispatch_output, json_each(CASE WHEN json_valid(dispatch_output.value) THEN dispatch_output.value ELSE '{}' END,'$.members') member
    ),
    dispatch_member_shapes AS (SELECT (CASE WHEN member.type='object' THEN (json_type(member.value)='object' AND (SELECT COUNT(*) FROM json_each(member.value))=5
    AND json_type(member.value,'$.member_index')='integer' AND json_extract(member.value,'$.member_index') BETWEEN 0 AND 9007199254740991
    AND (json_type(member.value, '$.name')='text' AND length(json_extract(member.value, '$.name')) BETWEEN 1 AND 9007199254740991) AND (json_type(member.value, '$.target')='text' AND length(json_extract(member.value, '$.target')) BETWEEN 1 AND 9007199254740991)
    AND ((json_extract(member.value,'$.status')='completed' AND CASE WHEN json_type(member.value,'$.outcome')='object' THEN (member.witnessed OR member.settled OR member.uncommitted_failure) ELSE 0 END)
      OR (json_extract(member.value,'$.status')='failed' AND json_type(member.value,'$.failure')='object'
        AND (json_type(member.value, '$.failure.kind')='text' AND length(json_extract(member.value, '$.failure.kind')) BETWEEN 1 AND 9007199254740991) AND (json_type(member.value, '$.failure.name')='text' AND length(json_extract(member.value, '$.failure.name')) BETWEEN 1 AND 9007199254740991) AND (json_type(member.value, '$.failure.message')='text' AND length(json_extract(member.value, '$.failure.message')) BETWEEN 1 AND 9007199254740991) AND (json_type(member.value, '$.failure.originSite')='text' AND length(json_extract(member.value, '$.failure.originSite')) BETWEEN 1 AND 9007199254740991)
        AND json_extract(member.value,'$.failure.classification') IN ('tool-input-invalid','tool-execution','llm-activity','processor-contract')
        AND (json_type(member.value,'$.failure.data') IS NULL OR json_type(member.value,'$.failure.data')='object')))) ELSE 0 END) AS valid FROM dispatch_members member)
    SELECT CASE WHEN json_valid(dispatch_output.value) THEN CASE json_extract(request.data, '$.tool')
    WHEN 'dispatch_agent' THEN EXISTS (
    SELECT 1 FROM engine_artifact lineage
    WHERE lineage.task_id = NEW.task_id AND lineage.kind = 'dispatch_lineage'
      AND json_extract(lineage.payload, '$.tool_part_id') = request.id
      AND json_extract(lineage.payload, '$.tool_call_id') = json_extract(request.data, '$.callID')
      AND json_extract(lineage.payload, '$.child_session_id') = json_extract(dispatch_output.value, '$.session_id')
      
      AND (
        (json_extract(dispatch_output.value, '$.kind') = 'accepted'
          AND (SELECT COUNT(*) FROM json_each(dispatch_output.value)) = 3
          AND json_type(dispatch_output.value, '$.session_id') = 'text'
          AND json_type(dispatch_output.value, '$.dispatch_lineage_id') = 'text'
          AND json_extract(dispatch_output.value, '$.dispatch_lineage_id') = lineage.id
          AND EXISTS (SELECT 1 FROM worker_turn_descriptor descriptor
            WHERE descriptor.session_id = json_extract(dispatch_output.value, '$.session_id')
              AND json_extract(descriptor.payload, '$.dispatchTurn.current_dispatch_id') = json_extract(lineage.payload, '$.dispatch_id')))
        OR (json_extract(dispatch_output.value, '$.kind') IN ('terminal_success','domain_incomplete','domain_blocked','coordination','partial')
          AND EXISTS (SELECT 1 FROM engine_artifact settlement
            WHERE settlement.task_id = NEW.task_id AND settlement.kind = 'dispatch_settlement'
              AND json_extract(settlement.payload, '$.dispatch_lineage_id') = lineage.id
              AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(dispatch_output.value) EXCEPT SELECT fullkey,type,atom FROM json_tree(json_extract(settlement.payload, '$.outcome')))
              AND NOT EXISTS (SELECT fullkey,type,atom FROM json_tree(json_extract(settlement.payload, '$.outcome')) EXCEPT SELECT fullkey,type,atom FROM json_tree(dispatch_output.value))))
      )
  )
    WHEN 'dispatch_agents' THEN CASE WHEN json_type(dispatch_output.value,'$.members')='array'
      AND NOT EXISTS (SELECT 1 FROM dispatch_member_shapes WHERE NOT COALESCE(valid,0))
      THEN EXISTS (
        SELECT 1 FROM dispatch_members member
        WHERE json_extract(member.value, '$.status') = 'completed'
          AND json_extract(member.value, '$.name') = json_extract(request.data, '$.input.team[' || json_extract(member.value, '$.member_index') || '].name')
          AND member.witnessed
      ) ELSE 0 END ELSE 0 END ELSE 0 END FROM dispatch_output) AS accepted
      FROM tool_part_request request
      JOIN tool_part_outcome outcome ON outcome.request_part_id = request.id
      WHERE request.message_id = json_extract(NEW.payload, '$.decision_occurrence.assistant_message_id')
    )
    SELECT
    json_type(NEW.payload) = 'object'
    AND (SELECT COUNT(*) FROM json_each(NEW.payload)) = CASE
      WHEN json_extract(NEW.payload, '$.disposition') = 'resolved' THEN 7
      ELSE 6
    END
    AND json_type(NEW.payload, '$.task_id') = 'text'
    AND json_extract(NEW.payload, '$.task_id') = NEW.task_id
    AND json_type(NEW.payload, '$.ingress_id') = 'text'
    AND length(json_extract(NEW.payload, '$.ingress_id')) = 24
    AND substr(json_extract(NEW.payload, '$.ingress_id'), 1, 5) = 'art_h'
    AND substr(json_extract(NEW.payload, '$.ingress_id'), 6) NOT GLOB '*[^A-Za-z0-9]*'
    AND json_type(NEW.payload, '$.execution_epoch') = 'integer'
    AND json_extract(NEW.payload, '$.execution_epoch') BETWEEN 1 AND 9007199254740991
    AND json_extract(NEW.payload, '$.disposition') IN ('resolved','terminal_inapplicable','exhausted','operator_abandoned','input_rejected')
    AND json_type(NEW.payload, '$.evidence_ids') = 'array'
    AND json_array_length(NEW.payload, '$.evidence_ids') > 0
    AND NOT EXISTS (
      SELECT 1 FROM json_each(NEW.payload, '$.evidence_ids') evidence
      WHERE evidence.type IS NOT 'text' OR length(evidence.value) = 0
    )
    AND json_type(NEW.payload, '$.time_created') = 'integer'
    AND json_extract(NEW.payload, '$.time_created') BETWEEN 1 AND 9007199254740991
    AND EXISTS (
      SELECT 1 FROM engine_task_root_ingress ingress
      WHERE ingress.id = json_extract(NEW.payload, '$.ingress_id')
        AND ingress.task_id = NEW.task_id
        AND ingress.execution_epoch = json_extract(NEW.payload, '$.execution_epoch')
    )
    AND (
      (
        json_extract(NEW.payload, '$.disposition') = 'resolved'
        AND json_type(NEW.payload, '$.decision_occurrence') = 'object'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload, '$.decision_occurrence')) = 4
        AND json_type(NEW.payload, '$.decision_occurrence.assistant_message_id') = 'text'
        AND json_type(NEW.payload, '$.decision_occurrence.control_message_id') = 'text'
        AND json_type(NEW.payload, '$.decision_occurrence.predecessor_id') = 'text'
        AND length(json_extract(NEW.payload, '$.decision_occurrence.predecessor_id')) = 24
        AND substr(json_extract(NEW.payload, '$.decision_occurrence.predecessor_id'), 1, 4) IN ('art_','msg_')
        AND substr(json_extract(NEW.payload, '$.decision_occurrence.predecessor_id'), 5, 1) IN ('g','h','-')
        AND substr(json_extract(NEW.payload, '$.decision_occurrence.predecessor_id'), 6) NOT GLOB '*[^A-Za-z0-9]*'
        AND json_type(NEW.payload, '$.decision_occurrence.activation_id') = 'text'
        AND (SELECT COUNT(DISTINCT value) FROM json_each(NEW.payload, '$.evidence_ids'))
          = json_array_length(NEW.payload, '$.evidence_ids')
        AND NOT EXISTS (
          SELECT 1 FROM json_each(NEW.payload, '$.evidence_ids') evidence
          WHERE NOT EXISTS (
            SELECT 1
            FROM tool_part_request request
            JOIN tool_part_outcome outcome ON outcome.request_part_id = request.id
            JOIN message assistant ON assistant.id = request.message_id
            JOIN message control
              ON control.id = json_extract(assistant.data, '$.parentID')
             AND control.session_id = assistant.session_id
            JOIN engine_control_activation_lease activation
              ON activation.id = json_extract(assistant.data, '$.activationID')
             AND activation.target = 'task_root_ingress'
             AND activation.target_id = json_extract(NEW.payload, '$.ingress_id')
            JOIN engine_task task ON task.id = NEW.task_id
            JOIN session orchestrator
              ON orchestrator.id = assistant.session_id
             AND orchestrator.parent_id = task.session_id
             AND orchestrator.project_id = task.project_id
             AND orchestrator.kind = 'orchestrator'
            WHERE request.id = evidence.value
              AND request.message_id = json_extract(NEW.payload, '$.decision_occurrence.assistant_message_id')
              AND assistant.id = json_extract(NEW.payload, '$.decision_occurrence.assistant_message_id')
              AND json_extract(assistant.data, '$.role') = 'assistant'
              AND json_extract(assistant.data, '$.author') = 'orchestrator'
              AND json_extract(assistant.data, '$.parentID')
                = json_extract(NEW.payload, '$.decision_occurrence.control_message_id')
              AND json_extract(assistant.data, '$.activationID')
                = json_extract(NEW.payload, '$.decision_occurrence.activation_id')
              AND json_extract(outcome.data, '$.outcome') = 'completed'
              AND json_type(assistant.data, '$.time.completed') IN ('integer','real')
              AND control.id = json_extract(NEW.payload, '$.decision_occurrence.control_message_id')
              AND control.id = 'msg_task-root-control_'
                || json_extract(NEW.payload, '$.ingress_id')
                || '_'
                || json_extract(NEW.payload, '$.decision_occurrence.predecessor_id')
              AND json_extract(control.data, '$.role') = 'user'
              AND json_extract(control.data, '$.author') = 'orchestrator'
              AND json_extract(control.data, '$.agent') = 'orchestrator'
              AND json_extract(control.data, '$.extra.orchestrator_control_ingress.ingress_id')
                = json_extract(NEW.payload, '$.ingress_id')
              AND json_extract(control.data, '$.extra.orchestrator_control_ingress.predecessor_id')
                = json_extract(NEW.payload, '$.decision_occurrence.predecessor_id')
              AND activation.id = json_extract(NEW.payload, '$.decision_occurrence.activation_id')
              AND (
                json_extract(request.data, '$.tool') IN ('no_action','wait')
                OR (SELECT accepted FROM dispatch_receipts WHERE id = request.id)
                OR (
                  json_extract(request.data, '$.tool') = 'manage_task'
                  AND json_extract(request.data, '$.input.action') NOT IN ('add_goal','modify_goal','delete_goal')
                  AND json_type(request.data, '$.input.goal') IS NULL
                  AND json_type(request.data, '$.input.goalID') IS NULL
                  AND json_type(request.data, '$.input.updates') IS NULL
                )
                OR (
                  json_extract(request.data, '$.tool') = 'respond_agent_coordination'
                  AND json_extract(request.data, '$.input.decision') IN ('cancel_worker','fail_task','acknowledge_terminal')
                )
              )
          )
        )
        AND (
          json_array_length(NEW.payload, '$.evidence_ids') = 1
          OR NOT EXISTS (
            SELECT 1
            FROM json_each(NEW.payload, '$.evidence_ids') evidence
            JOIN tool_part_request request ON request.id = evidence.value
            WHERE json_extract(request.data, '$.tool') != 'dispatch_agent'
          )
        )
        AND (
          SELECT COUNT(DISTINCT request.message_id)
          FROM json_each(NEW.payload, '$.evidence_ids') evidence
          JOIN tool_part_request request ON request.id = evidence.value
        ) = 1
        AND NOT EXISTS (
          SELECT 1 FROM message conflicting_assistant
          WHERE conflicting_assistant.id != json_extract(NEW.payload, '$.decision_occurrence.assistant_message_id')
            AND json_extract(conflicting_assistant.data, '$.role') = 'assistant'
            AND (
              json_extract(conflicting_assistant.data, '$.activationID')
                = json_extract(NEW.payload, '$.decision_occurrence.activation_id')
              OR (
                conflicting_assistant.session_id = (
                  SELECT assistant.session_id FROM message assistant
                  WHERE assistant.id = json_extract(NEW.payload, '$.decision_occurrence.assistant_message_id')
                )
                AND EXISTS (
                  SELECT 1 FROM engine_control_activation_lease conflicting_activation
                  WHERE conflicting_activation.id = json_extract(conflicting_assistant.data, '$.activationID')
                    AND conflicting_activation.target = 'task_root_ingress'
                    AND conflicting_activation.target_id = json_extract(NEW.payload, '$.ingress_id')
                )
                AND json_extract(conflicting_assistant.data, '$.parentID')
                  = json_extract(NEW.payload, '$.decision_occurrence.control_message_id')
              )
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM tool_part_request malformed
          JOIN tool_part_outcome malformed_outcome ON malformed_outcome.request_part_id = malformed.id
          WHERE malformed.message_id = json_extract(NEW.payload, '$.decision_occurrence.assistant_message_id')
            AND json_extract(malformed_outcome.data, '$.outcome') = 'completed'
            AND json_extract(malformed.data, '$.tool') = 'respond_agent_coordination'
            AND (
              json_type(malformed.data, '$.input') IS NOT 'object'
              OR COALESCE(
                json_extract(malformed.data, '$.input.decision') NOT IN (
                  'cancel_worker','redispatch','fail_task','ask_user','acknowledge_terminal'
                ),
                1
              )
            )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM tool_part_request candidate
          JOIN tool_part_outcome candidate_outcome ON candidate_outcome.request_part_id = candidate.id
          WHERE candidate.message_id = (
              SELECT request.message_id
              FROM json_each(NEW.payload, '$.evidence_ids') evidence
              JOIN tool_part_request request ON request.id = evidence.value
              LIMIT 1
            )
            AND json_extract(candidate_outcome.data, '$.outcome') = 'completed'
            AND (
              json_extract(candidate.data, '$.tool') IN ('no_action','wait')
              OR (SELECT accepted FROM dispatch_receipts WHERE id = candidate.id)
              OR (
                json_extract(candidate.data, '$.tool') = 'manage_task'
                AND json_extract(candidate.data, '$.input.action') NOT IN ('add_goal','modify_goal','delete_goal')
                AND json_type(candidate.data, '$.input.goal') IS NULL
                AND json_type(candidate.data, '$.input.goalID') IS NULL
                AND json_type(candidate.data, '$.input.updates') IS NULL
              )
              OR (
                json_extract(candidate.data, '$.tool') = 'respond_agent_coordination'
                AND json_extract(candidate.data, '$.input.decision') IN ('cancel_worker','fail_task','acknowledge_terminal')
              )
            )
            AND candidate.id NOT IN (SELECT value FROM json_each(NEW.payload, '$.evidence_ids'))
        )
      )
      OR (
        json_extract(NEW.payload, '$.disposition') = 'terminal_inapplicable'
        AND json_array_length(NEW.payload, '$.evidence_ids') = 1
        AND EXISTS (
          SELECT 1 FROM protocol_event lifecycle
          JOIN engine_task_root_ingress ingress
            ON ingress.id = json_extract(NEW.payload, '$.ingress_id')
          WHERE lifecycle.id = json_extract(NEW.payload, '$.evidence_ids[0]')
            AND lifecycle.aggregate_type = 'task'
            AND lifecycle.aggregate_id = NEW.task_id
            AND lifecycle.type IN ('task.cancelled','task.completed','task.failed','task.execution.reopened','task.deleted')
            AND (
              (lifecycle.type IN ('task.cancelled','task.completed','task.failed')
                AND json_extract(lifecycle.payload, '$.execution_epoch') = ingress.execution_epoch
                AND lifecycle.emitted_at >= ingress.time_accepted)
              OR (lifecycle.type = 'task.execution.reopened'
                AND json_extract(lifecycle.payload, '$.execution_epoch') > ingress.execution_epoch)
              OR (lifecycle.type = 'task.deleted' AND lifecycle.emitted_at >= ingress.time_accepted)
            )
        )
      )
      OR (
        json_extract(NEW.payload, '$.disposition') = 'exhausted'
        AND json_array_length(NEW.payload, '$.evidence_ids') = 1
        AND EXISTS (
          SELECT 1 FROM engine_artifact gate
          WHERE gate.id = json_extract(NEW.payload, '$.evidence_ids[0]')
            AND gate.task_id = NEW.task_id
            AND gate.kind = 'task-infrastructure-error'
            AND json_extract(gate.payload, '$.operation') = 'surface-operator-gated-ingress'
            AND json_extract(gate.payload, '$.context.ingressID') = json_extract(NEW.payload, '$.ingress_id')
            AND json_extract(gate.payload, '$.context.state') = 'exhausted'
        )
      )
      OR (
        json_extract(NEW.payload, '$.disposition') = 'input_rejected'
        AND json_array_length(NEW.payload, '$.evidence_ids') = 1
        AND EXISTS (
          SELECT 1 FROM engine_artifact outcome
          JOIN engine_artifact request ON request.id = json_extract(outcome.payload, '$.request_artifact_id')
          WHERE outcome.id = json_extract(NEW.payload, '$.evidence_ids[0]')
            AND outcome.task_id = NEW.task_id AND request.task_id = NEW.task_id
            AND outcome.kind = 'mission_acceptance_extension_outcome'
            AND request.kind = 'mission_acceptance_extension_request'
            AND json_extract(outcome.payload, '$.result.kind') = 'rejected'
            AND json_extract(outcome.payload, '$.ingress_artifact_id') = json_extract(NEW.payload, '$.ingress_id')
            AND json_extract(request.payload, '$.ingress_artifact_id') = json_extract(NEW.payload, '$.ingress_id')
        )
      )
      OR (
        json_extract(NEW.payload, '$.disposition') = 'operator_abandoned'
        AND json_array_length(NEW.payload, '$.evidence_ids') = 1
        AND EXISTS (
          SELECT 1 FROM engine_artifact gate
          WHERE gate.id = json_extract(NEW.payload, '$.evidence_ids[0]')
            AND gate.task_id = NEW.task_id
            AND gate.kind = 'task-infrastructure-error'
            AND json_extract(gate.payload, '$.operation') = 'surface-operator-gated-ingress'
            AND json_extract(gate.payload, '$.context.ingressID') = json_extract(NEW.payload, '$.ingress_id')
            AND json_extract(gate.payload, '$.context.state') = 'host_fault'
            AND json_type(gate.payload, '$.context.gateReason') = 'text'
        )
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: Task-root ingress disposition requires exact immutable release evidence');
END;

CREATE TRIGGER IF NOT EXISTS engine_acceptance_extension_no_update
BEFORE UPDATE ON engine_artifact
FOR EACH ROW
WHEN OLD.kind IN ('mission_acceptance_extension_request','mission_acceptance_extension_outcome')
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: Mission acceptance extension facts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS engine_acceptance_extension_no_delete
BEFORE DELETE ON engine_artifact
FOR EACH ROW
WHEN OLD.kind IN ('mission_acceptance_extension_request','mission_acceptance_extension_outcome')
  AND EXISTS (SELECT 1 FROM engine_task task WHERE task.id = OLD.task_id)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: Mission acceptance extension facts require Task retention');
END;

CREATE TRIGGER IF NOT EXISTS engine_scheduling_disposition_no_delete
BEFORE DELETE ON engine_artifact
FOR EACH ROW
WHEN OLD.kind IN ('dispatch_settlement','dispatch_delivery_disposition','task_root_ingress_disposition')
  AND EXISTS (SELECT 1 FROM engine_task task WHERE task.id = OLD.task_id)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: scheduling settlement or disposition is immutable until Task retention');
END;

CREATE TRIGGER IF NOT EXISTS engine_dispatch_lineage_no_delete
BEFORE DELETE ON engine_artifact
FOR EACH ROW
WHEN OLD.kind = 'dispatch_lineage'
  AND EXISTS (SELECT 1 FROM engine_task task WHERE task.id = OLD.task_id)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: dispatch lineage is immutable until Task retention');
END;

CREATE TRIGGER IF NOT EXISTS engine_scheduling_disposition_evidence_no_update
BEFORE UPDATE ON engine_artifact
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM engine_artifact disposition
  WHERE disposition.task_id = OLD.task_id
    AND (
      (
        disposition.kind = 'dispatch_delivery_disposition'
        AND (
          OLD.id = json_extract(disposition.payload, '$.dispatch_lineage_id')
          OR OLD.id = json_extract(disposition.payload, '$.infrastructure_source_artifact_id')
          OR OLD.id = json_extract(disposition.payload, '$.budget_artifact_id')
          OR (
            OLD.kind = 'dispatch_settlement'
            AND json_extract(OLD.payload, '$.dispatch_id') = json_extract(disposition.payload, '$.dispatch_id')
          )
        )
      )
      OR (
        disposition.kind = 'task_root_ingress_disposition'
        AND EXISTS (
          SELECT 1 FROM json_each(disposition.payload, '$.evidence_ids') evidence
          WHERE evidence.value = OLD.id
        )
      )
    )
)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: scheduling disposition evidence is immutable');
END;

CREATE TRIGGER IF NOT EXISTS engine_scheduling_disposition_evidence_no_delete
BEFORE DELETE ON engine_artifact
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task task WHERE task.id = OLD.task_id)
  AND EXISTS (
    SELECT 1 FROM engine_artifact disposition
    WHERE disposition.task_id = OLD.task_id
      AND (
        (
          disposition.kind = 'dispatch_delivery_disposition'
          AND (
            OLD.id = json_extract(disposition.payload, '$.dispatch_lineage_id')
            OR OLD.id = json_extract(disposition.payload, '$.infrastructure_source_artifact_id')
            OR OLD.id = json_extract(disposition.payload, '$.budget_artifact_id')
            OR (
              OLD.kind = 'dispatch_settlement'
              AND json_extract(OLD.payload, '$.dispatch_id') = json_extract(disposition.payload, '$.dispatch_id')
            )
          )
        )
        OR (
          disposition.kind = 'task_root_ingress_disposition'
          AND EXISTS (
            SELECT 1 FROM json_each(disposition.payload, '$.evidence_ids') evidence
            WHERE evidence.value = OLD.id
          )
        )
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: scheduling disposition evidence is immutable until Task retention');
END;

CREATE TRIGGER IF NOT EXISTS task_root_disposition_activation_identity_no_update
BEFORE UPDATE ON engine_control_activation_lease
FOR EACH ROW
WHEN (
  OLD.id != NEW.id
  OR OLD.target != NEW.target
  OR OLD.target_id != NEW.target_id
  OR OLD.owner_occurrence_id != NEW.owner_occurrence_id
  OR OLD.time_activated != NEW.time_activated
)
AND EXISTS (
  SELECT 1
  FROM engine_artifact disposition
  JOIN json_each(disposition.payload, '$.evidence_ids') evidence
  JOIN tool_part_request request ON request.id = evidence.value
  JOIN message assistant ON assistant.id = request.message_id
  WHERE disposition.kind = 'task_root_ingress_disposition'
    AND disposition.task_id = (
      SELECT ingress.task_id FROM engine_task_root_ingress ingress WHERE ingress.id = OLD.target_id
    )
    AND json_extract(assistant.data, '$.activationID') = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'engine_control_activation_lease: disposition causal identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS dispatch_lineage_activation_identity_no_update
BEFORE UPDATE ON engine_control_activation_lease
FOR EACH ROW
WHEN (
  OLD.id != NEW.id
  OR OLD.target != NEW.target
  OR OLD.target_id != NEW.target_id
  OR OLD.owner_occurrence_id != NEW.owner_occurrence_id
  OR OLD.time_activated != NEW.time_activated
)
AND EXISTS (
    SELECT 1
    FROM engine_artifact lineage
    JOIN engine_task task ON task.id = lineage.task_id
    JOIN tool_part_request request ON request.id = json_extract(lineage.payload, '$.tool_part_id')
    JOIN message assistant ON assistant.id = request.message_id
    WHERE lineage.kind = 'dispatch_lineage'
      AND json_extract(assistant.data, '$.activationID') = OLD.id
      AND OLD.target = 'task_root_ingress'
      AND OLD.target_id = (
        SELECT ingress.id
        FROM engine_task_root_ingress ingress
        WHERE ingress.task_id = lineage.task_id
          AND ingress.execution_epoch = json_extract(lineage.payload, '$.execution_epoch')
          AND ingress.id = OLD.target_id
      )
)
BEGIN
  SELECT RAISE(ABORT, 'engine_control_activation_lease: dispatch lineage causal identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS task_root_disposition_activation_no_delete
BEFORE DELETE ON engine_control_activation_lease
FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM engine_artifact disposition
  JOIN json_each(disposition.payload, '$.evidence_ids') evidence
  JOIN tool_part_request request ON request.id = evidence.value
  JOIN message assistant ON assistant.id = request.message_id
  JOIN engine_task_root_ingress ingress ON ingress.id = OLD.target_id
  JOIN engine_task task ON task.id = ingress.task_id
  WHERE disposition.kind = 'task_root_ingress_disposition'
    AND disposition.task_id = task.id
    AND json_extract(assistant.data, '$.activationID') = OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'engine_control_activation_lease: disposition causal identity is immutable until Task retention');
END;

CREATE TRIGGER IF NOT EXISTS dispatch_lineage_activation_no_delete
BEFORE DELETE ON engine_control_activation_lease
FOR EACH ROW
WHEN EXISTS (
    SELECT 1
    FROM engine_artifact lineage
    JOIN engine_task task ON task.id = lineage.task_id
    JOIN tool_part_request request ON request.id = json_extract(lineage.payload, '$.tool_part_id')
    JOIN message assistant ON assistant.id = request.message_id
    WHERE lineage.kind = 'dispatch_lineage'
      AND json_extract(assistant.data, '$.activationID') = OLD.id
      AND OLD.target = 'task_root_ingress'
      AND OLD.target_id = (
        SELECT ingress.id
        FROM engine_task_root_ingress ingress
        WHERE ingress.task_id = lineage.task_id
          AND ingress.execution_epoch = json_extract(lineage.payload, '$.execution_epoch')
          AND ingress.id = OLD.target_id
      )
)
BEGIN
  SELECT RAISE(ABORT, 'engine_control_activation_lease: dispatch lineage causal identity is immutable until Task retention');
END;

CREATE TRIGGER IF NOT EXISTS task_root_disposition_control_message_no_update
BEFORE UPDATE ON message
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM engine_artifact disposition
  JOIN engine_task task ON task.id = disposition.task_id
  WHERE disposition.kind = 'task_root_ingress_disposition'
    AND json_extract(disposition.payload, '$.disposition') = 'resolved'
    AND json_extract(disposition.payload, '$.decision_occurrence.control_message_id') = OLD.id
)
AND (OLD.session_id IS NOT NEW.session_id OR OLD.data IS NOT NEW.data)
BEGIN
  SELECT RAISE(ABORT, 'message: Task-root disposition control lineage is immutable');
END;

-- Baseline metric definitions are immutable measurement facts. The SQL layer
-- protects comparability; it does not grant them scheduling authority.
CREATE TRIGGER IF NOT EXISTS engine_metric_spec_baseline_no_update
BEFORE UPDATE ON engine_metric_spec
FOR EACH ROW
WHEN OLD.source = 'baseline'
BEGIN
  SELECT RAISE(ABORT, 'engine_metric_spec: baseline row is frozen (no UPDATE)');
END;

-- SHA-256 means Secure Hash Algorithm 256-bit. SQLite has no built-in SHA-256
-- function and Bun's SQLite binding does not expose user-defined SQL
-- functions. The canonical Engine Artifact writer computes the digest. These
-- triggers enforce the part SQLite can prove independently: the byte count is
-- exact, digests have canonical shape, fixed-block coverage is complete, and
-- payload/index identities cannot be changed separately. Directory reads
-- verify only the bounded index digest. Exact reads verify covered blocks;
-- complete consumers additionally verify the locator's full payload digest.
CREATE TRIGGER IF NOT EXISTS engine_artifact_catalog_metadata_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN
  typeof(NEW.catalog_revision) != 'integer'
  OR NEW.catalog_revision < 1
  OR NOT EXISTS (
    SELECT 1 FROM engine_artifact_catalog_revision
    WHERE revision = NEW.catalog_revision
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact
    WHERE catalog_revision = NEW.catalog_revision
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact_version
    WHERE catalog_revision = NEW.catalog_revision
  )
  OR typeof(NEW.payload) != 'text'
  OR json_valid(NEW.payload) != 1
  OR NEW.payload_bytes != octet_length(NEW.payload)
  OR typeof(NEW.payload_sha256) != 'text'
  OR octet_length(NEW.payload_sha256) != 64
  OR NEW.payload_sha256 GLOB '*[^0-9a-f]*'
  OR json_valid(NEW.payload_block_sha256s) != 1
  OR json_type(NEW.payload_block_sha256s) != 'array'
  OR json_array_length(NEW.payload_block_sha256s) != ((NEW.payload_bytes + 65535) / 65536)
  OR EXISTS (
    SELECT 1
    FROM json_each(NEW.payload_block_sha256s)
    WHERE type != 'text'
      OR octet_length(value) != 64
      OR value GLOB '*[^0-9a-f]*'
  )
  OR typeof(NEW.payload_block_index_sha256) != 'text'
  OR octet_length(NEW.payload_block_index_sha256) != 64
  OR NEW.payload_block_index_sha256 GLOB '*[^0-9a-f]*'
  OR (
    NEW.catalog_import_source_task_id IS NOT NULL
    AND (
      typeof(NEW.catalog_import_source_task_id) != 'text'
      OR octet_length(NEW.catalog_import_source_task_id) < 1
    )
  )
  OR typeof(NEW.catalog_metadata_sha256) != 'text'
  OR octet_length(NEW.catalog_metadata_sha256) != 64
  OR NEW.catalog_metadata_sha256 GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: payload catalog metadata is inconsistent');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_catalog_metadata_update
BEFORE UPDATE OF
  payload,
  task_id,
  kind,
  label,
  time_created,
  time_updated,
  payload_sha256,
  payload_bytes,
  payload_block_sha256s,
  payload_block_index_sha256,
  catalog_artifact_type,
  catalog_schema_diagnostic,
  catalog_producer,
  catalog_import_source_task_id,
  catalog_resource_count,
  catalog_resource_media_types,
  catalog_search_text,
  catalog_search_text_truncated,
  catalog_metadata_sha256,
  catalog_revision
ON engine_artifact
FOR EACH ROW
WHEN
  typeof(NEW.catalog_revision) != 'integer'
  OR NEW.catalog_revision <= OLD.catalog_revision
  OR NEW.task_id IS NOT OLD.task_id
  OR NEW.kind IS NOT OLD.kind
  OR NEW.time_created IS NOT OLD.time_created
  OR NOT EXISTS (
    SELECT 1 FROM engine_artifact_catalog_revision
    WHERE revision = NEW.catalog_revision
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact
    WHERE catalog_revision = NEW.catalog_revision
      AND id != OLD.id
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact_version
    WHERE catalog_revision = NEW.catalog_revision
  )
  OR typeof(NEW.payload) != 'text'
  OR json_valid(NEW.payload) != 1
  OR NEW.payload_bytes != octet_length(NEW.payload)
  OR typeof(NEW.payload_sha256) != 'text'
  OR octet_length(NEW.payload_sha256) != 64
  OR NEW.payload_sha256 GLOB '*[^0-9a-f]*'
  OR json_valid(NEW.payload_block_sha256s) != 1
  OR json_type(NEW.payload_block_sha256s) != 'array'
  OR json_array_length(NEW.payload_block_sha256s) != ((NEW.payload_bytes + 65535) / 65536)
  OR EXISTS (
    SELECT 1
    FROM json_each(NEW.payload_block_sha256s)
    WHERE type != 'text'
      OR octet_length(value) != 64
      OR value GLOB '*[^0-9a-f]*'
  )
  OR typeof(NEW.payload_block_index_sha256) != 'text'
  OR octet_length(NEW.payload_block_index_sha256) != 64
  OR NEW.payload_block_index_sha256 GLOB '*[^0-9a-f]*'
  OR (
    NEW.catalog_import_source_task_id IS NOT NULL
    AND (
      typeof(NEW.catalog_import_source_task_id) != 'text'
      OR octet_length(NEW.catalog_import_source_task_id) < 1
    )
  )
  OR typeof(NEW.catalog_metadata_sha256) != 'text'
  OR octet_length(NEW.catalog_metadata_sha256) != 64
  OR NEW.catalog_metadata_sha256 GLOB '*[^0-9a-f]*'
  OR (
    CAST(COALESCE(NEW.payload, 'null') AS TEXT) IS NOT CAST(COALESCE(OLD.payload, 'null') AS TEXT)
    AND (
      NEW.payload_sha256 = OLD.payload_sha256
      OR NEW.payload_block_sha256s IS OLD.payload_block_sha256s
      OR NEW.payload_block_index_sha256 = OLD.payload_block_index_sha256
      OR NEW.catalog_metadata_sha256 = OLD.catalog_metadata_sha256
    )
  )
  OR (
    CAST(COALESCE(NEW.payload, 'null') AS TEXT) IS CAST(COALESCE(OLD.payload, 'null') AS TEXT)
    AND (
      NEW.payload_sha256 != OLD.payload_sha256
      OR NEW.payload_bytes != OLD.payload_bytes
      OR NEW.payload_block_sha256s IS NOT OLD.payload_block_sha256s
      OR NEW.payload_block_index_sha256 != OLD.payload_block_index_sha256
    )
  )
  OR (
    (
      NEW.payload_sha256 IS NOT OLD.payload_sha256
      OR NEW.payload_bytes IS NOT OLD.payload_bytes
      OR NEW.payload_block_index_sha256 IS NOT OLD.payload_block_index_sha256
      OR NEW.catalog_artifact_type IS NOT OLD.catalog_artifact_type
      OR NEW.catalog_schema_diagnostic IS NOT OLD.catalog_schema_diagnostic
      OR NEW.catalog_producer IS NOT OLD.catalog_producer
      OR NEW.catalog_import_source_task_id IS NOT OLD.catalog_import_source_task_id
      OR NEW.catalog_resource_count IS NOT OLD.catalog_resource_count
      OR NEW.catalog_resource_media_types IS NOT OLD.catalog_resource_media_types
      OR NEW.catalog_search_text IS NOT OLD.catalog_search_text
      OR NEW.catalog_search_text_truncated IS NOT OLD.catalog_search_text_truncated
    )
    AND NEW.catalog_metadata_sha256 = OLD.catalog_metadata_sha256
  )
  OR (
    NEW.task_id IS OLD.task_id
    AND NEW.kind IS OLD.kind
    AND substr(NEW.label, 1, 513)
      IS substr(OLD.label, 1, 513)
    AND NEW.time_created IS OLD.time_created
    AND NEW.time_updated IS OLD.time_updated
    AND NEW.payload_sha256 IS OLD.payload_sha256
    AND NEW.payload_bytes IS OLD.payload_bytes
    AND NEW.payload_block_index_sha256 IS OLD.payload_block_index_sha256
    AND NEW.catalog_artifact_type IS OLD.catalog_artifact_type
    AND NEW.catalog_schema_diagnostic IS OLD.catalog_schema_diagnostic
    AND NEW.catalog_producer IS OLD.catalog_producer
    AND NEW.catalog_import_source_task_id IS OLD.catalog_import_source_task_id
    AND NEW.catalog_resource_count IS OLD.catalog_resource_count
    AND NEW.catalog_resource_media_types IS OLD.catalog_resource_media_types
    AND NEW.catalog_search_text IS OLD.catalog_search_text
    AND NEW.catalog_search_text_truncated IS OLD.catalog_search_text_truncated
    AND NEW.catalog_metadata_sha256 != OLD.catalog_metadata_sha256
  )
  OR (
    (
      NEW.task_id IS NOT OLD.task_id
      OR NEW.kind IS NOT OLD.kind
      OR substr(NEW.label, 1, 513)
        IS NOT substr(OLD.label, 1, 513)
      OR NEW.time_created IS NOT OLD.time_created
      OR NEW.time_updated IS NOT OLD.time_updated
    )
    AND NEW.catalog_metadata_sha256 = OLD.catalog_metadata_sha256
  )
  OR NEW.catalog_import_source_task_id IS NOT OLD.catalog_import_source_task_id
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: payload and bounded catalog identities must change atomically');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_catalog_revision_no_update
BEFORE UPDATE ON engine_artifact_catalog_revision
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact_catalog_revision: revisions are append-only');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_catalog_revision_no_delete
BEFORE DELETE ON engine_artifact_catalog_revision
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact_catalog_revision: revisions are append-only');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_version_integrity_insert
BEFORE INSERT ON engine_artifact_version
FOR EACH ROW
WHEN
  typeof(NEW.catalog_revision) != 'integer'
  OR NEW.catalog_revision < 1
  OR NOT EXISTS (
    SELECT 1 FROM engine_artifact_catalog_revision
    WHERE revision = NEW.catalog_revision
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact
    WHERE catalog_revision = NEW.catalog_revision
  )
  OR EXISTS (
    SELECT 1 FROM engine_artifact_version
    WHERE catalog_revision = NEW.catalog_revision
  )
  OR NOT EXISTS (
    SELECT 1
    FROM engine_artifact AS current
    WHERE current.id = NEW.artifact_id
      AND current.task_id IS NEW.task_id
      AND current.kind IS NEW.kind
      AND NEW.catalog_revision < current.catalog_revision
  )
  OR typeof(NEW.payload) != 'text'
  OR json_valid(NEW.payload) != 1
  OR NEW.payload_bytes != octet_length(NEW.payload)
  OR typeof(NEW.payload_sha256) != 'text'
  OR octet_length(NEW.payload_sha256) != 64
  OR NEW.payload_sha256 GLOB '*[^0-9a-f]*'
  OR json_valid(NEW.payload_block_sha256s) != 1
  OR json_type(NEW.payload_block_sha256s) != 'array'
  OR json_array_length(NEW.payload_block_sha256s) != ((NEW.payload_bytes + 65535) / 65536)
  OR EXISTS (
    SELECT 1
    FROM json_each(NEW.payload_block_sha256s)
    WHERE type != 'text'
      OR octet_length(value) != 64
      OR value GLOB '*[^0-9a-f]*'
  )
  OR typeof(NEW.payload_block_index_sha256) != 'text'
  OR octet_length(NEW.payload_block_index_sha256) != 64
  OR NEW.payload_block_index_sha256 GLOB '*[^0-9a-f]*'
  OR typeof(NEW.catalog_metadata_sha256) != 'text'
  OR octet_length(NEW.catalog_metadata_sha256) != 64
  OR NEW.catalog_metadata_sha256 GLOB '*[^0-9a-f]*'
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact_version: prior catalog version is inconsistent');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_archive_previous_version
AFTER UPDATE ON engine_artifact
FOR EACH ROW
BEGIN
  INSERT INTO engine_artifact_version (
    artifact_id, task_id, kind, label, payload,
    payload_sha256, payload_bytes, payload_block_sha256s, payload_block_index_sha256,
    catalog_artifact_type, catalog_schema_diagnostic, catalog_producer,
    catalog_import_source_task_id, catalog_resource_count, catalog_resource_media_types,
    catalog_search_text, catalog_search_text_truncated, catalog_metadata_sha256,
    catalog_revision, time_created, time_updated
  ) VALUES (
    OLD.id, OLD.task_id, OLD.kind, OLD.label, OLD.payload,
    OLD.payload_sha256, OLD.payload_bytes, OLD.payload_block_sha256s, OLD.payload_block_index_sha256,
    OLD.catalog_artifact_type, OLD.catalog_schema_diagnostic, OLD.catalog_producer,
    OLD.catalog_import_source_task_id, OLD.catalog_resource_count, OLD.catalog_resource_media_types,
    OLD.catalog_search_text, OLD.catalog_search_text_truncated, OLD.catalog_metadata_sha256,
    OLD.catalog_revision, OLD.time_created, OLD.time_updated
  );
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_version_no_update
BEFORE UPDATE ON engine_artifact_version
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact_version: prior versions are immutable');
END;

CREATE TRIGGER IF NOT EXISTS engine_artifact_version_no_delete
BEFORE DELETE ON engine_artifact_version
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM engine_artifact
  WHERE id = OLD.artifact_id
)
AND EXISTS (
  SELECT 1 FROM engine_task
  WHERE id = OLD.task_id
)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact_version: prior versions are immutable');
END;

-- Agent Coordination is an append-only fact chain. Current state is reduced
-- from request, response/action plan, terminal outcome, and Task execution epoch.
CREATE TRIGGER IF NOT EXISTS engine_agent_coordination_request_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'agent_coordination_request'
  AND NOT (
    json_valid(NEW.payload)
    AND json_type(NEW.payload) = 'object'
    AND (SELECT COUNT(*) FROM json_each(NEW.payload)) = (SELECT COUNT(DISTINCT key) FROM json_each(NEW.payload))
    AND NOT EXISTS (
      SELECT 1 FROM json_each(NEW.payload)
      WHERE key NOT IN (
        'request_id','task_id','execution_epoch','session_id','agent','worker_binding','origin',
        'message_id','tool_call_id','tool_part_id','tool_input','operator_steer_id','operator_message',
        'delivery_slice_subject','summary','details','blocking','requested_decision','evidence_locators',
        'severity','created_at','session_lineage_source','dispatch_lineage_id'
      )
    )
    AND json_extract(NEW.payload,'$.request_id') = NEW.id
    AND json_extract(NEW.payload,'$.task_id') = NEW.task_id
    AND json_type(NEW.payload,'$.execution_epoch') = 'integer'
    AND json_extract(NEW.payload,'$.execution_epoch') > 0
    AND json_extract(NEW.payload,'$.execution_epoch') <= 9007199254740991
    AND json_type(NEW.payload,'$.session_id') = 'text'
    AND length(json_extract(NEW.payload,'$.session_id')) > 0
    AND json_type(NEW.payload,'$.agent') = 'text'
    AND length(json_extract(NEW.payload,'$.agent')) > 0
    AND json_type(NEW.payload,'$.worker_binding') = 'object'
    AND (SELECT COUNT(*) FROM json_each(NEW.payload,'$.worker_binding')) = 4
    AND (SELECT COUNT(*) FROM json_each(NEW.payload,'$.worker_binding')) = (SELECT COUNT(DISTINCT key) FROM json_each(NEW.payload,'$.worker_binding'))
    AND NOT EXISTS (
      SELECT 1 FROM json_each(NEW.payload,'$.worker_binding')
      WHERE key NOT IN ('identity','expertSquadID','workerTurnDescriptorID','workerTurnDescriptorHash')
    )
    AND json_type(NEW.payload,'$.worker_binding.identity') = 'object'
    AND (SELECT COUNT(*) FROM json_each(NEW.payload,'$.worker_binding.identity')) = 7
    AND (SELECT COUNT(*) FROM json_each(NEW.payload,'$.worker_binding.identity')) = (SELECT COUNT(DISTINCT key) FROM json_each(NEW.payload,'$.worker_binding.identity'))
    AND NOT EXISTS (
      SELECT 1 FROM json_each(NEW.payload,'$.worker_binding.identity')
      WHERE key NOT IN ('agentID','baseRole','sessionKind','dispatchAdapterID','runtimeTemplateABIVersion','dispatchAdapterABIVersion','projectionHash')
    )
    AND json_extract(NEW.payload,'$.worker_binding.identity.agentID') = json_extract(NEW.payload,'$.agent')
    AND EXISTS (
      SELECT 1 FROM worker_turn_descriptor descriptor
      WHERE descriptor.id=json_extract(NEW.payload,'$.worker_binding.workerTurnDescriptorID')
        AND descriptor.task_id=NEW.task_id
        AND descriptor.session_id=json_extract(NEW.payload,'$.session_id')
        AND descriptor.hash=json_extract(NEW.payload,'$.worker_binding.workerTurnDescriptorHash')
        AND descriptor.agent=json_extract(NEW.payload,'$.agent')
        AND json_extract(descriptor.payload,'$.expertSquadID')=json_extract(NEW.payload,'$.worker_binding.expertSquadID')
        AND json_extract(descriptor.payload,'$.identity.agentID')=json_extract(NEW.payload,'$.worker_binding.identity.agentID')
        AND json_extract(descriptor.payload,'$.identity.baseRole')=json_extract(NEW.payload,'$.worker_binding.identity.baseRole')
        AND json_extract(descriptor.payload,'$.identity.sessionKind')=json_extract(NEW.payload,'$.worker_binding.identity.sessionKind')
        AND json_extract(descriptor.payload,'$.identity.dispatchAdapterID')=json_extract(NEW.payload,'$.worker_binding.identity.dispatchAdapterID')
        AND json_extract(descriptor.payload,'$.identity.runtimeTemplateABIVersion')=json_extract(NEW.payload,'$.worker_binding.identity.runtimeTemplateABIVersion')
        AND json_extract(descriptor.payload,'$.identity.dispatchAdapterABIVersion')=json_extract(NEW.payload,'$.worker_binding.identity.dispatchAdapterABIVersion')
        AND json_extract(descriptor.payload,'$.identity.projectionHash')=json_extract(NEW.payload,'$.worker_binding.identity.projectionHash')
    )
    AND json_type(NEW.payload,'$.summary') = 'text'
    AND length(json_extract(NEW.payload,'$.summary')) > 0
    AND json_type(NEW.payload,'$.details') = 'text'
    AND length(json_extract(NEW.payload,'$.details')) > 0
    AND json_type(NEW.payload,'$.blocking') IN ('true','false')
    AND json_type(NEW.payload,'$.requested_decision') = 'text'
    AND length(json_extract(NEW.payload,'$.requested_decision')) > 0
    AND (
      json_type(NEW.payload,'$.delivery_slice_subject') IS NULL
      OR (
        json_type(NEW.payload,'$.delivery_slice_subject')='text'
        AND length(json_extract(NEW.payload,'$.delivery_slice_subject')) > 0
      )
    )
    AND json_extract(NEW.payload,'$.severity') IN ('info','blocked','failure')
    AND (
      json_type(NEW.payload,'$.evidence_locators') IS NULL
      OR (
        json_type(NEW.payload,'$.evidence_locators')='array'
        AND NOT EXISTS (
          SELECT 1 FROM json_each(NEW.payload,'$.evidence_locators') locator
          WHERE NOT (
  
  locator.type='object'
  AND CASE json_extract(locator.value,'$.source')
    WHEN 'engine_artifact' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=4
      AND json_type(locator.value,'$.expected_sha256')='text'
      AND length(json_extract(locator.value,'$.expected_sha256'))=64
      AND json_type(locator.value,'$.artifact_id')='text'
      AND length(json_extract(locator.value,'$.artifact_id'))>0
      AND json_type(locator.value,'$.catalog_revision')='integer'
      AND json_extract(locator.value,'$.catalog_revision')>0
    WHEN 'task_artifact_snapshot' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=2
      AND json_type(locator.value,'$.snapshot')='object'
      AND (SELECT COUNT(*) FROM json_each(locator.value,'$.snapshot'))=5
      AND json_extract(locator.value,'$.snapshot.schema_version')=2
      AND json_type(locator.value,'$.snapshot.project_id')='text'
      AND length(json_extract(locator.value,'$.snapshot.project_id'))>0
      AND json_type(locator.value,'$.snapshot.task_id')='text'
      AND length(json_extract(locator.value,'$.snapshot.task_id'))>0
      AND json_type(locator.value,'$.snapshot.snapshot_id')='text'
      AND length(json_extract(locator.value,'$.snapshot.snapshot_id'))>0
      AND json_type(locator.value,'$.snapshot.manifest_sha256')='text'
      AND length(json_extract(locator.value,'$.snapshot.manifest_sha256'))=64
    WHEN 'task_artifact_resource' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=2
      AND json_type(locator.value,'$.ref')='object'
      AND (SELECT COUNT(*) FROM json_each(locator.value,'$.ref'))=6
      AND json_type(locator.value,'$.ref.media_type')='text'
      AND length(json_extract(locator.value,'$.ref.media_type'))>0
      AND json_type(locator.value,'$.ref.bytes')='integer'
      AND json_extract(locator.value,'$.ref.bytes')>=0
      AND json_type(locator.value,'$.ref.sha256')='text'
      AND length(json_extract(locator.value,'$.ref.sha256'))=64
      AND json_type(locator.value,'$.ref.snapshot')='object'
      AND (SELECT COUNT(*) FROM json_each(locator.value,'$.ref.snapshot'))=5
      AND json_extract(locator.value,'$.ref.snapshot.schema_version')=2
      AND json_type(locator.value,'$.ref.snapshot.project_id')='text'
      AND length(json_extract(locator.value,'$.ref.snapshot.project_id'))>0
      AND json_type(locator.value,'$.ref.snapshot.task_id')='text'
      AND length(json_extract(locator.value,'$.ref.snapshot.task_id'))>0
      AND json_type(locator.value,'$.ref.snapshot.snapshot_id')='text'
      AND length(json_extract(locator.value,'$.ref.snapshot.snapshot_id'))>0
      AND json_type(locator.value,'$.ref.snapshot.manifest_sha256')='text'
      AND length(json_extract(locator.value,'$.ref.snapshot.manifest_sha256'))=64
      AND json_type(locator.value,'$.ref.tree')='text'
      AND length(json_extract(locator.value,'$.ref.tree'))>0
      AND json_type(locator.value,'$.ref.path')='text'
      AND length(json_extract(locator.value,'$.ref.path'))>0
    WHEN 'session' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=2
      AND json_type(locator.value,'$.session_id')='text'
      AND length(json_extract(locator.value,'$.session_id'))>0
    WHEN 'session_message' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=3
      AND json_type(locator.value,'$.session_id')='text'
      AND length(json_extract(locator.value,'$.session_id'))>0
      AND json_type(locator.value,'$.message_id')='text'
      AND length(json_extract(locator.value,'$.message_id'))>0
    WHEN 'goal_revision' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=2
      AND json_type(locator.value,'$.goal_id')='text'
      AND length(json_extract(locator.value,'$.goal_id'))>0
    WHEN 'coordination_request' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=2
      AND json_type(locator.value,'$.request_id')='text'
      AND length(json_extract(locator.value,'$.request_id'))>0
    ELSE 0
  END

)
        )
        AND NOT EXISTS (
          SELECT 1
          FROM json_each(NEW.payload,'$.evidence_locators') locator
          GROUP BY json(locator.value)
          HAVING COUNT(*)>1
        )
      )
    )
    AND json_type(NEW.payload,'$.created_at') = 'integer'
    AND json_extract(NEW.payload,'$.created_at') BETWEEN 1 AND 9007199254740991
    AND json_extract(NEW.payload,'$.created_at')=NEW.time_created
    AND json_extract(NEW.payload,'$.execution_epoch') = (
      SELECT MAX(json_extract(opened.payload,'$.execution_epoch'))
      FROM protocol_event opened
      WHERE opened.aggregate_type='task'
        AND opened.aggregate_id=NEW.task_id
        AND opened.type IN ('task.execution.opened','task.execution.reopened')
    )
    AND (
      (
        json_extract(NEW.payload,'$.origin') = 'worker_handoff'
        AND json_extract(NEW.payload,'$.session_lineage_source') = 'dispatch_lineage'
        AND json_type(NEW.payload,'$.message_id') = 'text'
        AND json_type(NEW.payload,'$.tool_call_id') = 'text'
        AND length(json_extract(NEW.payload,'$.tool_call_id')) > 0
        AND json_type(NEW.payload,'$.tool_part_id') = 'text'
        AND json_type(NEW.payload,'$.tool_input')='object'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload,'$.tool_input'))=
            (SELECT COUNT(DISTINCT key) FROM json_each(NEW.payload,'$.tool_input'))
        AND NOT EXISTS (
          SELECT 1 FROM json_each(NEW.payload,'$.tool_input')
          WHERE key NOT IN ('summary','details','blocking','requested_decision','evidence_locators','severity')
        )
        AND json_type(NEW.payload,'$.tool_input.summary')='text'
        AND length(json_extract(NEW.payload,'$.tool_input.summary')) > 0
        AND json_type(NEW.payload,'$.tool_input.details')='text'
        AND length(json_extract(NEW.payload,'$.tool_input.details')) > 0
        AND json_type(NEW.payload,'$.tool_input.blocking') IN ('true','false')
        AND json_type(NEW.payload,'$.tool_input.requested_decision')='text'
        AND length(json_extract(NEW.payload,'$.tool_input.requested_decision')) > 0
        AND (json_type(NEW.payload,'$.tool_input.severity') IS NULL OR json_extract(NEW.payload,'$.tool_input.severity') IN ('info','blocked','failure'))
        AND (
          json_type(NEW.payload,'$.tool_input.evidence_locators') IS NULL
          OR (
            json_type(NEW.payload,'$.tool_input.evidence_locators')='array'
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload,'$.tool_input.evidence_locators') locator
              WHERE NOT (
  locator.type='object'
  AND CASE json_extract(locator.value,'$.source')
    WHEN 'engine_artifact' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=3
      AND json_type(locator.value,'$.artifact_id')='text'
      AND length(json_extract(locator.value,'$.artifact_id'))>0
      AND json_type(locator.value,'$.catalog_revision')='integer'
      AND json_extract(locator.value,'$.catalog_revision')>0
    WHEN 'task_artifact_snapshot' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=2
      AND json_type(locator.value,'$.snapshot')='object'
      AND (SELECT COUNT(*) FROM json_each(locator.value,'$.snapshot'))=5
      AND json_extract(locator.value,'$.snapshot.schema_version')=2
      AND json_type(locator.value,'$.snapshot.project_id')='text'
      AND length(json_extract(locator.value,'$.snapshot.project_id'))>0
      AND json_type(locator.value,'$.snapshot.task_id')='text'
      AND length(json_extract(locator.value,'$.snapshot.task_id'))>0
      AND json_type(locator.value,'$.snapshot.snapshot_id')='text'
      AND length(json_extract(locator.value,'$.snapshot.snapshot_id'))>0
      AND json_type(locator.value,'$.snapshot.manifest_sha256')='text'
      AND length(json_extract(locator.value,'$.snapshot.manifest_sha256'))=64
    WHEN 'task_artifact_resource' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=2
      AND json_type(locator.value,'$.ref')='object'
      AND (SELECT COUNT(*) FROM json_each(locator.value,'$.ref'))=3
      AND json_type(locator.value,'$.ref.snapshot')='object'
      AND (SELECT COUNT(*) FROM json_each(locator.value,'$.ref.snapshot'))=5
      AND json_extract(locator.value,'$.ref.snapshot.schema_version')=2
      AND json_type(locator.value,'$.ref.snapshot.project_id')='text'
      AND length(json_extract(locator.value,'$.ref.snapshot.project_id'))>0
      AND json_type(locator.value,'$.ref.snapshot.task_id')='text'
      AND length(json_extract(locator.value,'$.ref.snapshot.task_id'))>0
      AND json_type(locator.value,'$.ref.snapshot.snapshot_id')='text'
      AND length(json_extract(locator.value,'$.ref.snapshot.snapshot_id'))>0
      AND json_type(locator.value,'$.ref.snapshot.manifest_sha256')='text'
      AND length(json_extract(locator.value,'$.ref.snapshot.manifest_sha256'))=64
      AND json_type(locator.value,'$.ref.tree')='text'
      AND length(json_extract(locator.value,'$.ref.tree'))>0
      AND json_type(locator.value,'$.ref.path')='text'
      AND length(json_extract(locator.value,'$.ref.path'))>0
    WHEN 'session' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=2
      AND json_type(locator.value,'$.session_id')='text'
      AND length(json_extract(locator.value,'$.session_id'))>0
    WHEN 'session_message' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=3
      AND json_type(locator.value,'$.session_id')='text'
      AND length(json_extract(locator.value,'$.session_id'))>0
      AND json_type(locator.value,'$.message_id')='text'
      AND length(json_extract(locator.value,'$.message_id'))>0
    WHEN 'goal_revision' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=2
      AND json_type(locator.value,'$.goal_id')='text'
      AND length(json_extract(locator.value,'$.goal_id'))>0
    WHEN 'coordination_request' THEN
      (SELECT COUNT(*) FROM json_each(locator.value))=2
      AND json_type(locator.value,'$.request_id')='text'
      AND length(json_extract(locator.value,'$.request_id'))>0
    ELSE 0
  END
)
            )
            AND NOT EXISTS (
              SELECT 1
              FROM json_each(NEW.payload,'$.tool_input.evidence_locators') locator
              GROUP BY json(locator.value)
              HAVING COUNT(*)>1
            )
          )
        )
        AND json_extract(NEW.payload,'$.summary')=json_extract(NEW.payload,'$.tool_input.summary')
        AND json_extract(NEW.payload,'$.details')=json_extract(NEW.payload,'$.tool_input.details')
        AND json_extract(NEW.payload,'$.blocking')=json_extract(NEW.payload,'$.tool_input.blocking')
        AND json_extract(NEW.payload,'$.requested_decision')=json_extract(NEW.payload,'$.tool_input.requested_decision')
        AND json_extract(NEW.payload,'$.severity')=COALESCE(
          json_extract(NEW.payload,'$.tool_input.severity'),
          CASE WHEN json_extract(NEW.payload,'$.tool_input.blocking') THEN 'blocked' ELSE 'info' END
        )
        AND json_type(NEW.payload,'$.dispatch_lineage_id') = 'text'
        AND json_type(NEW.payload,'$.operator_steer_id') IS NULL
        AND json_type(NEW.payload,'$.operator_message') IS NULL
        AND EXISTS (
          SELECT 1
          FROM tool_part_request part
          JOIN message ON message.id=part.message_id
          WHERE part.id=json_extract(NEW.payload,'$.tool_part_id')
            AND part.message_id=json_extract(NEW.payload,'$.message_id')
            AND message.session_id=json_extract(NEW.payload,'$.session_id')
            AND json_extract(message.data,'$.role')='assistant'
            AND json_extract(message.data,'$.author')=json_extract(NEW.payload,'$.agent')
            AND json_extract(part.data,'$.callID')=json_extract(NEW.payload,'$.tool_call_id')
            AND json_extract(part.data,'$.tool')='request_orchestrator_decision'
            AND json(part.data -> '$.input')=json(NEW.payload -> '$.tool_input')
        )
        AND COALESCE(json_array_length(NEW.payload,'$.tool_input.evidence_locators'),0)=
            COALESCE(json_array_length(NEW.payload,'$.evidence_locators'),0)
        AND NOT EXISTS (
          SELECT 1
          FROM json_each(NEW.payload,'$.tool_input.evidence_locators') input_locator
          LEFT JOIN json_each(NEW.payload,'$.evidence_locators') durable_locator
            ON durable_locator.key=input_locator.key
          WHERE durable_locator.key IS NULL
             OR NOT (
  json_extract(input_locator.value,'$.source')=json_extract(durable_locator.value,'$.source')
  AND CASE json_extract(input_locator.value,'$.source')
    WHEN 'engine_artifact' THEN
      json_extract(input_locator.value,'$.artifact_id')=json_extract(durable_locator.value,'$.artifact_id')
      AND json_extract(input_locator.value,'$.catalog_revision')=json_extract(durable_locator.value,'$.catalog_revision')
    WHEN 'task_artifact_resource' THEN
      json(input_locator.value -> '$.ref.snapshot')=json(durable_locator.value -> '$.ref.snapshot')
      AND json_extract(input_locator.value,'$.ref.tree')=json_extract(durable_locator.value,'$.ref.tree')
      AND json_extract(input_locator.value,'$.ref.path')=json_extract(durable_locator.value,'$.ref.path')
    ELSE json(input_locator.value)=json(durable_locator.value)
  END
)
        )
        AND EXISTS (
          SELECT 1
          FROM worker_turn_descriptor descriptor
          JOIN engine_artifact lineage
            ON lineage.id=json_extract(NEW.payload,'$.dispatch_lineage_id')
           AND lineage.task_id=NEW.task_id
           AND lineage.kind='dispatch_lineage'
          WHERE descriptor.id=json_extract(NEW.payload,'$.worker_binding.workerTurnDescriptorID')
            AND descriptor.task_id=NEW.task_id
            AND descriptor.session_id=json_extract(NEW.payload,'$.session_id')
            AND descriptor.hash=json_extract(NEW.payload,'$.worker_binding.workerTurnDescriptorHash')
            AND json_type(descriptor.payload,'$.dispatchTurn')='object'
            AND json_extract(descriptor.payload,'$.dispatchTurn.current_dispatch_id')=json_extract(lineage.payload,'$.dispatch_id')
            AND json_extract(lineage.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
            AND json_extract(lineage.payload,'$.child_session_id')=json_extract(NEW.payload,'$.session_id')
            AND json_extract(lineage.payload,'$.target_agent_id')=json_extract(NEW.payload,'$.agent')
            AND json(lineage.payload -> '$.projected_worker_identity')=json(NEW.payload -> '$.worker_binding.identity')
            AND json(lineage.payload -> '$.workflow_binding')=json(descriptor.payload -> '$.dispatchTurn.workflow_binding')
            AND json_extract(lineage.payload,'$.workflow_node_id') IS json_extract(descriptor.payload,'$.dispatchTurn.workflow_node_id')
            AND json_extract(lineage.payload,'$.workflow_occurrence_id')=json_extract(descriptor.payload,'$.dispatchTurn.workflow_occurrence_id')
            AND json(lineage.payload -> '$.delivery_slice_revision_ids')=json(descriptor.payload -> '$.dispatchTurn.delivery_slice_revision_ids')
        )
      )
      OR (
        json_extract(NEW.payload,'$.origin') = 'operator_steer'
        AND json_extract(NEW.payload,'$.operator_steer_id')=NEW.id
        AND json_type(NEW.payload,'$.operator_message')='text'
        AND length(json_extract(NEW.payload,'$.operator_message')) > 0
        AND json_extract(NEW.payload,'$.details')=json_extract(NEW.payload,'$.operator_message')
        AND json_extract(NEW.payload,'$.requested_decision')='operator_steer'
        AND json_extract(NEW.payload,'$.blocking')=1
        AND json_extract(NEW.payload,'$.severity')='blocked'
        AND json_extract(NEW.payload,'$.summary')=
          'Operator steer for ' || json_extract(NEW.payload,'$.agent') ||
          ' session ' || json_extract(NEW.payload,'$.session_id')
        AND json_type(NEW.payload,'$.message_id') IS NULL
        AND json_type(NEW.payload,'$.tool_call_id') IS NULL
        AND json_type(NEW.payload,'$.tool_part_id') IS NULL
        AND json_type(NEW.payload,'$.tool_input') IS NULL
        AND json_type(NEW.payload,'$.evidence_locators') IS NULL
        AND json_extract(NEW.payload,'$.session_lineage_source')='dispatch_lineage'
        AND json_type(NEW.payload,'$.dispatch_lineage_id')='text'
        AND EXISTS (
          SELECT 1
          FROM worker_turn_descriptor descriptor
          JOIN engine_artifact lineage
            ON lineage.id=json_extract(NEW.payload,'$.dispatch_lineage_id')
           AND lineage.task_id=NEW.task_id
           AND lineage.kind='dispatch_lineage'
          WHERE descriptor.id=json_extract(NEW.payload,'$.worker_binding.workerTurnDescriptorID')
            AND descriptor.task_id=NEW.task_id
            AND descriptor.session_id=json_extract(NEW.payload,'$.session_id')
            AND descriptor.hash=json_extract(NEW.payload,'$.worker_binding.workerTurnDescriptorHash')
            AND json_type(descriptor.payload,'$.dispatchTurn')='object'
            AND json_extract(descriptor.payload,'$.dispatchTurn.current_dispatch_id')=json_extract(lineage.payload,'$.dispatch_id')
            AND json_extract(lineage.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
            AND json_extract(lineage.payload,'$.child_session_id')=json_extract(NEW.payload,'$.session_id')
            AND json_extract(lineage.payload,'$.target_agent_id')=json_extract(NEW.payload,'$.agent')
            AND json(lineage.payload -> '$.projected_worker_identity')=json(NEW.payload -> '$.worker_binding.identity')
            AND json(lineage.payload -> '$.workflow_binding')=json(descriptor.payload -> '$.dispatchTurn.workflow_binding')
            AND json_extract(lineage.payload,'$.workflow_node_id') IS json_extract(descriptor.payload,'$.dispatchTurn.workflow_node_id')
            AND json_extract(lineage.payload,'$.workflow_occurrence_id')=json_extract(descriptor.payload,'$.dispatchTurn.workflow_occurrence_id')
            AND json(lineage.payload -> '$.delivery_slice_revision_ids')=json(descriptor.payload -> '$.dispatchTurn.delivery_slice_revision_ids')
        )
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: invalid immutable agent coordination request fact');
END;

CREATE TRIGGER IF NOT EXISTS engine_agent_coordination_response_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'agent_coordination_response'
  AND NOT (
    json_valid(NEW.payload)
    AND json_type(NEW.payload)='object'
    AND (SELECT COUNT(*) FROM json_each(NEW.payload))=(SELECT COUNT(DISTINCT key) FROM json_each(NEW.payload))
    AND NOT EXISTS (
      SELECT 1 FROM json_each(NEW.payload)
      WHERE key NOT IN (
        'response_id','request_id','frontier_id','previous_failed_outcome_id','action_id','task_id',
        'execution_epoch','orchestrator_session_id','orchestrator_message_id','orchestrator_tool_call_id',
        'orchestrator_tool_part_id','decision','reason','message','created_at'
      )
    )
    AND json_extract(NEW.payload,'$.response_id')=NEW.id
    AND json_extract(NEW.payload,'$.task_id')=NEW.task_id
    AND json_type(NEW.payload,'$.request_id')='text'
    AND json_type(NEW.payload,'$.frontier_id')='text'
    AND json_type(NEW.payload,'$.action_id')='text'
    AND json_type(NEW.payload,'$.execution_epoch')='integer'
    AND json_extract(NEW.payload,'$.execution_epoch') BETWEEN 1 AND 9007199254740991
    AND json_type(NEW.payload,'$.orchestrator_session_id')='text'
    AND json_type(NEW.payload,'$.orchestrator_message_id')='text'
    AND json_type(NEW.payload,'$.orchestrator_tool_call_id')='text'
    AND length(json_extract(NEW.payload,'$.orchestrator_tool_call_id')) > 0
    AND json_type(NEW.payload,'$.orchestrator_tool_part_id')='text'
    AND json_extract(NEW.payload,'$.decision') IN ('cancel_worker','redispatch','fail_task','ask_user','acknowledge_terminal')
    AND json_type(NEW.payload,'$.reason')='text'
    AND length(json_extract(NEW.payload,'$.reason')) > 0
    AND (json_type(NEW.payload,'$.message') IS NULL OR (json_type(NEW.payload,'$.message')='text' AND length(json_extract(NEW.payload,'$.message')) > 0))
    AND json_type(NEW.payload,'$.created_at')='integer'
    AND json_extract(NEW.payload,'$.created_at') BETWEEN 1 AND 9007199254740991
    AND json_extract(NEW.payload,'$.created_at')=NEW.time_created
    AND EXISTS (
      SELECT 1 FROM engine_artifact request
      WHERE request.id=json_extract(NEW.payload,'$.request_id')
        AND request.task_id=NEW.task_id
        AND request.kind='agent_coordination_request'
        AND json_extract(request.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
        AND NEW.time_created > request.time_created
    )
    AND json_extract(NEW.payload,'$.execution_epoch') = (
      SELECT MAX(json_extract(opened.payload,'$.execution_epoch'))
      FROM protocol_event opened
      WHERE opened.aggregate_type='task'
        AND opened.aggregate_id=NEW.task_id
        AND opened.type IN ('task.execution.opened','task.execution.reopened')
    )
    AND NOT EXISTS (
      SELECT 1 FROM protocol_event deleted
      WHERE deleted.aggregate_type='task'
        AND deleted.aggregate_id=NEW.task_id
        AND deleted.type='task.deleted'
    )
    AND (
      (
        json_extract(NEW.payload,'$.decision')='acknowledge_terminal'
        AND EXISTS (
          SELECT 1 FROM protocol_event terminal
          WHERE terminal.aggregate_type='task'
            AND terminal.aggregate_id=NEW.task_id
            AND terminal.type IN ('task.completed','task.failed','task.cancelled')
            AND json_extract(terminal.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
        )
      )
      OR (
        json_extract(NEW.payload,'$.decision')!='acknowledge_terminal'
        AND NOT EXISTS (
          SELECT 1 FROM protocol_event boundary
          WHERE boundary.aggregate_type='task'
            AND boundary.aggregate_id=NEW.task_id
            AND boundary.type IN ('task.completed','task.failed','task.cancelled','task.cancellation.requested')
            AND json_extract(boundary.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
        )
      )
    )
    AND (
      (
        json_type(NEW.payload,'$.previous_failed_outcome_id')='null'
        AND json_extract(NEW.payload,'$.frontier_id')=json_extract(NEW.payload,'$.request_id')
      )
      OR (
        json_type(NEW.payload,'$.previous_failed_outcome_id')='text'
        AND json_extract(NEW.payload,'$.frontier_id')=json_extract(NEW.payload,'$.previous_failed_outcome_id')
        AND EXISTS (
          SELECT 1 FROM engine_artifact failed
          WHERE failed.id=json_extract(NEW.payload,'$.previous_failed_outcome_id')
            AND failed.task_id=NEW.task_id
            AND failed.kind='agent_coordination_action_outcome'
            AND json_extract(failed.payload,'$.request_id')=json_extract(NEW.payload,'$.request_id')
            AND json_extract(failed.payload,'$.status')='failed'
            AND NEW.time_created > failed.time_created
        )
      )
    )
    AND EXISTS (
      SELECT 1
      FROM tool_part_request part
      JOIN message ON message.id=part.message_id
      JOIN session orchestrator ON orchestrator.id=message.session_id
      WHERE part.id=json_extract(NEW.payload,'$.orchestrator_tool_part_id')
        AND part.message_id=json_extract(NEW.payload,'$.orchestrator_message_id')
        AND message.session_id=json_extract(NEW.payload,'$.orchestrator_session_id')
        AND json_extract(part.data,'$.callID')=json_extract(NEW.payload,'$.orchestrator_tool_call_id')
        AND json_extract(part.data,'$.tool')='respond_agent_coordination'
        AND orchestrator.kind='orchestrator'
        AND EXISTS (
          WITH RECURSIVE task_session_tree(id) AS (
            SELECT task.session_id FROM engine_task task
            WHERE task.id=NEW.task_id
              AND task.project_id=orchestrator.project_id
              AND task.session_id IS NOT NULL
            UNION ALL
            SELECT child.id FROM session child
            JOIN task_session_tree parent ON child.parent_id=parent.id
          )
          SELECT 1 FROM task_session_tree WHERE id=orchestrator.id
        )
        AND json_extract(message.data,'$.role')='assistant'
        AND json_extract(message.data,'$.author')='orchestrator'
        AND json_extract(part.data,'$.input.request_id')=json_extract(NEW.payload,'$.request_id')
        AND json_extract(part.data,'$.input.decision')=json_extract(NEW.payload,'$.decision')
        AND json_extract(part.data,'$.input.reason')=json_extract(NEW.payload,'$.reason')
        AND (
          (json_type(NEW.payload,'$.message') IS NULL AND json_type(part.data,'$.input.message') IS NULL)
          OR json_extract(part.data,'$.input.message')=json_extract(NEW.payload,'$.message')
        )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: invalid immutable agent coordination response fact');
END;

CREATE TRIGGER IF NOT EXISTS engine_agent_coordination_action_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'agent_coordination_action'
  AND NOT (
    json_valid(NEW.payload)
    AND json_type(NEW.payload)='object'
    AND (SELECT COUNT(*) FROM json_each(NEW.payload))=(SELECT COUNT(DISTINCT key) FROM json_each(NEW.payload))
    AND NOT EXISTS (
      SELECT 1 FROM json_each(NEW.payload)
      WHERE key NOT IN (
        'action_id','request_id','response_id','task_id','execution_epoch','orchestrator_session_id',
        'orchestrator_message_id','orchestrator_tool_call_id','orchestrator_tool_part_id','action','decision',
        'target_session_id','target_agent','delivery_slice_subject','reason','redispatch_binding','created_at'
      )
    )
    AND json_extract(NEW.payload,'$.action_id')=NEW.id
    AND json_extract(NEW.payload,'$.task_id')=NEW.task_id
    AND json_type(NEW.payload,'$.request_id')='text'
    AND json_type(NEW.payload,'$.response_id')='text'
    AND json_type(NEW.payload,'$.execution_epoch')='integer'
    AND json_extract(NEW.payload,'$.execution_epoch') BETWEEN 1 AND 9007199254740991
    AND json_type(NEW.payload,'$.orchestrator_session_id')='text'
    AND json_type(NEW.payload,'$.orchestrator_message_id')='text'
    AND json_type(NEW.payload,'$.orchestrator_tool_call_id')='text'
    AND length(json_extract(NEW.payload,'$.orchestrator_tool_call_id')) > 0
    AND json_type(NEW.payload,'$.orchestrator_tool_part_id')='text'
    AND json_type(NEW.payload,'$.target_session_id')='text'
    AND json_type(NEW.payload,'$.target_agent')='text'
    AND length(json_extract(NEW.payload,'$.target_agent')) > 0
    AND (
      json_type(NEW.payload,'$.delivery_slice_subject') IS NULL
      OR (
        json_type(NEW.payload,'$.delivery_slice_subject')='text'
        AND length(json_extract(NEW.payload,'$.delivery_slice_subject')) > 0
      )
    )
    AND json_type(NEW.payload,'$.reason')='text'
    AND length(json_extract(NEW.payload,'$.reason')) > 0
    AND json_type(NEW.payload,'$.created_at')='integer'
    AND json_extract(NEW.payload,'$.created_at') BETWEEN 1 AND 9007199254740991
    AND json_extract(NEW.payload,'$.created_at')=NEW.time_created
    AND json_extract(NEW.payload,'$.execution_epoch') = (
      SELECT MAX(json_extract(opened.payload,'$.execution_epoch'))
      FROM protocol_event opened
      WHERE opened.aggregate_type='task'
        AND opened.aggregate_id=NEW.task_id
        AND opened.type IN ('task.execution.opened','task.execution.reopened')
    )
    AND NOT EXISTS (
      SELECT 1 FROM protocol_event deleted
      WHERE deleted.aggregate_type='task'
        AND deleted.aggregate_id=NEW.task_id
        AND deleted.type='task.deleted'
    )
    AND (
      (
        json_extract(NEW.payload,'$.decision')='acknowledge_terminal'
        AND EXISTS (
          SELECT 1 FROM protocol_event terminal
          WHERE terminal.aggregate_type='task'
            AND terminal.aggregate_id=NEW.task_id
            AND terminal.type IN ('task.completed','task.failed','task.cancelled')
            AND json_extract(terminal.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
        )
      )
      OR (
        json_extract(NEW.payload,'$.decision')!='acknowledge_terminal'
        AND NOT EXISTS (
          SELECT 1 FROM protocol_event boundary
          WHERE boundary.aggregate_type='task'
            AND boundary.aggregate_id=NEW.task_id
            AND boundary.type IN ('task.completed','task.failed','task.cancelled','task.cancellation.requested')
            AND json_extract(boundary.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
        )
      )
    )
    AND (
      (json_extract(NEW.payload,'$.decision')='redispatch' AND json_extract(NEW.payload,'$.action')='redispatch_worker' AND json_type(NEW.payload,'$.redispatch_binding')='object')
      OR (json_extract(NEW.payload,'$.decision')!='redispatch' AND json_extract(NEW.payload,'$.action')=json_extract(NEW.payload,'$.decision') AND json_type(NEW.payload,'$.redispatch_binding') IS NULL)
    )
    AND EXISTS (
      SELECT 1
      FROM engine_artifact response
      JOIN engine_artifact request
        ON request.id=json_extract(response.payload,'$.request_id')
       AND request.task_id=response.task_id
       AND request.kind='agent_coordination_request'
      WHERE response.id=json_extract(NEW.payload,'$.response_id')
        AND response.task_id=NEW.task_id
        AND response.kind='agent_coordination_response'
        AND NEW.time_created=response.time_created
        AND json_extract(response.payload,'$.action_id')=NEW.id
        AND json_extract(response.payload,'$.request_id')=json_extract(NEW.payload,'$.request_id')
        AND json_extract(response.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
        AND json_extract(response.payload,'$.decision')=json_extract(NEW.payload,'$.decision')
        AND json_extract(response.payload,'$.orchestrator_session_id')=json_extract(NEW.payload,'$.orchestrator_session_id')
        AND json_extract(response.payload,'$.orchestrator_message_id')=json_extract(NEW.payload,'$.orchestrator_message_id')
        AND json_extract(response.payload,'$.orchestrator_tool_call_id')=json_extract(NEW.payload,'$.orchestrator_tool_call_id')
        AND json_extract(response.payload,'$.orchestrator_tool_part_id')=json_extract(NEW.payload,'$.orchestrator_tool_part_id')
        AND json_extract(response.payload,'$.reason')=json_extract(NEW.payload,'$.reason')
        AND json_extract(request.payload,'$.session_id')=json_extract(NEW.payload,'$.target_session_id')
        AND json_extract(request.payload,'$.agent')=json_extract(NEW.payload,'$.target_agent')
        AND json_extract(request.payload,'$.delivery_slice_subject') IS json_extract(NEW.payload,'$.delivery_slice_subject')
        AND (
          json_extract(NEW.payload,'$.decision')!='redispatch'
          OR (
            (SELECT COUNT(*) FROM json_each(NEW.payload,'$.redispatch_binding'))=10
            AND (SELECT COUNT(*) FROM json_each(NEW.payload,'$.redispatch_binding'))=(SELECT COUNT(DISTINCT key) FROM json_each(NEW.payload,'$.redispatch_binding'))
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload,'$.redispatch_binding')
              WHERE key NOT IN (
                'identity','expertSquadID','workerTurnDescriptorID','workerTurnDescriptorHash',
                'sourceDispatchLineageID','sourceDispatchID','workflowBinding','workflowNodeID',
                'workflowOccurrenceID','deliverySliceRevisionIDs'
              )
            )
            AND json_extract(NEW.payload,'$.redispatch_binding.sourceDispatchLineageID')=json_extract(request.payload,'$.dispatch_lineage_id')
            AND json_extract(NEW.payload,'$.redispatch_binding.workerTurnDescriptorID')=json_extract(request.payload,'$.worker_binding.workerTurnDescriptorID')
            AND json_extract(NEW.payload,'$.redispatch_binding.workerTurnDescriptorHash')=json_extract(request.payload,'$.worker_binding.workerTurnDescriptorHash')
            AND json_extract(NEW.payload,'$.redispatch_binding.expertSquadID')=json_extract(request.payload,'$.worker_binding.expertSquadID')
            AND json(NEW.payload -> '$.redispatch_binding.identity')=json(request.payload -> '$.worker_binding.identity')
            AND EXISTS (
              SELECT 1 FROM engine_artifact lineage
              WHERE lineage.id=json_extract(NEW.payload,'$.redispatch_binding.sourceDispatchLineageID')
                AND lineage.task_id=NEW.task_id
                AND lineage.kind='dispatch_lineage'
                AND json_extract(lineage.payload,'$.dispatch_id')=json_extract(NEW.payload,'$.redispatch_binding.sourceDispatchID')
                AND json(lineage.payload -> '$.workflow_binding')=json(NEW.payload -> '$.redispatch_binding.workflowBinding')
                AND json_extract(lineage.payload,'$.workflow_node_id') IS json_extract(NEW.payload,'$.redispatch_binding.workflowNodeID')
                AND json_extract(lineage.payload,'$.workflow_occurrence_id')=json_extract(NEW.payload,'$.redispatch_binding.workflowOccurrenceID')
                AND json(lineage.payload -> '$.delivery_slice_revision_ids')=json(NEW.payload -> '$.redispatch_binding.deliverySliceRevisionIDs')
            )
          )
        )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: invalid immutable agent coordination action fact');
END;

CREATE TRIGGER IF NOT EXISTS engine_agent_coordination_outcome_insert
BEFORE INSERT ON engine_artifact
FOR EACH ROW
WHEN NEW.kind = 'agent_coordination_action_outcome'
  AND NOT (
    json_valid(NEW.payload)
    AND json_type(NEW.payload)='object'
    AND (SELECT COUNT(*) FROM json_each(NEW.payload))=(SELECT COUNT(DISTINCT key) FROM json_each(NEW.payload))
    AND NOT EXISTS (
      SELECT 1 FROM json_each(NEW.payload)
      WHERE key NOT IN ('outcome_id','request_id','response_id','action_id','task_id','execution_epoch','action','status','result','error','created_at')
    )
    AND json_extract(NEW.payload,'$.outcome_id')=NEW.id
    AND json_extract(NEW.payload,'$.task_id')=NEW.task_id
    AND json_type(NEW.payload,'$.request_id')='text'
    AND json_type(NEW.payload,'$.response_id')='text'
    AND json_type(NEW.payload,'$.action_id')='text'
    AND json_type(NEW.payload,'$.execution_epoch')='integer'
    AND json_extract(NEW.payload,'$.execution_epoch') BETWEEN 1 AND 9007199254740991
    AND json_extract(NEW.payload,'$.action') IN ('cancel_worker','redispatch_worker','fail_task','ask_user','acknowledge_terminal')
    AND json_extract(NEW.payload,'$.status') IN ('completed','failed')
    AND (json_type(NEW.payload,'$.result') IS NULL OR json_type(NEW.payload,'$.result')='object')
    AND ((json_extract(NEW.payload,'$.status')='failed' AND json_type(NEW.payload,'$.error')='text' AND length(json_extract(NEW.payload,'$.error')) > 0) OR (json_extract(NEW.payload,'$.status')!='failed' AND json_type(NEW.payload,'$.error') IS NULL))
    AND json_type(NEW.payload,'$.created_at')='integer'
    AND json_extract(NEW.payload,'$.created_at') BETWEEN 1 AND 9007199254740991
    AND json_extract(NEW.payload,'$.created_at')=NEW.time_created
    AND json_extract(NEW.payload,'$.execution_epoch') = (
      SELECT MAX(json_extract(opened.payload,'$.execution_epoch'))
      FROM protocol_event opened
      WHERE opened.aggregate_type='task'
        AND opened.aggregate_id=NEW.task_id
        AND opened.type IN ('task.execution.opened','task.execution.reopened')
    )
    AND EXISTS (
      SELECT 1 FROM engine_artifact action
      WHERE action.id=json_extract(NEW.payload,'$.action_id')
        AND action.task_id=NEW.task_id
        AND action.kind='agent_coordination_action'
        AND NEW.time_created >= action.time_created
        AND json_extract(action.payload,'$.request_id')=json_extract(NEW.payload,'$.request_id')
        AND json_extract(action.payload,'$.response_id')=json_extract(NEW.payload,'$.response_id')
        AND json_extract(action.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
        AND json_extract(action.payload,'$.action')=json_extract(NEW.payload,'$.action')
    )
    AND (
      json_extract(NEW.payload,'$.status')='failed'
      OR (
        json_extract(NEW.payload,'$.status')='completed'
        AND json_type(NEW.payload,'$.result')='object'
        AND (SELECT COUNT(*) FROM json_each(NEW.payload,'$.result'))=(
          SELECT COUNT(DISTINCT key) FROM json_each(NEW.payload,'$.result')
        )
        AND (
          (
            json_extract(NEW.payload,'$.action')='redispatch_worker'
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload,'$.result')
              WHERE key NOT IN (
                'dispatch_lineage_id','dispatch_id','dispatch_session_id','dispatch_agent_id',
                'work_scope','dispatch_bound','awaiting_explicit_dispatch'
              )
            )
            AND json_type(NEW.payload,'$.result.dispatch_lineage_id')='text'
            AND json_type(NEW.payload,'$.result.dispatch_id')='text'
            AND json_type(NEW.payload,'$.result.dispatch_session_id')='text'
            AND json_type(NEW.payload,'$.result.dispatch_agent_id')='text'
            AND json(NEW.payload -> '$.result.work_scope')=json('{"kind":"task"}')
            AND json_extract(NEW.payload,'$.result.dispatch_bound')=1
            AND json_extract(NEW.payload,'$.result.awaiting_explicit_dispatch')=0
            AND EXISTS (
              SELECT 1
              FROM engine_artifact lineage
              JOIN worker_turn_descriptor descriptor
                ON descriptor.task_id=NEW.task_id
               AND descriptor.session_id=json_extract(NEW.payload,'$.result.dispatch_session_id')
               AND json_extract(descriptor.payload,'$.dispatchTurn.current_dispatch_id')=json_extract(lineage.payload,'$.dispatch_id')
              WHERE lineage.id=json_extract(NEW.payload,'$.result.dispatch_lineage_id')
                AND lineage.task_id=NEW.task_id
                AND lineage.kind='dispatch_lineage'
                AND json_extract(lineage.payload,'$.coordination_action_id')=json_extract(NEW.payload,'$.action_id')
                AND json_extract(lineage.payload,'$.dispatch_id')=json_extract(NEW.payload,'$.result.dispatch_id')
                AND json_extract(lineage.payload,'$.child_session_id')=json_extract(NEW.payload,'$.result.dispatch_session_id')
                AND json_extract(lineage.payload,'$.target_agent_id')=json_extract(NEW.payload,'$.result.dispatch_agent_id')
                AND json(lineage.payload -> '$.projected_worker_identity')=json(descriptor.payload -> '$.identity')
                AND json(lineage.payload -> '$.workflow_binding')=json(descriptor.payload -> '$.dispatchTurn.workflow_binding')
                AND json_extract(lineage.payload,'$.workflow_node_id') IS json_extract(descriptor.payload,'$.dispatchTurn.workflow_node_id')
                AND json_extract(lineage.payload,'$.workflow_occurrence_id')=json_extract(descriptor.payload,'$.dispatchTurn.workflow_occurrence_id')
                AND json(lineage.payload -> '$.delivery_slice_revision_ids')=json(descriptor.payload -> '$.dispatchTurn.delivery_slice_revision_ids')
            )
          )
          OR (
            json_extract(NEW.payload,'$.action')='ask_user'
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload,'$.result')
              WHERE key NOT IN ('question_id','interaction_id','interaction_status')
            )
            AND json_type(NEW.payload,'$.result.question_id')='text'
            AND json_type(NEW.payload,'$.result.interaction_id')='text'
            AND json_extract(NEW.payload,'$.result.interaction_status') IN ('answered','rejected','expired')
            AND EXISTS (
              SELECT 1 FROM engine_interaction_request interaction
              JOIN engine_artifact action
                ON action.id=json_extract(NEW.payload,'$.action_id')
               AND action.task_id=NEW.task_id
               AND action.kind='agent_coordination_action'
              JOIN engine_interaction_outcome outcome ON outcome.interaction_id=interaction.id
              JOIN bus_publication_outbox publication ON publication.occurrence_id=outcome.source_occurrence_id
              JOIN bus_publication_outbox request_publication ON request_publication.occurrence_id=interaction.source_id
              WHERE interaction.id=json_extract(NEW.payload,'$.result.interaction_id')
                AND interaction.source_kind='bus_question'
                AND request_publication.occurrence_id='bus-occurrence:agent-coordination-question:' || action.id
                AND request_publication.event_type='question.asked'
                AND json_extract(NEW.payload,'$.result.question_id')='que_agent_coordination_' || action.id
                AND COALESCE(interaction.external_id,json_extract(request_publication.properties,'$.id'))=json_extract(NEW.payload,'$.result.question_id')
                AND COALESCE(interaction.task_id,NEW.task_id)=NEW.task_id
                AND COALESCE(interaction.session_id,json_extract(request_publication.properties,'$.sessionID'))=json_extract(action.payload,'$.orchestrator_session_id')
                AND json_extract(request_publication.properties,'$.sessionID')=json_extract(action.payload,'$.orchestrator_session_id')
                AND json_extract(request_publication.properties,'$.tool.messageID')=json_extract(action.payload,'$.orchestrator_message_id')
                AND json_extract(request_publication.properties,'$.tool.callID')=json_extract(action.payload,'$.orchestrator_tool_call_id')
                AND json_type(request_publication.properties,'$.questions')='array'
                AND (
                  interaction.payload IS NULL
                  OR (
                    json(interaction.payload -> '$.questions')=json(request_publication.properties -> '$.questions')
                    AND json(interaction.payload -> '$.tool')=json(request_publication.properties -> '$.tool')
                  )
                )
                AND outcome.outcome IS NULL
                AND outcome.response IS NULL
                AND outcome.time_created IS NULL
                AND publication.occurrence_id='bus-occurrence:question-terminal:' || json_extract(NEW.payload,'$.result.question_id')
                AND json_extract(publication.properties,'$.requestID')=COALESCE(interaction.external_id,json_extract(request_publication.properties,'$.id'))
                AND json_extract(publication.properties,'$.sessionID')=COALESCE(interaction.session_id,json_extract(request_publication.properties,'$.sessionID'))
                AND (
                  (publication.event_type='question.replied' AND json_extract(NEW.payload,'$.result.interaction_status')='answered')
                  OR (publication.event_type='question.rejected' AND json_extract(NEW.payload,'$.result.interaction_status')='rejected')
                  OR (publication.event_type='question.expired' AND json_extract(NEW.payload,'$.result.interaction_status')='expired')
                )
            )
          )
          OR (
            json_extract(NEW.payload,'$.action')='fail_task'
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload,'$.result')
              WHERE key NOT IN ('task_id','task_status','terminal_event_id')
            )
            AND json_extract(NEW.payload,'$.result.task_id')=NEW.task_id
            AND json_extract(NEW.payload,'$.result.task_status')='failed'
            AND EXISTS (
              SELECT 1 FROM protocol_event terminal
              WHERE terminal.id=json_extract(NEW.payload,'$.result.terminal_event_id')
                AND terminal.aggregate_type='task'
                AND terminal.aggregate_id=NEW.task_id
                AND terminal.type='task.failed'
                AND json_extract(terminal.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
            )
          )
          OR (
            json_extract(NEW.payload,'$.action')='acknowledge_terminal'
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload,'$.result')
              WHERE key NOT IN ('terminal_lifecycle_reference','terminal_ingress_id')
            )
            AND json_type(NEW.payload,'$.result.terminal_lifecycle_reference')='object'
            AND (SELECT COUNT(*) FROM json_each(NEW.payload,'$.result.terminal_lifecycle_reference'))=1
            AND (SELECT COUNT(*) FROM json_each(NEW.payload,'$.result.terminal_lifecycle_reference'))=(
              SELECT COUNT(DISTINCT key) FROM json_each(NEW.payload,'$.result.terminal_lifecycle_reference')
            )
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload,'$.result.terminal_lifecycle_reference')
              WHERE key != 'terminalEventID'
            )
            AND json_type(NEW.payload,'$.result.terminal_lifecycle_reference.terminalEventID')='text'
            AND length(json_extract(NEW.payload,'$.result.terminal_lifecycle_reference.terminalEventID')) > 0
            AND EXISTS (
              SELECT 1 FROM protocol_event terminal
              WHERE terminal.id=json_extract(NEW.payload,'$.result.terminal_lifecycle_reference.terminalEventID')
                AND terminal.aggregate_type='task'
                AND terminal.aggregate_id=NEW.task_id
                AND terminal.type IN ('task.cancelled','task.completed','task.failed')
                AND json_extract(terminal.payload,'$.execution_epoch')=json_extract(NEW.payload,'$.execution_epoch')
            )
            AND EXISTS (
              SELECT 1 FROM engine_task_root_ingress ingress
              WHERE ingress.id=json_extract(NEW.payload,'$.result.terminal_ingress_id')
                AND ingress.task_id=NEW.task_id
                AND ingress.source='engine_artifact'
                AND ingress.source_id=json_extract(NEW.payload,'$.request_id')
            )
          )
          OR (
            json_extract(NEW.payload,'$.action')='cancel_worker'
            AND NOT EXISTS (
              SELECT 1 FROM json_each(NEW.payload,'$.result')
              WHERE key NOT IN ('session_id','physical_cancelled','prompt_cancelled','summary')
            )
            AND json_type(NEW.payload,'$.result.session_id')='text'
            AND json_type(NEW.payload,'$.result.physical_cancelled') IN ('true','false')
            AND json_type(NEW.payload,'$.result.prompt_cancelled') IN ('true','false')
            AND json_extract(NEW.payload,'$.result.physical_cancelled')=json_extract(NEW.payload,'$.result.prompt_cancelled')
            AND json_type(NEW.payload,'$.result.summary')='text'
            AND length(json_extract(NEW.payload,'$.result.summary')) > 0
            AND EXISTS (
              SELECT 1 FROM engine_artifact action
              JOIN session target ON target.id=json_extract(action.payload,'$.target_session_id')
              JOIN engine_task task ON task.id=action.task_id AND task.project_id=target.project_id
              WHERE action.id=json_extract(NEW.payload,'$.action_id')
                AND action.task_id=NEW.task_id
                AND json_extract(action.payload,'$.target_session_id')=json_extract(NEW.payload,'$.result.session_id')
            )
          )
        )
      )
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: invalid immutable agent coordination action outcome fact');
END;

CREATE TRIGGER IF NOT EXISTS engine_agent_coordination_fact_no_update
BEFORE UPDATE ON engine_artifact
FOR EACH ROW
WHEN OLD.kind IN (
  'agent_coordination_request','agent_coordination_response','agent_coordination_action',
  'agent_coordination_action_outcome'
)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: agent coordination facts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS engine_agent_coordination_fact_no_delete
BEFORE DELETE ON engine_artifact
FOR EACH ROW
WHEN OLD.kind IN (
  'agent_coordination_request','agent_coordination_response','agent_coordination_action',
  'agent_coordination_action_outcome'
)
AND EXISTS (SELECT 1 FROM engine_task task WHERE task.id=OLD.task_id)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: agent coordination facts are immutable until Task retention');
END;

-- Architect ContractGraph and GoalGraphProjection rows are immutable
-- execution facts. Mutable coordination and ingress artifacts keep their dedicated
-- update protocols; these two kinds can only be superseded by appending a new
-- exact Artifact.
CREATE TRIGGER IF NOT EXISTS engine_goal_graph_artifact_immutable
BEFORE UPDATE ON engine_artifact
FOR EACH ROW
WHEN OLD.kind IN ('architect_contract_graph', 'goal_graph_projection', 'goal_workload')
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: domain publication facts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS engine_goal_exact_artifact_binding_insert
BEFORE INSERT ON engine_goal
FOR EACH ROW
WHEN
  (NEW.requirement_set_artifact_id IS NULL) != (NEW.requirement_set_artifact_sha256 IS NULL)
  OR (NEW.requirement_set_artifact_id IS NULL) != (NEW.requirement_set_artifact_revision IS NULL)
  OR (NEW.contract_graph_artifact_id IS NULL) != (NEW.contract_graph_artifact_sha256 IS NULL)
  OR (NEW.contract_graph_artifact_id IS NULL) != (NEW.contract_graph_artifact_revision IS NULL)
  OR (
    NEW.requirement_set_artifact_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM engine_artifact
      WHERE id = NEW.requirement_set_artifact_id
        AND task_id = NEW.task_id
        AND kind = 'requirement_set'
        AND catalog_revision = NEW.requirement_set_artifact_revision
        AND payload_sha256 = NEW.requirement_set_artifact_sha256
    )
    AND NOT EXISTS (
      SELECT 1 FROM engine_artifact_version
      WHERE artifact_id = NEW.requirement_set_artifact_id
        AND task_id = NEW.task_id
        AND kind = 'requirement_set'
        AND catalog_revision = NEW.requirement_set_artifact_revision
        AND payload_sha256 = NEW.requirement_set_artifact_sha256
    )
  )
  OR (
    NEW.contract_graph_artifact_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM engine_artifact
      WHERE id = NEW.contract_graph_artifact_id
        AND task_id = NEW.task_id
        AND kind = 'architect_contract_graph'
        AND catalog_revision = NEW.contract_graph_artifact_revision
        AND payload_sha256 = NEW.contract_graph_artifact_sha256
    )
    AND NOT EXISTS (
      SELECT 1 FROM engine_artifact_version
      WHERE artifact_id = NEW.contract_graph_artifact_id
        AND task_id = NEW.task_id
        AND kind = 'architect_contract_graph'
        AND catalog_revision = NEW.contract_graph_artifact_revision
        AND payload_sha256 = NEW.contract_graph_artifact_sha256
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_goal: Artifact bindings must be exact same-Task locators');
END;

CREATE TRIGGER IF NOT EXISTS engine_goal_immutable
BEFORE UPDATE ON engine_goal
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'engine_goal: Goal revisions are immutable; append a new revision fact');
END;

CREATE TRIGGER IF NOT EXISTS engine_goal_supersede_same_task_insert
BEFORE INSERT ON engine_goal
FOR EACH ROW
WHEN
  NEW.supersede_of IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM engine_goal
    WHERE id = NEW.supersede_of
      AND task_id = NEW.task_id
  )
BEGIN
  SELECT RAISE(ABORT, 'engine_goal: supersede_of must reference an existing Goal in the same Task');
END;

CREATE TRIGGER IF NOT EXISTS automation_definition_revision_no_update
BEFORE UPDATE ON automation
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'automation: definition revisions are immutable; append a revision');
END;

CREATE TRIGGER IF NOT EXISTS automation_definition_revision_no_delete
BEFORE DELETE ON automation
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'automation: definition revisions are immutable; append a tombstone revision');
END;

CREATE TRIGGER IF NOT EXISTS automation_definition_tombstone_no_update
BEFORE UPDATE ON automation_definition_tombstone FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_definition_tombstone: immutable deletion fact'); END;
CREATE TRIGGER IF NOT EXISTS automation_definition_tombstone_no_delete
BEFORE DELETE ON automation_definition_tombstone FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_definition_tombstone: immutable deletion fact'); END;

CREATE TRIGGER IF NOT EXISTS automation_fire_no_update
BEFORE UPDATE ON automation_fire FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire: immutable logical occurrence'); END;
CREATE TRIGGER IF NOT EXISTS automation_fire_no_delete
BEFORE DELETE ON automation_fire FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire: immutable logical occurrence'); END;

CREATE TRIGGER IF NOT EXISTS automation_fire_frontier_authority_insert
BEFORE INSERT ON automation_fire_frontier FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM automation AS revision
  JOIN automation_fire AS fire
    ON fire.id=NEW.fire_id
    AND fire.automation_revision_id=revision.id
  WHERE revision.id=NEW.automation_revision_id
    AND revision.definition_id=NEW.definition_id
    AND (revision.status='active' OR fire.origin IN ('manual_api','manual_tool'))
    AND NEW.available_at>=fire.scheduled_due_at
    AND NOT EXISTS (
      SELECT 1 FROM automation AS later
      WHERE later.definition_id=revision.definition_id
        AND (
          later.revision>revision.revision
          OR (later.revision=revision.revision AND later.id>revision.id)
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM automation_definition_tombstone AS tombstone
      WHERE tombstone.definition_id=revision.definition_id
        AND tombstone.revision>=revision.revision
    )
    AND NOT (
      EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=fire.id)
      AND NOT EXISTS (
        SELECT 1
        FROM automation_run AS run
        LEFT JOIN automation_run_receipt AS receipt ON receipt.id=(
          SELECT latest.id
          FROM automation_run_receipt AS latest
          WHERE latest.run_id=run.id
          ORDER BY latest.time_created DESC,latest.id DESC
          LIMIT 1
        )
        WHERE run.fire_id=fire.id
          AND (receipt.id IS NULL OR receipt.outcome='retry_wait')
      )
    )
    AND NOT (
      NOT EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=fire.id)
      AND EXISTS (
        SELECT 1
        FROM automation_fire_attempt AS attempt
        JOIN automation_fire_attempt_receipt AS receipt ON receipt.attempt_id=attempt.id
        WHERE attempt.fire_id=fire.id
          AND receipt.outcome='failed'
          AND NOT EXISTS (
            SELECT 1 FROM automation_fire_attempt AS later
            WHERE later.fire_id=fire.id
              AND (
                later.ordinal>attempt.ordinal
                OR (later.ordinal=attempt.ordinal AND later.id>attempt.id)
              )
          )
      )
    )
)
BEGIN SELECT RAISE(ABORT, 'automation_fire_frontier: invalid current Fire authority'); END;

CREATE TRIGGER IF NOT EXISTS automation_fire_frontier_authority_update
BEFORE UPDATE ON automation_fire_frontier FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM automation AS revision
  JOIN automation_fire AS fire
    ON fire.id=NEW.fire_id
    AND fire.automation_revision_id=revision.id
  WHERE revision.id=NEW.automation_revision_id
    AND revision.definition_id=NEW.definition_id
    AND (revision.status='active' OR fire.origin IN ('manual_api','manual_tool'))
    AND NEW.available_at>=fire.scheduled_due_at
    AND NOT EXISTS (
      SELECT 1 FROM automation AS later
      WHERE later.definition_id=revision.definition_id
        AND (
          later.revision>revision.revision
          OR (later.revision=revision.revision AND later.id>revision.id)
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM automation_definition_tombstone AS tombstone
      WHERE tombstone.definition_id=revision.definition_id
        AND tombstone.revision>=revision.revision
    )
    AND NOT (
      EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=fire.id)
      AND NOT EXISTS (
        SELECT 1
        FROM automation_run AS run
        LEFT JOIN automation_run_receipt AS receipt ON receipt.id=(
          SELECT latest.id
          FROM automation_run_receipt AS latest
          WHERE latest.run_id=run.id
          ORDER BY latest.time_created DESC,latest.id DESC
          LIMIT 1
        )
        WHERE run.fire_id=fire.id
          AND (receipt.id IS NULL OR receipt.outcome='retry_wait')
      )
    )
    AND NOT (
      NOT EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=fire.id)
      AND EXISTS (
        SELECT 1
        FROM automation_fire_attempt AS attempt
        JOIN automation_fire_attempt_receipt AS receipt ON receipt.attempt_id=attempt.id
        WHERE attempt.fire_id=fire.id
          AND receipt.outcome='failed'
          AND NOT EXISTS (
            SELECT 1 FROM automation_fire_attempt AS later
            WHERE later.fire_id=fire.id
              AND (
                later.ordinal>attempt.ordinal
                OR (later.ordinal=attempt.ordinal AND later.id>attempt.id)
              )
          )
      )
    )
)
BEGIN SELECT RAISE(ABORT, 'automation_fire_frontier: invalid current Fire authority'); END;

CREATE TRIGGER IF NOT EXISTS automation_delay_settlement_no_update
BEFORE UPDATE ON automation_delay_settlement FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_delay_settlement: immutable admission settlement'); END;
CREATE TRIGGER IF NOT EXISTS automation_delay_settlement_no_delete
BEFORE DELETE ON automation_delay_settlement FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_delay_settlement: immutable admission settlement'); END;
CREATE TRIGGER IF NOT EXISTS automation_delay_settlement_lineage_insert
BEFORE INSERT ON automation_delay_settlement FOR EACH ROW
WHEN
  json_type(NEW.accepted_input_message_ids)<>'array'
  OR json_array_length(NEW.accepted_input_message_ids)=0
  OR NOT EXISTS (
    SELECT 1
    FROM automation AS definition
    JOIN message AS assistant
      ON assistant.id=NEW.assistant_message_id
      AND assistant.session_id=definition.session_id
      AND json_extract(assistant.data,'$.role')='assistant'
    WHERE definition.definition_id=NEW.definition_id
      AND definition.kind='delay'
      AND definition.session_id IS NOT NULL
      AND json_type(assistant.data,'$.acceptedInputMessageIDs')='array'
      AND json(json_extract(assistant.data,'$.acceptedInputMessageIDs'))=json(NEW.accepted_input_message_ids)
  )
  OR EXISTS (
    SELECT 1
    FROM json_each(NEW.accepted_input_message_ids) AS accepted
    LEFT JOIN message AS input ON input.id=accepted.value
    JOIN automation AS definition ON definition.definition_id=NEW.definition_id
    WHERE input.id IS NULL
      OR input.session_id<>definition.session_id
      OR json_extract(input.data,'$.role')<>'user'
  )
  OR (
    NEW.disposition='due_accepted'
    AND NOT EXISTS (
      SELECT 1
      FROM json_each(NEW.accepted_input_message_ids) AS accepted
      JOIN message AS wake
        ON wake.id=accepted.value
        AND json_extract(wake.data,'$.role')='user'
      JOIN automation_fire AS fire
        ON fire.id=NEW.fire_id
      JOIN automation AS definition
        ON definition.id=fire.automation_revision_id
      JOIN automation_run AS run
        ON run.fire_id=fire.id
        AND run.automation_revision_id=fire.automation_revision_id
      WHERE definition.definition_id=NEW.definition_id
        AND definition.kind='delay'
        AND wake.session_id=definition.session_id
        AND json_extract(wake.data,'$.extra.wake_reason.source')='scheduler.automation'
        AND json_extract(wake.data,'$.extra.wake_reason.jobID')=definition.definition_id
        AND json_extract(wake.data,'$.extra.wake_reason.fireID')=fire.id
        AND (
          SELECT count(*) FROM automation_run AS exact_run
          WHERE exact_run.fire_id=fire.id
            AND exact_run.automation_revision_id=fire.automation_revision_id
        )=1
    )
  )
BEGIN SELECT RAISE(ABORT, 'automation_delay_settlement: invalid Session delay admission lineage'); END;

CREATE TRIGGER IF NOT EXISTS automation_fire_attempt_no_update
BEFORE UPDATE ON automation_fire_attempt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire_attempt: immutable physical attempt'); END;
CREATE TRIGGER IF NOT EXISTS automation_fire_attempt_no_delete
BEFORE DELETE ON automation_fire_attempt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire_attempt: immutable physical attempt'); END;
CREATE TRIGGER IF NOT EXISTS engine_control_activation_lease_grant_no_update
BEFORE UPDATE ON engine_control_activation_lease_grant FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_control_activation_lease_grant: immutable lease grant'); END;
CREATE TRIGGER IF NOT EXISTS engine_control_activation_lease_grant_no_delete
BEFORE DELETE ON engine_control_activation_lease_grant FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_control_activation_lease_grant: immutable lease grant'); END;
CREATE TRIGGER IF NOT EXISTS engine_control_activation_lease_grant_insert
BEFORE INSERT ON engine_control_activation_lease_grant FOR EACH ROW
WHEN NEW.ordinal<>(
    SELECT COALESCE(max(existing.ordinal),0)+1
    FROM engine_control_activation_lease_grant AS existing
    WHERE existing.lease_id=NEW.lease_id
  )
  OR NOT EXISTS (
    SELECT 1
    FROM engine_control_activation_lease AS lease
    WHERE lease.id=NEW.lease_id
      AND lease.expires_at=NEW.expires_at
      AND lease.time_activated<=NEW.time_created
      AND NEW.expires_at>NEW.time_created
  )
BEGIN SELECT RAISE(ABORT, 'engine_control_activation_lease_grant: invalid grant authority'); END;
CREATE TRIGGER IF NOT EXISTS automation_fire_attempt_admission_insert
BEFORE INSERT ON automation_fire_attempt FOR EACH ROW
WHEN
  NEW.ordinal<>(
    SELECT COALESCE(max(existing.ordinal),0)+1
    FROM automation_fire_attempt AS existing
    WHERE existing.fire_id=NEW.fire_id
  )
  OR NOT EXISTS (
    SELECT 1
    FROM automation_fire AS fire
    JOIN automation AS definition ON definition.id=fire.automation_revision_id
    JOIN engine_control_activation_lease AS lease
      ON lease.target='automation'
      AND lease.id=NEW.lease_id
      AND lease.target_id=definition.definition_id
      AND lease.owner_occurrence_id=NEW.owner_occurrence_id
      AND NEW.lease_expires_at=lease.expires_at
      AND NEW.lease_expires_at>NEW.time_created
    JOIN engine_control_activation_lease_grant AS grant_authority
      ON grant_authority.lease_id=lease.id
      AND grant_authority.ordinal=NEW.lease_grant_ordinal
      AND grant_authority.expires_at=NEW.lease_expires_at
      AND grant_authority.time_created<=NEW.time_created
      AND NOT EXISTS (
        SELECT 1 FROM engine_control_activation_lease_grant AS later_grant
        WHERE later_grant.lease_id=grant_authority.lease_id
          AND later_grant.ordinal>grant_authority.ordinal
      )
    WHERE fire.id=NEW.fire_id
      AND NOT EXISTS (
        SELECT 1
        FROM engine_control_activation_lease AS later
        WHERE later.target='automation'
          AND later.target_id=definition.definition_id
          AND (
            later.time_activated>lease.time_activated
            OR (later.time_activated=lease.time_activated AND later.id>lease.id)
          )
      )
  )
BEGIN SELECT RAISE(ABORT, 'automation_fire_attempt: invalid ordinal or owner admission'); END;
CREATE TRIGGER IF NOT EXISTS automation_fire_attempt_receipt_no_update
BEFORE UPDATE ON automation_fire_attempt_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire_attempt_receipt: immutable attempt receipt'); END;
CREATE TRIGGER IF NOT EXISTS automation_fire_attempt_receipt_no_delete
BEFORE DELETE ON automation_fire_attempt_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_fire_attempt_receipt: immutable attempt receipt'); END;
CREATE TRIGGER IF NOT EXISTS automation_fire_attempt_terminal_frontier_insert
BEFORE INSERT ON automation_fire_attempt_receipt FOR EACH ROW
WHEN NEW.outcome='failed' AND EXISTS (
  SELECT 1
  FROM automation_fire_attempt AS attempt
  JOIN automation_fire_frontier AS frontier ON frontier.fire_id=attempt.fire_id
  WHERE attempt.id=NEW.attempt_id
    AND NOT EXISTS (SELECT 1 FROM automation_run AS run WHERE run.fire_id=attempt.fire_id)
    AND NOT EXISTS (
      SELECT 1 FROM automation_fire_attempt AS later
      WHERE later.fire_id=attempt.fire_id
        AND (
          later.ordinal>attempt.ordinal
          OR (later.ordinal=attempt.ordinal AND later.id>attempt.id)
        )
    )
)
BEGIN SELECT RAISE(ABORT, 'automation_fire_attempt_receipt: terminal settlement must advance the Fire frontier'); END;

CREATE TRIGGER IF NOT EXISTS automation_run_no_update
BEFORE UPDATE ON automation_run
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'automation_run: execution input is immutable; append a receipt');
END;

CREATE TRIGGER IF NOT EXISTS automation_run_no_delete
BEFORE DELETE ON automation_run
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'automation_run: execution history is immutable');
END;

CREATE TRIGGER IF NOT EXISTS automation_run_fire_revision_insert
BEFORE INSERT ON automation_run
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM automation_fire
  WHERE id=NEW.fire_id AND automation_revision_id=NEW.automation_revision_id
)
BEGIN
  SELECT RAISE(ABORT, 'automation_run: logical fire belongs to another definition revision');
END;

CREATE TRIGGER IF NOT EXISTS automation_run_mission_reservation_insert
BEFORE INSERT ON automation_run
FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM automation AS definition
  LEFT JOIN session AS target ON target.id=definition.session_id
  LEFT JOIN protocol_event AS opened ON opened.id=NEW.mission_opened_event_id
  LEFT JOIN protocol_event AS closure ON closure.id=NEW.mission_closure_event_id
  WHERE definition.id=NEW.automation_revision_id
    AND (
      (
        target.kind='mission'
        AND (
          (
            NEW.mission_opened_event_id IS NOT NULL
            AND NEW.mission_disposition IS NULL
            AND NEW.mission_closure_event_id IS NULL
            AND opened.aggregate_type='session'
            AND opened.aggregate_id=definition.session_id
            AND opened.type='mission.execution.opened'
          )
          OR (
            NEW.mission_opened_event_id IS NULL
            AND NEW.mission_disposition='mission_closed'
            AND NEW.mission_closure_event_id IS NOT NULL
            AND closure.aggregate_type='session'
            AND closure.aggregate_id=definition.session_id
            AND closure.type IN ('mission.execution.closing','mission.execution.closed')
          )
        )
      )
      OR (
        COALESCE(target.kind,'')<>'mission'
        AND NEW.mission_opened_event_id IS NULL
        AND NEW.mission_disposition IS NULL
        AND NEW.mission_closure_event_id IS NULL
      )
    )
)
BEGIN
  SELECT RAISE(ABORT, 'automation_run: Mission target requires one exact active or terminal reservation');
END;

-- An accepted Task-root Message is frozen in content, not in place. Delivery
-- moves it from the Task-root Session into the Orchestrator Session, which
-- rewrites only its Session, its timeline position, and the matching `time`
-- and `orderKey` inside `data` -- not one word of what was said. Freezing
-- the row outright made that move impossible, so a Message accepted before it
-- was delivered could never be delivered at all: every wake replayed the same
-- refused relocation and the Task died holding it. The exemption is therefore
-- exactly one shape -- a relocation that leaves the causal content identical --
-- and every other update, including a bare timestamp bump in place, still aborts.
CREATE TRIGGER IF NOT EXISTS task_root_source_message_no_update
BEFORE UPDATE ON message
FOR EACH ROW
WHEN (
    EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='message' AND source_id=OLD.id)
    OR EXISTS (SELECT 1 FROM protocol_event WHERE json_extract(payload,'$.inputMessageID')=OLD.id)
  )
  AND NOT (
    NEW.id = OLD.id
    AND NEW.session_id <> OLD.session_id
    AND json_remove(NEW.data, '$.time', '$.orderKey') IS json_remove(OLD.data, '$.time', '$.orderKey')
  )
BEGIN
  SELECT RAISE(ABORT, 'message: accepted Task-root causal facts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS deleted_task_no_update
BEFORE UPDATE ON engine_task FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=OLD.id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'engine_task: deleted aggregate is immutable'); END;

CREATE TRIGGER IF NOT EXISTS engine_task_project_no_update
BEFORE UPDATE OF project_id ON engine_task FOR EACH ROW
WHEN NEW.project_id IS NOT OLD.project_id
BEGIN SELECT RAISE(ABORT, 'engine_task: Project authority is immutable'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_protocol_no_insert
BEFORE INSERT ON protocol_event FOR EACH ROW
WHEN NEW.aggregate_type='task' AND NEW.type<>'task.deleted'
  AND EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.aggregate_id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'protocol_event: deleted Task rejects new lifecycle facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_ingress_no_insert
BEFORE INSERT ON engine_task_root_ingress FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.task_id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'engine_task_root_ingress: deleted Task rejects new input'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_artifact_no_insert
BEFORE INSERT ON engine_artifact FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.task_id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'engine_artifact: deleted Task rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_interaction_no_insert
BEFORE INSERT ON engine_interaction_request FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.task_id AND type='task.deleted')
  OR (
    NEW.source_kind='permission_request' AND EXISTS (
      SELECT 1 FROM permission_ledger
      JOIN protocol_event ON protocol_event.aggregate_type='task'
        AND protocol_event.aggregate_id=permission_ledger.task_id
        AND protocol_event.type='task.deleted'
      WHERE permission_ledger.id=NEW.source_id
    )
  )
  OR (
    NEW.source_kind='bus_question' AND EXISTS (
      WITH RECURSIVE source_session(id,parent_id) AS (
        SELECT session.id,session.parent_id
        FROM bus_publication_outbox
        JOIN session ON session.id=json_extract(bus_publication_outbox.properties,'$.sessionID')
        WHERE bus_publication_outbox.occurrence_id=NEW.source_id
        UNION ALL
        SELECT session.id,session.parent_id FROM session
        JOIN source_session ON session.id=source_session.parent_id
      )
      SELECT 1 FROM source_session
      JOIN engine_task ON engine_task.session_id=source_session.id
      JOIN protocol_event ON protocol_event.aggregate_type='task'
        AND protocol_event.aggregate_id=engine_task.id
        AND protocol_event.type='task.deleted'
    )
  )
BEGIN SELECT RAISE(ABORT, 'engine_interaction_request: deleted Task rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_progress_no_insert
BEFORE INSERT ON engine_progress_snapshot FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.task_id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'engine_progress_snapshot: deleted Task rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_task_goal_no_insert
BEFORE INSERT ON engine_goal FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='task' AND aggregate_id=NEW.task_id AND type='task.deleted')
BEGIN SELECT RAISE(ABORT, 'engine_goal: deleted Task rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_no_update
BEFORE UPDATE ON session FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='session' AND aggregate_id=OLD.id AND type='session.deleted')
BEGIN SELECT RAISE(ABORT, 'session: deleted aggregate is immutable'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_protocol_no_insert
BEFORE INSERT ON protocol_event FOR EACH ROW
WHEN NEW.aggregate_type='session' AND NEW.type<>'session.deleted'
  AND EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='session' AND aggregate_id=NEW.aggregate_id AND type='session.deleted')
BEGIN SELECT RAISE(ABORT, 'protocol_event: deleted Session rejects new lifecycle facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_message_no_insert
BEFORE INSERT ON message FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='session' AND aggregate_id=NEW.session_id AND type='session.deleted')
BEGIN SELECT RAISE(ABORT, 'message: deleted Session rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_message_no_update
BEFORE UPDATE ON message FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='session' AND aggregate_id=OLD.session_id AND type='session.deleted')
BEGIN SELECT RAISE(ABORT, 'message: deleted Session facts are immutable'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_part_no_insert
BEFORE INSERT ON part FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN protocol_event
    ON protocol_event.aggregate_type='session'
   AND protocol_event.aggregate_id=message.session_id
   AND protocol_event.type='session.deleted'
  WHERE message.id=NEW.message_id
)
BEGIN SELECT RAISE(ABORT, 'part: deleted Session rejects new facts'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_part_no_update
BEFORE UPDATE ON part FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN protocol_event
    ON protocol_event.aggregate_type='session'
   AND protocol_event.aggregate_id=message.session_id
   AND protocol_event.type='session.deleted'
  WHERE message.id=OLD.message_id
)
BEGIN SELECT RAISE(ABORT, 'part: deleted Session facts are immutable'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_tool_request_no_insert
BEFORE INSERT ON tool_part_request FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN protocol_event
    ON protocol_event.aggregate_type='session'
   AND protocol_event.aggregate_id=message.session_id
   AND protocol_event.type='session.deleted'
  WHERE message.id=NEW.message_id
)
BEGIN SELECT RAISE(ABORT, 'tool_part_request: deleted Session rejects new effects'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_provider_request_no_insert
BEFORE INSERT ON provider_activity_request FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN protocol_event
    ON protocol_event.aggregate_type='session'
   AND protocol_event.aggregate_id=message.session_id
   AND protocol_event.type='session.deleted'
  WHERE message.id=NEW.assistant_message_id
)
BEGIN SELECT RAISE(ABORT, 'provider_activity_request: deleted Session rejects new effects'); END;

CREATE TRIGGER IF NOT EXISTS deleted_session_control_no_insert
BEFORE INSERT ON session_control_record FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM protocol_event WHERE aggregate_type='session' AND aggregate_id=NEW.session_id AND type='session.deleted')
BEGIN SELECT RAISE(ABORT, 'session_control_record: deleted Session rejects new controls'); END;

CREATE TRIGGER IF NOT EXISTS assistant_effect_identity_immutable
BEFORE UPDATE ON message
FOR EACH ROW
WHEN json_extract(OLD.data,'$.role')='assistant'
  AND (
    json_type(OLD.data,'$.activationID')='text'
    OR EXISTS (SELECT 1 FROM provider_activity_request WHERE assistant_message_id=OLD.id)
    OR EXISTS (SELECT 1 FROM tool_part_request WHERE message_id=OLD.id)
  )
  AND (
    OLD.session_id IS NOT NEW.session_id
    OR json_extract(OLD.data,'$.role') IS NOT json_extract(NEW.data,'$.role')
    OR json_extract(OLD.data,'$.author') IS NOT json_extract(NEW.data,'$.author')
    OR json_extract(OLD.data,'$.parentID') IS NOT json_extract(NEW.data,'$.parentID')
    OR json_extract(OLD.data,'$.activationID') IS NOT json_extract(NEW.data,'$.activationID')
    OR json_extract(OLD.data,'$.agent') IS NOT json_extract(NEW.data,'$.agent')
    OR json_extract(OLD.data,'$.modelID') IS NOT json_extract(NEW.data,'$.modelID')
    OR json_extract(OLD.data,'$.providerID') IS NOT json_extract(NEW.data,'$.providerID')
  )
BEGIN
  SELECT RAISE(ABORT, 'message: assistant effect causal/model identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS completed_assistant_message_immutable
BEFORE UPDATE ON message
FOR EACH ROW
WHEN json_extract(OLD.data,'$.role')='assistant'
  AND json_type(OLD.data,'$.time.completed') IN ('integer','real')
  AND OLD.data <> NEW.data
BEGIN
  SELECT RAISE(ABORT, 'message: completed assistant is immutable');
END;

CREATE TRIGGER IF NOT EXISTS task_root_source_message_no_delete
BEFORE DELETE ON message
FOR EACH ROW
WHEN (
  EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='message' AND source_id=OLD.id)
  OR json_type(OLD.data, '$.activationID')='text'
  OR EXISTS (SELECT 1 FROM protocol_event WHERE json_extract(payload,'$.inputMessageID')=OLD.id)
  OR EXISTS (SELECT 1 FROM message child WHERE json_extract(child.data,'$.parentID')=OLD.id AND json_extract(child.data,'$.role')='assistant')
)
  AND EXISTS (SELECT 1 FROM session WHERE id=OLD.session_id)
BEGIN
  SELECT RAISE(ABORT, 'message: Task-root causal facts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS task_root_source_part_no_insert
BEFORE INSERT ON part
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='message' AND source_id=NEW.message_id)
  OR EXISTS (SELECT 1 FROM protocol_event WHERE json_extract(payload,'$.inputMessageID')=NEW.message_id)
BEGIN
  SELECT RAISE(ABORT, 'part: accepted Task-root input bundle is immutable');
END;

CREATE TRIGGER IF NOT EXISTS task_root_causal_part_no_delete
BEFORE DELETE ON part
FOR EACH ROW
WHEN (
  EXISTS (SELECT 1 FROM message WHERE id=OLD.message_id AND json_type(data,'$.activationID')='text')
  OR EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='message' AND source_id=OLD.message_id)
  OR EXISTS (SELECT 1 FROM protocol_event WHERE json_extract(payload,'$.inputMessageID')=OLD.message_id)
)
  AND EXISTS (
    SELECT 1 FROM message JOIN session ON session.id=message.session_id WHERE message.id=OLD.message_id
  )
BEGIN
  SELECT RAISE(ABORT, 'part: Task-root causal facts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS completed_assistant_part_no_insert
BEFORE INSERT ON part
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message
  WHERE id=NEW.message_id
    AND json_extract(data,'$.role')='assistant'
    AND json_type(data,'$.time.completed') IN ('integer','real')
    AND NOT (
      (
        json_extract(NEW.data,'$.type')='compaction'
        AND json_extract(data,'$.summary')=1
        AND json_extract(data,'$.author')='compaction'
      )
      OR (
        json_extract(NEW.data,'$.type') IN ('source-url','source-document','source-file','interactive-artifact')
        AND EXISTS (
          SELECT 1 FROM tool_part_request request
          JOIN tool_part_outcome outcome ON outcome.request_part_id=request.id
          WHERE request.id=json_extract(NEW.data,'$.toolPartID')
            AND request.message_id=NEW.message_id
            AND json_extract(outcome.data,'$.outcome')='completed'
        )
      )
    )
)
BEGIN
  SELECT RAISE(ABORT, 'part: completed assistant content is immutable');
END;

CREATE TRIGGER IF NOT EXISTS part_tool_result_binding_insert
BEFORE INSERT ON part
FOR EACH ROW
WHEN json_type(NEW.data,'$.toolPartID') IS NOT NULL
  AND NOT (
    json_extract(NEW.data,'$.type') IN ('source-url','source-document','source-file','interactive-artifact')
    AND json_type(NEW.data,'$.toolPartID')='text'
    AND EXISTS (
      SELECT 1 FROM tool_part_request request
      JOIN tool_part_outcome outcome ON outcome.request_part_id=request.id
      WHERE request.id=json_extract(NEW.data,'$.toolPartID') AND request.message_id=NEW.message_id
        AND json_extract(outcome.data,'$.outcome')='completed'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'part: Tool result binding requires its completed invocation');
END;

CREATE TRIGGER IF NOT EXISTS part_tool_result_binding_update
BEFORE UPDATE ON part
FOR EACH ROW
WHEN json_type(NEW.data,'$.toolPartID') IS NOT NULL
  AND NOT (
    json_extract(NEW.data,'$.type') IN ('source-url','source-document','source-file','interactive-artifact')
    AND json_type(NEW.data,'$.toolPartID')='text'
    AND EXISTS (
      SELECT 1 FROM tool_part_request request
      JOIN tool_part_outcome outcome ON outcome.request_part_id=request.id
      WHERE request.id=json_extract(NEW.data,'$.toolPartID') AND request.message_id=NEW.message_id
        AND json_extract(outcome.data,'$.outcome')='completed'
    )
  )
BEGIN
  SELECT RAISE(ABORT, 'part: Tool result binding requires its completed invocation');
END;

CREATE TRIGGER IF NOT EXISTS completed_assistant_part_no_update
BEFORE UPDATE ON part
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message
  WHERE id=OLD.message_id
    AND json_extract(data,'$.role')='assistant'
    AND json_type(data,'$.time.completed') IN ('integer','real')
)
  AND OLD.data <> NEW.data
BEGIN
  SELECT RAISE(ABORT, 'part: completed assistant content is immutable');
END;

CREATE TRIGGER IF NOT EXISTS completed_assistant_tool_request_no_insert
BEFORE INSERT ON tool_part_request
FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message
  WHERE id=NEW.message_id
    AND json_extract(data,'$.role')='assistant'
    AND json_type(data,'$.time.completed') IN ('integer','real')
)
BEGIN
  SELECT RAISE(ABORT, 'tool_part_request: cannot append after assistant completion');
END;

CREATE TRIGGER IF NOT EXISTS task_root_source_artifact_no_update
BEFORE UPDATE ON engine_artifact
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='engine_artifact' AND source_id=OLD.id)
  AND EXISTS (SELECT 1 FROM engine_task WHERE id=OLD.task_id)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: accepted Task-root source is immutable');
END;

CREATE TRIGGER IF NOT EXISTS task_root_source_artifact_no_delete
BEFORE DELETE ON engine_artifact
FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task_root_ingress WHERE source='engine_artifact' AND source_id=OLD.id)
BEGIN
  SELECT RAISE(ABORT, 'engine_artifact: accepted Task-root source is immutable');
END;

CREATE TRIGGER IF NOT EXISTS tool_part_request_no_update
BEFORE UPDATE ON tool_part_request FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'tool_part_request: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_request_no_delete
BEFORE DELETE ON tool_part_request FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN session ON session.id=message.session_id WHERE message.id=OLD.message_id
)
BEGIN SELECT RAISE(ABORT, 'tool_part_request: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_progress_running_insert
BEFORE INSERT ON tool_part_progress FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM tool_part_outcome WHERE request_part_id=NEW.request_part_id)
  OR EXISTS (
    SELECT 1 FROM tool_part_request
    JOIN message ON message.id=tool_part_request.message_id
    WHERE tool_part_request.id=NEW.request_part_id
      AND json_type(message.data,'$.time.completed') IN ('integer','real')
  )
  OR EXISTS (
    SELECT 1 FROM tool_part_request
    JOIN message ON message.id=tool_part_request.message_id
    JOIN protocol_event
      ON protocol_event.aggregate_type='session'
     AND protocol_event.aggregate_id=message.session_id
     AND protocol_event.type='session.deleted'
    WHERE tool_part_request.id=NEW.request_part_id
  )
BEGIN SELECT RAISE(ABORT, 'tool_part_progress: request is no longer running'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_progress_no_update
BEFORE UPDATE ON tool_part_progress FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'tool_part_progress: immutable progress fact'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_progress_no_delete
BEFORE DELETE ON tool_part_progress FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM tool_part_request
  JOIN message ON message.id=tool_part_request.message_id
  JOIN session ON session.id=message.session_id
  WHERE tool_part_request.id=OLD.request_part_id
)
BEGIN SELECT RAISE(ABORT, 'tool_part_progress: immutable progress fact'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_outcome_no_update
BEFORE UPDATE ON tool_part_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'tool_part_outcome: immutable outcome fact'); END;
CREATE TRIGGER IF NOT EXISTS tool_part_outcome_no_delete
BEFORE DELETE ON tool_part_outcome FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM tool_part_request
  JOIN message ON message.id=tool_part_request.message_id
  JOIN session ON session.id=message.session_id
  WHERE tool_part_request.id=OLD.request_part_id
)
BEGIN SELECT RAISE(ABORT, 'tool_part_outcome: immutable outcome fact'); END;
CREATE TRIGGER IF NOT EXISTS provider_activity_request_no_update
BEFORE UPDATE ON provider_activity_request FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'provider_activity_request: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS provider_activity_request_no_delete
BEFORE DELETE ON provider_activity_request FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM message JOIN session ON session.id=message.session_id WHERE message.id=OLD.assistant_message_id
)
BEGIN SELECT RAISE(ABORT, 'provider_activity_request: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS provider_activity_outcome_no_update
BEFORE UPDATE ON provider_activity_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'provider_activity_outcome: immutable outcome fact'); END;
CREATE TRIGGER IF NOT EXISTS provider_activity_outcome_no_delete
BEFORE DELETE ON provider_activity_outcome FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM provider_activity_request
  JOIN message ON message.id=provider_activity_request.assistant_message_id
  JOIN session ON session.id=message.session_id
  WHERE provider_activity_request.id=OLD.request_id
)
BEGIN SELECT RAISE(ABORT, 'provider_activity_outcome: immutable outcome fact'); END;

-- Permission evidence is immutable for as long as the Project it describes
-- exists. Both tables cascade from project, so the delete guards must yield to
-- that cascade the way provider_activity_outcome does: without the parent
-- probe the trigger aborts Project deletion itself and the row becomes
-- undeletable evidence of an unreachable Project. Ledger rows carrying no
-- project_id are outcome facts that no cascade ever reaches, so they stay
-- unconditionally immutable.
CREATE TRIGGER IF NOT EXISTS permission_policy_no_update
BEFORE UPDATE ON permission_policy FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'permission_policy: immutable policy fact'); END;
CREATE TRIGGER IF NOT EXISTS permission_policy_no_delete
BEFORE DELETE ON permission_policy FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM project WHERE id=OLD.project_id)
BEGIN SELECT RAISE(ABORT, 'permission_policy: immutable policy fact'); END;
CREATE TRIGGER IF NOT EXISTS permission_ledger_no_update
BEFORE UPDATE ON permission_ledger FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'permission_ledger: immutable authorization fact'); END;
CREATE TRIGGER IF NOT EXISTS permission_ledger_no_delete
BEFORE DELETE ON permission_ledger FOR EACH ROW
WHEN OLD.project_id IS NULL OR EXISTS (SELECT 1 FROM project WHERE id=OLD.project_id)
BEGIN SELECT RAISE(ABORT, 'permission_ledger: immutable authorization fact'); END;
CREATE TRIGGER IF NOT EXISTS permission_execution_result_no_update
BEFORE UPDATE ON permission_execution_result FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'permission_execution_result: immutable effect receipt'); END;
CREATE TRIGGER IF NOT EXISTS permission_execution_result_no_delete
BEFORE DELETE ON permission_execution_result FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'permission_execution_result: immutable effect receipt'); END;

CREATE TRIGGER IF NOT EXISTS channel_ingress_accepted_no_update
BEFORE UPDATE ON channel_ingress_accepted FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'channel_ingress_accepted: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS channel_ingress_accepted_no_delete
BEFORE DELETE ON channel_ingress_accepted FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'channel_ingress_accepted: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS channel_ingress_outcome_no_update
BEFORE UPDATE ON channel_ingress_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'channel_ingress_outcome: immutable effect receipt'); END;
CREATE TRIGGER IF NOT EXISTS channel_ingress_outcome_no_delete
BEFORE DELETE ON channel_ingress_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'channel_ingress_outcome: immutable effect receipt'); END;

CREATE TRIGGER IF NOT EXISTS engine_git_checkpoint_request_no_update
BEFORE UPDATE ON engine_git_checkpoint_request FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_git_checkpoint_request: immutable effect request'); END;
CREATE TRIGGER IF NOT EXISTS engine_git_checkpoint_request_no_delete
BEFORE DELETE ON engine_git_checkpoint_request FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id=OLD.task_id)
BEGIN SELECT RAISE(ABORT, 'engine_git_checkpoint_request: immutable effect request'); END;
CREATE TRIGGER IF NOT EXISTS engine_git_checkpoint_outcome_no_update
BEFORE UPDATE ON engine_git_checkpoint_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_git_checkpoint_outcome: immutable effect receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_git_checkpoint_outcome_no_delete
BEFORE DELETE ON engine_git_checkpoint_outcome FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_git_checkpoint_request WHERE id=OLD.request_id)
BEGIN SELECT RAISE(ABORT, 'engine_git_checkpoint_outcome: immutable effect receipt'); END;

CREATE TRIGGER IF NOT EXISTS event_job_definition_revision_no_update
BEFORE UPDATE ON event_job FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job: definition revisions are immutable; append a revision'); END;
CREATE TRIGGER IF NOT EXISTS event_job_definition_revision_no_delete
BEFORE DELETE ON event_job FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job: definition revisions are immutable; append a tombstone revision'); END;
CREATE TRIGGER IF NOT EXISTS event_job_definition_tombstone_no_update
BEFORE UPDATE ON event_job_definition_tombstone FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_definition_tombstone: immutable deletion fact'); END;
CREATE TRIGGER IF NOT EXISTS event_job_definition_tombstone_no_delete
BEFORE DELETE ON event_job_definition_tombstone FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_definition_tombstone: immutable deletion fact'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_no_update
BEFORE UPDATE ON event_job_fire FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_fire: occurrence input is immutable; append a receipt'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_no_delete
BEFORE DELETE ON event_job_fire FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_fire: occurrence history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_definition_insert
BEFORE INSERT ON event_job_fire FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM event_job AS definition
  WHERE definition.id=NEW.event_job_revision_id
    AND definition.definition_id=NEW.definition_id
)
BEGIN SELECT RAISE(ABORT, 'event_job_fire: definition queue authority mismatch'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_mission_reservation_insert
BEFORE INSERT ON event_job_fire FOR EACH ROW
WHEN (
  EXISTS (
    SELECT 1 FROM event_job AS definition
    JOIN session AS target ON target.id=definition.session_id
    WHERE definition.id=NEW.event_job_revision_id AND target.kind='mission'
  )
  AND NEW.mission_opened_event_id IS NULL
  AND NEW.mission_disposition IS NULL
  AND NEW.mission_closure_event_id IS NULL
) OR (
  NOT EXISTS (
    SELECT 1 FROM event_job AS definition
    JOIN session AS target ON target.id=definition.session_id
    WHERE definition.id=NEW.event_job_revision_id AND target.kind='mission'
  )
  AND (
    NEW.mission_opened_event_id IS NOT NULL
    OR NEW.mission_disposition IS NOT NULL
    OR NEW.mission_closure_event_id IS NOT NULL
  )
)
BEGIN
  SELECT RAISE(ABORT, 'event_job_fire: Mission target requires one exact active or terminal reservation');
END;
CREATE TRIGGER IF NOT EXISTS event_occurrence_no_update
BEFORE UPDATE ON event_occurrence FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_occurrence: input fact is immutable'); END;
CREATE TRIGGER IF NOT EXISTS event_occurrence_no_delete
BEFORE DELETE ON event_occurrence FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_occurrence: input history is immutable'); END;

CREATE TRIGGER IF NOT EXISTS bus_publication_outbox_no_update
BEFORE UPDATE ON bus_publication_outbox FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_outbox: publication input is immutable'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_outbox_no_delete
BEFORE DELETE ON bus_publication_outbox FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_outbox: publication history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_owner_no_update
BEFORE UPDATE ON bus_publication_owner FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_owner: immutable original Project occurrence'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_owner_no_delete
BEFORE DELETE ON bus_publication_owner FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_owner: original owner history is immutable'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_owner_insert
BEFORE INSERT ON bus_publication_owner FOR EACH ROW
WHEN NEW.project_generation IS NULL OR NOT EXISTS (
  SELECT 1 FROM bus_publication_outbox AS source JOIN project ON project.id=source.project_id
  WHERE source.occurrence_id=NEW.occurrence_id AND project.generation=NEW.project_generation
)
BEGIN SELECT RAISE(ABORT, 'bus_publication_owner: new source must bind its exact current Project'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_delivery_no_update
BEFORE UPDATE ON bus_publication_delivery FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_delivery: effect request is immutable'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_delivery_no_delete
BEFORE DELETE ON bus_publication_delivery FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_delivery: effect request history is immutable'); END;

CREATE TRIGGER IF NOT EXISTS protocol_event_task_project_insert
BEFORE INSERT ON protocol_event FOR EACH ROW
WHEN NEW.aggregate_type='task'
  AND NOT EXISTS (
    SELECT 1 FROM engine_task task
    WHERE task.id=NEW.aggregate_id AND task.project_id=NEW.project_id
  )
BEGIN SELECT RAISE(ABORT, 'protocol_event: Task Project authority mismatch'); END;
CREATE TRIGGER IF NOT EXISTS worker_turn_descriptor_task_project_insert
BEFORE INSERT ON worker_turn_descriptor FOR EACH ROW
WHEN json_extract(NEW.payload,'$.lifecycle.taskID') IS NOT NEW.task_id
  OR EXISTS (
    SELECT 1 FROM engine_artifact settlement
    WHERE settlement.task_id=NEW.task_id AND settlement.kind='dispatch_settlement'
      AND json_extract(settlement.payload,'$.dispatch_id')=json_extract(NEW.payload,'$.dispatchTurn.current_dispatch_id')
      AND json_extract(settlement.payload,'$.outcome.kind')='infrastructure_failure'
      AND json_type(settlement.payload,'$.outcome.session_id') IS NULL
  )
  OR NOT EXISTS (
    SELECT 1
    FROM engine_task task
    JOIN session ON session.id=NEW.session_id
    WHERE task.id=NEW.task_id
      AND task.project_id=NEW.project_id
      AND session.project_id=NEW.project_id
  )
  OR NOT EXISTS (
    SELECT 1 FROM engine_artifact lineage
    WHERE lineage.kind='dispatch_lineage'
      AND lineage.task_id=NEW.task_id
      AND json_extract(lineage.payload,'$.child_session_id')=NEW.session_id
      AND json_extract(lineage.payload,'$.dispatch_id')
        = json_extract(NEW.payload,'$.dispatchTurn.current_dispatch_id')
  )
BEGIN SELECT RAISE(ABORT, 'worker_turn_descriptor: Task Project or dispatch lineage authority mismatch'); END;
CREATE TRIGGER IF NOT EXISTS worker_turn_descriptor_no_update
BEFORE UPDATE ON worker_turn_descriptor FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'worker_turn_descriptor: immutable dispatch authority'); END;
CREATE TRIGGER IF NOT EXISTS worker_turn_descriptor_no_delete
BEFORE DELETE ON worker_turn_descriptor FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM session WHERE id=OLD.session_id)
BEGIN SELECT RAISE(ABORT, 'worker_turn_descriptor: immutable dispatch authority'); END;
CREATE TRIGGER IF NOT EXISTS protocol_event_no_update
BEFORE UPDATE ON protocol_event FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_event: immutable domain fact'); END;
CREATE TRIGGER IF NOT EXISTS protocol_event_no_delete
BEFORE DELETE ON protocol_event FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_event: immutable domain fact'); END;
CREATE TRIGGER IF NOT EXISTS protocol_inbox_no_update
BEFORE UPDATE ON protocol_inbox FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_inbox: immutable delivery request'); END;
CREATE TRIGGER IF NOT EXISTS protocol_inbox_no_delete
BEFORE DELETE ON protocol_inbox FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_inbox: immutable delivery request'); END;
CREATE TRIGGER IF NOT EXISTS protocol_delivery_receipt_no_update
BEFORE UPDATE ON protocol_delivery_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_delivery_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS protocol_delivery_receipt_no_delete
BEFORE DELETE ON protocol_delivery_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'protocol_delivery_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS automation_run_receipt_no_update
BEFORE UPDATE ON automation_run_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_run_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS automation_run_receipt_no_delete
BEFORE DELETE ON automation_run_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_run_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS automation_run_terminal_frontier_insert
BEFORE INSERT ON automation_run_receipt FOR EACH ROW
WHEN NEW.outcome<>'retry_wait' AND EXISTS (
  SELECT 1
  FROM automation_run AS settled
  JOIN automation_fire_frontier AS frontier ON frontier.fire_id=settled.fire_id
  WHERE settled.id=NEW.run_id
    AND NOT EXISTS (
      SELECT 1
      FROM automation_run AS candidate
      LEFT JOIN automation_run_receipt AS receipt ON receipt.id=(
        SELECT latest.id
        FROM automation_run_receipt AS latest
        WHERE latest.run_id=candidate.id
        ORDER BY latest.time_created DESC,latest.id DESC
        LIMIT 1
      )
      WHERE candidate.fire_id=settled.fire_id
        AND candidate.id<>NEW.run_id
        AND (receipt.id IS NULL OR receipt.outcome='retry_wait')
    )
)
BEGIN SELECT RAISE(ABORT, 'automation_run_receipt: terminal settlement must advance the Fire frontier'); END;
CREATE TRIGGER IF NOT EXISTS automation_run_terminal_mission_reservation_insert
BEFORE INSERT ON automation_run_receipt FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM automation_run AS run
  WHERE run.id=NEW.run_id
    AND run.mission_disposition='mission_closed'
    AND (
      NEW.outcome<>'disposition'
      OR NEW.disposition<>'mission_closed'
      OR NEW.closure_event_id IS NOT run.mission_closure_event_id
      OR NEW.error IS NOT NULL
      OR EXISTS (SELECT 1 FROM automation_run_receipt AS existing WHERE existing.run_id=run.id)
    )
)
BEGIN SELECT RAISE(ABORT, 'automation_run_receipt: terminal Mission reservation requires its exact closure receipt'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_receipt_no_update
BEFORE UPDATE ON event_job_fire_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_fire_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_receipt_no_delete
BEFORE DELETE ON event_job_fire_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'event_job_fire_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_receipt_frontier_insert
BEFORE INSERT ON event_job_fire_receipt FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM event_job_fire AS fire
  WHERE fire.id=NEW.fire_id
    AND fire.definition_id=NEW.definition_id
    AND fire.queue_position=NEW.queue_position
)
BEGIN SELECT RAISE(ABORT, 'event_job_fire_receipt: Fire frontier authority mismatch'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_terminal_fifo_insert
BEFORE INSERT ON event_job_fire_receipt FOR EACH ROW
WHEN NEW.outcome<>'retry_wait' AND NEW.queue_position<>(
  COALESCE((
    SELECT terminal.queue_position
    FROM event_job_fire_receipt AS terminal
    WHERE terminal.definition_id=NEW.definition_id
      AND terminal.outcome<>'retry_wait'
    ORDER BY terminal.queue_position DESC
    LIMIT 1
  ), 0) + 1
)
BEGIN SELECT RAISE(ABORT, 'event_job_fire_receipt: terminal settlement must advance the FIFO frontier'); END;
CREATE TRIGGER IF NOT EXISTS event_job_fire_terminal_mission_reservation_insert
BEFORE INSERT ON event_job_fire_receipt FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM event_job_fire AS fire
  WHERE fire.id=NEW.fire_id
    AND fire.mission_disposition='mission_closed'
    AND (
      NEW.outcome<>'disposition'
      OR NEW.disposition<>'mission_closed'
      OR NEW.closure_event_id IS NOT fire.mission_closure_event_id
      OR NEW.error IS NOT NULL
    )
)
BEGIN SELECT RAISE(ABORT, 'event_job_fire_receipt: terminal Mission reservation requires its exact closure receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_root_ingress_project_insert
BEFORE INSERT ON engine_task_root_ingress FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1 FROM engine_task task
  WHERE task.id=NEW.task_id AND task.project_id=NEW.project_id
)
BEGIN SELECT RAISE(ABORT, 'engine_task_root_ingress: Task Project authority mismatch'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_root_ingress_no_update
BEFORE UPDATE ON engine_task_root_ingress FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_task_root_ingress: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_root_ingress_no_delete
BEFORE DELETE ON engine_task_root_ingress FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id = OLD.task_id)
BEGIN SELECT RAISE(ABORT, 'engine_task_root_ingress: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_root_ingress_policy_no_update
BEFORE UPDATE ON engine_task_root_ingress_policy FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_task_root_ingress_policy: immutable policy fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_root_ingress_policy_no_delete
BEFORE DELETE ON engine_task_root_ingress_policy FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_task_root_ingress_policy: immutable policy fact'); END;

CREATE TRIGGER IF NOT EXISTS engine_task_wait_registration_no_update
BEFORE UPDATE ON engine_task_wait_registration FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_registration: immutable wait intent'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_wait_registration_no_delete
BEFORE DELETE ON engine_task_wait_registration FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id=OLD.task_id)
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_registration: immutable wait intent'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_wait_registration_lineage_insert
BEFORE INSERT ON engine_task_wait_registration FOR EACH ROW
WHEN NOT EXISTS (
    SELECT 1
    FROM tool_part_request AS request
    JOIN message AS creator
      ON creator.id=request.message_id
      AND json_extract(creator.data,'$.role')='assistant'
      AND json_extract(creator.data,'$.activationID')=NEW.creator_activation_id
    JOIN engine_control_activation_lease AS lease
      ON lease.id=NEW.creator_activation_id
      AND lease.target='task_root_ingress'
      AND lease.target_id=NEW.creator_ingress_id
      AND lease.expires_at>NEW.time_created
    JOIN engine_task_root_ingress AS ingress
      ON ingress.id=NEW.creator_ingress_id
      AND ingress.task_id=NEW.task_id
      AND ingress.project_id=NEW.project_id
      AND ingress.execution_epoch=NEW.execution_epoch
    JOIN engine_task AS task
      ON task.id=NEW.task_id
      AND task.project_id=NEW.project_id
    WHERE request.id=NEW.tool_part_id
      AND json_extract(request.data,'$.tool')='wait'
  )
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_registration: invalid Tool creator lineage'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_wait_settlement_no_update
BEFORE UPDATE ON engine_task_wait_settlement FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_settlement: immutable settlement'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_wait_settlement_lineage_insert
BEFORE INSERT ON engine_task_wait_settlement FOR EACH ROW
WHEN NOT EXISTS (
  SELECT 1
  FROM engine_task_wait_registration AS wait
  JOIN engine_task_root_ingress AS ingress ON ingress.id=NEW.ingress_id
  WHERE wait.id=NEW.wait_id
    AND wait.task_id=ingress.task_id
    AND wait.execution_epoch=ingress.execution_epoch
    AND (
      (
        NEW.disposition='superseded'
        AND ingress.time_accepted>=wait.time_created
        AND NOT (
          ingress.source='inline'
          AND ingress.source_id=wait.id
          AND json_extract(ingress.inline_payload,'$.taskWaitWake.jobID')=wait.id
        )
        AND ingress.sequence>(
          SELECT creator.sequence
          FROM engine_task_root_ingress AS creator
          WHERE creator.id=wait.creator_ingress_id
        )
      )
      OR (
        NEW.disposition='due_ingress_accepted'
        AND ingress.source='inline'
        AND ingress.source_id=wait.id
        AND json_type(ingress.inline_payload,'$.taskWaitWake')='object'
        AND json_extract(ingress.inline_payload,'$.taskWaitWake.jobID')=wait.id
        AND json_extract(ingress.inline_payload,'$.taskWaitWake.fireID')=wait.id
        AND json_extract(ingress.inline_payload,'$.taskWaitWake.dueAt')=wait.due_at
        AND ingress.time_accepted>=wait.due_at
        AND NEW.time_created>=ingress.time_accepted
      )
    )
)
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_settlement: wait and ingress lineage must match'); END;
CREATE TRIGGER IF NOT EXISTS engine_task_wait_settlement_no_delete
BEFORE DELETE ON engine_task_wait_settlement FOR EACH ROW
WHEN EXISTS (
  SELECT 1
  FROM engine_task_wait_registration AS wait
  JOIN engine_task AS task ON task.id=wait.task_id
  WHERE wait.id=OLD.wait_id
)
BEGIN SELECT RAISE(ABORT, 'engine_task_wait_settlement: immutable settlement'); END;

CREATE TRIGGER IF NOT EXISTS automation_project_target_no_update
BEFORE UPDATE ON automation_project_target FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_project_target: immutable definition input'); END;
CREATE TRIGGER IF NOT EXISTS automation_project_target_no_delete
BEFORE DELETE ON automation_project_target FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'automation_project_target: immutable definition input'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_delivery_receipt_no_update
BEFORE UPDATE ON bus_publication_delivery_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_delivery_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_delivery_receipt_no_delete
BEFORE DELETE ON bus_publication_delivery_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_delivery_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_phase_receipt_no_update
BEFORE UPDATE ON bus_publication_phase_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_phase_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_phase_receipt_no_delete
BEFORE DELETE ON bus_publication_phase_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_phase_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_attempt_receipt_no_update
BEFORE UPDATE ON bus_publication_attempt_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_attempt_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS bus_publication_attempt_receipt_no_delete
BEFORE DELETE ON bus_publication_attempt_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'bus_publication_attempt_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_interaction_request_no_update
BEFORE UPDATE ON engine_interaction_request FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_interaction_request: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_interaction_request_no_delete
BEFORE DELETE ON engine_interaction_request FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_interaction_request: immutable input fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_interaction_outcome_no_update
BEFORE UPDATE ON engine_interaction_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_interaction_outcome: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_interaction_outcome_no_delete
BEFORE DELETE ON engine_interaction_outcome FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_interaction_outcome: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_build_observation_cleanup_no_update
BEFORE UPDATE ON engine_build_observation_cleanup FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_build_observation_cleanup: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_build_observation_cleanup_no_delete
BEFORE DELETE ON engine_build_observation_cleanup FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id = OLD.task_id)
BEGIN SELECT RAISE(ABORT, 'engine_build_observation_cleanup: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS engine_build_observation_cleanup_receipt_no_update
BEFORE UPDATE ON engine_build_observation_cleanup_receipt FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_build_observation_cleanup_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_build_observation_cleanup_receipt_no_delete
BEFORE DELETE ON engine_build_observation_cleanup_receipt FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_build_observation_cleanup WHERE observation_id = OLD.observation_id)
BEGIN SELECT RAISE(ABORT, 'engine_build_observation_cleanup_receipt: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS session_control_record_no_update
BEFORE UPDATE ON session_control_record FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'session_control_record: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS session_control_record_no_delete
BEFORE DELETE ON session_control_record FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM session WHERE id=OLD.session_id)
BEGIN SELECT RAISE(ABORT, 'session_control_record: immutable request fact'); END;
CREATE TRIGGER IF NOT EXISTS session_control_event_no_update
BEFORE UPDATE ON session_control_event FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'session_control_event: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS session_control_event_no_delete
BEFORE DELETE ON session_control_event FOR EACH ROW
WHEN EXISTS (
  SELECT 1 FROM session_control_record
  JOIN session ON session.id=session_control_record.session_id
  WHERE session_control_record.id=OLD.control_id
)
BEGIN SELECT RAISE(ABORT, 'session_control_event: immutable receipt'); END;
CREATE TRIGGER IF NOT EXISTS engine_progress_snapshot_no_update
BEFORE UPDATE ON engine_progress_snapshot FOR EACH ROW
BEGIN SELECT RAISE(ABORT, 'engine_progress_snapshot: immutable authored checkpoint'); END;
CREATE TRIGGER IF NOT EXISTS engine_progress_snapshot_no_delete
BEFORE DELETE ON engine_progress_snapshot FOR EACH ROW
WHEN EXISTS (SELECT 1 FROM engine_task WHERE id=OLD.task_id)
BEGIN SELECT RAISE(ABORT, 'engine_progress_snapshot: immutable authored checkpoint'); END;
