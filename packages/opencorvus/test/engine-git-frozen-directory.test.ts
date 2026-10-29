import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { asc, eq } from "drizzle-orm"
import { EngineGitCheckpointOutcomeTable, EngineGitCheckpointRequestTable } from "../src/engine/engine.sql"
import { EngineGit } from "../src/engine/git"
import { requireTask } from "../src/engine/store"
import { Instance } from "../src/project/instance"
import { Database } from "../src/storage/db"
import { hostGit } from "../src/util/git"
import { Worktree } from "../src/worktree"
import { WorktreeReadiness } from "../src/worktree/readiness"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"

afterAll(resetMemoryDatabase)

async function git(directory: string, args: string[]) {
  const result = await hostGit(args, { cwd: directory, timeoutProfile: "fast" })
  expect({ exit: result.exitCode, stderr: result.stderr.toString() }).toMatchObject({ exit: 0 })
  return result
}

async function longProject(label: string) {
  const owner = await memoryProject(`frozen-directory-${label}`)
  try {
    let directory = path.join(owner.path, `long-${label}`, "目录")
    const executionDirectory = () =>
      label === "managed" ? path.join(Worktree.worktreesRoot(directory), "m404") : directory
    while (Buffer.byteLength(executionDirectory()) < 310) directory += "目"
    expect(executionDirectory().length).toBeLessThan(260)
    console.log("Long UTF-8 fixture", {
      directory,
      utf8Bytes: Buffer.byteLength(directory),
      utf16CodeUnits: directory.length,
      executionUtf8Bytes: Buffer.byteLength(executionDirectory()),
      executionUtf16CodeUnits: executionDirectory().length,
    })
    await fs.mkdir(directory, { recursive: true })
    await git(directory, ["init"])
    await fs.writeFile(path.join(directory, "identity.txt"), `PUBLIC-${label}\n`)
    await git(directory, ["add", "--", "identity.txt"])
    await git(directory, [
      "-c",
      "user.name=Public Fixture",
      "-c",
      "user.email=public@example.invalid",
      "commit",
      "-m",
      `Public ${label}`,
    ])
    return {
      path: await fs.realpath(directory),
      async [Symbol.asyncDispose]() {
        await owner[Symbol.asyncDispose]()
      },
    }
  } catch (error) {
    await owner[Symbol.asyncDispose]()
    throw error
  }
}

function checkpointFacts(taskID: string) {
  return Database.use((db) => {
    const requests = db
      .select()
      .from(EngineGitCheckpointRequestTable)
      .where(eq(EngineGitCheckpointRequestTable.task_id, taskID))
      .orderBy(asc(EngineGitCheckpointRequestTable.time_created))
      .all()
    const ids = new Set(requests.map((request) => request.id))
    const outcomes = db
      .select()
      .from(EngineGitCheckpointOutcomeTable)
      .all()
      .filter((outcome) => ids.has(outcome.request_id))
    return {
      requests,
      outcomes: requests.map((request) => outcomes.find((outcome) => outcome.request_id === request.id)!),
    }
  })
}

