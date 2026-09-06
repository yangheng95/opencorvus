import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { GlobalTaskService } from "@/task-api/global-task-service"
import { EngineService, TaskCreationCommitTestHooks } from "@/task-api"
import {
  GlobalCreationAcceptedTargetConflictError,
  GlobalCreationAllocation,
  GlobalCreationAllocationConflictError,
} from "@/project/global-creation-allocation"
import { GlobalCreationAllocationTable, ProjectTable } from "@/project/project.sql"
import { Instance } from "@/project/instance"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Database, eq } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { ImplicitProject } from "@/project/implicit-project"
import { Project } from "@/project/project"
import { Server } from "@/server/server"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import {
  exportMysqlTransferSnapshot,
  importMysqlTransferSnapshot,
  preflightMysqlTransferSnapshot,
} from "@/storage/mysql-transfer"
import { TaskChannelBindingProjectConflictError } from "@/engine/task-project-error"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import {
  TestHooks as TaskControlTestHooks,
  waitForIngressDeliveryHooksForTest,
} from "@/engine/task-root-ingress-delivery"
import { Session } from "@/session"
import { EngineTaskTable } from "@/engine/engine.sql"

const base = {
  title: "Canonical global request",
  request: "Create one Task for one immutable global request",
  productPillar: "code" as const,
  source: "test",
}

let acceptedReconciliationHook: Disposable | undefined
let ingressRunnerOverrides: Disposable[] = []

beforeEach(async () => {
  process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
  await Config.updateGlobalPatch({
    model: "global-replay-provider/global-replay-model",
    provider: {
      "global-replay-provider": {
        name: "Global replay provider",
        npm: "@ai-sdk/openai-compatible",
        api: "http://127.0.0.1:9/global-replay-model",
        models: {
          "global-replay-model": {
            name: "Global replay model",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 1_000_000, output: 4_096 },
          },
          "global-replay-model-alt": {
            name: "Alternate resolved model",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 1_000_000, output: 4_096 },
          },
        },
      },
    },
  })
  acceptedReconciliationHook = TaskCreationCommitTestHooks.installBeforeAcceptedReconciliation(() => {
    ingressRunnerOverrides.push(TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) }))
  })
})

afterEach(async () => {
  acceptedReconciliationHook?.[Symbol.dispose]()
  acceptedReconciliationHook = undefined
  await waitForIngressDeliveryHooksForTest()
  for (const override of ingressRunnerOverrides.reverse()) override[Symbol.dispose]()
  ingressRunnerOverrides = []
  await resetMemoryDatabase()
}, 30_000)

