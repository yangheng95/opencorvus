import { afterEach, describe, expect, test } from "bun:test"
import { EngineArtifactEnvelopeSchema } from "@opencorvus-ai/plugin"
import { createHash } from "node:crypto"
import { artifactCatalogAuthority, searchTaskArtifacts } from "../src/artifact-catalog"
import { recordEngineArtifact } from "../src/engine/artifact"
import { persistEstablishedTask as persistTask } from "./fixture/engine-task"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { createArtifactSearchAiTool } from "../src/tool/artifact-catalog"
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
        const transported = await tool.execute({ ...search, limit: 100 }, {
          toolCallId: "artifact-search-cursor-contract",
          messages: [],
          abortSignal: new AbortController().signal,
          opencorvus: { sessionID: session.id },
        } as never)
        const transportedPage = JSON.parse(transported.output) as typeof first
        expect(transported.metadata).toMatchObject({ filteredTotal: 50, hasMore: true })
        expect(transportedPage.entries).toHaveLength(25)
        expect(Buffer.byteLength(transported.output, "utf8")).toBeLessThanOrEqual(40 * 1_024)
        expect(transportedPage.next_cursor).toEqual(expect.any(String))
        expect(transportedPage.next_cursor!.length).toBeLessThan(600)

        publishCursorArtifact(taskID, 50)
        const transportedSecond = await tool.execute({ ...search, limit: 100, cursor: transportedPage.next_cursor! }, {
          toolCallId: "artifact-search-cursor-contract-next",
          messages: [],
          abortSignal: new AbortController().signal,
          opencorvus: { sessionID: session.id },
        } as never)
        const second = JSON.parse(transportedSecond.output) as typeof first
        const frozenIDs = [...transportedPage.entries, ...second.entries].map((entry) => entry.locator)

        expect(second).toMatchObject({ filtered_total: 50, catalog_complete: true, next_cursor: null })
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
  }, 0)
})
