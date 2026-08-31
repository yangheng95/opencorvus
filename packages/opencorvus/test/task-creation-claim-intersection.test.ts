import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { EngineService } from "@/task-api"
import { TaskCreationIdentityConflictError } from "@/engine/task-creation-contract"
import { TaskChannelBindingProjectConflictError } from "@/engine/task-project-error"
import { EngineChannelBindingTable, EngineTaskTable } from "@/engine/engine.sql"
import { ProtocolStore } from "@/protocol/store"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { Server } from "@/server/server"

beforeAll(async () => {
  process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
  await Config.updateGlobalPatch({
    model: "claim-test-provider/claim-test-model",
    provider: {
      "claim-test-provider": {
        name: "Claim test provider",
        npm: "@ai-sdk/openai-compatible",
        api: "http://127.0.0.1:9/claim-test-model",
        models: {
          "claim-test-model": {
            name: "Claim test model",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 1_000_000, output: 4_096 },
          },
        },
      },
    },
  })
})

afterAll(resetMemoryDatabase)

describe("Task creation identity intersection", () => {
  test("the project Task route returns the stable unavailable terminal after accepted retention", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const requestID = Identifier.ascending("call")
        const body = { request: "Retain one accepted route Task", productPillar: "code" }
        const send = () => Server.App().request("/task", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-opencorvus-request-id": requestID,
            "x-opencorvus-directory": project.path,
          },
          body: JSON.stringify(body),
        })
        const accepted = await send()
        const acceptedBody = await accepted.json() as { task_id: string }
        expect(accepted.status).toBe(202)
        const task = Database.use((db) =>
          db.select().from(EngineTaskTable).where(eq(EngineTaskTable.id, acceptedBody.task_id)).get(),
        )
        if (!task?.session_id) throw new Error("Accepted route Task has no root Session")
        Database.immediateTransaction(() => {
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.completed",
            aggregate: "task",
            aggregate_id: task.id,
            task_id: null,
            session_id: task.session_id,
            source: "test.route-retention",
            emitted_at: Date.now(),
            payload: { execution_epoch: 1 },
          })
        })
        expect(await EngineService.deleteTask(task.id, { projectID: Instance.project.id })).toBe(true)
        const replay = await send()
        expect({ status: replay.status, body: await replay.json() }).toMatchObject({
          status: 410,
          body: { name: "TaskCreationAcceptedTargetUnavailableError", data: { taskID: task.id } },
        })
      },
    })
  }, 120_000)

  test("one winner acquires missing request/channel aliases and freezes channel payload", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const requestID = Identifier.ascending("call")
        const channel = { platform: "slack", channel: Identifier.ascending("artifact"), thread: "root", payload: { v: 1 } }
        const input = { request: "Bind one accepted Task to both identities", productPillar: "code" as const }
        const requestWinner = await EngineService.createTask({ ...input, requestID }, { actor: "user" })
        expect(
          await EngineService.createTask({ ...input, requestID, channelBinding: channel }, { actor: "user" }),
        ).toBe(requestWinner)
        expect(await EngineService.createTask({ ...input, channelBinding: channel }, { actor: "user" })).toBe(
          requestWinner,
        )

        const rootSessionID = Database.use((db) =>
          db.select({ sessionID: EngineTaskTable.session_id }).from(EngineTaskTable)
            .where(eq(EngineTaskTable.id, requestWinner)).get()?.sessionID,
        )
        if (!rootSessionID) throw new Error("Accepted claim test Task has no root Session")
        Database.immediateTransaction(() => {
          ProtocolStore.appendEventInTransaction({
            kind: "event",
            type: "task.cancelled",
            aggregate: "task",
            aggregate_id: requestWinner,
            task_id: null,
            session_id: rootSessionID,
            source: "test.claim-retention",
            emitted_at: Date.now(),
            payload: { execution_epoch: 1, error: "seeded terminal" },
          })
        })
        expect(
          await EngineService.createTask({ ...input, requestID, channelBinding: channel }, { actor: "user" }),
        ).toBe(requestWinner)
        expect(
          Database.use((db) =>
            db.select({ taskID: EngineChannelBindingTable.task_id }).from(EngineChannelBindingTable)
              .where(eq(EngineChannelBindingTable.task_id, requestWinner)).get(),
          ),
        ).toEqual({ taskID: requestWinner })

        await expect(
          EngineService.createTask(
            { ...input, channelBinding: { ...channel, payload: { v: 2 } } },
            { actor: "user" },
          ),
        ).rejects.toBeInstanceOf(TaskCreationIdentityConflictError)

        const channelOnly = { platform: "slack", channel: Identifier.ascending("artifact"), thread: "root" }
        const channelWinner = await EngineService.createTask(
          { ...input, request: "Bind the inverse alias", channelBinding: channelOnly },
          { actor: "user" },
        )
        const inverseRequestID = Identifier.ascending("call")
        expect(
          await EngineService.createTask(
            { ...input, request: "Bind the inverse alias", requestID: inverseRequestID, channelBinding: channelOnly },
            { actor: "user" },
          ),
        ).toBe(channelWinner)
        expect(
          await EngineService.createTask(
            { ...input, request: "Bind the inverse alias", requestID: inverseRequestID },
            { actor: "user" },
          ),
        ).toBe(channelWinner)
      },
    })
  }, 120_000)

  test("request and channel winners that name different Tasks return the typed composite conflict", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        const requestID = Identifier.ascending("call")
        const channel = { platform: "slack", channel: Identifier.ascending("artifact"), thread: "root" }
        const requestTaskID = await EngineService.createTask(
          { request: "Request winner", productPillar: "code", requestID },
          { actor: "user" },
        )
        const channelTaskID = await EngineService.createTask(
          { request: "Channel winner", productPillar: "code", channelBinding: channel },
          { actor: "user" },
        )
        try {
          await EngineService.createTask(
            { request: "Request winner", productPillar: "code", requestID, channelBinding: channel },
            { actor: "user" },
          )
          throw new Error("Expected composite Task identity conflict")
        } catch (error) {
          expect(error).toBeInstanceOf(TaskCreationIdentityConflictError)
          expect((error as InstanceType<typeof TaskCreationIdentityConflictError>).toObject().data).toMatchObject({
            requestTaskID,
            channelTaskID,
            toolTaskID: null,
          })
        }
      },
    })
  }, 120_000)

  test("a globally unique channel retained by another Project returns the typed Project conflict", async () => {
    await using first = await memoryProject()
    await using second = await memoryProject()
    const channel = { platform: "slack", channel: Identifier.ascending("artifact"), thread: "cross-project" }
    const winner = await Instance.provide({
      directory: first.path,
      init: InstanceBootstrap,
      fn: async () => {
        using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        return EngineService.createTask(
          { request: "Own the external thread", productPillar: "code", channelBinding: channel },
          { actor: "user" },
        )
      },
    })
    await expect(
      Instance.provide({
        directory: second.path,
        init: InstanceBootstrap,
        fn: async () => {
          using _runner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
          return EngineService.createTask(
            { request: "Attempt the occupied thread", productPillar: "code", channelBinding: channel },
            { actor: "user" },
          )
        },
      }),
    ).rejects.toMatchObject({
      name: "TaskChannelBindingProjectConflictError",
      data: { taskID: winner },
    } satisfies Partial<InstanceType<typeof TaskChannelBindingProjectConflictError>>)
  }, 120_000)
})
