import { afterAll, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
import { readMissionDurableActivity } from "../src/engine/durable-activity"
import { EngineTaskTable } from "../src/engine/engine.sql"
import { persistQueuedTask } from "../src/engine/pipeline"
import { Identifier } from "../src/id/id"
import { ensureMissionSession, MissionExpertSquadSnapshotMismatchError } from "../src/mission/session"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { MessageTable, SessionTable } from "../src/session/session.sql"
import { Database } from "../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { createOpenCorvusClient } from "@opencorvus-ai/sdk/client"
import { Hono } from "hono"
import { MissionRoutes } from "../src/server/routes/mission"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"

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
        const taskSession = await Session.create({
          kind: "root",
          parentID: mission.id,
          title: "Benchmark trial",
        })
        const taskID = Identifier.ascending("task")
        const timeCreated = Date.now()
        persistQueuedTask({
          taskID,
          sessionID: taskSession.id,
          now: timeCreated,
          title: "Benchmark trial",
          request: "Run one exact benchmark trial",
          productPillar: "code",
          source: "mission",
          priority: "normal",
          metadata: { actor: "mission", mission: { id: missionID, session_id: mission.id } },
          projectID: Instance.project.id,
          queue: true,
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
        expect(
          (await client.mission.activityCursor({ missionID }, { throwOnError: true })).data,
        ).toEqual(
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
      },
    })
  }, 0)
})
