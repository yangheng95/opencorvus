import { describe, expect, test } from "bun:test"
import { Database as SQLite } from "bun:sqlite"
import { SCHEMA_DDL } from "../src/storage/ddl"
import {
  buildTaskCreationContractFact,
  buildTaskCreationRequestFact,
  globalTaskRequestContract,
  panelTaskCreationCallerInput,
  taskCreationCallerRequest,
  taskCreationContractFingerprint,
} from "../src/engine/task-creation-contract"
import { createPanelUIRequestToolContext, PanelTool } from "../src/tool/panel"
import { buildPanelCreationFact, panelCreationTargetID } from "../src/engine/panel-creation-fact"

test("Panel UI create_task accepts only the server-owned request occurrence", async () => {
  const requestID = crypto.randomUUID()
  const panel = await PanelTool.init({ agentID: "panel_ui" })
  const context = createPanelUIRequestToolContext({ surface: "panel", requestID })
  for (const callerRequestID of [crypto.randomUUID(), ""]) {
    await expect(
      panel.execute(
        {
          action: "create_task",
          request_id: callerRequestID,
          request: "Create one Panel Task",
          title: "Panel Task",
          productPillar: "code",
        },
        context,
      ),
    ).rejects.toThrow("request_id conflicts with the server-owned Panel UI request identity")
  }
})

