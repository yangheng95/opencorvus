import { afterEach, describe, expect, test } from "bun:test"
import { Identifier } from "@/id/id"
import { missionRecord, missionStatusRecord } from "@/mission/projection"
import { ensureMissionSession } from "@/mission/session"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { SessionStatus } from "@/session/status"
import { missionStatusSnapshot } from "@/status/task-status-snapshot"
import { resetDatabase } from "./fixture/db"
import { tmpdir } from "./fixture/fixture"

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
})
