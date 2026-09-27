import { afterAll, expect, test } from "bun:test"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { workspaceTreeDigest } from "@opencorvus-ai/plugin"
import { ensureGitProjectMetadata } from "../src/engine/git-project-metadata"
import { configureTaskIngressRunner } from "../src/engine/task-root-ingress-delivery"
import { readTaskProcessBinding } from "../src/engine/task-execution-capsule-binding"
import { requireTaskPackageRevisionBinding } from "../src/engine/task-package-revision-binding"
import { requireTask } from "../src/engine/store"
import { taskRootDirectory } from "../src/engine/task-directory"
import { executionCapsuleSourceTreeSnapshot } from "../src/execution-capsule/tree-digest"
import { ExpertSquadPackageManager } from "../src/expert-squad/manager"
import { Global } from "../src/global"
import { Instance } from "../src/project/instance"
import { Project } from "../src/project/project"
import { EngineService, TaskExecutionDirectoryInitializerTestHooks } from "../src/task-api"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const inputRoot = path.resolve(import.meta.dir, "../../../specs/artifacts/2026-09-27-evolution-readiness/input")

async function git(directory: string, args: string[]) {
  const child = Bun.spawn(["git", ...args], { cwd: directory, stdout: "pipe", stderr: "pipe" })
  const [exit, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ])
  if (exit !== 0) throw new Error(`Readiness Git command failed (${exit}): ${stderr}`)
  return stdout.trim()
}

afterAll(resetMemoryDatabase)

test("registered Trial directories preserve complete initial inputs independently of coordinator and peer output", async () => {
  await using coordinator = await memoryProject()
  const roots = await Global.createTemporaryDirectory("evolution-readiness-")
  try {
    const directories = [path.join(roots, "execution-1"), path.join(roots, "execution-2")]
    for (const directory of directories) {
      await mkdir(directory)
      for (const file of ["request.md", "metrics.json"]) {
        await writeFile(path.join(directory, file), await readFile(path.join(inputRoot, file)))
      }
      await git(directory, ["init", "--quiet"])
      await git(directory, ["config", "user.name", "Evolution readiness checker"])
      await git(directory, ["config", "user.email", "readiness@example.invalid"])
      await ensureGitProjectMetadata(directory)
      await git(directory, ["add", "."])
      await git(directory, ["commit", "--quiet", "-m", "Freeze independent diagnostic input"])
    }
    const frozen = await executionCapsuleSourceTreeSnapshot(directories[0]!)
    expect(frozen.files.map((file) => file.path)).toEqual([".gitattributes", ".gitignore", "metrics.json", "request.md"])
    for (const file of ["request.md", "metrics.json"]) {
      expect(Buffer.from(frozen.files.find((entry) => entry.path === file)!.bytes_base64, "base64"))
        .toEqual(await readFile(path.join(inputRoot, file)))
    }
    expect(await executionCapsuleSourceTreeSnapshot(directories[1]!)).toEqual(frozen)

    await Instance.provide({ directory: coordinator.path, fn: async () => {
      const projectID = Instance.project.id
      const installed = await ExpertSquadPackageManager.installPayloadPackage({
        projectDirectory: coordinator.path, id: "data-analysis", installationScope: "project",
      })
      // The driver holds root ingress. Task acceptance, directory admission and
      // persisted package/workspace facts below are real; no model is executed.
      using _initializer = TaskExecutionDirectoryInitializerTestHooks.replace(async () => {
        configureTaskIngressRunner(async () => {})
      })
      const taskIDs: string[] = []
      for (const [index, directory] of directories.entries()) {
        const taskID = await EngineService.createTask({
          requestID: `readiness-${index}`,
          title: `Readiness execution ${index + 1}`,
          request: await readFile(path.join(inputRoot, "request.md"), "utf8"),
          directory, productPillar: "work", model: "openai/gpt-5.6-luna",
          promptProfile: "data-analysis", expectedPackageDigest: installed.after.packageDigest,
        }, { actor: "user" })
        taskIDs.push(taskID)
        const task = requireTask(taskID)
        const binding = readTaskProcessBinding(taskID)
        expect(binding).toMatchObject({
          protocol: "task-native-process-binding-v2", task_id: taskID, project_id: projectID,
          workspace_root: directory, initial_tree_sha256: workspaceTreeDigest(frozen),
          package_revision_sha256: installed.after.packageDigest,
        })
        expect({ project: task.project_id, root: taskRootDirectory(task) }).toEqual({ project: projectID, root: directory })
        expect(requireTaskPackageRevisionBinding(taskID)).toMatchObject({
          scope: "project", project_id: projectID, namespace: "builtin", id: "data-analysis",
          package_digest: installed.after.packageDigest,
        })
      }
      expect(Project.get(projectID)!.sandboxes.toSorted()).toEqual([...directories].sort())
      await writeFile(path.join(coordinator.path, "stage-control.json"), "{\"stage\":\"prepared\"}\n")
      await writeFile(path.join(directories[0]!, "report.md"), "New output owned only by execution 1\n")
      const changed = await executionCapsuleSourceTreeSnapshot(directories[0]!)
      expect(changed.files).toEqual([...frozen.files, {
        path: "report.md", bytes_base64: Buffer.from("New output owned only by execution 1\n").toString("base64"),
      }].sort((a, b) => a.path.localeCompare(b.path)))
      expect(await executionCapsuleSourceTreeSnapshot(directories[1]!)).toEqual(frozen)
      expect(readTaskProcessBinding(taskIDs[0]!)).toMatchObject({ initial_tree_sha256: workspaceTreeDigest(frozen) })
      console.log("G58_READINESS " + JSON.stringify({
        projectID, taskIDs, directories, frozenPaths: frozen.files.map((file) => file.path),
        initialTree: workspaceTreeDigest(frozen), target: installed.after,
        modelExecution: "held-by-test-driver", independentPeerTree: workspaceTreeDigest(await executionCapsuleSourceTreeSnapshot(directories[1]!)),
      }))
    } })
  } finally {
    await Instance.disposeAll()
    await rm(roots, { recursive: true, force: true })
  }
}, 60_000)
