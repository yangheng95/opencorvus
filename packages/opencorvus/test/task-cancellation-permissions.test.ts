import { afterEach, expect, test } from "bun:test"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { EngineTaskTable } from "@/engine/engine.sql"
import { EngineInteraction } from "@/engine/interaction"
import { recoverStartedTaskExecutions } from "@/engine/host-recovery"
import { Event } from "@/engine/model"
import { EngineProtocol } from "@/engine/protocol"
import { terminalTask, updateTask } from "@/engine/state"
import { requireTask } from "@/engine/store"
import { appendTaskOpenedInTransaction, taskLifecycleProjection } from "@/engine/task-lifecycle"
import { Identifier } from "@/id/id"
import { PermissionAuthority } from "@/permission/authority"
import { readPermissionRequestFacts } from "@/permission/ledger-facts"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { EngineService } from "@/task-api"
import { withTimeout } from "@/util/await-with-timeout"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function task(title: string) {
  const root = await Session.create({ kind: "root", title })
  const id = Identifier.ascending("task"),
    now = Date.now()
  Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id,
        project_id: Instance.project.id,
        session_id: root.id,
        source: "test",
        product_pillar: "work",
        title,
        request: title,
        metadata: { actor: "user" },
        time_created: now,
      })
      .run()
    appendTaskOpenedInTransaction({ db, taskID: id, sessionID: root.id, now, source: "test" })
  })
  return { id, root }
}

function origin(taskID: string) {
  return {
    actor: "user" as const,
    source: "task.cancel" as const,
    surface: "api",
    requestID: `${taskID}:cancel`,
    reason: "The operator cancelled this Task",
  }
}

async function pending(sessionID: string, index: number) {
  const asked = Promise.withResolvers<PermissionAuthority.Request>()
  const callID = Identifier.ascending("part")
  const stop = Bus.subscribe(PermissionAuthority.Event.Asked, (event) => {
    if (event.properties.toolCallID === callID) asked.resolve(event.properties)
  })
  const execution = PermissionAuthority.authorizeAndExecute(
    {
      projectID: Instance.project.id,
      sessionID,
      messageID: Identifier.ascending("message"),
      toolCallID: callID,
      providerKind: "builtin",
      providerID: "builtin",
      toolName: "webfetch",
      args: { url: `https://example.test/cancellation/${index}` },
    },
    async () => ({ delivered: index }),
  ).then(
    (result) => ({ kind: "delivered" as const, result }),
    (error) => ({ kind: "rejected" as const, error }),
  )
  try {
    return { request: await withTimeout(asked.promise, 10000, "Original permission Asked"), execution }
  } finally {
    stop()
  }
}