describe("Task creation persisted Tool lineage", () => {
  test("only the exact panel.create_task Session Message call Part and request may own the contract", () => {
    const db = new SQLite(":memory:")
    db.exec(SCHEMA_DDL)
    const now = 1
    db.query(
      `INSERT INTO project(id,worktree,sandboxes,generation,time_created,time_updated)
       VALUES(?,?,?,?,?,?)`,
    ).run("project", "C:/project", "[]", "11111111-1111-4111-8111-111111111111", now, now)
    db.query(
      `INSERT INTO session(id,project_id,slug,directory,title,version,kind,time_created,time_updated)
       VALUES(?,?,?,?,?,?,?,?,?)`,
    ).run("session", "project", "session", "C:/project", "Session", "1", "assistant", now, now)
    db.query("INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)").run(
      "caller-message",
      "session",
      now,
      now,
      JSON.stringify({ role: "user" }),
    )
    db.query("INSERT INTO message(id,session_id,time_created,time_updated,data) VALUES(?,?,?,?,?)").run(
      "message",
      "session",
      now,
      now,
      JSON.stringify({ role: "assistant", parentID: "caller-message" }),
    )

    const attempt = (input: {
      label: string
      tool?: string
      action?: string
      storedRequest?: string
      storedMetadata?: Record<string, unknown>
      contractToolInput?: Record<string, unknown>
      contractAttachments?: unknown[]
      creator?: Partial<{ tool_part_id: string; message_id: string; tool_call_id: string; session_id: string }>
      contractRequest?: string
      omitRelationalToolPart?: boolean
      accepted?: boolean
    }) => {
      const partID = `part-${input.label}`
      const callID = `call-${input.label}`
      const taskID = `task-${input.label}`
      db.query("INSERT INTO tool_part_request(id,message_id,data,time_created) VALUES(?,?,?,?)").run(
        partID,
        "message",
        JSON.stringify({
          type: "tool-request",
          callID,
          tool: input.tool ?? "panel_create_task",
          input: {
            request: input.storedRequest ?? "Create exact Task",
            ...(input.storedMetadata ? { metadata: input.storedMetadata } : {}),
            ...(input.action ? { action: input.action } : {}),
          },
          time: { start: now },
        }),
        now,
      )
      db.query(
        `INSERT INTO engine_task(id,project_id,source,product_pillar,title,request,priority,time_created)
         VALUES(?,?,?,?,?,?,?,?)`,
      ).run(taskID, "project", "mission", "code", "Task", "Create exact Task", "normal", now)
      const toolInput =
        input.contractToolInput ??
        {
          request: input.storedRequest ?? "Create exact Task",
          ...(input.storedMetadata ? { metadata: input.storedMetadata } : {}),
          ...(input.action ? { action: input.action } : {}),
        }
      const creator = {
            actor: "control_agent",
            tool_part_id: partID,
            message_id: "message",
            tool_call_id: callID,
            session_id: "session",
            tool_input: toolInput,
            ...input.creator,
          }
      const request = buildTaskCreationRequestFact({
        creatorToolPartID: partID,
        request: taskCreationCallerRequest({
          caller: {
            ...panelTaskCreationCallerInput(toolInput, input.contractAttachments ?? []),
            request: input.contractRequest ?? toolInput.request,
          },
          creator,
        }),
      })
      const contract = buildTaskCreationContractFact({
        request,
        resolved: {
          project_id: "project",
          directory: "C:/project",
          source: "mission",
          product_pillar: "code",
          title: "Task",
          request: "Create exact Task",
          attachments: [],
          priority: "normal",
          budget: null,
          metadata: {},
          effective_model: null,
          prompt_profile_id: "base",
          package_revision: { id: "base", package_digest: "a".repeat(64) },
          creation_expected_package_digest: null,
          artifact_imports: [],
          process: { protocol: "task-native-process-binding-v2", mode: "native", workspace_root: "C:/project" },
          creator,
        },
      })
      const insert = () =>
        db
          .query(
            `INSERT INTO engine_task_creation_contract(
              task_id,fingerprint,contract,creator_tool_part_id,time_created
            ) VALUES(?,?,?,?,?)`,
          )
          .run(
            taskID,
            request.fingerprint,
            JSON.stringify(contract.contract),
            input.omitRelationalToolPart ? null : partID,
            now,
          )
      if (input.accepted) expect(insert()).toMatchObject({ changes: 1 })
      else if (input.omitRelationalToolPart) {
        expect(insert).toThrow("engine_task_creation_contract_fingerprint_shape")
      }
      else expect(insert).toThrow("engine_task_creation_contract: invalid panel Tool creator lineage")
    }

    attempt({ label: "accepted", accepted: true })
    attempt({ label: "missing-relational-tool-part", omitRelationalToolPart: true })
    attempt({ label: "tool", tool: "wait" })
    attempt({ label: "action", action: "wake_work" })
    attempt({ label: "part", creator: { tool_part_id: "part-other" } })
    attempt({ label: "message", creator: { message_id: "message-other" } })
    attempt({ label: "call", creator: { tool_call_id: "call-other" } })
    attempt({ label: "session", creator: { session_id: "session-other" } })
    attempt({
      label: "request",
      contractRequest: "Changed request",
    })
    attempt({
      label: "metadata",
      storedMetadata: { intent: "exact" },
      contractToolInput: { request: "Create exact Task", metadata: { intent: "changed" } },
    })
    attempt({
      label: "attachments",
      contractAttachments: [{ url: "/attachment/project/forged.txt", mime: "text/plain", filename: null }],
    })

    const attemptPanelSession = (input: {
      label: string
      mutate?: (fact: ReturnType<typeof buildPanelCreationFact>) => Record<string, unknown>
      sessionID?: string
      accepted?: boolean
    }) => {
      const partID = `wake-part-${input.label}`
      const callID = `wake-call-${input.label}`
      const toolInput = {
        title: `Wake ${input.label}`,
        request: `Wake ${input.label}`,
        reason: "Exact persisted wake request",
      }
      db.query("INSERT INTO tool_part_request(id,message_id,data,time_created) VALUES(?,?,?,?)").run(
        partID,
        "message",
        JSON.stringify({ type: "tool-request", callID, tool: "panel_wake_work", input: toolInput, time: { start: now } }),
        now,
      )
      const fact = buildPanelCreationFact({
        operation: "wake_work",
        toolPartID: partID,
        messageID: "message",
        toolCallID: callID,
        callerUserMessageID: "caller-message",
        params: toolInput,
      })
      const targetID = input.sessionID ?? panelCreationTargetID("wake_work", partID)
      const insert = () => db.query(
        `INSERT INTO session(id,project_id,slug,directory,title,version,kind,time_created,time_updated,metadata)
         VALUES(?,?,?,?,?,?,?,?,?,?)`,
      ).run(
        targetID,
        "project",
        `wake-${input.label}`,
        "C:/project",
        `Wake ${input.label}`,
        "1",
        "assistant",
        now,
        now,
        JSON.stringify({
          conversation: { surface: "right-sidebar", experience: "work" },
          panelCreation: input.mutate ? input.mutate(fact) : fact,
        }),
      )
      if (input.accepted) expect(insert()).toMatchObject({ changes: 1 })
      else expect(insert).toThrow("session: invalid panel creation occurrence")
    }
    attemptPanelSession({ label: "accepted", accepted: true })
    expect(
      db
        .query<{ detail: string }, [string]>(
          `EXPLAIN QUERY PLAN
           SELECT id FROM session
           WHERE json_type(metadata,'$.panelCreation') IS NOT NULL
             AND json_extract(metadata,'$.panelCreation.tool_part_id')=?`,
        )
        .all("wake-part-accepted")
        .map((row) => row.detail)
        .join("\n"),
    ).toContain("session_panel_creation_tool_part_idx")
    attemptPanelSession({ label: "message", mutate: (fact) => ({ ...fact, message_id: "message-other" }) })
    attemptPanelSession({ label: "call", mutate: (fact) => ({ ...fact, tool_call_id: "call-other" }) })
    attemptPanelSession({
      label: "input",
      mutate: (fact) => ({ ...fact, input: { ...fact.input, request: "changed" } }),
    })
    attemptPanelSession({ label: "target", sessionID: "session-wrong-target" })
    attemptPanelSession({
      label: "derived-target",
      sessionID: "ses_pforgedtarget",
      mutate: (fact) => ({ ...fact, target_id: "ses_pforgedtarget" }),
    })

    expect(() =>
      db
        .query("UPDATE session SET metadata=? WHERE id=?")
        .run(JSON.stringify({ panelCreation: { protocol: "panel-creation-v1", tool_part_id: "part-accepted" } }), "session"),
    ).toThrow("session: panel creation occurrence must be bound at insert")

    db.query(
      `INSERT INTO engine_task(id,project_id,request_id,source,product_pillar,title,request,priority,time_created)
       VALUES(?,?,?,?,?,?,?,?,?)`,
    ).run("task-global", "project", "global-request", "api", "code", "Global", "Global", "normal", now)
    db.query("UPDATE engine_task SET global_creation_allocation_id=? WHERE id=?").run(
      "allocation-valid",
      "task-global",
    )
    const allocationContract = globalTaskRequestContract({
      request: "Global",
      title: null,
      source: "api",
      productPillar: "code",
      attachments: [],
    })
    expect(
      db
        .query(
          `INSERT INTO global_creation_allocation(
            id,kind,request_id,request_fingerprint,request_contract,resolution_seed,
            materialized_project_id,materialized_project_generation,time_materialized,
            accepted_project_id,accepted_target_id,accepted_initial_config_overlay,time_accepted,directory,time_created
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          "allocation-valid",
          "global_task",
          "global-request",
          taskCreationContractFingerprint(allocationContract),
          JSON.stringify(allocationContract),
          "{}",
          "project",
          "11111111-1111-4111-8111-111111111111",
          now,
          "project",
          "task-global",
          "{}",
          now,
          "C:/global-valid",
          now,
        ),
    ).toMatchObject({ changes: 1 })
    expect(() =>
      db
        .query(
          `INSERT INTO global_creation_allocation(
            id,kind,request_id,request_fingerprint,request_contract,resolution_seed,
            materialized_project_id,materialized_project_generation,time_materialized,
            accepted_project_id,accepted_target_id,accepted_initial_config_overlay,time_accepted,directory,time_created
          ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          "allocation-invalid",
          "global_task",
          "another-request",
          taskCreationContractFingerprint(allocationContract),
          JSON.stringify(allocationContract),
          "{}",
          "project",
          "11111111-1111-4111-8111-111111111111",
          now,
          "project",
          "task-global",
          "{}",
          now,
          "C:/global-invalid",
          now,
        ),
    ).toThrow("global_creation_allocation: accepted target does not match request aggregate")
    db.close()
  })
})