describe("global Task request occurrence", () => {
  test("the public Global Task boundary requires identity and rejects caller-owned Project fields", async () => {
    const send = (body: Record<string, unknown>) =>
      Server.App().request("/global/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    const missing = await send(base)
    expect({ status: missing.status, body: await missing.json() }).toMatchObject({
      status: 400,
      body: { name: "GlobalTaskRequestIdentityRequiredError" },
    })
    const callerProject = await send({ ...base, requestID: Identifier.ascending("call"), directory: "C:/caller" })
    expect(callerProject.status).toBe(400)
    const identities = () =>
      Database.use((db) => ({
        allocations: db.select({ id: GlobalCreationAllocationTable.id }).from(GlobalCreationAllocationTable).all(),
        projects: db.select({ id: ProjectTable.id }).from(ProjectTable).all(),
      }))
    const before = identities()
    for (const unsupported of [
      { artifactSources: [{ authority: "completion_decision", source_task_id: "task-source" }] },
      { metadata: { caller: "reserved" } },
      { attachments: [{ mime: "text/plain", url: "/attachment/prj_missing/blob.txt" }] },
    ]) {
      const response = await send({ ...base, requestID: Identifier.ascending("call"), ...unsupported })
      expect({ status: response.status, body: await response.json() }).toMatchObject({
        status: 400,
        body: { success: false },
      })
      expect(identities()).toEqual(before)
    }
  })

  test("same explicit request returns the accepted Task after mutable global defaults change", async () => {
    const requestID = Identifier.ascending("call")
    const first = await GlobalTaskService.create({ ...base, requestID })
    await Config.updateGlobalPatch({
      model: "global-replay-provider/global-replay-model-2",
      provider: {
        "global-replay-provider": {
          name: "Global replay provider",
          npm: "@ai-sdk/openai-compatible",
          api: "http://127.0.0.1:9/global-replay-model",
          models: {
            "global-replay-model": {
              name: "Global replay model",
              tool_call: true,
              modalities: { input: ["text"], output: ["text"] },
              limit: { context: 1_000_000, output: 4_096 },
            },
            "global-replay-model-2": {
              name: "Changed global default",
              tool_call: true,
              modalities: { input: ["text"], output: ["text"] },
              limit: { context: 1_000_000, output: 4_096 },
            },
          },
        },
      },
    })
    expect(await GlobalTaskService.create({ ...base, requestID })).toEqual(first)
    const currentDefaults = spyOn(Config, "getGlobal").mockRejectedValue(
      new Error("current Global Task defaults are no longer resolvable"),
    )
    try {
      expect(await GlobalTaskService.create({ ...base, requestID })).toEqual(first)
      await expect(
        GlobalTaskService.create({ ...base, requestID, request: `${base.request} changed` }),
      ).rejects.toBeInstanceOf(GlobalCreationAllocationConflictError)
    } finally {
      currentDefaults.mockRestore()
    }
    expect(
      Database.use((db) =>
        db
          .select({
            projectID: GlobalCreationAllocationTable.accepted_project_id,
            targetID: GlobalCreationAllocationTable.accepted_target_id,
          })
          .from(GlobalCreationAllocationTable)
          .where(eq(GlobalCreationAllocationTable.request_id, requestID))
          .get(),
      ),
    ).toEqual({ projectID: first.project_id, targetID: first.task_id })
    const rootSessionID = Database.use(
      (db) =>
        db
          .select({ id: EngineTaskTable.session_id })
          .from(EngineTaskTable)
          .where(eq(EngineTaskTable.id, first.task_id))
          .get()?.id,
    )
    if (!rootSessionID) throw new Error("Accepted Global Task has no root Session")
    await Instance.provide({
      directory: first.directory,
      fn: () =>
        Session.mergeConfigOverlayInProject({
          sessionID: rootSessionID,
          projectID: first.project_id,
          patch: { model: "global-replay-provider/global-replay-model-2" },
        }),
    })
    expect(preflightMysqlTransferSnapshot(exportMysqlTransferSnapshot())).toMatchObject({
      schemaFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    const divergentTransfer = structuredClone(exportMysqlTransferSnapshot())
    const allocationRow = divergentTransfer.tables
      .find((table) => table.name === "global_creation_allocation")
      ?.rows.find((row) => row.request_id === requestID)
    if (!allocationRow) throw new Error("Global Task transfer omitted its accepted allocation")
    const resolution = JSON.parse(String(allocationRow.task_resolution)) as Record<string, unknown>
    resolution.selected_profile_id = "base-researcher"
    allocationRow.task_resolution = JSON.stringify(resolution)
    expect(() => preflightMysqlTransferSnapshot(divergentTransfer)).toThrow(
      expect.objectContaining({
        name: "MysqlTransferValidationError",
        data: expect.objectContaining({ message: expect.stringContaining("prompt profile diverges") }),
      }),
    )
    const divergentRoot = structuredClone(exportMysqlTransferSnapshot())
    const rootRow = divergentRoot.tables
      .find((table) => table.name === "session")
      ?.rows.find((row) => row.id === rootSessionID)
    if (!rootRow) throw new Error("Global Task transfer omitted its root Session")
    const rootMetadata = JSON.parse(String(rootRow.metadata)) as Record<string, any>
    rootMetadata.taskConfigSnapshot.permission_mode =
      rootMetadata.taskConfigSnapshot.permission_mode === "ask" ? "full_access" : "ask"
    rootRow.metadata = JSON.stringify(rootMetadata)
    expect(() => preflightMysqlTransferSnapshot(divergentRoot)).toThrow(
      expect.objectContaining({
        name: "MysqlTransferValidationError",
        data: expect.objectContaining({ message: expect.stringContaining("immutable root configuration snapshot") }),
      }),
    )
    const divergentDirectory = structuredClone(exportMysqlTransferSnapshot())
    const contractRow = divergentDirectory.tables
      .find((table) => table.name === "engine_task_creation_contract")
      ?.rows.find((row) => row.task_id === first.task_id)
    if (!contractRow) throw new Error("Global Task transfer omitted its creation contract")
    const contract = JSON.parse(String(contractRow.contract)) as Record<string, any>
    contract.resolved.directory = path.join(first.directory, "divergent")
    contractRow.contract = JSON.stringify(contract)
    expect(() => preflightMysqlTransferSnapshot(divergentDirectory)).toThrow(
      expect.objectContaining({
        name: "MysqlTransferValidationError",
        data: expect.objectContaining({ message: expect.stringContaining("resolved creation snapshot") }),
      }),
    )
  }, 120_000)

  test("equivalent padded and unpadded attachment bytes share one Global Task request", async () => {
    const requestID = Identifier.ascending("call")
    const attachment = { mime: "text/plain", filename: "one-byte.txt", data: "TQ==" }
    const first = await GlobalTaskService.create({ ...base, requestID, attachments: [attachment] })
    expect(
      await GlobalTaskService.create({
        ...base,
        requestID,
        attachments: [{ ...attachment, data: "TQ" }],
      }),
    ).toEqual(first)
  }, 120_000)

  test("shared Global Task semantic preflight rejects before allocation or Project publication", async () => {
    const channelBinding = {
      platform: "slack",
      channel: "preflight-channel",
      thread: "preflight-thread",
      payload: { revision: 1 },
    }
    await using foreign = await memoryProject("global task channel preflight owner")
    let ownerTaskID = ""
    await Instance.provide({
      directory: foreign.path,
      fn: async () => {
        ownerTaskID = await EngineService.createTask(
          { ...base, requestID: Identifier.ascending("call"), channelBinding },
          { actor: "user" },
        )
      },
    })
    await Instance.disposeAll()
    const facts = () =>
      Database.use((db) => ({
        allocations: db.select().from(GlobalCreationAllocationTable).all(),
        projects: db.select().from(ProjectTable).all(),
      }))
    const before = facts()
    const channelRequestID = Identifier.ascending("call")
    await expect(
      GlobalTaskService.create({ ...base, requestID: channelRequestID, channelBinding }),
    ).rejects.toMatchObject({
      name: "TaskChannelBindingGlobalCreationConflictError",
      data: {
        requestID: channelRequestID,
        platform: channelBinding.platform,
        channel: channelBinding.channel,
        thread: channelBinding.thread,
        taskID: ownerTaskID,
      },
    })
    expect(facts()).toEqual(before)

    const send = (body: Record<string, unknown>) =>
      Server.App().request("/global/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    const channelResponse = await send({ ...base, requestID: Identifier.ascending("call"), channelBinding })
    expect({ status: channelResponse.status, body: await channelResponse.json() }).toMatchObject({
      status: 409,
      body: { name: "TaskChannelBindingGlobalCreationConflictError" },
    })
    expect(facts()).toEqual(before)
    const profileResponse = await send({
      ...base,
      requestID: Identifier.ascending("call"),
      promptProfile: "missing-profile",
    })
    expect({ status: profileResponse.status, body: await profileResponse.json() }).toMatchObject({
      status: 400,
      body: { name: "PromptProfileNotFoundError", data: { profileID: "missing-profile", scope: "global" } },
    })
    expect(facts()).toEqual(before)

    const profileRequestID = Identifier.ascending("call")
    await expect(
      GlobalTaskService.create({ ...base, requestID: profileRequestID, promptProfile: "missing-profile" }),
    ).rejects.toMatchObject({
      name: "PromptProfileNotFoundError",
      data: { profileID: "missing-profile", scope: "global" },
    })
    expect(facts()).toEqual(before)

    const digestRequestID = Identifier.ascending("call")
    await expect(
      GlobalTaskService.create({ ...base, requestID: digestRequestID, expectedPackageDigest: "a".repeat(64) }),
    ).rejects.toMatchObject({
      name: "TaskExpectedPackageDigestConflictError",
      data: { profileID: "base", expectedPackageDigest: "a".repeat(64) },
    })
    expect(facts()).toEqual(before)
  }, 120_000)

  test("an exact Task winner from another production entry appends Global acceptance before return", async () => {
    const requestID = Identifier.ascending("call")
    let externalTaskID = ""
    using _winner = GlobalTaskService.TestHooks.replaceAfterProjectMaterialized(async ({ directory }) => {
      await Instance.provide({
        directory,
        init: InstanceBootstrap,
        fn: async () => {
          const allocation = Database.use((db) =>
            db
              .select()
              .from(GlobalCreationAllocationTable)
              .where(eq(GlobalCreationAllocationTable.request_id, requestID))
              .get(),
          )
          if (!allocation?.task_resolution) throw new Error("Global Task allocation has no frozen resolution")
          externalTaskID = await EngineService.createTask(
            { ...base, requestID },
            { actor: "user" },
            {
              taskConfigSnapshot: allocation.resolution_seed as Config.Info,
              taskResolution: allocation.task_resolution,
            },
          )
        },
      })
    })
    const result = await GlobalTaskService.create({ ...base, requestID })
    expect(result.task_id).toBe(externalTaskID)
    expect(
      Database.use((db) =>
        db
          .select({
            projectID: GlobalCreationAllocationTable.accepted_project_id,
            targetID: GlobalCreationAllocationTable.accepted_target_id,
            materializedProjectID: GlobalCreationAllocationTable.materialized_project_id,
          })
          .from(GlobalCreationAllocationTable)
          .where(eq(GlobalCreationAllocationTable.request_id, requestID))
          .get(),
      ),
    ).toEqual({ projectID: result.project_id, targetID: externalTaskID, materializedProjectID: result.project_id })
  }, 120_000)

  test("an external Task with another immutable root snapshot settles a typed Global allocation conflict", async () => {
    const requestID = Identifier.ascending("call")
    let externalTaskID = ""
    using _winner = GlobalTaskService.TestHooks.replaceAfterProjectMaterialized(async ({ directory }) => {
      await Instance.provide({
        directory,
        init: InstanceBootstrap,
        fn: async () => {
          await Config.updateProjectPatch({ permission_mode: "ask" })
          externalTaskID = await EngineService.createTask({ ...base, requestID }, { actor: "user" })
        },
      })
    })
    await expect(GlobalTaskService.create({ ...base, requestID })).rejects.toBeInstanceOf(
      GlobalCreationAcceptedTargetConflictError,
    )
    expect(
      Database.use((db) =>
        db
          .select({
            rejected: GlobalCreationAllocationTable.rejected_error,
            accepted: GlobalCreationAllocationTable.accepted_target_id,
          })
          .from(GlobalCreationAllocationTable)
          .where(eq(GlobalCreationAllocationTable.request_id, requestID))
          .get(),
      ),
    ).toEqual({
      rejected: expect.objectContaining({ name: "GlobalCreationAcceptedTargetConflictError" }),
      accepted: null,
    })
    expect(externalTaskID).toMatch(/^tsk_/)
  }, 120_000)

  test("a post-reserve channel race settles one typed terminal rejection", async () => {
    const requestID = Identifier.ascending("call")
    const channelBinding = {
      platform: "slack",
      channel: `race-${requestID}`,
      thread: "thread",
      payload: { revision: 1 },
    }
    await using foreign = await memoryProject("global task post-reserve channel winner")
    let winnerTaskID = ""
    using _race = GlobalTaskService.TestHooks.replaceAfterProjectMaterialized(async () => {
      await Instance.provide({
        directory: foreign.path,
        fn: async () => {
          winnerTaskID = await EngineService.createTask(
            { ...base, requestID: Identifier.ascending("call"), channelBinding },
            { actor: "user" },
          )
        },
      })
    })
    const attempt = () => GlobalTaskService.create({ ...base, requestID, channelBinding })
    const firstError = await attempt().then(
      () => undefined,
      (error: unknown) => error,
    )
    expect(firstError).toMatchObject({
      name: "TaskChannelBindingProjectConflictError",
      data: { taskID: winnerTaskID },
    })
    const terminal = Database.use((db) =>
      db
        .select({
          projectID: GlobalCreationAllocationTable.materialized_project_id,
          rejected: GlobalCreationAllocationTable.rejected_error,
          accepted: GlobalCreationAllocationTable.accepted_target_id,
        })
        .from(GlobalCreationAllocationTable)
        .where(eq(GlobalCreationAllocationTable.request_id, requestID))
        .get(),
    )
    expect(terminal).toMatchObject({
      projectID: expect.any(String),
      rejected: { name: "TaskChannelBindingProjectConflictError" },
      accepted: null,
    })
    await expect(attempt()).rejects.toMatchObject({
      name: "TaskChannelBindingProjectConflictError",
      data: { taskID: winnerTaskID },
    })
    expect(
      Database.use(
        (db) =>
          db
            .select({ id: GlobalCreationAllocationTable.id })
            .from(GlobalCreationAllocationTable)
            .where(eq(GlobalCreationAllocationTable.request_id, requestID))
            .all().length,
      ),
    ).toBe(1)
    await Instance.disposeAll()
    Database.transaction((db) => db.delete(ProjectTable).where(eq(ProjectTable.id, terminal!.projectID!)).run())
    expect(
      Database.use((db) => ({
        project: db
          .select({ id: ProjectTable.id })
          .from(ProjectTable)
          .where(eq(ProjectTable.id, terminal!.projectID!))
          .get(),
        rejection: db
          .select({ rejected: GlobalCreationAllocationTable.rejected_error })
          .from(GlobalCreationAllocationTable)
          .where(eq(GlobalCreationAllocationTable.request_id, requestID))
          .get(),
      })),
    ).toEqual({
      project: undefined,
      rejection: { rejected: expect.objectContaining({ name: "TaskChannelBindingProjectConflictError" }) },
    })
  }, 120_000)

  test("accepted replay follows the retained Project after anonymous promotion", async () => {
    const requestID = Identifier.ascending("call")
    const accepted = await GlobalTaskService.create({ ...base, requestID })
    await Instance.disposeAll()
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Global Task promotion replay requires the test runtime")
    const destinationParent = await createManagedTemporaryDirectory(processRoot, "global-task-promotion-")
    try {
      const promoted = await ImplicitProject.promote({
        project: Project.get(accepted.project_id),
        destinationParent,
        name: "retained-global-task",
      })
      expect(promoted.directory).not.toBe(accepted.directory)
      expect(await GlobalTaskService.create({ ...base, requestID })).toEqual({
        ...accepted,
        directory: promoted.directory,
      })
    } finally {
      await Instance.disposeAll()
      await removeManagedDirectoryTree(destinationParent)
    }
  }, 120_000)

  test("an accepted allocation remains terminal after its Task and carrying Project are retained away", async () => {
    const requestID = Identifier.ascending("call")
    const accepted = await GlobalTaskService.create({ ...base, requestID })
    await Instance.disposeAll()
    Database.transaction((db) => db.delete(ProjectTable).where(eq(ProjectTable.id, accepted.project_id)).run())

    await expect(GlobalTaskService.create({ ...base, requestID })).rejects.toMatchObject({
      name: "GlobalCreationAcceptedTargetUnavailableError",
      data: {
        requestID,
        projectID: accepted.project_id,
        targetID: accepted.task_id,
      },
    })
    expect(
      Database.use((db) =>
        db
          .select({ targetID: GlobalCreationAllocationTable.accepted_target_id })
          .from(GlobalCreationAllocationTable)
          .where(eq(GlobalCreationAllocationTable.request_id, requestID))
          .get(),
      ),
    ).toEqual({ targetID: accepted.task_id })
    const retainedAccepted = Database.use((db) =>
      db
        .select()
        .from(GlobalCreationAllocationTable)
        .where(eq(GlobalCreationAllocationTable.request_id, requestID))
        .get(),
    )
    if (!retainedAccepted?.task_resolution) throw new Error("Accepted Global Task omitted its frozen resolution")
    const rejectedRequestID = Identifier.ascending("call")
    const rejectedAllocation = GlobalCreationAllocation.reserve({
      kind: "global_task",
      requestID: rejectedRequestID,
      requestContract: retainedAccepted.request_contract,
      resolutionSeed: retainedAccepted.resolution_seed,
      taskResolution: retainedAccepted.task_resolution,
    })
    const rejectedProject = await GlobalCreationAllocation.materializeProject(rejectedAllocation)
    expect(
      GlobalCreationAllocation.reject({
        allocationID: rejectedAllocation.id,
        error: new TaskChannelBindingProjectConflictError({
          message: "retained rejection",
          platform: "slack",
          channel: "retained",
          thread: "retained",
          taskID: "retained-winner",
          projectID: "retained-winner-project",
          activeProjectID: rejectedProject.project.id,
        }),
      }),
    ).toBe("rejected")
    Database.transaction((db) => db.delete(ProjectTable).where(eq(ProjectTable.id, rejectedProject.project.id)).run())
    expect(
      Database.allFinalized<{ terminal: string }>(
        `SELECT CASE
           WHEN allocation.accepted_target_id IS NOT NULL THEN 'accepted'
           WHEN allocation.rejected_error IS NOT NULL THEN 'rejected'
           ELSE 'pending'
         END AS terminal
         FROM global_creation_allocation AS allocation
         LEFT JOIN project ON project.id=allocation.materialized_project_id
         WHERE allocation.materialized_project_id IS NOT NULL AND project.id IS NULL
         ORDER BY terminal`,
      ).map((row) => row.terminal),
    ).toEqual(expect.arrayContaining(["accepted", "rejected"]))
    await Database.awaitEffectIdle(10_000)
    const retainedSnapshot = exportMysqlTransferSnapshot()
    expect(preflightMysqlTransferSnapshot(retainedSnapshot)).toMatchObject({
      schemaFingerprint: retainedSnapshot.schemaFingerprint,
    })
    expect(importMysqlTransferSnapshot(retainedSnapshot)).toMatchObject({ ok: true })
    expect(
      Database.use((db) =>
        db
          .select({ retainedAt: GlobalCreationAllocationTable.time_project_retained })
          .from(GlobalCreationAllocationTable)
          .where(eq(GlobalCreationAllocationTable.request_id, rejectedRequestID))
          .get(),
      ),
    ).toEqual({ retainedAt: expect.any(Number) })
  }, 120_000)

  test("an accepted Task tombstone replays as one stable unavailable terminal", async () => {
    const requestID = Identifier.ascending("call")
    const accepted = await GlobalTaskService.create({ ...base, requestID })
    Database.immediateTransaction((db) => {
      const seq =
        db
          .select({ seq: ProtocolEventTable.seq })
          .from(ProtocolEventTable)
          .where(eq(ProtocolEventTable.aggregate_id, accepted.task_id))
          .all()
          .reduce((maximum, event) => Math.max(maximum, event.seq), 0) + 1
      db.insert(ProtocolEventTable)
        .values({
          id: Identifier.ascending("protocol_event"),
          kind: "event",
          type: "task.deleted",
          aggregate_type: "task",
          aggregate_id: accepted.task_id,
          project_id: accepted.project_id,
          source: "task.delete",
          seq,
          emitted_at: Date.now(),
          payload: { executionEpoch: 1, summary: "Task deleted" },
        })
        .run()
    })
    await expect(GlobalTaskService.create({ ...base, requestID })).rejects.toMatchObject({
      name: "GlobalCreationAcceptedTargetUnavailableError",
      data: { requestID, projectID: accepted.project_id, targetID: accepted.task_id },
    })
  }, 120_000)

  test("every caller semantic family conflicts against the pre-Task allocation contract", async () => {
    const requestID = Identifier.ascending("call")
    const allocationCut = new Error("stop after durable allocation")
    using _cut = GlobalTaskService.TestHooks.replaceAfterAllocation(() => {
      throw allocationCut
    })
    await expect(GlobalTaskService.create({ ...base, requestID })).rejects.toBe(allocationCut)
    _cut[Symbol.dispose]()

    const frozenResolution = Database.use((db) =>
      db
        .select({ value: GlobalCreationAllocationTable.task_resolution })
        .from(GlobalCreationAllocationTable)
        .where(eq(GlobalCreationAllocationTable.request_id, requestID))
        .get(),
    )
    expect(() =>
      Database.Client().run(
        `UPDATE global_creation_allocation SET task_resolution='{}' WHERE request_id='${requestID}'`,
      ),
    ).toThrow()
    expect(
      Database.use((db) =>
        db
          .select({ value: GlobalCreationAllocationTable.task_resolution })
          .from(GlobalCreationAllocationTable)
          .where(eq(GlobalCreationAllocationTable.request_id, requestID))
          .get(),
      ),
    ).toEqual(frozenResolution)

    const variants = [
      { request: `${base.request} changed` },
      { title: `${base.title} changed` },
      { source: "changed-source" },
      { productPillar: "work" as const },
      { attachments: [{ mime: "text/plain", data: Buffer.from("changed").toString("base64") }] },
      { model: "global-replay-provider/global-replay-model" },
      { priority: "high" as const },
      { promptProfile: "base-researcher" },
      { expectedPackageDigest: "a".repeat(64) },
      { budget: { maxExecutorGroups: 2 } },
      { checks: { test: ["bun test focused"] } },
      { channelBinding: { platform: "slack", channel: "channel", thread: "thread", payload: { revision: 2 } } },
    ]
    for (const variant of variants) {
      await expect(GlobalTaskService.create({ ...base, requestID, ...variant })).rejects.toBeInstanceOf(
        GlobalCreationAllocationConflictError,
      )
    }
  }, 120_000)

  test("a peer continues the exact allocation after the owner process dies before Task commit", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Global Task process test requires the repository test runtime")
    const runtime = await createManagedTemporaryDirectory(processRoot, "global-task-allocation-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "global-task-allocation-barrier-")
    const requestID = Identifier.ascending("call")
    const worker = path.join(import.meta.dir, "fixture", "global-task-request-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime, OPENCORVUS_TEST_PROCESS_ROOT: processRoot }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: string, occurrenceID = requestID) => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
          worker,
          mode,
          barrier,
          occurrenceID,
        ],
        { cwd: path.join(import.meta.dir, ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      expect(exitCode, stderr).toBe(0)
      const line = stdout
        .trim()
        .split(/\r?\n/)
        .findLast((candidate) => candidate.startsWith("{"))
      if (!line) throw new Error(`Global Task worker returned no JSON: ${stderr || stdout}`)
      return JSON.parse(line) as any
    }
    try {
      expect(await read(spawn("init"))).toEqual({ initialized: true })
      const owner = spawn("cut")
      const ready = path.join(barrier, "allocation.ready.json")
      const deadline = Date.now() + 30_000
      while (!(await fs.stat(ready).catch(() => undefined))) {
        if (Date.now() >= deadline) throw new Error("Global Task owner did not persist its allocation")
        await Bun.sleep(10)
      }
      const allocated = JSON.parse(await fs.readFile(ready, "utf8")) as { directory: string }
      owner.kill()
      await owner.exited
      await Bun.sleep(250)
      const before = await read(spawn("inspect"))
      expect(before).toMatchObject({ allocations: [{ directory: allocated.directory }], tasks: [], projectCount: 0 })

      const recovered = await read(spawn("recover"))
      expect(recovered).toMatchObject({
        result: { directory: allocated.directory },
        allocations: [{ directory: allocated.directory }],
        tasks: [{ id: recovered.result.task_id, projectID: recovered.result.project_id }],
        projectCount: 1,
      })

      const committedRequestID = Identifier.ascending("call")
      const committedOwner = spawn("cut-committed", committedRequestID)
      const [committedStderr, committedExit] = await Promise.all([
        new Response(committedOwner.stderr).text(),
        committedOwner.exited,
      ])
      expect(committedExit, committedStderr).toBe(88)
      const projected = await read(spawn("recover", committedRequestID))
      expect(projected).toMatchObject({
        result: { task_id: projected.result.task_id, project_id: projected.result.project_id },
        tasks: [{ id: projected.result.task_id, projectID: projected.result.project_id }],
        projectCount: 2,
      })
      expect(projected.intent).toContain("Create exactly one Task after allocation-owner death")

      const resolvedRequestID = Identifier.ascending("call")
      const resolvedOwner = spawn("cut-resolved", resolvedRequestID)
      const [resolvedStderr, resolvedExit] = await Promise.all([
        new Response(resolvedOwner.stderr).text(),
        resolvedOwner.exited,
      ])
      expect(resolvedExit, resolvedStderr).toBe(89)
      const frozen = await read(spawn("inspect", resolvedRequestID))
      expect(frozen).toMatchObject({
        tasks: [],
        allocations: [
          {
            projectID: null,
            materializedProjectID: expect.any(String),
            materializedProjectGeneration: expect.stringMatching(/^[0-9a-f-]{36}$/),
            targetID: null,
            taskResolution: {
              protocol: "task-creation-resolution-seed-v1",
              selected_profile_id: "base",
              package_revision: { packageDigest: expect.stringMatching(/^[a-f0-9]{64}$/) },
              process_mode: "native",
            },
          },
        ],
        projectCount: 3,
      })
      expect(await read(spawn("delete-materialized", resolvedRequestID))).toMatchObject({
        deletionError: expect.stringContaining("pending global creation allocation owns this Project"),
        tasks: [],
        allocations: [
          {
            materializedProjectID: frozen.allocations[0].materializedProjectID,
            materializedProjectGeneration: frozen.allocations[0].materializedProjectGeneration,
            targetID: null,
          },
        ],
        projectCount: 3,
      })
      expect(await read(spawn("mutate-defaults", resolvedRequestID))).toEqual({ mutated: true })
      const resolvedRecovery = await read(spawn("recover", resolvedRequestID))
      expect(resolvedRecovery).toMatchObject({
        result: {
          task_id: resolvedRecovery.result.task_id,
          project_id: frozen.allocations[0].materializedProjectID,
        },
        allocations: [
          {
            materializedProjectID: frozen.allocations[0].materializedProjectID,
            materializedProjectGeneration: frozen.allocations[0].materializedProjectGeneration,
            projectID: frozen.allocations[0].materializedProjectID,
            targetID: resolvedRecovery.result.task_id,
          },
        ],
        projectCount: 3,
        contracts: [
          {
            taskID: resolvedRecovery.result.task_id,
            contract: {
              resolved: {
                prompt_profile_id: "base",
                package_revision: {
                  id: "base",
                  package_digest: frozen.allocations[0].taskResolution.package_revision.packageDigest,
                },
              },
            },
          },
        ],
      })
    } finally {
      for (const child of children) if (child.exitCode === null) child.kill()
      await Promise.allSettled(children.map((child) => child.exited))
      await removeManagedDirectoryTree(runtime)
      await removeManagedDirectoryTree(barrier)
    }
  }, 240_000)
})