test("Task cancellation settles all permission pages and descendants through their canonical decisions", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      EngineInteraction.subscribe()
      const target = await task("Cancel all owned permissions"),
        peer = await task("Independent sibling")
      const child = await Session.create({ kind: "orchestrator", parentID: target.root.id, title: "Owned child" })
      const rows = []
      for (let index = 0; index < 67; index++) rows.push(await pending(index < 65 ? target.root.id : child.id, index))
      const peerPending = await pending(peer.root.id, 100)
      expect(
        await Promise.all([
          EngineService.cancelTask(target.id, { origin: origin(target.id) }),
          EngineService.cancelTask(target.id, { origin: origin(target.id) }),
        ]),
      ).toEqual([true, true])
      expect(taskLifecycleProjection(target.id).status).toBe("cancelled")
      for (const row of rows) {
        const outcome = await row.execution
        expect(outcome.kind).toBe("rejected")
        if (outcome.kind === "rejected") expect(outcome.error).toBeInstanceOf(PermissionAuthority.RejectedError)
        const facts = Database.use((db) => readPermissionRequestFacts(db, row.request.id))!
        expect(facts.rows.map((item) => item.event_type)).toEqual(["requested", "cancelled"])
        expect(facts.authority).toMatchObject({
          decision_slot: row.request.id,
          actor_id: "system",
          reason: origin(target.id).reason,
        })
      }
      const interactions = await EngineService.listTaskInteractions(target.id)
      expect(interactions.map((item) => ({ externalID: item.externalID, status: item.status, response: item.response }))
        .sort((a, b) => a.externalID.localeCompare(b.externalID))).toEqual(
        rows.map((row) => ({
          externalID: row.request.id,
          status: "rejected",
          response: {
            decision: "deny",
            termination: {
              status: "cancelled",
              ledgerEventID: Database.use((db) => readPermissionRequestFacts(db, row.request.id))!.authority!.id,
              reason: origin(target.id).reason,
            },
          },
        })).sort((a, b) => a.externalID.localeCompare(b.externalID)),
      )
      const originalTerminal = ProtocolStore.latestTaskEvent(target.id, "task.cancelled")
      expect(await EngineService.cancelTask(target.id, { origin: origin(target.id) })).toBe(true)
      expect(await EngineService.requestTaskCancellation(target.id, { origin: origin(target.id) })).toMatchObject({
        status: "cancelled",
        terminalEventID: originalTerminal!.id,
      })
      const late = await PermissionAuthority.reply({
        requestID: rows[0]!.request.id,
        decision: "allow_once",
        actorID: "late-operator",
      })
      expect(late).toMatchObject({
        decision: "deny",
        eventID: Database.use((db) => readPermissionRequestFacts(db, rows[0]!.request.id))!.authority!.id,
      })
      await PermissionAuthority.reply({
        requestID: peerPending.request.id,
        decision: "allow_once",
        actorID: "peer-operator",
      })
      expect(await peerPending.execution).toEqual({ kind: "delivered", result: { delivered: 100 } })
    },
  })
}, 60000)

test("recovered historical cancellation retires its old permission while another Project remains actionable", async () => {
  await using project = await memoryProject("historical-cancellation")
  await using foreign = await memoryProject("independent-permission")
  const foreignPending = await Instance.provide({
    directory: foreign.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      return pending((await Session.create({ kind: "assistant", title: "Other Project" })).id, 200)
    },
  })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      EngineInteraction.subscribe()
      const target = await task("Old runtime cancelled while awaiting approval")
      const row = await pending(target.root.id, 201),
        cancellationOrigin = origin(target.id)
      const requested = Database.immediateTransaction(() =>
        EngineProtocol.emitInTransaction(
          Event.TaskCancellationRequested,
          {
            actor: cancellationOrigin.actor,
            surface: cancellationOrigin.surface,
            reason: cancellationOrigin.reason,
            summary: cancellationOrigin.reason,
            execution_epoch: 1,
          },
          { taskID: target.id, source: cancellationOrigin.source, correlationID: cancellationOrigin.requestID },
        ),
      )
      await terminalTask(requireTask(target.id), { status: "cancelled", error: "task cancelled" }, "Old cancellation", {
        cancellationRequest: { eventID: requested.id },
      })
      const originalTerminal = ProtocolStore.latestTaskEvent(target.id, "task.cancelled")
      expect(await recoverStartedTaskExecutions({ scopeProjectWorktree: project.path })).toMatchObject({
        attempted: 0,
        initialized: 0,
        cancelledPermissionTasksRecovered: 1,
        failures: [],
      })
      const outcome = await row.execution
      expect(outcome.kind).toBe("rejected")
      if (outcome.kind === "rejected") expect(outcome.error).toBeInstanceOf(PermissionAuthority.RejectedError)
      expect(
        Database.use((db) => readPermissionRequestFacts(db, row.request.id))!.rows.map((item) => item.event_type),
      ).toEqual(["requested", "cancelled"])
      expect(ProtocolStore.latestTaskEvent(target.id, "task.cancelled")).toEqual(originalTerminal)
      expect(await EngineService.reconcilePendingTaskCancellations()).toBe(0)
    },
  })
  await Instance.provide({
    directory: foreign.path,
    fn: async () => {
      await PermissionAuthority.reply({
        requestID: foreignPending.request.id,
        decision: "allow_once",
        actorID: "other-project-operator",
      })
      expect(await foreignPending.execution).toEqual({ kind: "delivered", result: { delivered: 200 } })
    },
  })
}, 30000)