async function checkpointCycle(directory: string, label: string, markerKind: "directory" | "file" = "directory") {
  expect(Buffer.byteLength(directory)).toBeGreaterThanOrEqual(300)
  const userHead = (await git(directory, ["rev-parse", "HEAD"])).text().trim()
  const projectID = Instance.project.id
  const identityBytes = await fs.readFile(path.join(directory, "identity.txt"))
  expect(identityBytes.toString().replace(/\r?\n$/, "")).toBe(`PUBLIC-${label}`)
  const original = Buffer.from([0, 13, 10, 255, label.charCodeAt(0), 0])
  const updated = Buffer.concat([original, Buffer.from(`PUBLIC-${label}-RESULT\r\n`)])
  await fs.writeFile(path.join(directory, "raw.bin"), original)
  const taskID = await createEngineGitCheckpointTask({ projectPath: directory, title: `Frozen directory ${label}` })
  const prepared = await EngineGit.prepare(requireTask(taskID))
  console.log("Frozen directory baseline", {
    directoryBytes: Buffer.byteLength(directory),
    projectID,
    taskID,
    error: "error" in prepared ? prepared.error : undefined,
  })
  const baseline = (prepared.task.metadata as any).git?.baseline
  expect(baseline?.mode).toBe("created_commit")
  const gitDir = (await git(directory, ["rev-parse", "--absolute-git-dir"])).text().trim()
  const commonDir = (await git(directory, ["rev-parse", "--git-common-dir"])).text().trim()
  expect(structuredClone(baseline.repositories[0].authority)).toMatchObject({
    workspace: directory,
    git_marker_kind: markerKind,
    git_dir: await fs.realpath(gitDir),
    common_dir: await fs.realpath(path.resolve(directory, commonDir)),
  })
  expect((await git(directory, ["show", `${baseline.commit}:raw.bin`])).stdout).toEqual(original)
  await fs.writeFile(path.join(directory, "raw.bin"), updated)
  const completed = await EngineGit.complete(requireTask(taskID))
  const result = (completed.task.metadata as any).git?.result
  expect(result?.mode).toBe("created_commit")
  expect(structuredClone(result.checkpoint_receipt)).toMatchObject({
    checkpoint_stage: "result",
    outcome: "success",
    repository_count: 1,
    blob_import_process_count: 1,
    index_import_process_count: 1,
  })
  expect((await git(directory, ["show", `${result.commit}:raw.bin`])).stdout).toEqual(updated)
  expect((await git(directory, ["show", `${result.commit}:identity.txt`])).stdout).toEqual(identityBytes)
  expect((await git(directory, ["rev-parse", "HEAD"])).text().trim()).toBe(userHead)
  expect(requireTask(taskID).project_id).toBe(projectID)
  const beforeReplay = checkpointFacts(taskID)
  expect(
    beforeReplay.requests.map((request) => ({
      taskID: request.task_id,
      stage: request.stage,
      operationKey: request.operation_key,
    })),
  ).toEqual([
    { taskID, stage: "baseline", operationKey: "baseline:1" },
    { taskID, stage: "result", operationKey: "result:1" },
  ])
  expect(
    beforeReplay.outcomes.map((outcome) => ({ requestID: outcome.request_id, commit: (outcome.result as any).commit })),
  ).toEqual([
    { requestID: beforeReplay.requests[0]!.id, commit: baseline.commit },
    { requestID: beforeReplay.requests[1]!.id, commit: result.commit },
  ])
  const replayedBaseline = await EngineGit.prepare(requireTask(taskID))
  const replayedResult = await EngineGit.complete(requireTask(taskID))
  expect((replayedBaseline.task.metadata as any).git.baseline.commit).toBe(baseline.commit)
  expect((replayedResult.task.metadata as any).git.result.commit).toBe(result.commit)
  expect(checkpointFacts(taskID)).toEqual(beforeReplay)
  return { projectID, taskID, directory, commit: result.commit, bytes: updated }
}

test("real checkpoints preserve raw bytes and immutable receipts with UTF-8 paths over 300 bytes and UTF-16 below 260 units", async () => {
  await using project = await longProject("single")
  await Instance.provide({ directory: project.path, fn: () => checkpointCycle(project.path, "single") })
}, 120000)

test("two Projects retain their frozen roots and bytes through concurrent checkpoints with UTF-8 over 300 bytes and UTF-16 below 260 units", async () => {
  await using left = await longProject("left")
  await using right = await longProject("right")
  const settled = await Promise.allSettled([
    Instance.provide({ directory: left.path, fn: () => checkpointCycle(left.path, "left") }),
    Instance.provide({ directory: right.path, fn: () => checkpointCycle(right.path, "right") }),
  ])
  const failures = settled.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
  if (failures.length) throw new AggregateError(failures, "Concurrent checkpoint owners failed")
  const results = settled.map((result) => {
    if (result.status !== "fulfilled") throw result.reason
    return result.value
  })
  expect(new Set(results.map((result) => result.projectID)).size).toBe(2)
  expect(results.map((result) => requireTask(result.taskID).project_id)).toEqual(
    results.map((result) => result.projectID),
  )
  for (const result of results) {
    expect((await git(result.directory, ["show", `${result.commit}:raw.bin`])).stdout).toEqual(result.bytes)
  }
}, 180000)

test("the production managed-worktree entry reaches readiness and real checkpoints through its frozen external admin directory", async () => {
  await using project = await longProject("managed")
  const created = await Instance.provide({
    directory: project.path,
    fn: async () => {
      const result = await Worktree.create({ name: "m404" })
      expect(await WorktreeReadiness.isReady(result.directory)).toBe(true)
      expect((await fs.lstat(path.join(result.directory, ".git"))).isFile()).toBe(true)
      console.log("Production managed worktree", {
        directory: result.directory,
        utf8Bytes: Buffer.byteLength(result.directory),
        utf16CodeUnits: result.directory.length,
      })
      return result
    },
  })
  await Instance.provide({
    directory: created.directory,
    fn: () => checkpointCycle(created.directory, "managed", "file"),
  })
}, 180000)
