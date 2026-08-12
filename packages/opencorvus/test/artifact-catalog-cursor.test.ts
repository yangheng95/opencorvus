import { afterEach, describe, expect, test } from "bun:test"
import { EngineArtifactEnvelopeSchema } from "@opencorvus-ai/plugin"
import { artifactCatalogAuthority, searchTaskArtifacts } from "../src/artifact-catalog"
import { recordEngineArtifact } from "../src/engine/artifact"
import { persistQueuedTask } from "../src/engine/pipeline"
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
  const session = await Session.create({
    kind: "root",
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
  persistQueuedTask({
    taskID,
    sessionID: session.id,
    now,
    title: "Artifact cursor contract",
    request: "Prove compact frozen pagination.",
    productPillar: "work",
    source: "test",
    priority: "normal",
    metadata: {},
    projectID: Instance.project.id,
    queue: true,
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

function mutateOneCanonicalCursorCharacter(cursor: string) {
  const originalWire = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown[]
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
  for (let index = 0; index < cursor.length; index += 1) {
    for (const replacement of alphabet) {
      if (replacement === cursor[index]) continue
      const candidate = `${cursor.slice(0, index)}${replacement}${cursor.slice(index + 1)}`
      const bytes = Buffer.from(candidate, "base64url")
      if (bytes.toString("base64url") !== candidate) continue
      let candidateWire: unknown
      try {
        candidateWire = JSON.parse(bytes.toString("utf8"))
      } catch {
        continue
      }
      if (!Array.isArray(candidateWire) || candidateWire.length !== originalWire.length) continue
      if (Buffer.from(JSON.stringify(candidateWire), "utf8").toString("base64url") !== candidate) continue
      const changedFields = originalWire.flatMap((value, field) =>
        JSON.stringify(value) === JSON.stringify(candidateWire[field]) ? [] : [field],
      )
      if (
        changedFields.length === 1 &&
        (changedFields[0] === 6 || changedFields[0] === 7) &&
        typeof candidateWire[changedFields[0]] === "number" &&
        Number.isInteger(candidateWire[changedFields[0]]) &&
        (candidateWire[changedFields[0]] as number) >= 0
      ) {
        return candidate
      }
    }
  }
  throw new Error("Cursor fixture has no one-character canonical total mutation")
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
        const transported = await tool.execute(
          { ...search, limit: 100 },
          {
            toolCallId: "artifact-search-cursor-contract",
            messages: [],
            abortSignal: new AbortController().signal,
            opencorvus: { sessionID: session.id },
          } as never,
        )
        const transportedPage = JSON.parse(transported.output) as typeof first
        expect(transported.metadata).toMatchObject({ filteredTotal: 50, hasMore: true })
        expect(transportedPage.entries).toHaveLength(25)
        expect(Buffer.byteLength(transported.output, "utf8")).toBeLessThanOrEqual(40 * 1_024)
        expect(transportedPage.next_cursor).toEqual(expect.any(String))
        expect(transportedPage.next_cursor!.length).toBeLessThan(600)

        publishCursorArtifact(taskID, 50)
        const transportedSecond = await tool.execute(
          { ...search, limit: 100, cursor: transportedPage.next_cursor! },
          {
            toolCallId: "artifact-search-cursor-contract-next",
            messages: [],
            abortSignal: new AbortController().signal,
            opencorvus: { sessionID: session.id },
          } as never,
        )
        const second = JSON.parse(transportedSecond.output) as typeof first
        const frozenIDs = [...transportedPage.entries, ...second.entries].map((entry) => entry.locator)

        expect(second).toMatchObject({ filtered_total: 50, catalog_complete: true, next_cursor: null })
        expect(second.entries).toHaveLength(25)
        expect(new Set(frozenIDs.map((locator) => JSON.stringify(locator))).size).toBe(50)

        const refreshed = await searchTaskArtifacts({
          authority: artifactCatalogAuthority(taskID),
          search: { ...search, limit: 100 },
        })
        expect(refreshed).toMatchObject({ filtered_total: 51, next_cursor: null })
        expect(refreshed.entries).toHaveLength(51)

        const oneCharacterMutation = mutateOneCanonicalCursorCharacter(first.next_cursor!)
        expect(
          [...first.next_cursor!].filter((character, index) => character !== oneCharacterMutation[index]),
        ).toHaveLength(1)
        await expect(
          searchTaskArtifacts({
            authority: artifactCatalogAuthority(taskID),
            search: { ...search, cursor: oneCharacterMutation },
          }),
        ).rejects.toThrow("artifact_search cursor integrity check failed")

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
