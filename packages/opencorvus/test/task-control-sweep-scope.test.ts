import { afterEach, describe, expect, test } from "bun:test"
import { EngineArtifactTable, EngineTaskRootIngressTable, EngineTaskTable } from "@/engine/engine.sql"
import { eq } from "@/storage/db"
import { appendTaskOpenedInTransaction, appendTaskReopenedInTransaction } from "@/engine/task-lifecycle"
import { acceptTaskRootIngressInTransaction } from "@/engine/task-root-fact-store"
import {
  reconcileTaskControlPlane,
  taskControlDriverSnapshot,
  TestHooks as TaskControlTestHooks,
} from "@/engine/task-root-ingress-delivery"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function waitForRecovery(ready: () => boolean) {
  const deadline = Date.now() + 5000
  while (!ready()) {
    if (Date.now() >= deadline) throw new Error("Task recovery did not reach its expected activation")
    await Bun.sleep(5)
  }
}

function seedTask(input: { rootSessionID: string; title: string; terminal?: boolean; postTerminalIngress?: boolean }) {
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  Database.immediateTransaction((db) => {
    db.insert(EngineTaskTable)
      .values({
        id: taskID,
        project_id: Instance.project.id,
        session_id: input.rootSessionID,
        source: "test",
        product_pillar: "code",
        title: input.title,
        request: input.title,
        time_created: now,
      })
      .run()
    appendTaskOpenedInTransaction({ db, taskID, sessionID: input.rootSessionID, now, source: "test.sweep" })
    acceptTaskRootIngressInTransaction(db, {
      taskID,
      executionEpoch: 1,
      source: "inline",
      sourceID: `head-${taskID}`,
      inlinePayload: { note: input.title },
      semanticTurnLimit: 3,
      activationLimit: 4,
      now: now + 1,
    })
    if (input.terminal) {
      ProtocolStore.appendEventInTransaction({
        kind: "event",
        type: "task.completed",
        aggregate: "task",
        aggregate_id: taskID,
        task_id: null,
        session_id: input.rootSessionID,
        source: "test.sweep",
        emitted_at: now + 2,
        payload: { execution_epoch: 1 },
      })
    }
    if (input.postTerminalIngress) {
      // The terminal-conversation carve-out: acceptance admits operator input
      // after the terminal boundary, and it relies on the same wake edges as
      // ordinary ingress.
      acceptTaskRootIngressInTransaction(db, {
        taskID,
        executionEpoch: 1,
        source: "inline",
        sourceID: `post-terminal-${taskID}`,
        inlinePayload: { note: `${input.title} follow-up` },
        semanticTurnLimit: 3,
        activationLimit: 4,
        now: now + 3,
      })
    }
  })
  return taskID
}

