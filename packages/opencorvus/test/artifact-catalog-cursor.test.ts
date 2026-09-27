import { afterEach, describe, expect, test } from "bun:test"
import { EngineArtifactEnvelopeSchema } from "@opencorvus-ai/plugin"
import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { artifactCatalogAuthority, searchTaskArtifacts } from "../src/artifact-catalog"
import { recordEngineArtifact } from "../src/engine/artifact"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { createArtifactSearchAiTool } from "../src/tool/artifact-catalog"
import { createTaskArtifactStoreExecution } from "../src/task-artifact/store"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import type { TaskToolExecutionScope } from "../src/tool/task-tool-execution-scope"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await resetMemoryDatabase()
})

async function createCatalogTask() {
  const session = Session.prepareRootNext({
    kind: "root",
    directory: Instance.directory,
    title: "Artifact cursor contract",
    metadata: {
      configOverlay: {
        model: "openai/gpt-5.6-sol",
        prompt_profile: { active: "cursor-contract" },
      },
    },
  })
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const packageDigest = "a".repeat(64)
  persistTask({
    taskID,
    rootSession: session,
    now,
    title: "Artifact cursor contract",
    request: "Prove compact frozen pagination.",
    productPillar: "work",
    source: "test",
    priority: "normal",
    metadata: {},
    projectID: Instance.project.id,
    packageRevision: {
      scope: "built_in",
      projectID: null,
      namespace: "test",
      id: "cursor-contract",
      version: "2026.08.09.1",
      packageDigest,
    },
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: Instance.directory,
      packageRevisionSHA256: packageDigest,
      timeCreated: now,
    }),
  })
  return { session, taskID }
}

function publishCursorArtifact(taskID: string, index: number) {
  return recordEngineArtifact({
    taskID,
    kind: "expert_output",
    label: `Cursor item ${index.toString().padStart(2, "0")} ${"x".repeat(480)}`,
    payload: EngineArtifactEnvelopeSchema.parse({
      artifact_type: "cursor-contract/item",
      schema_version: 1,
      producer: {
        owner_kind: "core",
        component_id: "artifact-cursor-test",
        operation_id: `publish-${index}`,
      },
      payload: { index },
      resources: [],
      observed_artifact_locators: [],
      source_artifact_locators: [],
    }),
  })
}

async function publishCatalogFile(taskID: string, sessionID: string) {
  const files = createTaskArtifactStoreExecution({
    kind: "task",
    projectID: Instance.project.id,
    projectDirectory: Instance.directory,
    taskID,
    taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(Instance.directory, taskID),
    sessionID,
    messageID: "message-cursor-files",
    toolCallID: "call-cursor-files",
    toolPartID: "part-cursor-files",
    executionSurface: {},
    owner: {
      kind: "projected-worker",
      expertSquadID: "cursor-contract",
      packageRevision: {
        scope: "built_in",
        projectID: null,
        namespace: "test",
        id: "cursor-contract",
        version: "2026.08.09.1",
        packageDigest: "a".repeat(64),
      },
      agentID: "cursor-worker",
      projectionHash: "b".repeat(64),
      workerTurnDescriptorID: "descriptor-cursor-files",
      workerTurnDescriptorHash: "c".repeat(64),
    },
  } as unknown as TaskToolExecutionScope)
  const stage = await files.stage({ trees: ["resources"] })
  await writeFile(path.join(stage.treeDirectories.resources!, "metrics.json"), "{}")
  await files.publish(stage, {
    snapshot_kind: "catalog",
    files: [{ tree: "resources", path: "metrics.json", media_type: "application/json" }],
  })
  await files.close()
}

function forgeCursorWithRecomputedPublicDigest(cursor: string) {
  const wire = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown[]
  wire[7] = Number(wire[7]) + 1
  const payload = wire.slice(0, 12)
  wire[12] = createHash("sha256").update(JSON.stringify(payload)).digest("base64url")
  return Buffer.from(JSON.stringify(wire), "utf8").toString("base64url")
}