test("historical permission settlement keeps a reopened Task's new occurrence actionable", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      EngineInteraction.subscribe()
      const target = await task("Reopen after the original cancelled occurrence")
      const old = await pending(target.root.id, 400),
        cancellationOrigin = origin(target.id)
      const requested = Database.immediateTransaction(() =>
        EngineProtocol.emitInTransaction(
          Event.TaskCancellationRequested,
          {
            actor: cancellationOrigin.actor,
            surface: cancellationOrigin.surface,
            reason: cancellationOrigin.reason,
            summary: cancellationOrigin.reason,
            execution_epoch: 1,
          },
          { taskID: target.id, source: cancellationOrigin.source, correlationID: cancellationOrigin.requestID },
        ),
      )
      await terminalTask(
        requireTask(target.id),
        { status: "cancelled", error: "task cancelled" },
        "Original cancellation",
        { cancellationRequest: { eventID: requested.id } },
      )
      let next: Awaited<ReturnType<typeof pending>> | undefined
      using interleave = PermissionAuthority.TestHooks.installAfterSessionDeletionBatchSelected(
        async ({ requestIDs }) => {
          if (next || !requestIDs.includes(old.request.id)) return
          await updateTask(requireTask(target.id), { status: "active" }, "Explicit new occurrence")
          next = await pending(target.root.id, 401)
        },
      )
      expect(await EngineService.reconcileCancelledTaskPermissions(target.id)).toBe(1)
      expect((await old.execution).kind).toBe("rejected")
      expect(taskLifecycleProjection(target.id)).toMatchObject({ status: "active", epoch: 2 })
      if (!next) throw new Error("Actual reopened permission required")
      await PermissionAuthority.reply({
        requestID: next.request.id,
        decision: "allow_once",
        actorID: "new-occurrence-operator",
      })
      expect(await next.execution).toEqual({ kind: "delivered", result: { delivered: 401 } })
      expect(await EngineService.reconcileCancelledTaskPermissions(target.id)).toBe(0)
    },
  })
}, 30000)

test("a failed permission cancellation remains cancelling and converges through the production retry", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      EngineInteraction.subscribe()
      const target = await task("Retry the canonical permission cancellation")
      const row = await pending(target.root.id, 300)
      Database.use((db) =>
        db.$client.exec(`CREATE TEMP TRIGGER task_permission_cancel_cut BEFORE INSERT ON permission_ledger
      WHEN NEW.request_id = '${row.request.id}' AND NEW.event_type = 'cancelled'
      BEGIN SELECT RAISE(ABORT, 'TASK_PERMISSION_CANCEL_COMMIT_CUT'); END`),
      )
      try {
        await expect(EngineService.cancelTask(target.id, { origin: origin(target.id) })).rejects.toMatchObject({
          code: "SQLITE_CONSTRAINT_TRIGGER",
          message: "TASK_PERMISSION_CANCEL_COMMIT_CUT",
        })
        expect(taskLifecycleProjection(target.id).status).toBe("cancelling")
      } finally {
        Database.use((db) => db.$client.exec("DROP TRIGGER task_permission_cancel_cut"))
      }
      expect(await EngineService.reconcilePendingTaskCancellation(target.id)).toBe(true)
      expect(taskLifecycleProjection(target.id).status).toBe("cancelled")
      expect((await row.execution).kind).toBe("rejected")
      expect(
        Database.use((db) => readPermissionRequestFacts(db, row.request.id))!.rows.map((item) => item.event_type),
      ).toEqual(["requested", "cancelled"])
    },
  })
}, 30000)
