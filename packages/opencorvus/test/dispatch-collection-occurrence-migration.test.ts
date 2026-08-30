import { expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import {
  deriveEngineArtifactCatalogMetadata,
  engineArtifactCatalogMetadataSHA256,
  serializeEngineArtifactPayload,
} from "@/engine/artifact-catalog-metadata"
import { engineArtifactCatalogLabelIndex } from "@/engine/artifact-catalog-constants"
import { Identifier } from "@/id/id"
import { workerTurnDescriptorHash } from "@/agent/worker-turn-descriptor-facts"
import { controlTextSHA256 } from "@/orchestrator/dispatch-turn-projection"
import {
  DispatchCollectionOccurrenceMigrationTestHooks,
  migrateDispatchCollectionOccurrences,
} from "@/storage/dispatch-collection-occurrence-migration"
import { SCHEMA_DDL } from "@/storage/ddl"
import { canonicalSchemaObjectSQL, findSchemaDrift } from "@/storage/schema-contract"
import { rewriteDispatchLineagePayloadForMigration } from "@/storage/dispatch-lineage-owner-migration"

function database(filename = ":memory:") {
  const sqlite = new SQLite(filename)
  sqlite.exec(SCHEMA_DDL)
  sqlite.exec("DROP INDEX engine_dispatch_lineage_direct_tool_occurrence_idx")
  sqlite.exec("DROP INDEX engine_dispatch_lineage_collection_member_idx")
  sqlite.exec("DROP INDEX engine_dispatch_lineage_initial_workflow_node_idx")
  sqlite.exec("DROP INDEX engine_dispatch_lineage_coordination_action_idx")
  const now = Date.now()
  sqlite.query(
    "INSERT INTO project(id,worktree,time_created,time_updated,sandboxes,generation) VALUES(?,?,?,?,?,?)",
  ).run("project-migration", "/migration", now, now, "[]", "00000000-0000-4000-8000-000000000001")
  sqlite.query(
    "INSERT INTO session(id,project_id,slug,directory,title,version,kind,time_created,time_updated) VALUES(?,?,?,?,?,?,?,?,?)",
  ).run("session-migration", "project-migration", "migration", "/migration", "Migration", "test", "orchestrator", now, now)
  sqlite.exec("PRAGMA foreign_keys=ON")
  return sqlite
}

function insertArtifact(sqlite: SQLite, input: { id: string; taskID: string; payload: Record<string, unknown>; time: number }) {
  sqlite.query(
    "INSERT OR IGNORE INTO engine_task(id,project_id,product_pillar,title,request,time_created) VALUES(?,?,?,?,?,?)",
  ).run(input.taskID, "project-migration", "general", "Migration Task", "Migrate legacy collection", input.time)
  const revision = sqlite
    .query<{ revision: number }, []>("INSERT INTO engine_artifact_catalog_revision DEFAULT VALUES RETURNING revision")
    .get()!.revision
  const payloadText = serializeEngineArtifactPayload(input.payload)
  const metadata = deriveEngineArtifactCatalogMetadata({ kind: "dispatch_lineage", payloadText })
  const catalogMetadataSHA256 = engineArtifactCatalogMetadataSHA256({
    artifact_id: input.id,
    task_id: input.taskID,
    kind: "dispatch_lineage",
    label_index: engineArtifactCatalogLabelIndex("dispatch-lineage"),
    time_created: input.time,
    time_updated: input.time,
    ...metadata,
  })
  sqlite.exec("DROP TRIGGER engine_dispatch_lineage_payload_insert")
  try {
    sqlite.query(
      `INSERT INTO engine_artifact(
      id,task_id,kind,label,payload,payload_sha256,payload_bytes,payload_block_sha256s,
      payload_block_index_sha256,catalog_artifact_type,catalog_schema_diagnostic,catalog_producer,
      catalog_import_source_task_id,catalog_resource_count,catalog_resource_media_types,
      catalog_search_text,catalog_search_text_truncated,catalog_metadata_sha256,catalog_revision,time_created,time_updated
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      input.id,input.taskID,"dispatch_lineage","dispatch-lineage",payloadText,metadata.payload_sha256,
      metadata.payload_bytes,JSON.stringify(metadata.payload_block_sha256s),metadata.payload_block_index_sha256,
      metadata.catalog_artifact_type,metadata.catalog_schema_diagnostic,
      metadata.catalog_producer === null ? null : JSON.stringify(metadata.catalog_producer),
      metadata.catalog_import_source_task_id,metadata.catalog_resource_count,
      JSON.stringify(metadata.catalog_resource_media_types),metadata.catalog_search_text,
      metadata.catalog_search_text_truncated ? 1 : 0,catalogMetadataSHA256,revision,input.time,input.time,
    )
  } finally {
    sqlite.exec(canonicalSchemaObjectSQL("trigger", "engine_dispatch_lineage_payload_insert"))
  }
}

function input(targets: string[]) {
  return {
    team: targets.map((target, index) => ({
      name: `member-${index + 1}`,
      target,
      responsibility: `Own ${target}`,
      boundary: `Only ${target}`,
      expected_result: `Evidence for ${target}`,
      depends_on: [],
    })),
    dispatches: targets.map((target) => ({
      dispatch: {
        target,
        work_scope: { kind: "task" as const },
        turn: {
          kind: "initial" as const,
          workflow_subject: { kind: "direct" as const },
          use_worktree: false,
          input: {},
        },
      },
    })),
  }
}

function insertOuter(sqlite: SQLite, id: string, collection: ReturnType<typeof input>, time: number) {
  const callID = `call-${id}`
  sqlite.query("INSERT OR IGNORE INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)").run(
    `msg-${id}`,
    "session-migration",
    time,
    time,
    JSON.stringify({ role: "assistant", activationID: `activation-${id}`, time: { created: time } }),
  )
  sqlite.query("INSERT INTO tool_part_request(id,message_id,data,time_created) VALUES(?,?,?,?)").run(
    id,
    `msg-${id}`,
    JSON.stringify({ type: "tool-request", callID, tool: "dispatch_agents", input: collection, time: { start: time } }),
    time,
  )
  return callID
}

function insertChild(
  sqlite: SQLite,
  input: { outerID: string; index: number; request: unknown; time: number; outcome?: Record<string, unknown> },
) {
  const id = Identifier.deterministic("part", `dispatch-agents\0${input.outerID}\0${input.index}`)
  const callID = Identifier.deterministic("call", `dispatch-agents\0${input.outerID}\0${input.index}`)
  sqlite.query("INSERT INTO tool_part_request(id,message_id,data,time_created) VALUES(?,?,?,?)").run(
    id,
    `msg-${input.outerID}`,
    JSON.stringify({ type: "tool-request", callID, tool: "dispatch_agent", input: input.request, time: { start: input.time } }),
    input.time,
  )
  if (input.outcome) {
    sqlite.query("INSERT INTO tool_part_outcome(id,request_part_id,data,time_created) VALUES(?,?,?,?)").run(
      `out-${id}`,
      id,
      JSON.stringify(input.outcome),
      input.time + 1,
    )
  }
  return { id, callID }
}

function insertLegacyLineage(
  sqlite: SQLite,
  input: { id: string; taskID: string; childPartID: string; childCallID: string; sessionID: string; time: number },
) {
  const request = JSON.parse(
    sqlite.query<{ data: string }, [string]>("SELECT data FROM tool_part_request WHERE id=?").get(input.childPartID)!.data,
  ) as { input: { dispatch: { target: string; work_scope: { kind: "task" }; turn: { kind: "initial"; input: Record<string, unknown> } } } }
  const outer = sqlite.query<{ message_id: string }, [string]>(
    "SELECT message_id FROM tool_part_request WHERE id=?",
  ).get(input.childPartID)!
  const orchestratorSessionID = sqlite.query<{ session_id: string }, [string]>(
    "SELECT session_id FROM message WHERE id=?",
  ).get(outer.message_id)!.session_id
  const identity = {
    agentID: request.input.dispatch.target,
    baseRole: "delegated-worker" as const,
    sessionKind: "delegated-worker" as const,
    dispatchAdapterID: "delegated_worker" as const,
    runtimeTemplateABIVersion: 1 as const,
    dispatchAdapterABIVersion: 1 as const,
    projectionHash: "a".repeat(64),
  }
  const packageBinding = {
    scope: "built_in" as const,
    project_id: null,
    namespace: "base",
    id: "base",
    version: "1.0.0",
    package_digest: "b".repeat(64),
  }
  const dispatchID = `dispatch-${input.id}`
  const workflowOccurrenceID = `workflow-${input.id}`
  sqlite.query(
    `INSERT OR IGNORE INTO session(id,project_id,slug,directory,title,version,kind,time_created,time_updated)
     VALUES(?,?,?,?,?,?,?,?,?)`,
  ).run(input.sessionID, "project-migration", `worker-${input.id}`, "/migration", input.id, "test", "delegated-worker", input.time, input.time)
  const inputMessageID = Identifier.deterministic("message", `migration-input\0${input.id}`)
  const inputPartID = Identifier.deterministic("part", `migration-input\0${input.id}`)
  sqlite.query("INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)").run(
    inputMessageID,
    input.sessionID,
    input.time,
    input.time,
    JSON.stringify({ role: "user", author: "orchestrator", time: { created: input.time } }),
  )
  const inputText = "Legacy dispatch input"
  sqlite.query("INSERT INTO part(id,message_id,time_created,time_updated,data) VALUES(?,?,?,?,?)").run(
    inputPartID,
    inputMessageID,
    input.time,
    input.time,
    JSON.stringify({ type: "text", text: inputText }),
  )
  const workflowBinding = { kind: "direct" as const, package_revision: packageBinding }
  const descriptorPayload = {
    identity,
    expertSquadID: "base",
    packageRevision: {
      scope: "built_in" as const,
      projectID: null,
      namespace: "base",
      id: "base",
      version: "1.0.0",
      packageDigest: "b".repeat(64),
    },
    model: { selection: "explicit" as const, providerID: "test", modelID: "test" },
    prompt: { systemMode: "complete" as const, systemSha256: "c".repeat(64) },
    tools: { enabled: [], stageOwned: [], stageMaterializers: {} },
    output: { format: "text" as const, resultMode: "reply" as const },
    lifecycle: { taskID: input.taskID, workScope: request.input.dispatch.work_scope },
    messageAuthority: {
      user_message_id: inputMessageID,
      control_text_parts: [{ part_id: inputPartID, text_sha256: controlTextSHA256(inputText) }],
    },
    dispatchTurn: {
      kind: "initial" as const,
      current_dispatch_id: dispatchID,
      workflow_binding: workflowBinding,
      workflow_node_id: null,
      workflow_occurrence_id: workflowOccurrenceID,
      delivery_slice_revision_ids: [],
      evidence_locators: [],
      task_authority: {
        task_id: input.taskID,
        root_session_id: input.sessionID,
        request_sha256: "e".repeat(64),
        initial_control_text_parts: [],
      },
    },
  }
  sqlite.query(
    "INSERT INTO worker_turn_descriptor(id,session_id,hash,agent,payload,time_created,time_updated) VALUES(?,?,?,?,?,?,?)",
  ).run(
    Identifier.deterministic("worker_turn_descriptor", input.id),
    input.sessionID,
    workerTurnDescriptorHash(descriptorPayload),
    identity.agentID,
    JSON.stringify(descriptorPayload),
    input.time,
    input.time,
  )
  insertArtifact(sqlite, {
    id: input.id,
    taskID: input.taskID,
    time: input.time,
    payload: {
      dispatch_id: dispatchID,
      task_id: input.taskID,
      orchestrator_session_id: orchestratorSessionID,
      orchestrator_message_id: outer.message_id,
      tool_part_id: input.childPartID,
      tool_call_id: input.childCallID,
      tool_name: "dispatch_agent",
      child_session_id: input.sessionID,
      target_agent_id: request.input.dispatch.target,
      projected_worker_identity: identity,
      work_scope: request.input.dispatch.work_scope,
      delivery_slice_revision_ids: [],
      workflow_binding: workflowBinding,
      workflow_node_id: null,
      workflow_occurrence_id: workflowOccurrenceID,
      adapter_input: request.input.dispatch.turn.input,
      delivery_owner: { kind: "runtime_process", process_occurrence_id: "process-owner" },
      time_created: input.time,
    },
  })
}

function artifactPayload(sqlite: SQLite, id: string) {
  return JSON.parse(sqlite.query<{ payload: string }, [string]>("SELECT payload FROM engine_artifact WHERE id=?").get(id)!.payload)
}

test("migrates completed, running and partially failed collections to the real outer occurrence", () => {
  const sqlite = database()
  try {
    const now = Date.now()
    const completedInput = input(["a", "b"])
    const completedOuter = "part-outer-completed"
    const completedCall = insertOuter(sqlite, completedOuter, completedInput, now)
    const completedChildren = completedInput.dispatches.map((request, index) => {
      const sessionID = Identifier.deterministic("session", `migration-completed\0${index}`)
      const child = insertChild(sqlite, {
        outerID: completedOuter,
        index,
        request,
        time: now + index,
        outcome: {
          outcome: "completed",
          output: JSON.stringify({ kind: "accepted", session_id: sessionID, dispatch_lineage_id: `art-${index}` }),
          title: "accepted",
          metadata: {},
          time: { end: now + 10 + index },
        },
      })
      insertLegacyLineage(sqlite, {
        id: `art-${index}`,
        taskID: "tsk_completed",
        childPartID: child.id,
        childCallID: child.callID,
        sessionID,
        time: now + index,
      })
      return child
    })
    sqlite.query("INSERT INTO tool_part_outcome(id,request_part_id,data,time_created) VALUES(?,?,?,?)").run(
      "out-completed-outer",
      completedOuter,
      JSON.stringify({
        outcome: "completed",
        output: JSON.stringify({ dispatches: [] }),
        title: "Dispatched frontier (2/2)",
        metadata: {},
        time: { end: now + 20 },
      }),
      now + 20,
    )

    const runningInput = input(["c", "d"])
    const runningOuter = "part-outer-running"
    const runningCall = insertOuter(sqlite, runningOuter, runningInput, now + 30)
    const runningChild = insertChild(sqlite, {
      outerID: runningOuter,
      index: 0,
      request: runningInput.dispatches[0],
      time: now + 31,
    })
    insertLegacyLineage(sqlite, {
      id: "art-running",
      taskID: "tsk_running",
      childPartID: runningChild.id,
      childCallID: runningChild.callID,
      sessionID: Identifier.deterministic("session", "migration-running"),
      time: now + 31,
    })
    insertChild(sqlite, {
      outerID: runningOuter,
      index: 1,
      request: runningInput.dispatches[1],
      time: now + 32,
      outcome: {
        outcome: "failed",
        failure: {
          name: "Error",
          message: "running member d failed",
          classification: "tool-execution",
          kind: "tool-execute-error",
          originSite: "legacy.dispatch-member",
        },
        time: { end: now + 33 },
      },
    })

    const failedInput = input(["e", "f"])
    const failedOuter = "part-outer-failed"
    const failedCall = insertOuter(sqlite, failedOuter, failedInput, now + 40)
    const failedFirst = insertChild(sqlite, {
      outerID: failedOuter,
      index: 0,
      request: failedInput.dispatches[0],
      time: now + 41,
    })
    insertLegacyLineage(sqlite, {
      id: "art-failed-first",
      taskID: "tsk_failed",
      childPartID: failedFirst.id,
      childCallID: failedFirst.callID,
      sessionID: Identifier.deterministic("session", "migration-failed-first"),
      time: now + 41,
    })
    insertChild(sqlite, {
      outerID: failedOuter,
      index: 1,
      request: failedInput.dispatches[1],
      time: now + 42,
      outcome: {
        outcome: "failed",
        failure: {
          name: "Error",
          message: "member f failed",
          classification: "tool-execution",
          kind: "tool-execute-error",
          originSite: "legacy.dispatch-member",
        },
        time: { end: now + 43 },
      },
    })
    sqlite.query("INSERT INTO tool_part_outcome(id,request_part_id,data,time_created) VALUES(?,?,?,?)").run(
      "out-failed-outer",
      failedOuter,
      JSON.stringify({
        outcome: "failed",
        failure: {
          name: "Error",
          message: "legacy outer failed",
          classification: "tool-execution",
          kind: "tool-execute-error",
          originSite: "legacy.dispatch-outer",
        },
        time: { end: now + 44 },
      }),
      now + 44,
    )

    expect(migrateDispatchCollectionOccurrences(sqlite)).toBe(true)
    const failedOutcome = JSON.parse(
      sqlite.query<{ data: string }, []>("SELECT data FROM tool_part_outcome WHERE id='out-failed-outer'").get()!.data,
    )
    const rewritten = sqlite
      .query<{ payload: string; payload_sha256: string }, []>("SELECT payload,payload_sha256 FROM engine_artifact WHERE id='art-0'")
      .get()!
    const runningProgress = sqlite
      .query<{ metadata: string }, [string]>(
        "SELECT metadata FROM tool_part_progress WHERE request_part_id=? ORDER BY time_created,id",
      )
      .all(runningOuter)
      .map((row) => JSON.parse(row.metadata).dispatch_collection.members[0])
    const expectedMetadata = deriveEngineArtifactCatalogMetadata({
      kind: "dispatch_lineage",
      payloadText: serializeEngineArtifactPayload(JSON.parse(rewritten.payload)),
    })
    expect({
      completed: [artifactPayload(sqlite, "art-0"), artifactPayload(sqlite, "art-1")].map((payload) => ({
        part: payload.tool_part_id,
        call: payload.tool_call_id,
        tool: payload.tool_name,
        index: payload.collection_member_index,
        count: payload.collection_member_count,
      })),
      running: artifactPayload(sqlite, "art-running"),
      failed: artifactPayload(sqlite, "art-failed-first"),
      failedOutcome,
      runningProgress,
      requestIDs: sqlite.query<{ id: string }, []>("SELECT id FROM tool_part_request ORDER BY id").all().map((row) => row.id),
      payloadSHA: rewritten.payload_sha256,
      expectedSHA: expectedMetadata.payload_sha256,
      indexes: sqlite.query<{ name: string }, []>(
        "SELECT name FROM sqlite_schema WHERE type='index' AND name LIKE 'engine_dispatch_lineage_%_idx' ORDER BY name",
      ).all().map((row) => row.name),
      archivedVersions: sqlite.query<{ count: number }, []>(
        "SELECT count(*) AS count FROM engine_artifact_version WHERE kind='dispatch_lineage'",
      ).get()!.count,
      schemaDrift: findSchemaDrift(sqlite),
      secondRun: migrateDispatchCollectionOccurrences(sqlite),
    }).toMatchObject({
      completed: [
        { part: completedOuter, call: completedCall, tool: "dispatch_agents", index: 0, count: 2 },
        { part: completedOuter, call: completedCall, tool: "dispatch_agents", index: 1, count: 2 },
      ],
      running: {
        tool_part_id: runningOuter,
        tool_call_id: runningCall,
        tool_name: "dispatch_agents",
        collection_member_index: 0,
        collection_member_count: 2,
      },
      failed: {
        tool_part_id: failedOuter,
        tool_call_id: failedCall,
        tool_name: "dispatch_agents",
        collection_member_index: 0,
        collection_member_count: 2,
      },
      failedOutcome: {
        outcome: "completed",
        metadata: { frontier_size: 2, completed_count: 1 },
      },
      runningProgress: [
        { member_index: 0, status: "completed", outcome: { kind: "accepted" } },
        { member_index: 1, status: "failed", failure: { message: "running member d failed" } },
      ],
      requestIDs: [completedOuter, failedOuter, runningOuter].sort(),
      payloadSHA: expectedMetadata.payload_sha256,
      expectedSHA: expectedMetadata.payload_sha256,
      indexes: [
        "engine_dispatch_lineage_collection_member_idx",
        "engine_dispatch_lineage_coordination_action_idx",
        "engine_dispatch_lineage_direct_tool_occurrence_idx",
        "engine_dispatch_lineage_initial_workflow_node_idx",
      ],
      archivedVersions: 4,
      schemaDrift: undefined,
      secondRun: false,
    })
    expect(failedOutcome.metadata.members.map((member: any) => member.status)).toEqual(["completed", "failed"])
    expect(completedChildren).toHaveLength(2)
  } finally {
    sqlite.close()
  }
})

test("returns the exact terminal-collection error for a lineage that never reached a durable Turn", () => {
  const sqlite = database()
  try {
    const now = Date.now()
    const collection = input(["lineage-only"])
    const outerID = "part-terminal-lineage-only"
    insertOuter(sqlite, outerID, collection, now)
    const child = insertChild(sqlite, {
      outerID,
      index: 0,
      request: collection.dispatches[0],
      time: now + 1,
    })
    const lineageID = "art-terminal-lineage-only"
    const sessionID = Identifier.deterministic("session", "migration-terminal-lineage-only")
    insertLegacyLineage(sqlite, {
      id: lineageID,
      taskID: "tsk_terminal_lineage_only",
      childPartID: child.id,
      childCallID: child.callID,
      sessionID,
      time: now + 1,
    })
    sqlite.query("DELETE FROM worker_turn_descriptor WHERE session_id=?").run(sessionID)
    sqlite.query("INSERT INTO tool_part_outcome(id,request_part_id,data,time_created) VALUES(?,?,?,?)").run(
      "out-terminal-lineage-only",
      outerID,
      JSON.stringify({
        outcome: "completed",
        output: JSON.stringify({ dispatches: [] }),
        title: "Dispatched frontier (1/1)",
        metadata: {},
        time: { end: now + 2 },
      }),
      now + 2,
    )

    expect(() => migrateDispatchCollectionOccurrences(sqlite)).toThrow(
      "Collection member 0 has neither an exact outcome, descriptor-backed lineage, nor outer failure",
    )
    expect({
      childRequestCount: sqlite.query<{ count: number }, [string]>(
        "SELECT COUNT(*) AS count FROM tool_part_request WHERE id=?",
      ).get(child.id)!.count,
      lineagePartID: artifactPayload(sqlite, lineageID).tool_part_id,
      outerOutcome: JSON.parse(
        sqlite.query<{ data: string }, []>(
          "SELECT data FROM tool_part_outcome WHERE id='out-terminal-lineage-only'",
        ).get()!.data,
      ).outcome,
    }).toEqual({
      childRequestCount: 1,
      lineagePartID: child.id,
      outerOutcome: "completed",
    })
  } finally {
    sqlite.close()
  }
})

test("enforces one immutable lineage per Tool occurrence, collection member, or initial workflow node", () => {
  const sqlite = database()
  try {
    expect(migrateDispatchCollectionOccurrences(sqlite)).toBe(true)
    const now = Date.now()
    const base = {
      task_id: "tsk_unique",
      adapter_input: {},
      delivery_owner: { kind: "runtime_process", process_occurrence_id: "process-owner" },
    }
    insertArtifact(sqlite, {
      id: "art-direct-a",
      taskID: "tsk-unique",
      time: now,
      payload: { ...base, tool_name: "dispatch_agent", tool_part_id: "part-direct", tool_call_id: "call-direct" },
    })
    expect(() => insertArtifact(sqlite, {
      id: "art-direct-b",
      taskID: "tsk-unique",
      time: now + 1,
      payload: { ...base, tool_name: "dispatch_agent", tool_part_id: "part-direct", tool_call_id: "call-direct" },
    })).toThrow("UNIQUE constraint failed: index 'engine_dispatch_lineage_direct_tool_occurrence_idx'")

    insertArtifact(sqlite, {
      id: "art-collection-a",
      taskID: "tsk-unique",
      time: now + 2,
      payload: {
        ...base,
        tool_name: "dispatch_agents",
        tool_part_id: "part-collection",
        tool_call_id: "call-collection",
        collection_member_index: 0,
        collection_member_count: 2,
      },
    })
    expect(() => insertArtifact(sqlite, {
      id: "art-collection-b",
      taskID: "tsk-unique",
      time: now + 3,
      payload: {
        ...base,
        tool_name: "dispatch_agents",
        tool_part_id: "part-collection",
        tool_call_id: "call-collection",
        collection_member_index: 0,
        collection_member_count: 2,
      },
    })).toThrow("UNIQUE constraint failed: index 'engine_dispatch_lineage_collection_member_idx'")

    const workflow = {
      ...base,
      workflow_binding: { kind: "virtual_workflow" },
      workflow_occurrence_id: "workflow-occurrence",
      workflow_node_id: "node-a",
    }
    insertArtifact(sqlite, {
      id: "art-workflow-a",
      taskID: "tsk-unique",
      time: now + 4,
      payload: { ...workflow, tool_name: "dispatch_agent", tool_part_id: "part-workflow-a", tool_call_id: "call-workflow-a" },
    })
    expect(() => insertArtifact(sqlite, {
      id: "art-workflow-b",
      taskID: "tsk-unique",
      time: now + 5,
      payload: { ...workflow, tool_name: "dispatch_agent", tool_part_id: "part-workflow-b", tool_call_id: "call-workflow-b" },
    })).toThrow("UNIQUE constraint failed: index 'engine_dispatch_lineage_initial_workflow_node_idx'")
    insertArtifact(sqlite, {
      id: "art-workflow-continuation",
      taskID: "tsk-unique",
      time: now + 6,
      payload: {
        ...workflow,
        tool_name: "dispatch_agent",
        tool_part_id: "part-workflow-continuation",
        tool_call_id: "call-workflow-continuation",
        continuation_of_dispatch_id: "dispatch-workflow-a",
      },
    })
    expect(sqlite.query<{ count: number }, []>(
      "SELECT count(*) AS count FROM engine_artifact WHERE json_extract(payload,'$.workflow_node_id')='node-a'",
    ).get()!.count).toBe(2)
  } finally {
    sqlite.close()
  }
})

test("takes the writer reservation before scanning dispatch collections", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "opencorvus-dispatch-collection-migration-"))
  const filename = path.join(directory, "migration.db")
  const sqlite = database(filename)
  const peer = new SQLite(filename)
  try {
    peer.exec("PRAGMA busy_timeout=0")
    const collection = input(["a"])
    const outer = "part-writer-reservation"
    insertOuter(sqlite, outer, collection, Date.now())
    insertChild(sqlite, { outerID: outer, index: 0, request: collection.dispatches[0], time: Date.now() })
    using _hook = DispatchCollectionOccurrenceMigrationTestHooks.replaceAfterAdmission(() => {
      expect(() => insertOuter(peer, "part-peer", input(["peer"]), Date.now())).toThrow()
    })
    expect(migrateDispatchCollectionOccurrences(sqlite)).toBe(true)
    expect(sqlite.query("SELECT id FROM tool_part_request WHERE id='part-peer'").get()).toBeNull()
  } finally {
    peer.close(true)
    sqlite.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test("rolls back lineage rewrites and child deletion on exact input drift", () => {
  const sqlite = database()
  try {
    const now = Date.now()
    const validInput = input(["a"])
    const validOuter = "part-valid"
    insertOuter(sqlite, validOuter, validInput, now)
    const validChild = insertChild(sqlite, { outerID: validOuter, index: 0, request: validInput.dispatches[0], time: now })
    insertLegacyLineage(sqlite, {
      id: "art-valid",
      taskID: "tsk_rollback",
      childPartID: validChild.id,
      childCallID: validChild.callID,
      sessionID: Identifier.deterministic("session", "migration-valid"),
      time: now,
    })

    const invalidInput = input(["b"])
    const invalidOuter = "part-invalid"
    insertOuter(sqlite, invalidOuter, invalidInput, now + 1)
    const invalidChild = insertChild(sqlite, {
      outerID: invalidOuter,
      index: 0,
      request: {
        ...invalidInput.dispatches[0],
        dispatch: { ...invalidInput.dispatches[0]!.dispatch, target: "drift" },
      },
      time: now + 1,
    })

    expect(() => migrateDispatchCollectionOccurrences(sqlite)).toThrow(
      `Legacy dispatch member ${invalidChild.id} does not match outer part-invalid index 0`,
    )
    expect({
      lineage: artifactPayload(sqlite, "art-valid"),
      childIDs: sqlite.query<{ id: string }, []>("SELECT id FROM tool_part_request ORDER BY id").all().map((row) => row.id),
      trigger: sqlite.query<{ name: string }, []>(
        "SELECT name FROM sqlite_schema WHERE type='trigger' AND name='engine_dispatch_lineage_immutable'",
      ).get()?.name,
    }).toMatchObject({
      lineage: { tool_part_id: validChild.id, tool_call_id: validChild.callID, tool_name: "dispatch_agent" },
      childIDs: expect.arrayContaining([validOuter, validChild.id, invalidOuter]),
      trigger: "engine_dispatch_lineage_immutable",
    })
  } finally {
    sqlite.close()
  }
})

test("returns the exact authority error for a production-shaped lineage payload drift", () => {
  const sqlite = database()
  try {
    const now = Date.now()
    const collection = input(["a"])
    const outer = "part-lineage-authority-drift"
    insertOuter(sqlite, outer, collection, now)
    const child = insertChild(sqlite, { outerID: outer, index: 0, request: collection.dispatches[0], time: now })
    insertLegacyLineage(sqlite, {
      id: "art-lineage-authority-drift",
      taskID: "tsk_lineage-authority-drift",
      childPartID: child.id,
      childCallID: child.callID,
      sessionID: Identifier.deterministic("session", "migration-lineage-authority-drift"),
      time: now,
    })
    sqlite.exec("DROP TRIGGER engine_dispatch_lineage_immutable")
    const lineage = sqlite.query<any, []>(
      `SELECT id,task_id,kind,label,payload,time_created,time_updated,catalog_revision
       FROM engine_artifact WHERE id='art-lineage-authority-drift'`,
    ).get()!
    const payload = JSON.parse(lineage.payload)
    payload.target_agent_id = "drift"
    rewriteDispatchLineagePayloadForMigration(sqlite, lineage, payload)
    sqlite.exec(canonicalSchemaObjectSQL("trigger", "engine_dispatch_lineage_immutable"))

    expect(() => migrateDispatchCollectionOccurrences(sqlite)).toThrow(
      "Dispatch lineage art-lineage-authority-drift does not match outer member 0 authority",
    )
    expect({
      child: sqlite.query<{ id: string }, [string]>("SELECT id FROM tool_part_request WHERE id=?").get(child.id)?.id,
      tool: artifactPayload(sqlite, "art-lineage-authority-drift").tool_name,
      target: artifactPayload(sqlite, "art-lineage-authority-drift").target_agent_id,
    }).toEqual({ child: child.id, tool: "dispatch_agent", target: "drift" })
  } finally {
    sqlite.close()
  }
})

test("rejects a damaged persisted outer collection before any durable mutation", () => {
  const sqlite = database()
  try {
    const now = Date.now()
    const outerID = "part-invalid-outer-input"
    const damaged = input(["a"])
    delete (damaged.team[0] as { responsibility?: string }).responsibility
    insertOuter(sqlite, outerID, damaged, now)

    let failure: unknown
    try {
      migrateDispatchCollectionOccurrences(sqlite)
    } catch (error) {
      failure = error
    }
    expect(failure).toMatchObject({
      name: "DispatchCollectionMigrationInputError",
      code: "DISPATCH_COLLECTION_MIGRATION_INPUT_INVALID",
      message: expect.stringContaining(
        "dispatch_agents Tool request part-invalid-outer-input has invalid persisted collection input",
      ),
    })
    expect({
      requests: sqlite.query<{ count: number }, []>("SELECT count(*) AS count FROM tool_part_request").get()!.count,
      indexes: sqlite.query<{ count: number }, []>(
        "SELECT count(*) AS count FROM sqlite_schema WHERE type='index' AND name IN ('engine_dispatch_lineage_direct_tool_occurrence_idx','engine_dispatch_lineage_collection_member_idx','engine_dispatch_lineage_initial_workflow_node_idx','engine_dispatch_lineage_coordination_action_idx')",
      ).get()!.count,
      versions: sqlite.query<{ count: number }, []>("SELECT count(*) AS count FROM engine_artifact_version").get()!.count,
    }).toEqual({ requests: 1, indexes: 0, versions: 0 })
  } finally {
    sqlite.close()
  }
})
