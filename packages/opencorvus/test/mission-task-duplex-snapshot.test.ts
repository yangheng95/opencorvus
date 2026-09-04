import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolDeliveryReceiptTable, ProtocolInboxTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { SessionStatus } from "@/session/status"
import {
  MessageTable,
  PartTable,
  ToolPartOutcomeTable,
  ToolPartProgressTable,
  ToolPartRequestTable,
} from "@/session/session.sql"
import { Database } from "@/storage/db"
import {
  missionTaskDuplexFinalEvidenceState,
  missionTaskDuplexActivityKey,
  missionTaskDuplexProgressKey,
  missionTaskDuplexToolHealth,
  missionTaskDuplexTrajectoryEvidence,
  missionTaskDuplexReconciliationEvidence,
  missionTaskDuplexUsageOwnerRequirements,
  observeMissionTaskDuplexActivity,
  projectMissionTaskDuplexControlStateInTransaction,
} from "../script/mission-task-duplex-snapshot"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Mission Task duplex snapshot", () => {
  test("accepts one causal terminal reconciliation per Task and reports repeated-read trajectory mismatch", () => {
    const part = (tool: string, input: Record<string, unknown>, start: number, output = "{}") => ({
      id: `${tool}:${start}`, sessionID: "mission", tool, state: { status: "completed", input, output, time: { start, end: start + 1 } },
    })
    const readOutput = (taskID: string, readRef: string) => JSON.stringify({
      taskID,
      terminal_lifecycle_reference: { terminalEventID: `terminal-${taskID}` },
      artifact_transport_version: 2,
      artifact_locator_ref: "al_1234567890abcdef",
      artifact_read_ref: readRef,
      locator: { source: "engine_artifact", artifact_id: `artifact-${taskID}`, catalog_revision: 1, expected_sha256: "a".repeat(64) },
      media_type: "application/json", byte_start: 0, byte_end: 1, next_offset: null, total_bytes: 1,
      complete: true, sha256: "a".repeat(64), text: "x", attachment: false,
    })
    const parts = [
      part("panel_create_task", { title: "B" }, 1),
      part("panel_create_task", { title: "A" }, 3),
      part("panel_query_task", { taskIDs: ["B"] }, 5),
      part("panel_query_task_artifacts", { taskID: "B", page_number: 1 }, 7),
      part("panel_read_task_artifact", { taskID: "B" }, 9, readOutput("B", "ar_1234567890abcdeB")),
      part("panel_query_task", { taskIDs: ["A"] }, 11),
      part("panel_query_task_artifacts", { taskID: "A", page_number: 1 }, 13),
      part("panel_read_task_artifact", { taskID: "A" }, 15, readOutput("A", "ar_1234567890abcdeA")),
      part("publish_interactive_artifact", {}, 17),
      part("panel_complete_mission", {
        summary: "Both exact terminal occurrences accepted",
        task_acceptances: [
          { task_id: "A", evidence_read_refs: ["ar_1234567890abcdeA"] },
          { task_id: "B", evidence_read_refs: ["ar_1234567890abcdeB"] },
        ],
      }, 21),
    ]
    const evaluate = (toolParts = parts) => missionTaskDuplexReconciliationEvidence({
      missionSessionID: "mission", completionPartID: "panel_complete_mission:21", taskIDs: ["A", "B"], toolParts,
    })
    expect(evaluate()).toEqual({
      ready: true, status: "accepted", completionObserved: true, creationCount: 2, publicationCount: 1, completionCount: 1,
      tasks: ["A", "B"].map((taskID) => ({
        taskID, queryCount: 1, catalogCount: 1, readCount: 1,
        readReference: `ar_1234567890abcde${taskID}`, retainedReadAccepted: true, causalOrder: true,
      })),
    })
    const repeated = evaluate([...parts, part("panel_read_task_artifact", { taskID: "A" }, 19, readOutput("A", "ar_abcdefghijklmnop"))])
    expect({ status: repeated.status, counts: repeated.tasks.map(({ taskID, readCount }) => ({ taskID, readCount })) }).toEqual({
      status: "trajectory_mismatch", counts: [{ taskID: "A", readCount: 2 }, { taskID: "B", readCount: 1 }],
    })
    const premature = evaluate(parts.map((item) => item.tool === "publish_interactive_artifact"
      ? part(item.tool, item.state.input, 6) : item))
    expect(premature.status).toBe("trajectory_mismatch")
    const pendingSnapshot = parts.map((item) => item.tool === "panel_complete_mission"
      ? { ...item, state: { ...item.state, status: "running" } } : item)
    expect([evaluate(pendingSnapshot).status, evaluate().status]).toEqual(["pending_completion", "accepted"])
    expect(missionTaskDuplexReconciliationEvidence({
      missionSessionID: "mission", completionPartID: "newer-completion", taskIDs: ["A", "B"], toolParts: parts,
    }).status).toBe("pending_completion")
  })

  test("reports persisted phase timing and per-agent Tool-name counts", () => {
    expect(
      missionTaskDuplexTrajectoryEvidence({
        missionCreatedAtMs: 1_000,
        missionCompletedAtMs: 9_000,
        tasks: [
          { createdAtMs: 2_000, completedAtMs: 7_000 },
          { createdAtMs: 2_500, completedAtMs: 8_000 },
        ],
        schedulerEvents: [
          { emittedAtMs: 3_000 },
          { emittedAtMs: 6_000 },
        ],
        messages: [
          { id: "message-mission", role: "assistant", agentID: "mission" },
          { id: "message-orchestrator-a", role: "assistant", agentID: "orchestrator" },
          { id: "message-orchestrator-b", role: "assistant", agentID: "orchestrator" },
        ],
        toolRequests: [
          { messageID: "message-mission", tool: "scheduler_message", input: { action: "send" } },
          { messageID: "message-mission", tool: "mission_state", input: { action: "snapshot" } },
          { messageID: "message-mission", tool: "mission_state", input: { action: "commit" } },
          { messageID: "message-orchestrator-a", tool: "scheduler_message" },
          { messageID: "message-orchestrator-b", tool: "no_action" },
        ],
      }),
    ).toEqual({
      milestones: {
        missionCreatedAtMs: 1_000,
        firstTaskCreatedAtMs: 2_000,
        firstSchedulerEventAtMs: 3_000,
        lastSchedulerEventAtMs: 6_000,
        tasksTerminalAtMs: 8_000,
        missionCompletedAtMs: 9_000,
      },
      durationsMs: {
        missionToFirstTask: 1_000,
        missionToFirstSchedulerEvent: 2_000,
        schedulerEventWindow: 3_000,
        taskLifecycleWindow: 6_000,
        tasksTerminalToMissionCompletion: 1_000,
        missionToCompletion: 8_000,
      },
      toolCallsByAgent: [
        {
          agentID: "mission",
          totalCalls: 3,
          tools: [
            { tool: "mission_state", count: 2 },
            { tool: "scheduler_message", count: 1 },
          ],
        },
        {
          agentID: "orchestrator",
          totalCalls: 2,
          tools: [
            { tool: "no_action", count: 1 },
            { tool: "scheduler_message", count: 1 },
          ],
        },
      ],
      toolActionsByAgent: [
        {
          agentID: "mission",
          actions: [
            { action: "mission_state:commit", count: 1 },
            { action: "mission_state:snapshot", count: 1 },
            { action: "scheduler_message:send", count: 1 },
          ],
        },
      ],
    })

    expect(() =>
      missionTaskDuplexTrajectoryEvidence({
        missionCreatedAtMs: 1_000,
        missionCompletedAtMs: 9_000,
        tasks: [
          { createdAtMs: 2_000, completedAtMs: 7_000 },
          { createdAtMs: 5_000, completedAtMs: 4_000 },
        ],
        schedulerEvents: [{ emittedAtMs: 3_000 }],
        messages: [],
        toolRequests: [],
      }),
    ).toThrow("Mission Task duplex Task 2 completion cannot precede creation")
  })

  test("resolves Task-root usage requirements to their exact orchestrator child Sessions", () => {
    expect(
      missionTaskDuplexUsageOwnerRequirements({
        missionSessionID: "session-mission",
        taskRootSessionIDs: ["session-task-a", "session-task-b", "session-task-ambiguous"],
        sessions: [
          { id: "session-task-a", parentID: null, kind: "root" },
          { id: "session-orchestrator-a", parentID: "session-task-a", kind: "orchestrator" },
          { id: "session-planner-a", parentID: "session-task-a", kind: "planner" },
          { id: "session-orchestrator-b", parentID: "session-task-b", kind: "orchestrator" },
          { id: "session-orchestrator-left", parentID: "session-task-ambiguous", kind: "orchestrator" },
          { id: "session-orchestrator-right", parentID: "session-task-ambiguous", kind: "orchestrator" },
        ],
      }),
    ).toEqual({
      owners: [
        { sessionID: "session-mission", agentID: "mission" },
        { sessionID: "session-orchestrator-a", agentID: "orchestrator" },
        { sessionID: "session-orchestrator-b", agentID: "orchestrator" },
      ],
      unresolvedTaskRootSessionIDs: ["session-task-ambiguous"],
    })
  })

  test("renews the bounded inactivity deadline from persisted running Tool progress", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const now = 1_000
        const root = await Session.create({ kind: "root", title: "Duplex activity" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "mission",
          model: { providerID: "openai", modelID: "gpt-5.6-sol" },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          parentID: user.id,
          role: "assistant",
          author: "mission",
          time: { created: now + 1 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-sol",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const runningTool = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: root.id,
          messageID: assistant.id,
          type: "tool",
          callID: "call_duplex_activity",
          tool: "bash",
          state: { status: "running", input: { command: "train" }, time: { start: now + 2 } },
        })
        const activityKey = () => Database.use((db) => missionTaskDuplexActivityKey({
          taskCount: 0,
          schedulerEventCount: 0,
          deliveredInboxCount: 0,
          messages: db.select().from(MessageTable).all(),
          parts: db.select().from(PartTable).all(),
          toolRequests: db.select().from(ToolPartRequestTable).all(),
          toolProgress: db.select().from(ToolPartProgressTable).all(),
          toolOutcomes: db.select().from(ToolPartOutcomeTable).all(),
        }))
        const initialKey = activityKey()
        const initial = observeMissionTaskDuplexActivity({
          activityKey: initialKey,
          observedAtMs: now + 3,
          inactivityWindowMs: 3_000,
          absoluteDeadlineMs: 10_000,
        })
        expect(initial.deadlineMs).toBe(4_003)

        const stable = observeMissionTaskDuplexActivity({
          previous: initial,
          activityKey: activityKey(),
          observedAtMs: now + 1_000,
          inactivityWindowMs: 3_000,
          absoluteDeadlineMs: 10_000,
        })
        expect(stable).toEqual(initial)

        const progressID = Identifier.ascending("part")
        Database.use((db) => db.insert(ToolPartProgressTable).values({
          id: progressID,
          request_part_id: runningTool.id,
          metadata: { output_bytes: 31_337 },
          time_created: now + 2_500,
        }).run())
        const progressKey = activityKey()
        expect(JSON.parse(progressKey).toolProgress).toEqual({
          count: 1,
          latestTime: now + 2_500,
          latestID: progressID,
        })
        const renewed = observeMissionTaskDuplexActivity({
          previous: stable,
          activityKey: progressKey,
          observedAtMs: now + 2_600,
          inactivityWindowMs: 3_000,
          absoluteDeadlineMs: 10_000,
        })
        expect(renewed.deadlineMs).toBe(6_600)

        const capped = observeMissionTaskDuplexActivity({
          previous: renewed,
          activityKey: `${progressKey}:terminal`,
          observedAtMs: 9_000,
          inactivityWindowMs: 3_000,
          absoluteDeadlineMs: 10_000,
        })
        expect(capped.deadlineMs).toBe(10_000)
      },
    })
  })

  test("accepts one completion-owned canonical Artifact and exact scheduler usage owners", () => {
    const nonce = "DUPLEX-final-evidence"
    const base = {
      missionSessionID: "session-mission",
      completionMessageID: "message-completion",
      completionParentMessageID: "message-input",
      messages: [
        {
          id: "message-completion",
          sessionID: "session-mission",
          role: "assistant",
          parentMessageID: "message-input",
          completedAtMs: 200,
          finish: "stop",
        },
      ],
      execution: { inputMessageID: "message-input", status: { type: "idle" as const } },
      nonce,
      artifacts: [
        {
          id: "artifact-final",
          messageID: "message-artifact",
          sessionID: "session-mission",
          parentMessageID: "message-input",
          payload: {
            schemaVersion: "1",
            renderer: "document@1",
            title: "Duplex completion",
            markdown: `# Completed\n\n${nonce}`,
          },
        },
      ],
      usage: [
        {
          sessionID: "session-mission",
          agentID: "mission",
          inputTokens: 100,
          outputTokens: 20,
          reasoningTokens: 5,
          cacheReadTokens: 40,
          cacheWriteTokens: 0,
          totalTokens: 165,
        },
        {
          sessionID: "session-task-a",
          agentID: "orchestrator",
          inputTokens: 80,
          outputTokens: 10,
          reasoningTokens: 3,
          cacheReadTokens: 20,
          cacheWriteTokens: 0,
          totalTokens: 113,
        },
        {
          sessionID: "session-task-b",
          agentID: "orchestrator",
          inputTokens: 70,
          outputTokens: 9,
          reasoningTokens: 2,
          cacheReadTokens: 15,
          cacheWriteTokens: 0,
          totalTokens: 96,
        },
      ],
      requiredUsageOwners: [
        { sessionID: "session-mission", agentID: "mission" as const },
        { sessionID: "session-task-a", agentID: "orchestrator" as const },
        { sessionID: "session-task-b", agentID: "orchestrator" as const },
      ],
    }

    expect(missionTaskDuplexFinalEvidenceState(base)).toEqual({
      ready: true,
      blockingReasons: [],
      finalArtifactID: "artifact-final",
      finalArtifactCount: 1,
      artifactContainsNonce: true,
      missingUsageOwners: [],
      finalReply: {
        status: "settled",
        responseMessageIDs: ["message-completion"],
        completedAtMs: 200,
        failedReplyIDs: [],
      },
      usageByAgent: [
        {
          agentID: "mission",
          calls: 1,
          inputTokens: 100,
          outputTokens: 20,
          reasoningTokens: 5,
          cacheReadTokens: 40,
          cacheWriteTokens: 0,
          totalTokens: 165,
        },
        {
          agentID: "orchestrator",
          calls: 2,
          inputTokens: 150,
          outputTokens: 19,
          reasoningTokens: 5,
          cacheReadTokens: 35,
          cacheWriteTokens: 0,
          totalTokens: 209,
        },
      ],
    })

    for (const status of [
      { type: "streaming" as const },
      { type: "retry" as const, attempt: 1, message: "retrying", next: 300 },
    ]) {
      expect(
        missionTaskDuplexFinalEvidenceState({
          ...base,
          execution: { ...base.execution, status },
        }).blockingReasons,
      ).toEqual(["final_response_unsettled"])
    }
    expect(
      missionTaskDuplexFinalEvidenceState({
        ...base,
        execution: { ...base.execution, inputMessageID: "another-input" },
      }).finalReply.status,
    ).toBe("pending")
    expect(
      missionTaskDuplexFinalEvidenceState({
        ...base,
        messages: [
          { ...base.messages[0]!, finish: "tool-calls", completedAtMs: 200 },
          { ...base.messages[0]!, id: "earlier-stop", completedAtMs: 100 },
        ],
      }).blockingReasons,
    ).toEqual(["final_response_unsettled"])
    expect(
      missionTaskDuplexFinalEvidenceState({
        ...base,
        messages: [{ ...base.messages[0]!, error: { name: "MessageAbortedError", data: { message: "shutdown" } } }],
      }).finalReply,
    ).toEqual({
      status: "failed",
      responseMessageIDs: [],
      completedAtMs: undefined,
      failedReplyIDs: ["message-completion"],
    })

    expect(
      missionTaskDuplexFinalEvidenceState({
        ...base,
        completionMessageID: undefined,
        completionParentMessageID: undefined,
        usage: base.usage.filter((row) => row.sessionID !== "session-task-b"),
      }).blockingReasons,
    ).toEqual([
      "mission_completion_missing",
      "final_artifact_occurrence_missing",
      "final_artifact_payload_invalid",
      "final_artifact_nonce_missing",
      "required_usage_missing",
    ])

    expect(
      missionTaskDuplexFinalEvidenceState({
        ...base,
        artifacts: base.artifacts.map((artifact) => ({
          ...artifact,
          parentMessageID: "message-previous-input",
        })),
      }).blockingReasons,
    ).toEqual(["final_artifact_occurrence_missing", "final_artifact_payload_invalid", "final_artifact_nonce_missing"])

    expect(
      missionTaskDuplexFinalEvidenceState({
        ...base,
        completionParentMessageID: undefined,
      }).blockingReasons,
    ).toEqual([
      "mission_completion_occurrence_missing",
      "final_artifact_occurrence_missing",
      "final_artifact_payload_invalid",
      "final_artifact_nonce_missing",
    ])

    expect(
      missionTaskDuplexFinalEvidenceState({
        ...base,
        artifacts: [
          ...base.artifacts,
          { ...base.artifacts[0]!, id: "artifact-duplicate", messageID: "message-artifact-2" },
        ],
      }).blockingReasons,
    ).toEqual(["final_artifact_occurrence_missing", "final_artifact_payload_invalid", "final_artifact_nonce_missing"])
  })

  test("accepts the final reply only after persisted assistant and exact execution settlement", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Final response settlement" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "work",
          model: { providerID: "test", modelID: "test" },
          time: { created: 100 },
        })
        const completion = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "assistant",
          author: "work",
          agent: "work",
          parentID: user.id,
          providerID: "test",
          modelID: "test",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 1, input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          time: { created: 110, completed: 120 },
          finish: "tool-calls",
        })
        if (completion.role !== "assistant") throw new Error("Expected persisted assistant completion")
        const owner = new AbortController().signal
        SessionStatus.beginPromptGeneration(session.id, owner)
        SessionStatus.beginExecutionOccurrence(session.id, user.id, owner)
        await SessionStatus.set(session.id, { type: "streaming" }, { promptGenerationOwner: owner })
        const observe = () =>
          missionTaskDuplexFinalEvidenceState({
            missionSessionID: session.id,
            completionMessageID: completion.id,
            completionParentMessageID: user.id,
            messages: Database.use((db) => db.select().from(MessageTable).all()).map((row) => {
              const message = Message.Info.parse({ ...row.data, id: row.id, sessionID: row.session_id })
              return {
                id: message.id,
                sessionID: message.sessionID,
                role: message.role,
                ...(message.role === "assistant"
                  ? {
                      parentMessageID: message.parentID,
                      completedAtMs: message.time.completed,
                      finish: message.finish,
                      error: message.error,
                    }
                  : {}),
              }
            }),
            execution: {
              inputMessageID: SessionStatus.executionOccurrence(session.id)?.inputMessageID,
              status: SessionStatus.get(session.id),
            },
            nonce: "final-response",
            artifacts: [
              {
                id: "final",
                messageID: completion.id,
                sessionID: session.id,
                parentMessageID: user.id,
                payload: { schemaVersion: "1", renderer: "document@1", title: "Final", markdown: "final-response" },
              },
            ],
            requiredUsageOwners: [{ sessionID: session.id, agentID: "mission" }],
            usage: [
              {
                sessionID: session.id,
                agentID: "mission",
                inputTokens: 1,
                outputTokens: 1,
                reasoningTokens: 0,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                totalTokens: 2,
              },
            ],
          })
        try {
          expect(observe().blockingReasons).toEqual(["final_response_unsettled"])
          const { orderKey: _completionOrderKey, ...replyFields } = completion
          const tail = await Session.updateMessage({
            ...replyFields,
            id: Identifier.ascending("message"),
            time: { created: 130 },
            finish: undefined,
          })
          if (tail.role !== "assistant") throw new Error("Expected persisted assistant response")
          await SessionStatus.settleAcceptedExecutionOccurrence(session.id, owner)
          expect(observe().finalReply.status).toBe("pending")
          await SessionStatus.set(session.id, { type: "streaming" }, { promptGenerationOwner: owner })
          await Session.updateMessage({ ...tail, time: { created: 130, completed: 140 }, finish: "stop" })
          expect(observe().finalReply.status).toBe("pending")
          await SessionStatus.settleAcceptedExecutionOccurrence(session.id, owner)
          expect(observe()).toMatchObject({
            ready: true,
            blockingReasons: [],
            finalReply: {
              status: "settled",
              responseMessageIDs: [tail.id],
              completedAtMs: 140,
              failedReplyIDs: [],
            },
          })
        } finally {
          SessionStatus.release(session.id)
        }
      },
    })
  })

  test("projects terminal Task and delivery facts into one semantic acceptance frontier", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const now = Date.now()
        const taskID = Identifier.ascending("task")
        const root = await Session.create({ kind: "root", title: "Duplex snapshot" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "mission",
          model: { providerID: "openai", modelID: "gpt-5.6-sol" },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: root.id,
          parentID: user.id,
          role: "assistant",
          author: "mission",
          time: { created: now + 1 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-sol",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        const toolPartID = Identifier.ascending("part")
        const runningTool = await Session.updatePart({
          id: toolPartID,
          sessionID: root.id,
          messageID: assistant.id,
          type: "tool",
          callID: "call_duplex_snapshot",
          tool: "scheduler_message",
          state: {
            status: "running",
            input: { kind: "notification", message: "READY snapshot" },
            time: { start: now + 2 },
          },
        })
        if (runningTool.type !== "tool") throw new Error("Expected persisted Tool Part")
        await Session.updatePart({
          ...runningTool,
          state: {
            status: "completed",
            input: { kind: "notification", message: "READY snapshot" },
            output: "delivered",
            title: "scheduler_message notification",
            metadata: { truncated: false },
            time: { start: now + 2, end: now + 3 },
          },
        })
        const inboxID = Identifier.ascending("protocol_inbox")
        const messageID = Identifier.ascending("message")
        const snapshot = Database.immediateTransaction((db) => {
          db.insert(EngineTaskTable).values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: root.id,
            source: "test",
            product_pillar: "code",
            title: "Duplex snapshot",
            request: "Project current control facts",
            time_created: now,
          }).run()
          appendTaskOpenedInTransaction({ db, taskID, sessionID: root.id, now, source: "test.duplex" })
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.completed",
            aggregate: "task",
            aggregate_id: taskID,
            task_id: null,
            session_id: root.id,
            source: "test.duplex",
            emitted_at: now + 1,
            payload: { execution_epoch: 1 },
          })
          const deliveryEvent = ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "test.duplex.delivery",
            aggregate: "stream",
            aggregate_id: "stream:duplex-snapshot",
            source: "test.duplex",
            emitted_at: now + 2,
            payload: {},
          })
          db.insert(ProtocolInboxTable).values({
            id: inboxID,
            envelope_id: deliveryEvent.id,
            actor: "session",
            actor_id: root.id,
            visible_at: now + 2,
            time_created: now + 2,
          }).run()
          db.insert(ProtocolDeliveryReceiptTable).values({
            id: Identifier.ascending("protocol_inbox"),
            inbox_id: inboxID,
            receipt: { kind: "session_wake", message_id: messageID },
            time_created: now + 3,
          }).run()
          return projectMissionTaskDuplexControlStateInTransaction(db, {
            tasks: db.select().from(EngineTaskTable).all(),
            inboxes: db.select().from(ProtocolInboxTable).all(),
            toolRequests: db.select().from(ToolPartRequestTable).all(),
          }, now + 4)
        })

        expect(snapshot.tasks).toMatchObject([
          { id: taskID, lifecycle_status: "completed", time_completed: now + 1 },
        ])
        expect(snapshot.inboxes).toMatchObject([
          {
            id: inboxID,
            status: "delivered",
            delivery_result: { kind: "session_wake", message_id: messageID },
          },
        ])
        expect(snapshot.toolParts).toMatchObject([
          {
            id: toolPartID,
            type: "tool",
            tool: "scheduler_message",
            state: {
              status: "completed",
              input: { kind: "notification", message: "READY snapshot" },
              output: "delivered",
            },
          },
        ])
        expect(missionTaskDuplexToolHealth(snapshot.toolParts)).toEqual({
          failedToolPartIDs: [],
          runningToolPartIDs: [],
        })
        expect(missionTaskDuplexProgressKey({
          ...snapshot,
          schedulerEventCount: 1,
          missionCompleted: false,
        })).toBe("1:1:1:1:0")
        expect(missionTaskDuplexProgressKey({
          ...snapshot,
          schedulerEventCount: 1,
          missionCompleted: true,
        })).toBe("1:1:1:1:1")
      },
    })
  })
})
