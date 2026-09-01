import { afterEach, describe, expect, test } from "bun:test"
import { sql } from "drizzle-orm"
import { BusPublicationOutboxTable } from "../src/bus/bus.sql"
import {
  EngineArtifactTable,
  EngineTaskRootIngressPolicyTable,
  EngineTaskRootIngressTable,
  EngineTaskTable,
} from "../src/engine/engine.sql"
import { taskLifecycleProjection } from "../src/engine/task-lifecycle"
import { TestHooks as TaskControlTestHooks } from "../src/engine/task-root-ingress-delivery"
import { Identifier } from "../src/id/id"
import { MemoryChunkTable, MemoryFileTable } from "../src/memory/memory.sql"
import { Instance } from "../src/project/instance"
import { ProtocolEventTable } from "../src/protocol/protocol.sql"
import { Session } from "../src/session"
import { SessionTable } from "../src/session/session.sql"
import { Database } from "../src/storage/db"
import { EngineService } from "../src/task-api"
import { InstanceBootstrap } from "../src/project/bootstrap"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

function aggregateFootprint() {
  return Database.use((db) => ({
    sessions: db
      .select({ id: SessionTable.id })
      .from(SessionTable)
      .all()
      .map((row) => row.id)
      .sort(),
    tasks: db
      .select({ id: EngineTaskTable.id })
      .from(EngineTaskTable)
      .all()
      .map((row) => row.id)
      .sort(),
    artifacts: db
      .select({ id: EngineArtifactTable.id })
      .from(EngineArtifactTable)
      .all()
      .map((row) => row.id)
      .sort(),
    lifecycle: db
      .select({ id: ProtocolEventTable.id })
      .from(ProtocolEventTable)
      .all()
      .map((row) => row.id)
      .sort(),
    ingress: db
      .select({ id: EngineTaskRootIngressTable.id })
      .from(EngineTaskRootIngressTable)
      .all()
      .map((row) => row.id)
      .sort(),
    ingressPolicies: db
      .select({ id: EngineTaskRootIngressPolicyTable.id })
      .from(EngineTaskRootIngressPolicyTable)
      .all()
      .map((row) => row.id)
      .sort(),
    memoryFiles: db
      .select({ id: MemoryFileTable.id })
      .from(MemoryFileTable)
      .all()
      .map((row) => row.id)
      .sort(),
    memoryChunks: db
      .select({ id: MemoryChunkTable.id })
      .from(MemoryChunkTable)
      .all()
      .map((row) => row.id)
      .sort(),
    outbox: db
      .select({ id: BusPublicationOutboxTable.occurrence_id })
      .from(BusPublicationOutboxTable)
      .all()
      .map((row) => row.id)
      .sort(),
  }))
}

describe("Task creation commits its root Session with the Task aggregate", () => {
  test("a failed aggregate commit leaves no visible root Session, and the retried request creates the whole occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        using _ingressRunner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const requestID = `arc010-${Identifier.ascending("artifact")}`
        const input = {
          requestID,
          request: "Commit the root Session and the Task aggregate together",
          productPillar: "code" as const,
          model: "firmware/gpt-5",
          promptProfile: "base",
        }
        await Database.awaitEffectIdle(5_000)
        const before = aggregateFootprint()

        // Fail after every Task aggregate row, its lifecycle opening, ingress
        // policy and initial ingress have been written. SQLite must roll the
        // entire transaction back, and Database must discard every queued Bus
        // and protocol publication effect.
        Database.use((db) =>
          db.run(
            sql.raw(`
            CREATE TEMP TRIGGER arc010_fail_after_initial_ingress
            AFTER INSERT ON engine_task_root_ingress
            WHEN NEW.source = 'task' AND NEW.source_id = NEW.task_id
            BEGIN
              SELECT RAISE(ABORT, 'injected task aggregate commit failure');
            END
          `),
          ),
        )
        try {
          await expect(EngineService.createTask(input, { actor: "user" })).rejects.toThrow(
            "injected task aggregate commit failure",
          )
        } finally {
          Database.use((db) => db.run(sql.raw("DROP TRIGGER arc010_fail_after_initial_ingress")))
        }
        await Database.awaitEffectIdle(5_000)

        // Exact pre-request equality covers the root Session, Task row,
        // package/process binding Artifacts, project-memory occurrence,
        // lifecycle, ingress policy/ingress and durable publication outbox.
        expect(aggregateFootprint()).toEqual(before)

        // The canonical task.created fact is part of the same aggregate
        // transaction. Rejecting that insert must roll back the Task, root
        // Session, bindings, lifecycle and ingress together; a post-commit
        // best-effort publisher would leave the accepted aggregate behind.
        Database.use((db) =>
          db.run(
            sql.raw(`
            CREATE TEMP TRIGGER arc019_fail_task_created
            BEFORE INSERT ON protocol_event
            WHEN NEW.type = 'task.created'
            BEGIN
              SELECT RAISE(ABORT, 'injected task.created commit failure');
            END
          `),
          ),
        )
        try {
          await expect(EngineService.createTask(input, { actor: "user" })).rejects.toThrow(
            "injected task.created commit failure",
          )
        } finally {
          Database.use((db) => db.run(sql.raw("DROP TRIGGER arc019_fail_task_created")))
        }
        await Database.awaitEffectIdle(5_000)
        expect(aggregateFootprint()).toEqual(before)

        // The same request retried creates the complete occurrence: Task and
        // root Session commit together and reference each other.
        const taskID = await EngineService.createTask(input, { actor: "user" })
        const task = await EngineService.getTask(taskID)
        expect(task.sessionID).toBeTruthy()
        const rootSession = await Session.get(task.sessionID!)
        const lifecycle = taskLifecycleProjection(taskID)
        const ingress = Database.use((db) =>
          db
            .select()
            .from(EngineTaskRootIngressTable)
            .where(sql`${EngineTaskRootIngressTable.task_id} = ${taskID}`)
            .get(),
        )
        const bindingKinds = Database.use((db) =>
          db
            .select({ kind: EngineArtifactTable.kind })
            .from(EngineArtifactTable)
            .where(sql`${EngineArtifactTable.task_id} = ${taskID}`)
            .all()
            .map((row) => row.kind)
            .sort(),
        )
        expect({
          kind: rootSession.kind,
          projectID: rootSession.projectID,
          lifecycle: { epoch: lifecycle.epoch, status: lifecycle.status },
          ingress: ingress && { source: ingress.source, sourceID: ingress.source_id, epoch: ingress.execution_epoch },
          bindingKinds,
          hasTaskCreatedEvent: Database.use((db) => db.select().from(ProtocolEventTable).all()).some(
            (row) => row.aggregate_id === taskID && row.type === "task.created",
          ),
        }).toEqual({
          kind: "root",
          projectID: Instance.project.id,
          lifecycle: { epoch: 1, status: "active" },
          ingress: { source: "task", sourceID: taskID, epoch: 1 },
          bindingKinds: ["task_execution_capsule_binding", "task_package_revision_binding"],
          hasTaskCreatedEvent: true,
        })
      },
    })
  }, 120_000)
})
