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
        const taskSession = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Terminal Work Ledger Task" })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        const completed = started + 10
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
        await terminalTask(
          requireTask(taskID),
          { status: "completed", time_started: started, time_completed: completed },
          "Terminal timing projected",
        )

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
      },
    })
  })

  test("projects failed and archived terminal Task timing without splitting lifecycle snapshots", async () => {
    await using project = await tmpdir({ git: true })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Archived failed Work Ledger Task" })
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
        await terminalTask(
          requireTask(taskID),
          { status: "failed", error: "expected terminal fixture", time_started: started, time_completed: started },
          "Failed timing projected",
        )
        Database.transaction((db) =>
          setEngineTaskArchived(db, { taskID, timeArchived: started + 1, timeUpdated: started + 1 }),
        )

        const archived = await listArchivedWorkLedger()
        expect(archived.rows.find((row) => row.kind === "task" && row.id === taskID)).toMatchObject({
          id: taskID,
          lifecycleStatus: "failed",
          activityStatus: "inactive",
          started,
          completed: started,
          archived: started + 1,
        })
      },
    })
  })
})