describe("Task-control sweep scope", () => {
  test("sweeps only Tasks whose lifecycle can still enable an ingress", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Sweep root" })
        const open = seedTask({ rootSessionID: root.id, title: "Open Task" })
        const finished = seedTask({ rootSessionID: root.id, title: "Finished Task", terminal: true })

        const activated: string[] = []
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ taskID }) => {
            activated.push(taskID)
          },
        })

        await reconcileTaskControlPlane()
        await waitForRecovery(() => activated.length === 1)

        // A terminal Task whose history is settled absorbs every further fact,
        // so scanning it can only cost a full evidence read per heartbeat. It
        // must not be swept.
        expect({
          swept: taskControlDriverSnapshot()
            .map((entry) => entry.taskID)
            .toSorted(),
          activated,
        }).toEqual({ swept: [open], activated: [open] })
      },
    })
  })

  test("keeps sweeping a terminal Task that holds an unsettled post-terminal ingress", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Terminal conversation root" })
        const finished = seedTask({
          rootSessionID: root.id,
          title: "Finished Task with follow-up",
          terminal: true,
          postTerminalIngress: true,
        })

        const activatedIngressSources: string[] = []
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ wakeID }) => {
            const source = Database.use((db) =>
              db
                .select({ sourceID: EngineTaskRootIngressTable.source_id })
                .from(EngineTaskRootIngressTable)
                .where(eq(EngineTaskRootIngressTable.id, wakeID!))
                .get(),
            )
            if (source) activatedIngressSources.push(source.sourceID)
          },
        })

        // The project-wide sweep — not a direct single-Task request — must
        // find it: this is the recovery path after the acceptance-time edge
        // was lost to a crash, where no direct request will ever arrive.
        await reconcileTaskControlPlane()
        await waitForRecovery(() => activatedIngressSources.length === 1)

        expect({
          swept: taskControlDriverSnapshot().map((entry) => entry.taskID),
          activatedIngressSources,
        }).toEqual({
          swept: [finished],
          // The pre-terminal head ingress reduced to terminal_inapplicable, so
          // the post-terminal conversation is the activated frontier.
          activatedIngressSources: [`post-terminal-${finished}`],
        })
      },
    })
  })

  test("keeps only the current reopened epoch and conservatively admits an equal-time terminal ingress", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const root = await Session.create({ kind: "root", title: "Reopened frontier root" })
        const reopened = seedTask({
          rootSessionID: root.id,
          title: "Reopened Task",
          terminal: true,
          postTerminalIngress: true,
        })
        const equalBoundary = Identifier.ascending("task")
        let equalIngressID = ""
        const now = Date.now() + 100
        Database.immediateTransaction((db) => {
          appendTaskReopenedInTransaction({
            db,
            taskID: reopened,
            sessionID: root.id,
            now,
            source: "test.sweep.reopen",
          })
          acceptTaskRootIngressInTransaction(db, {
            taskID: reopened,
            executionEpoch: 2,
            source: "inline",
            sourceID: `current-epoch-${reopened}`,
            inlinePayload: { note: "current epoch" },
            semanticTurnLimit: 3,
            activationLimit: 4,
            now: now + 1,
          })

          db.insert(EngineTaskTable)
            .values({
              id: equalBoundary,
              project_id: Instance.project.id,
              session_id: root.id,
              source: "test",
              product_pillar: "code",
              title: "Equal boundary Task",
              request: "Keep an ingress accepted at the exact terminal instant",
              time_created: now + 2,
            })
            .run()
          appendTaskOpenedInTransaction({
            db,
            taskID: equalBoundary,
            sessionID: root.id,
            now: now + 2,
            source: "test.sweep.equal",
          })
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.completed",
            aggregate: "task",
            aggregate_id: equalBoundary,
            task_id: null,
            session_id: root.id,
            source: "test.sweep.equal",
            emitted_at: now + 3,
            payload: { execution_epoch: 1 },
          })
          equalIngressID = acceptTaskRootIngressInTransaction(db, {
            taskID: equalBoundary,
            executionEpoch: 1,
            source: "inline",
            sourceID: `equal-terminal-${equalBoundary}`,
            inlinePayload: { note: "equal terminal instant" },
            semanticTurnLimit: 3,
            activationLimit: 4,
            now: now + 3,
          }).id
        })

        const activatedSources: string[] = []
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
          runner: async ({ wakeID }) => {
            const source = Database.use((db) =>
              db
                .select({ sourceID: EngineTaskRootIngressTable.source_id })
                .from(EngineTaskRootIngressTable)
                .where(eq(EngineTaskRootIngressTable.id, wakeID!))
                .get(),
            )
            if (source) activatedSources.push(source.sourceID)
          },
        })

        await reconcileTaskControlPlane()
        await waitForRecovery(() => activatedSources.length === 1)

        expect({
          swept: taskControlDriverSnapshot()
            .map((entry) => entry.taskID)
            .toSorted(),
          activatedSources,
          equalBoundaryDisposition: Database.use(
            (db) =>
              db
                .select({ disposition: EngineArtifactTable.payload })
                .from(EngineArtifactTable)
                .where(eq(EngineArtifactTable.kind, "task_root_ingress_disposition"))
                .all()
                .find((row) => row.disposition?.ingress_id === equalIngressID)?.disposition.disposition,
          ),
        }).toEqual({
          // Equality stays a conservative discovery boundary. The exact
          // reducer then records it terminal-inapplicable without executing.
          swept: [reopened],
          activatedSources: [`current-epoch-${reopened}`],
          equalBoundaryDisposition: "terminal_inapplicable",
        })
      },
    })
  })
})