describe("Artifact catalog cursor", () => {
  test("uses one compact strict cursor to complete a frozen 50-entry catalog", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { session, taskID } = await createCatalogTask()
        for (let index = 0; index < 50; index += 1) publishCursorArtifact(taskID, index)
        const search = {
          artifact_types: ["cursor-contract/item"],
          sources: ["engine_artifact" as const],
          kinds: ["expert_output", "task_artifact_snapshot"],
          version_scope: "all" as const,
          sort: "oldest" as const,
          limit: 25,
        }
        const first = await searchTaskArtifacts({ authority: artifactCatalogAuthority(taskID), search })

        expect(first).toMatchObject({
          catalog_total: expect.any(Number),
          filtered_total: 50,
          catalog_complete: true,
        })
        expect(first.entries).toHaveLength(25)
        expect(first.next_cursor).toEqual(expect.any(String))
        expect(first.next_cursor!.length).toBeLessThan(600)

        const tool = createArtifactSearchAiTool(taskID)
        if (!tool.execute) throw new Error("artifact_search AI Tool is missing its execution boundary")
        const transported = await tool.execute({ queries: [search] }, {
          toolCallId: "artifact-search-cursor-contract",
          messages: [],
          abortSignal: new AbortController().signal,
          opencorvus: { sessionID: session.id },
        } as never)
        const batch = JSON.parse(transported.output)
        const transportedPage = batch.results[0].value
        expect(batch).toMatchObject({ complete: false, results: [{ request_index: 0, value: { filtered_total: 50 } }] })
        expect(transportedPage.entries).toHaveLength(25)
        expect(Buffer.byteLength(transported.output, "utf8")).toBeLessThanOrEqual(40 * 1_024)
        expect(batch.next_queries).toEqual([{ request_index: 0, cursor: expect.any(String) }])
        expect(batch.next_queries[0].cursor.length).toBeLessThan(600)

        publishCursorArtifact(taskID, 50)
        await publishCatalogFile(taskID, session.id)
        const transportedSecond = await tool.execute({ queries: [{ ...search, cursor: batch.next_queries[0].cursor }] }, {
          toolCallId: "artifact-search-cursor-contract-next",
          messages: [],
          abortSignal: new AbortController().signal,
          opencorvus: { sessionID: session.id },
        } as never)
        const secondBatch = JSON.parse(transportedSecond.output)
        const second = secondBatch.results[0].value
        const frozenIDs = [...transportedPage.entries, ...second.entries].map((entry) => entry.locator)

        expect(secondBatch).toMatchObject({ complete: true, next_queries: [], pending_queries: [] })
        expect(second).toMatchObject({ filtered_total: 50, catalog_complete: true })
        expect(second.resolution).toEqual(transportedPage.resolution)
        expect(second.entries).toHaveLength(25)
        expect(Buffer.byteLength(transportedSecond.output, "utf8")).toBeLessThanOrEqual(40 * 1_024)
        expect(new Set(frozenIDs.map((locator) => JSON.stringify(locator))).size).toBe(50)

        const refreshed = await searchTaskArtifacts({
          authority: artifactCatalogAuthority(taskID),
          search: { ...search, limit: 100 },
        })
        expect(refreshed).toMatchObject({ filtered_total: 51, next_cursor: null })
        expect(refreshed.entries).toHaveLength(51)

        const forged = forgeCursorWithRecomputedPublicDigest(first.next_cursor!)
        await expect(
          searchTaskArtifacts({
            authority: artifactCatalogAuthority(taskID),
            search: { ...search, cursor: forged },
          }),
        ).rejects.toThrow("artifact_search cursor authenticity check failed")

        await expect(
          searchTaskArtifacts({
            authority: artifactCatalogAuthority(taskID),
            search: { ...search, labels: ["different-filter"], cursor: first.next_cursor! },
          }),
        ).rejects.toThrow("artifact_search cursor does not belong to the supplied filters")

        const otherTask = await createCatalogTask()
        await expect(
          searchTaskArtifacts({
            authority: artifactCatalogAuthority(otherTask.taskID),
            search: { ...search, cursor: first.next_cursor! },
          }),
        ).rejects.toThrow("artifact_search cursor belongs to another Task authority")

        await expect(
          searchTaskArtifacts({
            authority: artifactCatalogAuthority(taskID),
            search: { ...search, cursor: first.next_cursor!.slice(0, -1) },
          }),
        ).rejects.toThrow(/artifact_search cursor/)
      },
    })
  })

  test("transports the exact requested-source scope for a filtered lookup", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { session, taskID } = await createCatalogTask()
        // The Task also holds files, as the diagnostic Task held its inputs.
        await publishCatalogFile(taskID, session.id)
        recordEngineArtifact({
          taskID,
          kind: "expert_output",
          label: "Data analysis audit",
          payload: EngineArtifactEnvelopeSchema.parse({
            artifact_type: "cursor-contract/audit",
            schema_version: 1,
            producer: { owner_kind: "core", component_id: "artifact-cursor-test", operation_id: "publish-audit" },
            payload: { verdict: "clean" },
            resources: [],
            observed_artifact_locators: [],
            source_artifact_locators: [],
          }),
        })
        const authority = artifactCatalogAuthority(taskID)
        // The G60 report writer's first query: an Engine type limited to the
        // file catalog. The type exists in this Task, just not in that source.
        const tool = createArtifactSearchAiTool(taskID)
        if (!tool.execute) throw new Error("artifact_search AI Tool is missing its execution boundary")
        const transported = await tool.execute({ queries: [{ sources: ["task_artifact"], artifact_types: ["cursor-contract/audit"], version_scope: "all", sort: "oldest", limit: 100 }] }, {
          toolCallId: "artifact-search-requested-scope", messages: [], abortSignal: new AbortController().signal,
          opencorvus: { sessionID: session.id },
        } as never)
        const excluded = JSON.parse(transported.output).results[0].value
        expect({
          scope: excluded.resolution.scope,
          filtered: excluded.filtered_total,
          status: excluded.resolution.status,
          unmatched: excluded.resolution.unmatched_filters.artifact_types,
          intersectionEmpty: excluded.resolution.filter_intersection_empty,
        }).toEqual({ scope: { sources: ["task_artifact"], version_scope: "all" }, filtered: 0, status: "no_match", unmatched: ["cursor-contract/audit"], intersectionEmpty: false })
        const absent = await searchTaskArtifacts({
          authority,
          search: { sources: ["task_artifact"], artifact_types: ["cursor-contract/missing"], version_scope: "all", sort: "oldest", limit: 100 },
        })
        expect({
          unmatched: absent.resolution.unmatched_filters.artifact_types,
          intersectionEmpty: absent.resolution.filter_intersection_empty,
        }).toEqual({ unmatched: ["cursor-contract/missing"], intersectionEmpty: false })
        const found = await searchTaskArtifacts({
          authority,
          search: { artifact_types: ["cursor-contract/audit"], version_scope: "all", sort: "oldest", limit: 100 },
        })
        expect({ filtered: found.filtered_total, status: found.resolution.status }).toEqual({ filtered: 1, status: "unique_candidate" })
        expect(excluded.catalog_total).toBeGreaterThan(0)
      },
    })
  })
})
