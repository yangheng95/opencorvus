import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import {
  artifactCatalogAuthority,
  exactEngineArtifactLocator,
  readTaskArtifact,
  searchTaskArtifacts,
} from "../../src/artifact-catalog"
import { projectDeclaredTurnOutputs, resolveCompletionArtifactEntries } from "../../src/conversation/turn-artifacts"
import { recordEngineArtifact } from "../../src/engine/artifact"
import { EngineTaskTable } from "../../src/engine/engine.sql"
import { recordDesignResourceManifest } from "../../src/frontend-design/design-resource-manifest"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import { Session } from "../../src/session"
import { Database } from "../../src/storage/db"
import { createTaskArtifactStoreExecution } from "../../src/task-artifact/store"
import { createToolExecutionSurface } from "../../src/tool/execution-surface"
import type { TaskToolExecutionScope } from "../../src/tool/task-tool-execution-scope"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

async function taskFixture(directory: string): Promise<{ taskID: string; scope: TaskToolExecutionScope }> {
  return Instance.provide({
    directory,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Declared output projection" })
      const taskID = Identifier.ascending("task")
      const now = Date.now()
      Database.use((db) =>
        db
          .insert(EngineTaskTable)
          .values({
            id: taskID,
            project_id: Instance.project.id,
            session_id: session.id,
            source: "test",
            product_pillar: "code",
            title: "Project Agent outputs",
            request: "Project exact Agent-declared outputs",
            priority: "normal",
            time_started: now,
            time_created: now,
            time_updated: now,
          })
          .run(),
      )
      return {
        taskID,
        scope: Object.freeze({
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: directory,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(directory, taskID),
          sessionID: session.id,
          messageID: Identifier.ascending("message"),
          toolCallID: Identifier.ascending("tool"),
          toolPartID: Identifier.ascending("part"),
          executionSurface: createToolExecutionSurface({
            toolIDs: ["artifact_snapshot", "artifact_publish"],
            permission: [],
          }),
          owner: Object.freeze({
            kind: "projected-worker",
            expertSquadID: "base",
            packageRevision: {
              scope: "built_in",
              projectID: null,
              namespace: "builtin",
              id: "base",
              version: "1.0.0",
              packageDigest: "c".repeat(64),
            },
            agentID: "base-developer",
            projectionHash: "a".repeat(64),
          }),
        }),
      }
    },
  })
}

async function publishFiles(scope: TaskToolExecutionScope) {
  const files = [
    { path: "docs/result.md", mediaType: "text/markdown", bytes: Buffer.from("# Result\n") },
    { path: "src/result.ts", mediaType: "text/plain", bytes: Buffer.from("export const result = true\n") },
  ] as const
  const store = createTaskArtifactStoreExecution(scope)
  try {
    const stage = await store.stage({ trees: ["deliverables"] })
    for (const file of files) {
      const target = path.join(stage.treeDirectories.deliverables!, file.path)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, file.bytes)
    }
    return await store.publish(stage, {
      snapshot_kind: "catalog",
      files: files.map((file) => ({ tree: "deliverables", path: file.path, media_type: file.mediaType })),
    })
  } finally {
    await store.close()
  }
}

async function publishResourceBatch(scope: TaskToolExecutionScope, prefix: string, count: number) {
  const files = Array.from({ length: count }, (_, index) => ({
    path: `${prefix}/resource-${index.toString().padStart(2, "0")}.txt`,
    mediaType: "text/plain",
    bytes: Buffer.from(`${prefix}-${index}\n`),
  }))
  const store = createTaskArtifactStoreExecution(scope)
  try {
    const stage = await store.stage({ trees: ["deliverables"] })
    for (const file of files) {
      const target = path.join(stage.treeDirectories.deliverables!, file.path)
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, file.bytes)
    }
    return await store.publish(stage, {
      snapshot_kind: "catalog",
      files: files.map((file) => ({ tree: "deliverables", path: file.path, media_type: file.mediaType })),
    })
  } finally {
    await store.close()
  }
}

