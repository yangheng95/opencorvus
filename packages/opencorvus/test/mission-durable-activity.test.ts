import { afterAll, describe, expect, test } from "bun:test"
import { and, asc, eq } from "drizzle-orm"
import { readMissionDurableActivity } from "../src/engine/durable-activity"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { Identifier } from "../src/id/id"
import { ensureMissionSession, MissionExpertSquadSnapshotMismatchError } from "../src/mission/session"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { MessageTable, SessionTable, ToolPartProgressTable } from "../src/session/session.sql"
import { Database } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk/client"
import { Hono } from "hono"
import { MissionRoutes } from "../src/server/routes/mission"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { closeMissionExecutionOperation, currentMissionExecutionClosure } from "../src/mission/execution-closure"
import { serverErrorResponse } from "../src/server/error-handler"
import { Auth } from "../src/auth"
import { Config } from "../src/config/config"
import { ProtocolEventTable } from "../src/protocol/protocol.sql"
import { taskLifecycleProjection } from "../src/engine/task-lifecycle"
import { MissionExecutionClosureTestHooks } from "../src/mission/execution-closure"
import { openMissionThroughRealWake } from "./fixture/mission-opened"
import { PersistedProjectContext } from "../src/server/persisted-project-context"
import { MissionRetentionTestHooks } from "../src/mission/retention"
import { Bus } from "../src/bus"
import "../src/task-api"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.06.1",
  packageDigest: "a".repeat(64),
}

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Mission durable activity", () => {
  test("archives a fresh Mission draft through the production route without inventing an opened occurrence", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const app = new Hono().route("/mission", MissionRoutes())
        app.onError(serverErrorResponse)
        const draftResponse = await app.fetch(
          new Request("http://opencorvus.test/mission/draft", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              title: "Archive an unstarted Mission",
              request: "Keep this Mission as a backlog draft until it is archived.",
              productPillar: "code",
              expertSquadIDs: ["base"],
            }),
          }),
        )
        expect(draftResponse.status).toBe(200)
        const draft = (await draftResponse.json()) as { missionID: string; sessionID: string; archived?: number }
        expect(draft.archived).toBeUndefined()

        const archiveUpdates: number[] = []
        const unsubscribe = Bus.subscribe(Session.Event.Updated, ({ properties }) => {
          if (properties.info.id === draft.sessionID) archiveUpdates.push(properties.info.time.updated)
        })
        const archiveResponse = await app
          .fetch(
            new Request(`http://opencorvus.test/mission/${draft.missionID}/archive`, {
              method: "PATCH",
              headers: { "content-type": "application/json", "x-opencorvus-request-id": "archive-fresh-draft" },
              body: JSON.stringify({
                archived: true,
                surface: "api",
                reason: "Archive the unstarted Mission draft",
              }),
            }),
          )
          .finally(unsubscribe)
        const archived = (await archiveResponse.json()) as { archived?: number }
        const lifecycle = Database.use((db) =>
          db
            .select({
              type: ProtocolEventTable.type,
              operationID: ProtocolEventTable.correlation_id,
              payload: ProtocolEventTable.payload,
            })
            .from(ProtocolEventTable)
            .where(
              and(
                eq(ProtocolEventTable.aggregate_type, "session"),
                eq(ProtocolEventTable.aggregate_id, draft.sessionID),
              ),
            )
            .orderBy(asc(ProtocolEventTable.seq))
            .all(),
        )
        expect({
          status: archiveResponse.status,
          archived: archived.archived,
          lifecycle: lifecycle.map((event) => event.type),
          oneOperation: new Set(lifecycle.map((event) => event.operationID)).size,
          oneProvenance: new Set(lifecycle.map((event) => JSON.stringify(event.payload))).size,
          archiveUpdates,
        }).toEqual({
          status: 200,
          archived: expect.any(Number),
          lifecycle: ["mission.execution.closing", "mission.execution.closed"],
          oneOperation: 1,
          oneProvenance: 1,
          archiveUpdates: [archived.archived],
        })
      },
    })
  }, 30_000)

  for (const retention of ["archive", "delete"] as const) {
    test(`commits the Mission ${retention} wake-rejection gate atomically with closed on the production route`, async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const missionID = `atomic-${retention}-gate`
          const mission = await ensureMissionSession({
            missionID,
            defaultCwd: project.path,
            productPillar: "code",
            heldExpertSquadIDs: ["base"],
          })
          await Config.updateProjectPatch({
            model: "mission-retention-test/rejection-model",
            provider: {
              "mission-retention-test": {
                name: "Mission retention gate test provider",
                npm: "@ai-sdk/openai-compatible",
                api: "http://127.0.0.1:1/v1",
                models: {
                  "rejection-model": {
                    name: "Mission retention rejection model",
                    tool_call: true,
                    modalities: { input: ["text"], output: ["text"] },
                    limit: { context: 32_000, output: 4_096 },
                  },
                },
              },
            },
          })
          await Auth.set("mission-retention-test", { type: "api", key: "mission-retention-test-key" })
          await openMissionThroughRealWake({
            missionID,
            sessionID: mission.id,
            source: "mission.dispatch",
            requestID: `atomic-${retention}-gate:open`,
          })
          const app = new Hono().route("/mission", MissionRoutes())
          app.onError(serverErrorResponse)
          let release!: () => void
          let reached!: () => void
          const reachedClosed = new Promise<void>((resolve) => {
            reached = resolve
          })
          const releaseClosed = new Promise<void>((resolve) => {
            release = resolve
          })
          using _closedBarrier = MissionExecutionClosureTestHooks.installAfterClosedCommitted(async () => {
            reached()
            await releaseClosed
          })
          const retentionInput = new Request(
              retention === "archive"
                ? `http://opencorvus.test/mission/${missionID}/archive`
                : `http://opencorvus.test/mission/${missionID}`,
              {
                method: retention === "archive" ? "PATCH" : "DELETE",
                headers: {
                  "content-type": "application/json",
                  "x-opencorvus-request-id": `atomic-${retention}-gate:retention`,
                },
                body: JSON.stringify({
                  ...(retention === "archive" ? { archived: true } : {}),
                  surface: "api",
                  reason: `Commit the ${retention} retention gate with Mission closed`,
                }),
              },
            )
          const retentionRequest =
            retention === "delete"
              ? PersistedProjectContext.provide({ directory: project.path, fn: () => app.fetch(retentionInput) })
              : app.fetch(retentionInput)
          await Promise.race([
            reachedClosed,
            retentionRequest.then(async (response) => {
              throw new Error(
                `Mission ${retention} route returned before closed boundary: ${response.status} ${await response.text()}`,
              )
            }),
            Bun.sleep(10_000).then(() => {
              throw new Error(`Mission ${retention} route did not reach its closed commit boundary`)
            }),
          ])
          const durableGate = Database.use((db) => ({
            archivedAt: db
              .select({ value: SessionTable.time_archived })
              .from(SessionTable)
              .where(eq(SessionTable.id, mission.id))
              .get()?.value,
            deletedEvents: db
              .select({ id: ProtocolEventTable.id })
              .from(ProtocolEventTable)
              .where(
                and(
                  eq(ProtocolEventTable.aggregate_type, "session"),
                  eq(ProtocolEventTable.aggregate_id, mission.id),
                  eq(ProtocolEventTable.type, "session.deleted"),
                ),
              )
              .all().length,
          }))
          let wakeResponse: Response
          try {
            wakeResponse = await Promise.race([
              app.fetch(
                new Request("http://opencorvus.test/mission/wake", {
                  method: "POST",
                  headers: {
                    "content-type": "application/json",
                    "x-opencorvus-request-id": `atomic-${retention}-gate:wake`,
                  },
                  body: JSON.stringify({
                    missionID,
                    productPillar: "code",
                    text: `This wake must lose to the atomic ${retention} gate.`,
                  }),
                }),
              ),
              Bun.sleep(10_000).then(() => {
                throw new Error(`Mission ${retention} gate did not reject the concurrent production wake`)
              }),
            ])
          } finally {
            release()
          }
          const retentionResponse = await Promise.race([
            retentionRequest,
            Bun.sleep(10_000).then(() => {
              throw new Error(`Mission ${retention} route did not finish physical cleanup after gate commit`)
            }),
          ])
          const lifecycle = Database.use((db) =>
            db
              .select({ type: ProtocolEventTable.type })
              .from(ProtocolEventTable)
              .where(
                and(
                  eq(ProtocolEventTable.aggregate_type, "session"),
                  eq(ProtocolEventTable.aggregate_id, mission.id),
                  eq(ProtocolEventTable.type, "mission.execution.opened"),
                ),
              )
              .all(),
          )
          expect({
            durableGate,
            wake: { status: wakeResponse.status, body: await wakeResponse.json() },
            retentionStatus: retentionResponse.status,
            openedOccurrences: lifecycle.length,
          }).toMatchObject({
            durableGate:
              retention === "archive"
                ? { archivedAt: expect.any(Number), deletedEvents: 0 }
                : { archivedAt: null, deletedEvents: 0 },
            wake: {
              status: 409,
              body: {
                name: "MissionExecutionWakeClosedError",
                data: { missionID, sessionID: mission.id, state: "closed" },
              },
            },
            retentionStatus: 200,
            openedOccurrences: 1,
          })
        },
      })
    }, 30_000)
  }

  test("upgrades an abort-closed Mission through archive and delete without replacing close provenance", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "abort-closed-archive-upgrade"
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const taskSession = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Retention cleanup child",
        })
        const taskID = Identifier.ascending("task")
        const taskCreatedAt = Date.now()
        persistTask({
          taskID,
          rootSession: taskSession,
          now: taskCreatedAt,
          title: "Retention cleanup child",
          request: "Prove Mission delete settles its bound child Task",
          productPillar: "code",
          source: "mission",
          priority: "normal",
          metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: taskCreatedAt,
          }),
        })
        const app = new Hono().route("/mission", MissionRoutes())
        app.onError(serverErrorResponse)
        const abort = await app.fetch(
          new Request(`http://opencorvus.test/mission/${missionID}/abort`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-opencorvus-request-id": "abort-before-archive" },
            body: JSON.stringify({ surface: "api", reason: "Abort before retaining this Mission" }),
          }),
        )
        expect({ status: abort.status, body: await abort.clone().json() }).toEqual({ status: 200, body: true })
        const before = currentMissionExecutionClosure(mission.id)
        expect(before).toMatchObject({
          state: "closed",
          source: "mission.abort",
          requestID: expect.any(String),
          provenance: { kind: "request", surface: "api", reason: "Abort before retaining this Mission" },
        })

        const archived = await app.fetch(
          new Request(`http://opencorvus.test/mission/${missionID}/archive`, {
            method: "PATCH",
            headers: { "content-type": "application/json", "x-opencorvus-request-id": "archive-after-abort" },
            body: JSON.stringify({ archived: true, surface: "api", reason: "Retain the aborted Mission" }),
          }),
        )
        expect({ status: archived.status, body: await archived.json() }).toMatchObject({
          status: 200,
          body: { archived: expect.any(Number) },
        })
        expect(currentMissionExecutionClosure(mission.id)).toEqual(before)
        const deleted = await PersistedProjectContext.provide({
          directory: project.path,
          fn: () =>
            app.fetch(
              new Request(`http://opencorvus.test/mission/${missionID}`, {
                method: "DELETE",
                headers: { "content-type": "application/json", "x-opencorvus-request-id": "delete-after-abort" },
                body: JSON.stringify({ surface: "api", reason: "Delete the abort-closed Mission" }),
              }),
            ),
        })
        const deletedBody = await deleted.clone().json()
        const retentionFacts = Database.use((db) =>
          db
            .select({ type: ProtocolEventTable.type })
            .from(ProtocolEventTable)
            .where(
              and(
                eq(ProtocolEventTable.aggregate_type, "session"),
                eq(ProtocolEventTable.aggregate_id, mission.id),
              ),
            )
            .all(),
        )
        const task = Database.use((db) => db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, taskID)).get())
        expect({
          status: deleted.status,
          body: deletedBody,
          close: currentMissionExecutionClosure(mission.id),
          deleteRequests: retentionFacts.filter((fact) => fact.type === "mission.retention.delete_requested").length,
          deletedBoundaries: retentionFacts.filter((fact) => fact.type === "session.deleted").length,
          childLifecycle: taskLifecycleProjection(taskID),
          retainedTaskID: task?.id,
        }).toEqual({
          status: 200,
          body: true,
          close: before,
          deleteRequests: 1,
          deletedBoundaries: 1,
          childLifecycle: expect.objectContaining({ taskID, status: "cancelled" }),
          retainedTaskID: taskID,
        })
      },
    })
  }, 30_000)

  test("uses one archived-to-delete intent to reject restore and wake, then replays one deletion", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "archived-delete-retention-race"
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const app = new Hono().route("/mission", MissionRoutes())
        app.onError(serverErrorResponse)
        await Config.updateProjectPatch({
          model: "mission-retention-test/race-model",
          provider: {
            "mission-retention-test": {
              name: "Mission retention race provider",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:1/v1",
              models: {
                "race-model": {
                  name: "Mission retention race model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 32_000, output: 4_096 },
                },
              },
            },
          },
        })
        const archive = await app.fetch(
          new Request(`http://opencorvus.test/mission/${missionID}/archive`, {
            method: "PATCH",
            headers: { "content-type": "application/json", "x-opencorvus-request-id": "archive-before-delete" },
            body: JSON.stringify({ archived: true, surface: "api", reason: "Archive before delete upgrade" }),
          }),
        )
        expect(archive.status).toBe(200)
        const archivedClosure = currentMissionExecutionClosure(mission.id)
        expect(archivedClosure).toMatchObject({ state: "closed", source: "mission.archive" })

        let reached!: () => void
        let release!: () => void
        const intentCommitted = new Promise<void>((resolve) => (reached = resolve))
        const releaseIntent = new Promise<void>((resolve) => (release = resolve))
        using _intentBarrier = MissionRetentionTestHooks.installAfterDeleteIntentCommitted(async () => {
          reached()
          await releaseIntent
        })
        const deleteRequest = PersistedProjectContext.provide({
          directory: project.path,
          fn: () =>
            app.fetch(
              new Request(`http://opencorvus.test/mission/${missionID}`, {
                method: "DELETE",
                headers: { "content-type": "application/json", "x-opencorvus-request-id": "delete-after-archive" },
                body: JSON.stringify({ surface: "api", reason: "Delete the archived Mission" }),
              }),
            ),
        })
        await Promise.race([
          intentCommitted,
          Bun.sleep(10_000).then(() => {
            throw new Error("Mission delete route did not commit its immutable intent")
          }),
        ])

        const [restore, wake] = await Promise.all([
          app.fetch(
            new Request(`http://opencorvus.test/mission/${missionID}/archive`, {
              method: "PATCH",
              headers: { "content-type": "application/json", "x-opencorvus-request-id": "restore-after-delete" },
              body: JSON.stringify({ archived: false }),
            }),
          ),
          app.fetch(
            new Request("http://opencorvus.test/mission/wake", {
              method: "POST",
              headers: { "content-type": "application/json", "x-opencorvus-request-id": "wake-after-delete" },
              body: JSON.stringify({
                missionID,
                productPillar: "code",
                text: "Wake must lose to the accepted delete request.",
              }),
            }),
          ),
        ])
        expect({
          restore: { status: restore.status, body: await restore.json() },
          wake: { status: wake.status, body: await wake.json() },
        }).toMatchObject({
          restore: {
            status: 409,
            body: { name: "MissionDeleteRetentionRequestedError", data: { missionID, sessionID: mission.id } },
          },
          wake: {
            status: 409,
            body: { name: "MissionExecutionWakeClosedError", data: { missionID, sessionID: mission.id } },
          },
        })
        release()
        const deleted = await deleteRequest
        expect(deleted.status).toBe(200)
        const replay = await PersistedProjectContext.provide({
          directory: project.path,
          fn: () =>
            app.fetch(
              new Request(`http://opencorvus.test/mission/${missionID}`, {
                method: "DELETE",
                headers: { "content-type": "application/json", "x-opencorvus-request-id": "delete-replay" },
                body: JSON.stringify({ surface: "api", reason: "Replay completed delete" }),
              }),
            ),
        })
        const facts = Database.use((db) =>
          db
            .select({ type: ProtocolEventTable.type })
            .from(ProtocolEventTable)
            .where(
              and(
                eq(ProtocolEventTable.aggregate_type, "session"),
                eq(ProtocolEventTable.aggregate_id, mission.id),
              ),
            )
            .all(),
        )
        expect({
          replay: { status: replay.status, body: await replay.json() },
          deleteRequests: facts.filter((fact) => fact.type === "mission.retention.delete_requested").length,
          deletedBoundaries: facts.filter((fact) => fact.type === "session.deleted").length,
          closure: currentMissionExecutionClosure(mission.id),
        }).toMatchObject({
          replay: { status: 200, body: true },
          deleteRequests: 1,
          deletedBoundaries: 1,
          closure: {
            eventID: archivedClosure?.eventID,
            source: "mission.archive",
            requestID: archivedClosure?.requestID,
          },
        })
      },
    })
  }, 30_000)

  test("joins a delete replay that settles between the pending read and lifecycle acquisition", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "delete-completion-acquire-race"
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        await closeMissionExecutionOperation({
          missionID,
          sessionID: mission.id,
          source: "mission.delete",
          requestID: "delete-completion-acquire-race:gate",
          provenance: { kind: "request", surface: "api", reason: "Seed the production delete gate" },
        })
        const app = new Hono().route("/mission", MissionRoutes())
        app.onError(serverErrorResponse)
        let hookCalls = 0
        let reached!: () => void
        let release!: () => void
        const firstPending = new Promise<void>((resolve) => (reached = resolve))
        const releaseFirst = new Promise<void>((resolve) => (release = resolve))
        using _pendingBarrier = MissionRetentionTestHooks.installAfterDeleteCompletionObservedPending(async () => {
          hookCalls += 1
          if (hookCalls !== 1) return
          reached()
          await releaseFirst
        })
        const request = (requestID: string) =>
          PersistedProjectContext.provide({
            directory: project.path,
            fn: () =>
              app.fetch(
                new Request(`http://opencorvus.test/mission/${missionID}`, {
                  method: "DELETE",
                  headers: { "content-type": "application/json", "x-opencorvus-request-id": requestID },
                  body: JSON.stringify({ surface: "api", reason: "Join the accepted delete operation" }),
                }),
              ),
          })
        const first = request("delete-completion-race:first")
        await firstPending
        const second = await request("delete-completion-race:second")
        expect({ status: second.status, body: await second.json() }).toEqual({ status: 200, body: true })
        release()
        const firstResponse = await first
        const facts = Database.use((db) =>
          db
            .select({ type: ProtocolEventTable.type })
            .from(ProtocolEventTable)
            .where(
              and(
                eq(ProtocolEventTable.aggregate_type, "session"),
                eq(ProtocolEventTable.aggregate_id, mission.id),
              ),
            )
            .all(),
        )
        expect({
          first: { status: firstResponse.status, body: await firstResponse.json() },
          hookCalls,
          deleteRequests: facts.filter((fact) => fact.type === "mission.retention.delete_requested").length,
          deletedBoundaries: facts.filter((fact) => fact.type === "session.deleted").length,
        }).toEqual({
          first: { status: 200, body: true },
          hookCalls: 2,
          deleteRequests: 1,
          deletedBoundaries: 1,
        })
      },
    })
  }, 30_000)

  test("rejects a wake during durable close without mutating the Session config overlay", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "closing-wake-config-authority"
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const initial = await Session.mergeConfigOverlay({
          sessionID: mission.id,
          patch: { model: "firmware/gpt-5", prompt_profile: { active: "base" } },
        })
        await Auth.set("firmware", { type: "api", key: "isolated-route-contract-key" })
        await expect(
          closeMissionExecutionOperation({
            missionID,
            sessionID: mission.id,
            source: "mission.abort",
            requestID: "close-before-rejected-wake",
            provenance: {
              kind: "request",
              surface: "api",
              reason: "Reject the concurrent Mission wake under the exact close",
            },
            signal: AbortSignal.abort(new Error("injected close interruption")),
          }),
        ).rejects.toThrow("injected close interruption")
        expect(currentMissionExecutionClosure(mission.id)).toMatchObject({ state: "closing" })

        const app = new Hono().route("/mission", MissionRoutes())
        app.onError(serverErrorResponse)
        const response = await app.fetch(
          new Request("http://opencorvus.test/mission/wake", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              missionID,
              productPillar: "code",
              text: "This rejected wake must not alter Mission configuration.",
            }),
          }),
        )
        expect({ status: response.status, body: await response.json() }).toMatchObject({
          status: 409,
          body: {
            name: "MissionExecutionClosingError",
            data: { missionID, sessionID: mission.id },
          },
        })
        expect((await Session.get(mission.id)).metadata?.configOverlay).toEqual(initial.metadata?.configOverlay)
      },
    })
  }, 0)

  test("resumes only the same immutable Expert Squad snapshot", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const input = {
          missionID: "immutable-snapshot-resume",
          defaultCwd: project.path,
          productPillar: "code" as const,
          heldExpertSquadIDs: ["base"] as [string, ...string[]],
        }
        const created = await ensureMissionSession(input)
        const resumed = await ensureMissionSession(input)
        expect(resumed.id).toBe(created.id)
        try {
          await ensureMissionSession({ ...input, heldExpertSquadIDs: ["advanced"] })
          throw new Error("Expected immutable Mission Expert Squad snapshot mismatch")
        } catch (error) {
          expect(error).toBeInstanceOf(MissionExpertSquadSnapshotMismatchError)
          expect((error as InstanceType<typeof MissionExpertSquadSnapshotMismatchError>).toObject().data).toMatchObject(
            {
              missionID: input.missionID,
              heldCount: 1,
              heldSnapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            },
          )
        }
        const app = new Hono().route("/mission", MissionRoutes())
        const response = await app.fetch(
          new Request("http://opencorvus.test/mission/wake", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              missionID: input.missionID,
              productPillar: input.productPillar,
              text: "Resume with the requested immutable Expert Squad snapshot.",
              expertSquadIDs: ["advanced"],
              model: "firmware/gpt-5",
            }),
          }),
        )
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({
          name: "MissionExpertSquadSnapshotMismatchError",
          data: {
            missionID: input.missionID,
            heldCount: 1,
            heldSnapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          },
        })
      },
    })
  }, 0)

  test("projects one restart-safe cursor from Mission and child Task durable facts", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const missionID = "benchmark-mission"
        const mission = await ensureMissionSession({
          missionID,
          defaultCwd: project.path,
          productPillar: "code",
          heldExpertSquadIDs: ["base"],
        })
        const taskSession = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          parentID: mission.id,
          title: "Benchmark trial",
        })
        const taskID = Identifier.ascending("task")
        const timeCreated = Date.now()
        persistTask({
          taskID,
          rootSession: taskSession,
          now: timeCreated,
          title: "Benchmark trial",
          request: "Run one exact benchmark trial",
          productPillar: "code",
          source: "mission",
          priority: "normal",
          metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated,
          }),
        })

        const taskActivityTime = 4_000_000_000_000
        Database.use((db) =>
          db.transaction((tx) => {
            tx.update(SessionTable)
              .set({ time_created: taskActivityTime - 100, time_updated: taskActivityTime - 100 })
              .where(eq(SessionTable.id, mission.id))
              .run()
            tx.update(SessionTable)
              .set({ time_created: taskActivityTime - 50, time_updated: taskActivityTime - 50 })
              .where(eq(SessionTable.id, taskSession.id))
              .run()
            tx.update(EngineTaskTable)
              .set({ time_created: taskActivityTime, time_updated: taskActivityTime })
              .where(eq(EngineTaskTable.id, taskID))
              .run()
          }),
        )
        expect(
          readMissionDurableActivity({
            projectID: Instance.project.id,
            missionID,
            sessionID: mission.id,
          }),
        ).toMatchObject({
          mission_id: missionID,
          session_id: mission.id,
          source: "task",
          id: taskID,
          time_updated: taskActivityTime,
          tasks: [{ task_id: taskID, source: "task", id: taskID, time_updated: taskActivityTime }],
        })

        const message = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: taskSession.id,
          role: "user",
          author: "user",
          time: { created: taskActivityTime + 1 },
          agent: "user",
          model: { providerID: "test", modelID: "test" },
        })
        const messageActivityTime = taskActivityTime + 2
        Database.use((db) =>
          db
            .update(MessageTable)
            .set({ time_updated: messageActivityTime })
            .where(eq(MessageTable.id, message.id))
            .run(),
        )
        expect(
          readMissionDurableActivity({
            projectID: Instance.project.id,
            missionID,
            sessionID: mission.id,
          }),
        ).toMatchObject({
          mission_id: missionID,
          session_id: mission.id,
          source: "message",
          id: message.id,
          time_updated: messageActivityTime,
          tasks: [
            {
              task_id: taskID,
              source: "message",
              id: message.id,
              time_updated: messageActivityTime,
            },
          ],
        })
        const beforeSameMillisecondActivity = readMissionDurableActivity({
          projectID: Instance.project.id,
          missionID,
          sessionID: mission.id,
        })
        const sameMillisecondMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: taskSession.id,
          role: "user",
          author: "user",
          time: { created: messageActivityTime },
          agent: "user",
          model: { providerID: "test", modelID: "test" },
        })
        Database.use((db) =>
          db
            .update(MessageTable)
            .set({ time_updated: messageActivityTime })
            .where(eq(MessageTable.id, sameMillisecondMessage.id))
            .run(),
        )
        const sameMillisecondActivity = readMissionDurableActivity({
          projectID: Instance.project.id,
          missionID,
          sessionID: mission.id,
        })
        expect({
          before: beforeSameMillisecondActivity.activity_sha256,
          after: sameMillisecondActivity.activity_sha256,
          latestTime: sameMillisecondActivity.time_updated,
        }).toEqual({
          before: expect.stringMatching(/^[a-f0-9]{64}$/),
          after: expect.stringMatching(/^[a-f0-9]{64}$/),
          latestTime: messageActivityTime,
        })
        expect(
          new Set([beforeSameMillisecondActivity.activity_sha256, sameMillisecondActivity.activity_sha256]).size,
        ).toBe(2)
        await Session.updateMessage({
          id: sameMillisecondMessage.id,
          sessionID: taskSession.id,
          role: "user",
          author: "user",
          time: { created: messageActivityTime },
          agent: "user",
          model: { providerID: "test-updated", modelID: "test" },
        })
        Database.use((db) =>
          db
            .update(MessageTable)
            .set({ time_updated: messageActivityTime })
            .where(eq(MessageTable.id, sameMillisecondMessage.id))
            .run(),
        )
        const sameRowSameMillisecondActivity = readMissionDurableActivity({
          projectID: Instance.project.id,
          missionID,
          sessionID: mission.id,
        })
        expect(
          new Set([
            beforeSameMillisecondActivity.activity_sha256,
            sameMillisecondActivity.activity_sha256,
            sameRowSameMillisecondActivity.activity_sha256,
          ]).size,
        ).toBe(3)
        const app = new Hono().route("/mission", MissionRoutes())
        const client = createOpenCorvusClient({
          baseUrl: "http://opencorvus.test",
          directory: project.path,
          fetch: (request) => app.fetch(request),
        })
        expect((await client.mission.activityCursor({ missionID }, { throwOnError: true })).data).toEqual(
          readMissionDurableActivity({
            projectID: Instance.project.id,
            missionID,
            sessionID: mission.id,
          }),
        )

        await Session.setTitle({ sessionID: taskSession.id, title: "Renamed benchmark trial" })
        Database.use((db) =>
          db.transaction((tx) => {
            tx.update(SessionTable)
              .set({ time_updated: messageActivityTime + 1_000 })
              .where(eq(SessionTable.id, taskSession.id))
              .run()
            tx.update(EngineTaskTable)
              .set({ time_archived: messageActivityTime + 2_000, time_updated: messageActivityTime + 2_000 })
              .where(eq(EngineTaskTable.id, taskID))
              .run()
          }),
        )
        expect(
          readMissionDurableActivity({
            projectID: Instance.project.id,
            missionID,
            sessionID: mission.id,
          }),
        ).toEqual(sameRowSameMillisecondActivity)
        expect((await client.mission.activityCursor({ missionID }, { throwOnError: true })).data).toEqual(
          readMissionDurableActivity({
            projectID: Instance.project.id,
            missionID,
            sessionID: mission.id,
          }),
        )

        const progressAssistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          parentID: sameMillisecondMessage.id,
          sessionID: taskSession.id,
          role: "assistant",
          author: "coding",
          agent: "coding",
          providerID: "test",
          modelID: "test",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          time: { created: messageActivityTime + 3_000 },
        })
        const progressPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: taskSession.id,
          messageID: progressAssistant.id,
          type: "tool",
          tool: "bash",
          callID: "call_mission_durable_progress",
          state: {
            status: "running",
            input: { command: "train" },
            time: { start: messageActivityTime + 3_001 },
          },
        })
        const progressTime = messageActivityTime + 4_000
        const progressID = Identifier.ascending("part")
        Database.use((db) =>
          db
            .insert(ToolPartProgressTable)
            .values({
              id: progressID,
              request_part_id: progressPart.id,
              metadata: { output_bytes: 31_337 },
              time_created: progressTime,
            })
            .run(),
        )
        expect(
          readMissionDurableActivity({
            projectID: Instance.project.id,
            missionID,
            sessionID: mission.id,
          }),
        ).toMatchObject({
          source: "part",
          id: progressID,
          time_updated: progressTime,
          tasks: [{ task_id: taskID, source: "part", id: progressID, time_updated: progressTime }],
        })
      },
    })
  }, 0)
})
