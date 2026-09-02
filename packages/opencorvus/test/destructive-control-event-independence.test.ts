import { afterEach, describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { createRightSidebarConversationSession } from "@/chat/session"
import { EngineTaskTable } from "@/engine/engine.sql"
import { appendTaskOpenedInTransaction, taskLifecycleProjectionInTransaction } from "@/engine/task-lifecycle"
import { findTask, taskDeletedInTransaction } from "@/engine/store"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { ProtocolDeliveryReceiptTable, ProtocolEventTable, ProtocolInboxTable } from "@/protocol/protocol.sql"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { SessionPromptState } from "@/session/prompt/state"
import { recordProviderActivityEvent } from "@/session/provider-activity-facts"
import { ProviderActivityOutcomeTable, ProviderActivityRequestTable } from "@/session/session.sql"
import { SessionStatus } from "@/session/status"
import { publishSessionStatus } from "@/session/status-publication"
import { serverErrorResponse } from "@/server/error-handler"
import { MissionRoutes } from "@/server/routes/mission"
import { RightSidebarConversationRoutes } from "@/server/routes/right-sidebar-conversation"
import { Database, and, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function createTaskWithUnresolvedProviderEffect(label: string) {
  const root = await Session.create({ kind: "root", title: `${label} root` })
  const orchestrator = await Session.create({
    kind: "orchestrator",
    parentID: root.id,
    title: `${label} orchestrator`,
  })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: root.id,
        source: "test",
        product_pillar: "code",
        title: label,
        request: "Archive or delete despite an interrupted Provider stream",
        metadata: { actor: "user" },
        time_created: now,
      })
      .run()
    appendTaskOpenedInTransaction({
      db,
      taskID,
      sessionID: root.id,
      now,
      source: "test.destructive-control",
    })
  })
  const control = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: orchestrator.id,
    role: "user",
    author: "orchestrator",
    time: { created: now + 1 },
    agent: "orchestrator",
    model: { providerID: "deepseek", modelID: "deepseek-chat" },
  })
  const assistant = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: orchestrator.id,
    parentID: control.id,
    role: "assistant",
    author: "orchestrator",
    time: { created: now + 2 },
    agent: "orchestrator",
    providerID: "deepseek",
    modelID: "deepseek-chat",
    path: { cwd: Instance.project.worktree, root: Instance.project.worktree },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
  })
  const providerRequestID = Identifier.ascending("activity")
  recordProviderActivityEvent(assistant.id, {
    type: "started",
    id: providerRequestID,
    ts: now + 3,
    sessionID: orchestrator.id,
    provider: "deepseek",
    model: "deepseek-chat",
  })
  const missingLifecycleInputMessageID = Identifier.ascending("message")
  const nextTaskSequence = Math.max(...ProtocolStore.listTaskEvents(taskID).map((event) => event.sequence)) + 1
  Database.immediateTransaction((db) => {
    db.insert(ProtocolEventTable)
      .values({
        id: Identifier.ascending("protocol_event"),
        kind: "event",
        type: "agent.execution.lifecycle",
        aggregate_type: "task",
        aggregate_id: taskID,
        project_id: Instance.project.id,
        task_id: null,
        session_id: orchestrator.id,
        source: "test.destructive-control",
        seq: nextTaskSequence,
        emitted_at: now + 4,
        payload: { inputMessageID: missingLifecycleInputMessageID, status: { type: "streaming" } },
      })
      .run()
  })
  return { taskID, providerRequestID }
}

function seedUnrelatedInvalidSchedulerWake(sessionID: string) {
  const now = Date.now()
  return Database.immediateTransaction((db) => {
    const event = ProtocolStore.appendEventInTransaction({
      kind: "event",
      type: "scheduler.message",
      aggregate: "session",
      aggregate_id: sessionID,
      session_id: null,
      source: "scheduler-endpoint:test-source",
      target: "scheduler-endpoint:test-target",
      emitted_at: now,
      payload: {},
    })
    const inboxID = Identifier.ascending("protocol_inbox")
    db.insert(ProtocolInboxTable)
      .values({
        id: inboxID,
        envelope_id: event.id,
        actor: "session",
        actor_id: sessionID,
        visible_at: now,
        time_created: now,
      })
      .run()
    db.insert(ProtocolDeliveryReceiptTable)
      .values({
        id: Identifier.ascending("protocol_inbox"),
        inbox_id: inboxID,
        receipt: { kind: "session_wake", message_id: Identifier.ascending("message") },
        time_created: now + 1,
      })
      .run()
    return inboxID
  })
}

function destructiveControlProjection(taskID: string, providerRequestID: string) {
  return Database.use((db) => ({
    lifecycle: taskLifecycleProjectionInTransaction(db, taskID).status,
    archivedAt: db
      .select({ value: EngineTaskTable.time_archived })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.id, taskID))
      .get()?.value,
    deleted: taskDeletedInTransaction(db, taskID),
    cancellationBoundaries: db
      .select({ id: ProtocolEventTable.id })
      .from(ProtocolEventTable)
      .where(and(eq(ProtocolEventTable.aggregate_id, taskID), eq(ProtocolEventTable.type, "task.cancelled")))
      .all().length,
    providerRequest: db
      .select({ id: ProviderActivityRequestTable.id })
      .from(ProviderActivityRequestTable)
      .where(eq(ProviderActivityRequestTable.id, providerRequestID))
      .get()?.id,
    providerOutcome: db
      .select({ id: ProviderActivityOutcomeTable.id })
      .from(ProviderActivityOutcomeTable)
      .where(eq(ProviderActivityOutcomeTable.request_id, providerRequestID))
      .get()?.id,
  }))
}

