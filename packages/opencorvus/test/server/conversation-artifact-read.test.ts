import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { exactEngineArtifactLocator } from "../../src/artifact-catalog"
import { recordEngineArtifact } from "../../src/engine/artifact"
import { EngineTaskTable } from "../../src/engine/engine.sql"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { Database } from "../../src/storage/db"
import { createTaskArtifactStoreExecution } from "../../src/task-artifact/store"
import { createToolExecutionSurface } from "../../src/tool/execution-surface"
import type { TaskToolExecutionScope } from "../../src/tool/task-tool-execution-scope"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

type TaskFixture = {
  taskID: string
  scope: TaskToolExecutionScope
}

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})

async function createTask(directory: string, title: string): Promise<TaskFixture> {
  return Instance.provide({
    directory,
    fn: async () => {
      const session = await Session.create({ kind: "root", title })
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
            title,
            request: title,
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
            toolIDs: ["artifact_search", "artifact_read"],
            permission: [],
          }),
          owner: Object.freeze({
            kind: "projected-scheduler",
            expertSquadID: "test-squad",
            packageRevision: {
              scope: "project",
              projectID: Instance.project.id,
              namespace: "test",
              id: "test-squad",
              version: "1.0.0",
              packageDigest: "c".repeat(64),
            },
            agentID: "orchestrator",
            projectionHash: "a".repeat(64),
          }),
        }),
      }
    },
  })
}

async function publishResources(
  scope: TaskToolExecutionScope,
  files: readonly { path: string; mediaType: string; bytes: Uint8Array }[],
) {
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

async function readArtifact(
  projectPath: string,
  taskID: string,
  locator: unknown,
  byteOffset = 0,
  maxBytes = 65_536,
  origin?: string,
): Promise<Response> {
  const response = await Server.App().request(`/task/${taskID}/artifact-read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-opencorvus-directory": projectPath,
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify({ locator, byte_offset: byteOffset, max_bytes: maxBytes }),
  })
  if (response.status !== 200) {
    throw new Error(`Conversation Artifact read returned ${response.status}: ${await response.text()}`)
  }
  return response
}

describe("Conversation Artifact byte route", () => {
  test("reads the exact Engine Artifact owned by each addressed Task", async () => {
    await using project = await memoryProject()
    const firstTask = await createTask(project.path, "First Artifact owner")
    const secondTask = await createTask(project.path, "Second Artifact owner")
    const [first, second] = await Instance.provide({
      directory: project.path,
      fn: async () =>
        [
          { taskID: firstTask.taskID, owner: "first" },
          { taskID: secondTask.taskID, owner: "second" },
        ].map((entry) => {
          const artifactID = recordEngineArtifact({
            taskID: entry.taskID,
            kind: "expert_output",
            label: `${entry.owner} deliverable`,
            payload: { owner: entry.owner },
          })
          return {
            ...entry,
            locator: exactEngineArtifactLocator({ taskID: entry.taskID, artifactID }),
          }
        }),
    })

    for (const entry of [first, second]) {
      const response = await readArtifact(project.path, entry.taskID, entry.locator)
      const payload = JSON.parse(await response.text())
      expect(payload).toEqual({ owner: entry.owner })
      expect(response.headers.get("content-disposition")).toBe("inline")
      expect(response.headers.get("content-type")).toBe("application/json")
      expect(response.headers.get("etag")).toBe(`"sha256:${entry.locator.expected_sha256}"`)
    }
  })

  test("reads a snapshot manifest and reconstructs its UTF-8 text resource from exact byte ranges", async () => {
    await using project = await memoryProject()
    const task = await createTask(project.path, "Snapshot and text resource")
    const expectedText = '{"message":"你好🙂","status":"complete"}'
    const publication = await publishResources(task.scope, [
      { path: "report.json", mediaType: "application/json", bytes: Buffer.from(expectedText, "utf8") },
    ])

    const manifestResponse = await readArtifact(project.path, task.taskID, {
      source: "task_artifact_snapshot",
      snapshot: publication.snapshot,
    })
    expect(JSON.parse(await manifestResponse.text())).toEqual(publication.manifest)

    const locator = { source: "task_artifact_resource", ref: publication.artifacts[0]! }
    const chunks: Uint8Array[] = []
    let offset = 0
    let total = -1
    while (total < 0 || offset < total) {
      const response = await readArtifact(project.path, task.taskID, locator, offset, 5)
      const range = response.headers.get("content-range")
      if (!range) throw new Error("Text resource response has no Content-Range")
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range)
      if (!match) throw new Error(`Unexpected Content-Range ${range}`)
      const start = Number(match[1])
      const end = Number(match[2]) + 1
      total = Number(match[3])
      expect(start).toBe(offset)
      chunks.push(new Uint8Array(await response.arrayBuffer()))
      offset = end
    }
    const combined = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0))
    let cursor = 0
    for (const chunk of chunks) {
      combined.set(chunk, cursor)
      cursor += chunk.byteLength
    }
    expect(new TextDecoder("utf-8", { fatal: true }).decode(combined)).toBe(expectedText)
  })

  test("returns a binary resource as exact raw bytes with immutable metadata", async () => {
    await using project = await memoryProject()
    const task = await createTask(project.path, "Binary resource")
    const expected = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
    const publication = await publishResources(task.scope, [
      { path: "preview.png", mediaType: "image/png", bytes: expected },
    ])
    const resource = publication.artifacts[0]!

    const response = await readArtifact(
      project.path,
      task.taskID,
      {
        source: "task_artifact_resource",
        ref: resource,
      },
      0,
      65_536,
      "http://localhost:5173",
    )
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(expected)
    expect(response.headers.get("content-disposition")).toBe("attachment; filename*=UTF-8''preview.png")
    expect(response.headers.get("content-range")).toBe(`bytes 0-${expected.byteLength - 1}/${expected.byteLength}`)
    expect(response.headers.get("content-type")).toBe("image/png")
    expect(response.headers.get("etag")).toBe(`"sha256:${resource.sha256}"`)
    expect(response.headers.get("access-control-expose-headers")).toBe("Content-Disposition,Content-Range,ETag")
  })
})
