#!/usr/bin/env bun

import { Database as SQLite } from "bun:sqlite"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { ApplicationSchema } from "../src/storage/schema"
import { SCHEMA_DDL } from "../src/storage/ddl"

const ALLOWED_CLASSES = ["identity", "input", "causal", "policy", "fact", "receipt", "lease"] as const
type AllowedClass = (typeof ALLOWED_CLASSES)[number]
type TableInventory = Record<AllowedClass | "derived", readonly string[]>

function inventory(input: Partial<TableInventory>): TableInventory {
  return {
    identity: input.identity ?? [],
    input: input.input ?? [],
    causal: input.causal ?? [],
    policy: input.policy ?? [],
    fact: input.fact ?? [],
    receipt: input.receipt ?? [],
    lease: input.lease ?? [],
    derived: input.derived ?? [],
  }
}

/**
 * Every persisted SQL field in the execution-control scope must appear once.
 * `derived` is an implementation backlog and makes this checker fail. It may
 * only disappear by deleting the column/table or replacing it with a sole
 * immutable fact/receipt/lease coordinate.
 */
const CONTROL_STATE_INVENTORY = {
  ChannelIngressAcceptedTable: inventory({
    identity: ["id", "project_id", "platform", "request_id"],
    input: ["input"],
    fact: ["time_created"],
  }),
  ChannelIngressOutcomeTable: inventory({
    identity: ["request_id"],
    receipt: ["result", "time_created"],
  }),
  BusPublicationOutboxTable: inventory({
    identity: ["occurrence_id", "project_id"],
    input: ["directory", "event_type", "properties", "causation"],
    fact: ["time_created"],
  }),
  BusPublicationDeliveryTable: inventory({
    identity: ["occurrence_id", "phase", "subscriber_id"],
    input: ["effect_contract"],
    fact: ["time_created"],
  }),
  BusPublicationDeliveryReceiptTable: inventory({
    identity: ["id", "occurrence_id", "phase", "subscriber_id"],
    policy: ["retry_at"],
    receipt: ["outcome", "error", "time_created"],
  }),
  BusPublicationPhaseReceiptTable: inventory({
    identity: ["id", "occurrence_id", "phase"],
    receipt: ["time_created"],
  }),
  BusPublicationAttemptReceiptTable: inventory({
    identity: ["id", "occurrence_id"],
    policy: ["retry_at"],
    receipt: ["error", "time_created"],
  }),
  EngineTaskRootIngressPolicyTable: inventory({
    identity: ["id"],
    policy: ["semantic_turn_limit", "activation_limit", "absolute_deadline"],
    fact: ["time_created"],
  }),
  EngineTaskRootIngressTable: inventory({
    identity: ["id", "task_id"],
    causal: ["execution_epoch", "sequence", "source", "source_id", "policy_id"],
    fact: ["inline_payload", "time_accepted"],
  }),
  EngineControlActivationLeaseTable: inventory({
    identity: ["id"],
    causal: ["target", "target_id", "owner_occurrence_id"],
    lease: ["time_activated", "expires_at"],
  }),
  EngineTaskTable: inventory({
    identity: ["id", "project_id", "session_id", "request_id"],
    input: [
      "source",
      "product_pillar",
      "title",
      "request",
      "attachments",
      "system_artifacts",
      "priority",
      "budget",
      "time_archived",
      "time_pinned",
      "metadata",
    ],
    fact: ["time_created"],
  }),
  EngineBuildObservationCleanupTable: inventory({
    identity: ["observation_id", "task_id"],
    input: ["git_dir"],
    fact: ["time_created"],
  }),
  EngineBuildObservationCleanupReceiptTable: inventory({
    identity: ["id", "observation_id"],
    receipt: ["outcome", "error", "time_created"],
  }),
  EngineInteractionRequestTable: inventory({
    identity: ["id", "task_id", "session_id", "external_id"],
    causal: ["source_kind", "source_id"],
    input: ["request_type", "title", "body", "payload"],
    fact: ["time_created"],
  }),
  EngineInteractionOutcomeTable: inventory({
    identity: ["id", "interaction_id"],
    causal: ["source_occurrence_id"],
    receipt: ["outcome", "response", "time_created"],
  }),
  EngineWorkflowNodeOccurrenceTable: inventory({
    identity: ["task_id", "workflow_id", "workflow_node_id"],
    causal: ["initial_dispatch_id", "child_session_id"],
    fact: ["time_created"],
  }),
  EngineProgressSnapshotTable: inventory({
    identity: ["id", "task_id"],
    fact: ["summary", "payload", "time_created"],
  }),
  EngineGitCheckpointRequestTable: inventory({
    identity: ["id", "task_id", "operation_key"],
    input: ["stage", "input"],
    fact: ["time_created"],
  }),
  EngineGitCheckpointOutcomeTable: inventory({
    identity: ["request_id"],
    receipt: ["result", "time_created"],
  }),
  SessionControlRecordTable: inventory({
    identity: ["id", "session_id"],
    causal: ["source"],
    fact: ["kind", "payload", "time_created"],
  }),
  SessionControlEventTable: inventory({
    identity: ["id", "control_id"],
    receipt: ["kind", "payload", "time_created"],
  }),
  SessionPromptOwnerTable: inventory({
    identity: ["session_id", "generation"],
    causal: ["project_id", "owner_pid", "owner_process_instance_id", "owner_occurrence_id"],
    input: ["directory"],
    lease: ["time_acquired"],
  }),
  AutomationTable: inventory({
    identity: ["id", "definition_id", "revision", "project_id", "session_id", "task_id"],
    input: [
      "name",
      "kind",
      "scope",
      "recurrence",
      "execution_mode",
      "model_provider_id",
      "model_id",
      "reasoning_effort",
      "surface",
      "prompt",
      "agent",
      "status",
      "due_at",
      "time_created",
    ],
  }),
  AutomationDefinitionTombstoneTable: inventory({
    identity: ["id", "definition_id", "revision"],
    fact: ["time_created"],
  }),
  AutomationProjectTargetTable: inventory({
    identity: ["automation_revision_id", "project_id"],
    input: ["position"],
  }),
  AutomationRunTable: inventory({
    identity: ["id", "automation_revision_id", "fire_id"],
    causal: [
      "target_project_id",
      "mission_opened_event_id",
      "mission_disposition",
      "mission_closure_event_id",
    ],
    fact: ["started_at"],
  }),
  AutomationRunReceiptTable: inventory({
    identity: ["id", "run_id"],
    policy: ["retry_at"],
    receipt: ["outcome", "disposition", "closure_event_id", "error", "time_created"],
  }),
  EventJobTable: inventory({
    identity: ["id", "definition_id", "revision", "project_id", "session_id"],
    input: [
      "name",
      "event_type",
      "match_json",
      "prompt",
      "agent",
      "enabled",
      "one_shot",
      "cooldown_ms",
      "time_created",
    ],
  }),
  EventJobDefinitionTombstoneTable: inventory({
    identity: ["id", "definition_id", "revision"],
    fact: ["time_created"],
  }),
  EventJobFireTable: inventory({
    identity: ["id", "event_job_revision_id", "event_occurrence_id"],
    causal: [
      "causation_fire_id",
      "created_session_id",
      "mission_opened_event_id",
      "mission_disposition",
      "mission_closure_event_id",
    ],
    fact: ["time_created"],
  }),
  EventOccurrenceTable: inventory({
    identity: ["id"],
    causal: ["bus_outbox_id"],
    input: ["project_id", "event_type", "properties"],
    fact: ["time_created"],
  }),
  EventJobFireReceiptTable: inventory({
    identity: ["id", "fire_id"],
    policy: ["retry_at"],
    receipt: ["outcome", "disposition", "closure_event_id", "message_id", "error", "time_created"],
  }),
  ProtocolEventTable: inventory({
    identity: ["id", "aggregate_type", "aggregate_id", "task_id", "session_id", "interaction_id", "stream_id"],
    causal: ["kind", "type", "source", "target", "causation_id", "correlation_id", "reply_to", "seq"],
    policy: ["deadline_ms"],
    fact: ["emitted_at", "payload"],
  }),
  ProtocolInboxTable: inventory({
    identity: ["id", "envelope_id"],
    causal: ["actor", "actor_id"],
    policy: ["visible_at"],
    fact: ["time_created"],
  }),
  ProtocolDeliveryReceiptTable: inventory({
    identity: ["id", "inbox_id"],
    receipt: ["receipt", "time_created"],
  }),
  MessageTable: inventory({
    identity: ["id", "session_id"],
    fact: ["data", "time_created", "time_updated"],
  }),
  PartTable: inventory({
    identity: ["id", "message_id"],
    causal: ["time_created"],
    fact: ["data", "time_updated"],
  }),
  ToolPartRequestTable: inventory({
    identity: ["id", "message_id"],
    causal: ["time_created"],
    fact: ["data"],
  }),
  ToolPartProgressTable: inventory({
    identity: ["id", "request_part_id"],
    fact: ["title", "metadata", "time_created"],
  }),
  ToolPartOutcomeTable: inventory({
    identity: ["id", "request_part_id"],
    receipt: ["data", "time_created"],
  }),
  ProviderActivityRequestTable: inventory({
    identity: ["id", "assistant_message_id"],
    fact: ["time_created"],
  }),
  ProviderActivityOutcomeTable: inventory({
    identity: ["id", "request_id"],
    receipt: ["data", "time_created"],
  }),
  PermissionPolicyTable: inventory({
    identity: ["session_id", "project_id", "revision"],
    policy: ["mode"],
    fact: ["time_created"],
  }),
  PermissionLedgerTable: inventory({
    identity: ["id", "request_id"],
    causal: ["project_id", "session_id", "task_id", "message_id", "tool_call_id", "attempt_id", "source_event_id", "decision_slot", "outcome_slot"],
    input: ["mode", "policy_revision", "provider_kind", "provider_id", "provider_digest", "tool_name", "effect_class", "scope_version", "scope", "fingerprint", "summary"],
    fact: ["event_type", "decision_scope", "actor_id", "reason", "metadata", "time_created"],
  }),
  PermissionExecutionResultTable: inventory({
    identity: ["attempt_id"],
    receipt: ["result", "time_created"],
  }),
} as const satisfies Record<string, TableInventory>

