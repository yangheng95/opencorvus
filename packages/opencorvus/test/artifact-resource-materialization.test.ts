import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { prepareTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { Session } from "../src/session"
import { publishTaskArtifactProjectFiles } from "../src/task-artifact/store"
import { readTaskArtifact } from "../src/artifact-catalog"
import { artifactReadBatch } from "../src/tool/artifact-batch"
import { createToolExecutionSurface } from "../src/tool/execution-surface"
import type { TaskToolExecutionScope } from "../src/tool/task-tool-execution-scope"

// Real backend/filesystem fixtures; no Provider or model end-to-end claim.
const contents = "Hello from formal Task QA\n"
const packageRevision = {
  scope: "built_in" as const, projectID: null, namespace: "builtin", id: "base",
  version: "2026.08.06.1", packageDigest: "a".repeat(64),
}
afterAll(resetMemoryDatabase)

async function establish(directory: string) {
  const taskID = Identifier.ascending("task")
  const now = Date.now()
  const rootSession = Session.prepareRootNext({ kind: "root", directory, title: "Resource materialization" })
  persistEstablishedTask({
    taskID, rootSession, now, title: "Resource materialization", request: "Publish hello.txt",
    productPillar: "work", metadata: { actor: "user" }, projectID: Instance.project.id, packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native", taskID, projectID: Instance.project.id, rootDirectory: directory,
      packageRevisionSHA256: packageRevision.packageDigest, timeCreated: now,
    }),
  })
  const scope: TaskToolExecutionScope = {
    packageToolRef: null, kind: "task", projectID: Instance.project.id, projectDirectory: directory,
    taskID, taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(directory, taskID), sessionID: rootSession.id,
    messageID: Identifier.ascending("message"), toolCallID: Identifier.ascending("tool"),
    toolPartID: Identifier.ascending("part"),
    executionSurface: createToolExecutionSurface({ toolIDs: ["artifact_snapshot"], permission: [] }),
    owner: { kind: "projected-scheduler", expertSquadID: "base", packageRevision,
      agentID: "orchestrator", projectionHash: "d".repeat(64) },
  }
  await fs.writeFile(path.join(directory, "hello.txt"), contents)
  const publish = (additionalFiles: { path: string; mediaType: string }[] = []) => publishTaskArtifactProjectFiles({
    scope: { ...scope, toolCallID: Identifier.ascending("tool"), toolPartID: Identifier.ascending("part") },
    files: [{ path: "hello.txt", mediaType: "text/plain" }, ...additionalFiles], source: { kind: "current_task_project" },
  })
  const first = await publish()
  const request = (ref = first.artifacts[0]!) => ({
    locator: { source: "task_artifact_resource" as const, ref },
    delivery: "materialized_file" as const, byte_offset: 0, max_bytes: 1000,
  })
  const read = (input = request()) => readTaskArtifact({ authority: scope, read: input })
  return { scope, publish, first, request, read }
}

async function qualify(result: Awaited<ReturnType<typeof readTaskArtifact>>, scope: TaskToolExecutionScope) {
  const chunk = result.chunk
  expect({ complete: chunk.complete, start: chunk.byte_start, end: chunk.byte_end,
    total: chunk.total_bytes, next: chunk.next_offset, attachment: chunk.attachment }).toEqual({
    complete: true, start: 0, end: 26, total: 26, next: null, attachment: false,
  })
  expect(path.dirname(chunk.materialized_path!)).toBe(
    ProjectRuntimePaths.taskArtifactReadMaterializationRoot(scope.projectDirectory, scope.taskID),
  )
  expect(await fs.readFile(chunk.materialized_path!, "utf8")).toBe(contents)
  expect((await fs.stat(chunk.materialized_path!)).mode & 0o777).toBe(0o444)
  return chunk.materialized_path!
}

test("serial repeated immutable resource returns the same verified readonly bytes", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const fixture = await establish(project.path)
    const first = await qualify(await fixture.read(), fixture.scope)
    const second = await qualify(await fixture.read(), fixture.scope)
    expect(second).toBe(first)
  } })
}, 60_000)

test("actual serial batch resolves distinct snapshots with identical bytes and basename", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const fixture = await establish(project.path)
    await fs.writeFile(path.join(project.path, "context.txt"), "Second immutable snapshot context")
    const second = await fixture.publish([{ path: "context.txt", mediaType: "text/plain" }])
    expect([fixture.first.manifest.publication_sequence, second.manifest.publication_sequence]).toEqual([1, 2])
    const secondHello = second.artifacts.find((ref) => path.basename(ref.path) === "hello.txt")!
    expect(secondHello.sha256).toBe(fixture.first.artifacts[0]!.sha256)
    const batch = await artifactReadBatch([fixture.request(), fixture.request(secondHello)], async (read) => ({
      output: JSON.stringify((await fixture.read(read)).chunk),
    }))
    const output = JSON.parse(batch.output)
    expect(output.complete).toBe(true)
    expect(output.results.map((item: { request_index: number }) => item.request_index)).toEqual([0, 1])
    for (const item of output.results) await qualify({ chunk: item.value }, fixture.scope)
    expect(output.results[1].value.materialized_path).toBe(output.results[0].value.materialized_path)
  } })
}, 60_000)

test("parallel immutable readers converge on verified readonly bytes", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const fixture = await establish(project.path)
    const results = await Promise.all([fixture.read(), fixture.read(), fixture.read()])
    const paths = await Promise.all(results.map((result) => qualify(result, fixture.scope)))
    expect(paths).toEqual([paths[0], paths[0], paths[0]])
  } })
}, 60_000)

test("Task and Project ownership determines each materialization directory", async () => {
  await using firstProject = await memoryProject("materialization-first")
  await using secondProject = await memoryProject("materialization-second")
  for (const [directory, taskCount] of [[firstProject.path, 2], [secondProject.path, 1]] as const) {
    await Instance.provide({ directory, fn: async () => {
      for (let index = 0; index < taskCount; index++) {
        const fixture = await establish(directory)
        const target = await qualify(await fixture.read(), fixture.scope)
        expect(target).toBe(path.join(ProjectRuntimePaths.taskArtifactReadMaterializationRoot(directory,
          fixture.scope.taskID), `${fixture.first.artifacts[0]!.sha256}-hello.txt`))
      }
    } })
  }
}, 60_000)

test("corrupt existing immutable cache returns its precise integrity error", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const fixture = await establish(project.path)
    const target = await qualify(await fixture.read(), fixture.scope)
    await fs.chmod(target, 0o644)
    await fs.writeFile(target, "corrupt owned fixture")
    await fs.chmod(target, 0o444)
    await expect(fixture.read()).rejects.toThrow("artifact_read materialized cache path does not match the immutable locator")
  } })
}, 60_000)
