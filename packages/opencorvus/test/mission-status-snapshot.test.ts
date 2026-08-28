import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { requireTask } from "@/engine/store"
import { terminalTask } from "@/engine/state"
import { setEngineTaskArchived } from "@/engine/task"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { missionRecord, missionStatusRecord } from "@/mission/projection"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionStatus } from "@/session/status"
import { Database } from "@/storage/db"
import { missionStatusSnapshot } from "@/status/task-status-snapshot"
import { EngineService } from "@/task-api"
import { listArchivedWorkLedger, listWorkLedger } from "@/work-ledger/projection"
import { resetDatabase } from "./fixture/db"
import { persistEstablishedTask } from "./fixture/engine-task"
import { tmpdir } from "./fixture/fixture"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.08.13.1",
  packageDigest: "a".repeat(64),
}

async function persistUnownedTask(title: string, now = Date.now()) {
  const taskID = Identifier.ascending("task")
  persistEstablishedTask({
    taskID,
    rootSession: Session.prepareRootNext({ kind: "root", directory: Instance.directory, title }),
    now,
    title,
    request: `Keep ${title} visible without a Mission root`,
    productPillar: "work",
    source: "right-sidebar-conversation",
    metadata: { actor: "user" },
    projectID: Instance.project.id,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  return taskID
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetDatabase()
})

describe("Mission status snapshot", () => {
  test("reports an executing Mission before its first child Task exists", () => {
    const snapshot = missionStatusSnapshot({
      missionID: "mission-1",
      sessionID: "session-1",
      title: "Research NVIDIA",
      directory: "C:/research",
      productPillar: "work",
      missionActivity: "running",
      tasks: [],
      generatedAt: 123,
    })

    expect(snapshot.status).toBe("running")
    expect(snapshot.taskCounts).toEqual({ total: 0, running: 0, inactive: 0 })
    expect(snapshot.activity).toEqual({ total: 1, running: 1, inactive: 0 })
    expect(snapshot.generatedAt).toBe(123)
  })

  test("projects the Mission execution occurrence into both Mission and Work Ledger records", async () => {
    await using project = await tmpdir({ git: true })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "mission-status-projection",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        const input = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: mission.id,
          role: "user",
          author: "mission",
          time: { created: Date.now() },
          agent: "mission",
          model: { providerID: "test", modelID: "test" },
        })
        const owner = new AbortController()
        SessionStatus.beginExecutionOccurrence(mission.id, input.id, owner.signal)
        await SessionStatus.set(mission.id, { type: "streaming" })

        expect(missionRecord(mission)).toMatchObject({
          missionID: mission.missionID,
          sessionID: mission.id,
          interruptible: true,
          tasks: [],
          taskStats: { total: 0, running: 0, inactive: 0 },
        })
        expect(missionStatusRecord(mission)).toMatchObject({
          missionID: mission.missionID,
          sessionID: mission.id,
          status: "running",
          activity: { total: 1, running: 1, inactive: 0 },
          taskCounts: { total: 0, running: 0, inactive: 0 },
          tasks: [],
        })
      },
    })
  })

  test("projects a terminal child lifecycle and its completion time from one Work Ledger snapshot", async () => {
    await using project = await tmpdir({ git: true })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "mission-terminal-work-ledger-timing",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        const taskSession = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Terminal Work Ledger Task",
        })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        persistEstablishedTask({
          taskID,
          rootSession: taskSession,
          now: started,
          title: "Terminal Work Ledger Task",
          request: "Project one atomic terminal timing snapshot",
          productPillar: "work",
          source: "mission",
          metadata: { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } },
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: started,
          }),
        })
        const terminal = await terminalTask(
          requireTask(taskID),
          { status: "completed", time_started: started, time_completed: started + 10 },
          "Terminal timing projected",
        )
        const completed = terminal.time_completed
        if (completed === null) throw new Error("Terminal Task did not publish its completion time")

        const ledger = await listWorkLedger()
        const missionRow = ledger.rows.find((row) => row.kind === "mission" && row.missionID === mission.missionID)
        expect(missionRow).toMatchObject({
          tasks: [
            {
              id: taskID,
              lifecycleStatus: "completed",
              activityStatus: "inactive",
              started,
              completed,
            },
          ],
        })
        expect(
          ledger.rows.flatMap((row) => {
            if (row.kind === "mission") {
              return row.tasks
                .filter((task) => task.id === taskID)
                .map((task) => ({ placement: "mission-child", missionID: row.missionID, taskID: task.id }))
            }
            if (row.kind === "task" && row.id === taskID) {
              return [{ placement: "top-level", taskID: row.id }]
            }
            return []
          }),
        ).toEqual([
          {
            placement: "mission-child",
            missionID: mission.missionID,
            taskID,
          },
        ])
      },
    })
  })

  test("projects an unowned active Task as a top-level Work Ledger item", async () => {
    await using project = await tmpdir({ git: true })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const taskID = await persistUnownedTask("Visible unowned Task")

        const ledger = await listWorkLedger({ directory: project.path })
        expect(ledger.rows.find((row) => row.kind === "task" && row.id === taskID)).toMatchObject({
          kind: "task",
          id: taskID,
          title: "Visible unowned Task",
          directory: project.path,
          lifecycleStatus: "active",
          activityStatus: "running",
          source: "right-sidebar-conversation",
          productPillar: "work",
        })
      },
    })
  })

  test("paginates a lifecycle-updated unowned Task with one stable public cursor order", async () => {
    await using project = await tmpdir({ git: true })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const search = "unowned-task-cursor-contract"
        const trailingTaskID = await persistUnownedTask(`${search} trailing`, Date.now() - 100)
        const boundaryCreated = Date.now()
        const boundaryTaskID = await persistUnownedTask(`${search} boundary`, boundaryCreated)
        await terminalTask(
          requireTask(boundaryTaskID),
          { status: "failed", error: "expected cursor fixture" },
          "Cursor timing projected",
          {
            terminalAt: boundaryCreated + 10,
            preExecutionInfrastructureFailure: {
              code: "IMMUTABLE_CREATION_WORKSPACE_MISMATCH",
              initialTreeSHA256: "b".repeat(64),
              executionTreeSHA256: "c".repeat(64),
            },
          },
        )

        const first = await listWorkLedger({ directory: project.path, search, limit: 1 })
        expect(first.rows.map((row) => row.id)).toEqual([boundaryTaskID])
        if (!first.nextCursor) throw new Error("First Work Ledger page did not return its continuation cursor")

        const second = await listWorkLedger({
          directory: project.path,
          search,
          limit: 1,
          cursorUpdated: first.nextCursor.updated,
          cursorPinned: first.nextCursor.pinned,
          cursorRowKey: first.nextCursor.rowKey,
        })
        expect([...first.rows, ...second.rows].map((row) => row.id)).toEqual([boundaryTaskID, trailingTaskID])
        expect(second.nextCursor).toBeNull()
      },
    })
  })

  test("keeps returning durable Work Ledger rows after another Task is deleted", async () => {
    await using project = await tmpdir({ git: true })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const search = "deleted-task-list-convergence"
        const survivorTaskID = await persistUnownedTask(`${search} survivor`, Date.now() - 100)
        const deletedTaskID = await persistUnownedTask(`${search} deleted`)
        await terminalTask(
          requireTask(deletedTaskID),
          { status: "failed", error: "expected deletion fixture" },
          "Deletion fixture settled",
          {
            preExecutionInfrastructureFailure: {
              code: "IMMUTABLE_CREATION_WORKSPACE_MISMATCH",
              initialTreeSHA256: "d".repeat(64),
              executionTreeSHA256: "e".repeat(64),
            },
          },
        )
        expect(await EngineService.deleteTask(deletedTaskID)).toBe(true)

        const ledger = await listWorkLedger({ directory: project.path, search })
        expect(ledger.rows.map((row) => row.id)).toEqual([survivorTaskID])
      },
    })
  })

  test("projects failed and archived terminal Task timing without splitting lifecycle snapshots", async () => {
    await using project = await tmpdir({ git: true })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Archived failed Work Ledger Task",
        })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        persistEstablishedTask({
          taskID,
          rootSession: session,
          now: started,
          title: "Archived failed Work Ledger Task",
          request: "Keep the terminal timing in the archived projection",
          productPillar: "work",
          source: "test",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: Instance.directory,
            packageRevisionSHA256: packageRevision.packageDigest,
            timeCreated: started,
          }),
        })
        const terminal = await terminalTask(
          requireTask(taskID),
          { status: "failed", error: "expected terminal fixture", time_started: started, time_completed: started },
          "Failed timing projected",
        )
        const completed = terminal.time_completed
        if (completed === null) throw new Error("Failed Task did not publish its completion time")
        Database.transaction((db) =>
          setEngineTaskArchived(db, { taskID, timeArchived: started + 1, timeUpdated: started + 1 }),
        )

        const archived = await listArchivedWorkLedger()
        expect(archived.rows.find((row) => row.kind === "task" && row.id === taskID)).toMatchObject({
          id: taskID,
          lifecycleStatus: "failed",
          activityStatus: "inactive",
          started,
          completed,
          archived: started + 1,
        })
      },
    })
  })
})
