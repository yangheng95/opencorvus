import { afterEach, describe, expect, test } from "bun:test"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolDeliveryReceiptTable, ProtocolInboxTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
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
  observeMissionTaskDuplexActivity,
  projectMissionTaskDuplexControlStateInTransaction,
} from "../script/mission-task-duplex-snapshot"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Mission Task duplex snapshot", () => {
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
      nonce,
      artifacts: [
        {
          id: "artifact-final",
          messageID: "message-completion",
          sessionID: "session-mission",
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

    expect(
      missionTaskDuplexFinalEvidenceState({
        ...base,
        completionMessageID: undefined,
        usage: base.usage.filter((row) => row.sessionID !== "session-task-b"),
      }).blockingReasons,
    ).toEqual([
      "mission_completion_missing",
      "final_artifact_occurrence_missing",
      "final_artifact_payload_invalid",
      "final_artifact_nonce_missing",
      "required_usage_missing",
    ])
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