describe("destructive control event independence", () => {
  test("archives a Task while preserving an unresolved Provider request as audit evidence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createTaskWithUnresolvedProviderEffect("Archive event independence")
        const archived = await EngineService.setTaskArchived(fixture.taskID, true, {
          origin: {
            actor: "user",
            source: "task.archive",
            surface: "api",
            requestID: "archive-unresolved-provider",
            reason: "user archived task",
          },
        })

        expect({
          archived,
          task: findTask(fixture.taskID),
          ...destructiveControlProjection(fixture.taskID, fixture.providerRequestID),
        }).toMatchObject({
          archived: true,
          task: { id: fixture.taskID },
          lifecycle: "cancelled",
          archivedAt: expect.any(Number),
          deleted: false,
          cancellationBoundaries: 1,
          providerRequest: fixture.providerRequestID,
          providerOutcome: undefined,
        })
      },
    })
  })

  test("deletes a Task while preserving an unresolved Provider request as audit evidence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const fixture = await createTaskWithUnresolvedProviderEffect("Delete event independence")
        const deleted = await EngineService.deleteTask(fixture.taskID, {
          origin: {
            actor: "user",
            source: "task.delete",
            surface: "api",
            requestID: "delete-unresolved-provider",
            reason: "user deleted task",
          },
        })

        expect({
          deleted,
          publicTask: findTask(fixture.taskID),
          ...destructiveControlProjection(fixture.taskID, fixture.providerRequestID),
        }).toEqual({
          deleted: true,
          publicTask: undefined,
          lifecycle: "cancelled",
          archivedAt: null,
          cancellationBoundaries: 1,
          providerRequest: fixture.providerRequestID,
          providerOutcome: undefined,
        })
      },
    })
  })

  test("archives one Mission without reconciling an unrelated invalid scheduler wake", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "archive-target-mission"
        const target = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const unrelated = await ensureMissionSession({
          missionID: "unrelated-invalid-scheduler-mission",
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const unrelatedInboxID = seedUnrelatedInvalidSchedulerWake(unrelated.id)
        const app = new Hono().route("/mission", MissionRoutes())
        app.onError(serverErrorResponse)

        const response = await app.fetch(
          new Request(`http://opencorvus.test/mission/${missionID}/archive`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              archived: true,
              surface: "overlay.archive_panel",
              reason: "user archived mission",
            }),
          }),
        )

        expect({
          status: response.status,
          archivedAt: (await Session.get(target.id)).time.archived,
          unrelatedInbox: Database.use((db) =>
            db
              .select({ id: ProtocolInboxTable.id })
              .from(ProtocolInboxTable)
              .where(eq(ProtocolInboxTable.id, unrelatedInboxID))
              .get(),
          ),
        }).toEqual({
          status: 200,
          archivedAt: expect.any(Number),
          unrelatedInbox: { id: unrelatedInboxID },
        })
      },
    })
  })

  test("archives a Chat after its physical prompt owner settles", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const chat = await createRightSidebarConversationSession("chat")
        const owner = SessionPromptState.start(chat.id, chat.directory)
        if (!owner) throw new Error("Expected a physical Chat prompt owner")
        owner.addEventListener(
          "abort",
          () => {
            void SessionPromptState.finish(chat.id, owner, chat.directory, owner.reason)
          },
          { once: true },
        )
        const app = new Hono().route("/chat", RightSidebarConversationRoutes("chat"))

        const response = await app.fetch(
          new Request(`http://opencorvus.test/chat/session/${chat.id}/archive`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ archived: true }),
          }),
        )

        expect({
          status: response.status,
          ownerAborted: owner.aborted,
          archivedAt: (await Session.get(chat.id)).time.archived,
        }).toEqual({ status: 200, ownerAborted: true, archivedAt: expect.any(Number) })
      },
    })
  })

  test("keeps ordinary Mission abort lifecycle publication", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "ordinary-abort-lifecycle"
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const inputMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "mission",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const owner = SessionPromptState.start(mission.id, mission.directory)
        if (!owner) throw new Error("Expected a physical Mission prompt owner")
        SessionStatus.beginExecutionOccurrence(mission.id, inputMessage.id, owner)
        await publishSessionStatus(
          mission,
          { type: "streaming" },
          {
            inputMessageID: inputMessage.id,
            promptGenerationOwner: owner,
          },
        )
        owner.addEventListener(
          "abort",
          () => {
            void SessionPromptState.finish(mission.id, owner, mission.directory, owner.reason)
          },
          { once: true },
        )
        const app = new Hono().route("/mission", MissionRoutes())
        app.onError(serverErrorResponse)

        const response = await app.fetch(
          new Request(`http://opencorvus.test/mission/${missionID}/abort`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              surface: "overlay.interrupt_task",
              reason: "user aborted mission",
            }),
          }),
        )

        expect({
          status: response.status,
          ownerAborted: owner.aborted,
          lifecycle: SessionStatus.getExecution(mission.id, inputMessage.id),
        }).toEqual({
          status: 200,
          ownerAborted: true,
          lifecycle: { type: "terminal", reason: "aborted", error: expect.any(String) },
        })
      },
    })
  })
})