describe("Conversation Agent-declared output projection", () => {
  test("keeps Task Artifact resource membership frozen across paginated catalog reads", async () => {
    await using project = await memoryProject()
    const task = await taskFixture(project.path)
    await publishResourceBatch(task.scope, "initial", 30)

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const authority = artifactCatalogAuthority(task.taskID)
        const search = {
          kinds: ["task_artifact_resource" as const],
          version_scope: "all" as const,
          sort: "oldest" as const,
          limit: 10,
        }
        const first = await searchTaskArtifacts({ authority, search })
        expect(first).toMatchObject({ filtered_total: 30, catalog_complete: true })
        expect(first.entries).toHaveLength(10)
        expect(first.next_cursor).toEqual(expect.any(String))

        await publishResourceBatch(task.scope, "later", 1)
        const frozenEntries = [...first.entries]
        let cursor = first.next_cursor
        while (cursor) {
          const page = await searchTaskArtifacts({ authority, search: { ...search, cursor } })
          expect(page.filtered_total).toBe(30)
          frozenEntries.push(...page.entries)
          cursor = page.next_cursor
        }
        expect(frozenEntries).toHaveLength(30)
        expect(
          frozenEntries.every(
            (entry) => entry.locator.source === "task_artifact_resource" && entry.locator.ref.path.startsWith("initial/"),
          ),
        ).toBe(true)

        const refreshed = await searchTaskArtifacts({ authority, search: { ...search, limit: 100 } })
        expect(refreshed).toMatchObject({ filtered_total: 31, next_cursor: null })
        expect(refreshed.entries).toHaveLength(31)
      },
    })
  })

  test("preserves every selected producer declaration when their exact resources repeat", async () => {
    await using project = await memoryProject()
    const task = await taskFixture(project.path)
    const publication = await publishFiles(task.scope)
    const engineLocators = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const implementationArtifactID = recordEngineArtifact({
          taskID: task.taskID,
          kind: "expert_output",
          label: "Implementation delivery",
          payload: {
            artifact_type: "base/development-report",
            schema_version: 1,
            producer: publication.manifest.producer,
            payload: {
              changed_paths: publication.artifacts.map((resource) => resource.path),
              implemented_behavior: "Projects exact producer-declared outputs.",
            },
            resources: publication.artifacts,
            observed_artifact_locators: [],
            source_artifact_locators: [],
          },
        })
        const reviewArtifactID = recordEngineArtifact({
          taskID: task.taskID,
          kind: "expert_output",
          label: "Review delivery",
          payload: {
            artifact_type: "base/review-report",
            schema_version: 1,
            producer: {
              ...publication.manifest.producer,
              agent_id: "base-reviewer",
              projection_hash: "b".repeat(64),
            },
            payload: { verdict: "accepted" },
            resources: publication.artifacts,
            observed_artifact_locators: [],
            source_artifact_locators: [],
          },
        })
        return [
          exactEngineArtifactLocator({ taskID: task.taskID, artifactID: implementationArtifactID }),
          exactEngineArtifactLocator({ taskID: task.taskID, artifactID: reviewArtifactID }),
        ]
      },
    })
    const snapshotLocator = { source: "task_artifact_snapshot" as const, snapshot: publication.snapshot }

    const outputs = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const page = await searchTaskArtifacts({
          authority: artifactCatalogAuthority(task.taskID),
          search: { version_scope: "all", sort: "oldest", limit: 100 },
        })
        const locators = [...engineLocators, snapshotLocator]
        return projectDeclaredTurnOutputs({
          taskID: task.taskID,
          locators,
          entries: resolveCompletionArtifactEntries(task.taskID, locators, page.entries),
        })
      },
    })

    expect(outputs).toHaveLength(3)
    expect(outputs.map((output) => output.resources.map((resource) => resource.path))).toEqual([
      ["docs/result.md", "src/result.ts"],
      ["docs/result.md", "src/result.ts"],
      ["docs/result.md", "src/result.ts"],
    ])
    expect(
      outputs.map((output) =>
        output.producer?.owner_kind === "projected-worker" ? output.producer.agent_id : "unknown",
      ),
    ).toEqual(["base-developer", "base-reviewer", "base-developer"])
    expect(outputs.map((output) => output.label)).toEqual([
      "Implementation delivery",
      "Review delivery",
      expect.any(String),
    ])
  })

  test("projects one exact directly selected resource and one resource-free structured result", async () => {
    await using project = await memoryProject()
    const task = await taskFixture(project.path)
    const publication = await publishFiles(task.scope)
    const [structuredLocator, rawCoreLocator] = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const structuredArtifactID = recordEngineArtifact({
          taskID: task.taskID,
          kind: "expert_output",
          label: "Decision summary",
          payload: {
            artifact_type: "base/decision-summary",
            schema_version: 1,
            producer: publication.manifest.producer,
            payload: { verdict: "accepted" },
            resources: [],
            observed_artifact_locators: [],
            source_artifact_locators: [],
          },
        })
        const rawCoreArtifactID = recordDesignResourceManifest({
          taskID: task.taskID,
          manifest: {
            version: 1,
            task_id: task.taskID,
            created_at: 1,
            entries: [
              {
                id: "design-reference",
                kind: "image",
                intent: "visual_reference",
                origin: "material",
                mime: "image/png",
                sha256: "a".repeat(64),
                canonical_ref: "material://design-reference.png",
                size: 1,
                materializer: "conversation-turn-declared-outputs-test",
                related_entries: [],
                artifact_paths: [],
                created_at: 1,
              },
            ],
          },
        })
        return [
          exactEngineArtifactLocator({ taskID: task.taskID, artifactID: structuredArtifactID }),
          exactEngineArtifactLocator({ taskID: task.taskID, artifactID: rawCoreArtifactID }),
        ]
      },
    })
    const resourceLocator = { source: "task_artifact_resource" as const, ref: publication.artifacts[1]! }

    const outputs = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const authority = artifactCatalogAuthority(task.taskID)
        const page = await searchTaskArtifacts({
          authority,
          search: { version_scope: "all", sort: "oldest", limit: 100 },
        })
        const resourcePage = await searchTaskArtifacts({
          authority,
          search: {
            kinds: ["task_artifact_resource"],
            version_scope: "all",
            sort: "oldest",
            limit: 100,
          },
        })
        expect(resourcePage.entries.map((entry) => entry.locator)).toEqual(
          publication.artifacts.map((ref) => ({ source: "task_artifact_resource", ref })),
        )
        const exactEntry = resourcePage.entries.find(
          (entry) =>
            entry.locator.source === "task_artifact_resource" &&
            entry.locator.ref.tree === resourceLocator.ref.tree &&
            entry.locator.ref.path === resourceLocator.ref.path &&
            entry.locator.ref.sha256 === resourceLocator.ref.sha256,
        )
        if (!exactEntry) throw new Error("Exact Task Artifact resource catalog entry is missing")
        const read = await readTaskArtifact({
          authority,
          read: {
            locator: exactEntry.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          },
        })
        expect(read.chunk).toMatchObject({
          locator: resourceLocator,
          complete: true,
          total_bytes: publication.artifacts[1]!.bytes,
          sha256: publication.artifacts[1]!.sha256,
          text: "export const result = true\n",
        })
        const locators = [resourceLocator, structuredLocator, rawCoreLocator]
        return projectDeclaredTurnOutputs({
          taskID: task.taskID,
          locators,
          entries: resolveCompletionArtifactEntries(task.taskID, locators, page.entries),
        })
      },
    })

    expect(outputs).toHaveLength(3)
    expect(outputs[0]!.resources.map((resource) => resource.path)).toEqual(["src/result.ts"])
    expect(outputs[1]).toMatchObject({
      label: "Decision summary",
      declarationLocator: structuredLocator,
      artifactType: "base/decision-summary",
      producer: publication.manifest.producer,
      resources: [],
    })
    expect(outputs[2]).toMatchObject({
      label: "frontend_design-resource-manifest",
      declarationLocator: rawCoreLocator,
      artifactType: "opencorvus/core/design_resource_manifest",
      producer: {
        owner_kind: "core",
        component_id: "engine-artifact",
        operation_id: "design_resource_manifest",
      },
      resources: [],
    })
  })

  test("surfaces a selected invalid expert output as an exact transport-envelope error", async () => {
    await using project = await memoryProject()
    const task = await taskFixture(project.path)
    const locator = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const artifactID = recordEngineArtifact({
          taskID: task.taskID,
          kind: "expert_output",
          label: "Invalid legacy result",
          payload: { verdict: "accepted" },
        })
        return exactEngineArtifactLocator({ taskID: task.taskID, artifactID })
      },
    })

    const projection = Instance.provide({
      directory: project.path,
      fn: async () => {
        const page = await searchTaskArtifacts({
          authority: artifactCatalogAuthority(task.taskID),
          search: { version_scope: "all", sort: "oldest", limit: 100 },
        })
        return projectDeclaredTurnOutputs({
          taskID: task.taskID,
          locators: [locator],
          entries: resolveCompletionArtifactEntries(task.taskID, [locator], page.entries),
        })
      },
    })

    await expect(projection).rejects.toThrow(
      `Task ${task.taskID} selected Engine Artifact ${locator.artifact_id} is not a valid current transport envelope`,
    )
  })
})
