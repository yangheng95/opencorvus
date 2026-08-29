import { afterAll, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"
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
            provenance: { surface: "api", reason: "Reject non-operator wakes after closing begins" },
            close: async () => {
              throw new Error("injected close interruption")
            },
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