/** Cross-table functional dependencies that a per-column classification
 * cannot detect. Each listed coordinate is already uniquely determined by
 * another persisted identity and must therefore be physically absent. */
const FORBIDDEN_REDUNDANT_COLUMNS = {
  part: ["session_id"],
  tool_part_request: ["session_id"],
  provider_activity_request: ["session_id"],
  protocol_delivery_receipt: ["outcome", "visible_at", "error", "delivery_result"],
  protocol_event: ["order_key"],
  automation_run: ["automation_id"],
  automation_project_target: ["automation_id"],
  event_job_fire: ["event_job_id", "project_id", "event_type"],
  engine_workflow_node_occurrence: ["workflow_occurrence_id", "dispatch_lineage_artifact_id", "workflow_binding"],
} as const

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

const sqlite = new SQLite(":memory:")
const failures: string[] = []
try {
  sqlite.exec(SCHEMA_DDL)
  const scopedRegistryKeys = Object.keys(ApplicationSchema).filter((key) =>
    key.startsWith("BusPublication") ||
    key.startsWith("ChannelIngress") ||
    key.startsWith("EngineTask") ||
    key === "EngineControlActivationLeaseTable" ||
    key === "EngineBuildObservationCleanupTable" ||
    key === "EngineBuildObservationCleanupReceiptTable" ||
    key === "EngineInteractionRequestTable" ||
    key === "EngineInteractionOutcomeTable" ||
    key === "EngineWorkflowNodeOccurrenceTable" ||
    key === "EngineProgressSnapshotTable" ||
    key.startsWith("EngineGitCheckpoint") ||
    key === "SessionControlRecordTable" ||
    key === "SessionControlEventTable" ||
    key === "SessionPromptOwnerTable" ||
    key === "MessageTable" ||
    key === "PartTable" ||
    key === "ToolPartRequestTable" ||
    key === "ToolPartProgressTable" ||
    key === "ToolPartOutcomeTable" ||
    key === "ProviderActivityRequestTable" ||
    key === "ProviderActivityOutcomeTable" ||
    key.startsWith("Permission") ||
    key.startsWith("Automation") ||
    key.startsWith("EventJob") ||
    key === "EventOccurrenceTable" ||
    key.startsWith("Protocol")
  )
  for (const key of scopedRegistryKeys) {
    if (!(key in CONTROL_STATE_INVENTORY)) failures.push(`${key}: control-scope table is missing from the persisted-field inventory`)
  }
  for (const key of Object.keys(CONTROL_STATE_INVENTORY)) {
    if (!scopedRegistryKeys.includes(key)) failures.push(`${key}: inventory table is outside the declared control scope`)
  }
  for (const [registryKey, classification] of Object.entries(CONTROL_STATE_INVENTORY)) {
    const table = ApplicationSchema[registryKey as keyof typeof ApplicationSchema]
    if (!table) {
      failures.push(`${registryKey}: missing from ApplicationSchema`)
      continue
    }
    const tableName = getTableConfig(table).name
    const statement = sqlite.query<{ name: string }, []>(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    const actual = statement.all().map((column) => column.name)
    statement.finalize()
    const classified = new Map<string, string>()
    for (const [kind, columns] of Object.entries(classification)) {
      for (const column of columns) {
        const previous = classified.get(column)
        if (previous) failures.push(`${tableName}.${column}: classified as both ${previous} and ${kind}`)
        classified.set(column, kind)
      }
    }
    for (const column of actual) {
      if (!classified.has(column)) failures.push(`${tableName}.${column}: unclassified persisted field`)
    }
    for (const column of classified.keys()) {
      if (!actual.includes(column)) failures.push(`${tableName}.${column}: inventory field is absent from current DDL`)
    }
    for (const column of classification.derived) {
      if (actual.includes(column)) failures.push(`${tableName}.${column}: persisted derived control state`)
    }
  }
  for (const [tableName, forbiddenColumns] of Object.entries(FORBIDDEN_REDUNDANT_COLUMNS)) {
    const statement = sqlite.query<{ name: string }, []>(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    const actual = new Set(statement.all().map((column) => column.name))
    statement.finalize()
    for (const column of forbiddenColumns) {
      if (actual.has(column)) failures.push(`${tableName}.${column}: cross-table redundant identity or receipt projection`)
    }
  }

  const requiredImmutableTriggers = [
    "protocol_event_no_update", "protocol_event_no_delete",
    "engine_task_root_ingress_no_update", "engine_task_root_ingress_no_delete",
    "automation_definition_revision_no_update", "automation_definition_revision_no_delete",
    "automation_run_no_update", "automation_run_no_delete",
    "event_job_definition_revision_no_update", "event_job_definition_revision_no_delete",
    "event_occurrence_no_update", "event_occurrence_no_delete",
    "event_job_fire_no_update", "event_job_fire_no_delete",
    "bus_publication_outbox_no_update", "bus_publication_outbox_no_delete",
    "bus_publication_delivery_no_update", "bus_publication_delivery_no_delete",
    "tool_part_request_no_update", "tool_part_request_no_delete",
    "tool_part_progress_no_update", "tool_part_progress_no_delete",
    "tool_part_outcome_no_update", "tool_part_outcome_no_delete",
    "provider_activity_request_no_update", "provider_activity_request_no_delete",
    "provider_activity_outcome_no_update", "provider_activity_outcome_no_delete",
    "engine_interaction_request_no_update", "engine_interaction_request_no_delete",
    "engine_interaction_outcome_no_update", "engine_interaction_outcome_no_delete",
    "session_control_record_no_update", "session_control_record_no_delete",
    "session_control_event_no_update", "session_control_event_no_delete",
    "engine_build_observation_cleanup_no_update", "engine_build_observation_cleanup_no_delete",
    "engine_build_observation_cleanup_receipt_no_update", "engine_build_observation_cleanup_receipt_no_delete",
    "permission_policy_no_update", "permission_policy_no_delete",
    "permission_ledger_no_update", "permission_ledger_no_delete",
    "permission_execution_result_no_update", "permission_execution_result_no_delete",
    "channel_ingress_accepted_no_update", "channel_ingress_accepted_no_delete",
    "channel_ingress_outcome_no_update", "channel_ingress_outcome_no_delete",
    "engine_git_checkpoint_request_no_update", "engine_git_checkpoint_request_no_delete",
    "engine_git_checkpoint_outcome_no_update", "engine_git_checkpoint_outcome_no_delete",
  ]
  const triggerStatement = sqlite.query<{ name: string }, []>("SELECT name FROM sqlite_schema WHERE type='trigger'")
  const triggers = new Set(triggerStatement.all().map((row) => row.name))
  triggerStatement.finalize()
  for (const trigger of requiredImmutableTriggers) if (!triggers.has(trigger)) failures.push(`${trigger}: missing append-only database guard`)

  const requiredUniqueIndexes = [
    "protocol_delivery_receipt_terminal_idx",
    "automation_run_terminal_receipt_idx",
    "event_job_fire_terminal_receipt_idx",
    "bus_publication_delivery_terminal_idx",
  ]
  const indexStatement = sqlite.query<{ name: string }, []>("SELECT name FROM sqlite_schema WHERE type='index'")
  const indexes = new Set(indexStatement.all().map((row) => row.name))
  indexStatement.finalize()
  for (const index of requiredUniqueIndexes) if (!indexes.has(index)) failures.push(`${index}: missing exactly-one terminal receipt constraint`)

  function expectConstraint(label: string, statement: string) {
    try {
      sqlite.exec(statement)
      failures.push(`${label}: database accepted a redundant durable representation`)
    } catch {
      // A typed CHECK/trigger rejection is the positive database contract.
    }
  }
  expectConstraint("task aggregate envelope identity", `
    INSERT INTO protocol_event(id,kind,type,aggregate_type,aggregate_id,task_id,source,seq,emitted_at,payload)
    VALUES('evt:redundant-task','event','task.updated','task','task:one','task:one','host',1,1,'{}')
  `)
  expectConstraint("protocol payload envelope identity", `
    INSERT INTO protocol_event(id,kind,type,aggregate_type,aggregate_id,source,seq,emitted_at,payload)
    VALUES('evt:redundant-payload','event','task.updated','task','task:two','host',1,1,'{"taskID":"task:two"}')
  `)
  expectConstraint("Task status Bus projection", `
    INSERT INTO bus_publication_outbox(occurrence_id,project_id,directory,event_type,properties,time_created)
    VALUES('bus:redundant-status','project:one','/tmp','task.updated','{"taskID":"task:one","status":"running","summary":"x"}',1)
  `)
  expectConstraint("Event occurrence dual owner", `
    INSERT INTO event_occurrence(id,bus_outbox_id,project_id,event_type,properties,time_created)
    VALUES('event:dual-owner','bus:missing','project:one','x','{}',1)
  `)
  expectConstraint("Task metadata Git projection", `
    INSERT INTO engine_task(id,project_id,source,product_pillar,title,request,system_artifacts,priority,metadata,time_created)
    VALUES('task:git-shadow','project:one','test','code','x','x','[]','normal','{"git":{"baseline":{}}}',1)
  `)
  expectConstraint("progress Git projection", `
    INSERT INTO engine_progress_snapshot(id,task_id,summary,payload,time_created)
    VALUES('progress:git-shadow','task:one','x','{"kind":"git","stage":"baseline"}',1)
  `)
  expectConstraint("Permission receipt repeats request identity", `
    INSERT INTO permission_ledger(id,request_id,project_id,event_type,time_created)
    VALUES('permission:event','permission:request','project:one','execution_started',1)
  `)
  expectConstraint("Channel accepted payload repeats envelope identity", `
    INSERT INTO channel_ingress_accepted(id,project_id,platform,request_id,input,time_created)
    VALUES('channel:duplicate','project:one','slack','request:one','{"platform":"slack","request_id":"request:one"}',1)
  `)
  expectConstraint("completed Tool outcome without output authority", `
    INSERT INTO tool_part_outcome(id,request_part_id,data,time_created)
    VALUES('part:outcome','part:request','{"outcome":"completed","title":"x","metadata":{},"time":{"end":1}}',1)
  `)
} finally {
  sqlite.close(true)
}

if (failures.length > 0) {
  process.stderr.write(`control-state redundancy check failed (${failures.length})\n${failures.join("\n")}\n`)
  process.exit(1)
}

process.stdout.write(
  `control-state redundancy check passed (${Object.keys(CONTROL_STATE_INVENTORY).length} tables; ${ALLOWED_CLASSES.length} allowed fact classes)\n`,
)
