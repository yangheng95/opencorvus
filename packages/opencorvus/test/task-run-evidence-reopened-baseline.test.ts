import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { EngineGit, ensureGitProjectMetadata } from "@/engine/git"
import { terminalTask, updateTask } from "@/engine/state"
import { requireTask } from "@/engine/store"
import { requireCurrentTerminalLifecycleReference, resolveTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { executionCapsuleSourceTreeDigest } from "@/execution-capsule/tree-digest"
import { Instance } from "@/project/instance"
import { collectTaskRunEvidence } from "@/tool/task-run-evidence-host"
import { hostGit } from "@/util/git"
import { createEngineGitCheckpointTask } from "./fixture/engine-git"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

async function git(directory: string, args: string[]) {
  const result = await hostGit(args, { cwd: directory })
  expect(result.exitCode).toBe(0)
  return result.stdout.toString()
}

async function collect(taskID: string) {
  const task = requireTask(taskID)
  return collectTaskRunEvidence({
    projectID: task.project_id!,
    request: {
      taskID,
      terminalOccurrence: {
        status: "failed",
        lifecycle: resolveTerminalLifecycleReference(taskID, requireCurrentTerminalLifecycleReference(taskID)),
        completion_decision_artifact_id: null,
      },
      selectedMessageLocators: [],
    },
  })
}

test("reopened evidence retains creation identity and the current occurrence baseline across Projects and restart", async () => {
  await using left = await memoryProject()
  await using right = await memoryProject()
  const cases = await Promise.all([left, right].map(async (project, index) => Instance.provide({
    directory: project.path,
    fn: async () => {
      await ensureGitProjectMetadata(project.path)
      const file = path.join(project.path, "result.txt")
      await fs.writeFile(file, `original ${index}\n`)
      await git(project.path, ["add", ".gitattributes", ".gitignore", "result.txt"])
      await git(project.path, ["commit", "-m", "Creation workspace"])
      const initialTree = await executionCapsuleSourceTreeDigest(project.path)
      const taskID = await createEngineGitCheckpointTask({ projectPath: project.path, title: `Reopened evidence ${index}` })
      await updateTask(requireTask(taskID), { metadata: { actor: "user" } }, "Establish operator ownership")
      await EngineGit.prepare(requireTask(taskID))
      await fs.writeFile(file, `retained result ${index}\n`)
      await terminalTask(requireTask(taskID), { status: "failed", error: "First occurrence ended after saving work" }, "First occurrence")
      const first = await collect(taskID)
      expect(first.workspace_checkpoint.initial_tree_sha256).toBe(initialTree)
      expect(first.workspace_checkpoint.execution_baseline_tree_sha256).toBe(initialTree)

      await updateTask(requireTask(taskID), { status: "active" }, "Continue the same Task")
      const continuationTree = await executionCapsuleSourceTreeDigest(project.path)
      const prepared = await EngineGit.prepare(requireTask(taskID))
      const baseline = (prepared.task.metadata as any).git.baseline
      expect(await git(project.path, ["show", `${baseline.commit}:result.txt`])).toBe(`retained result ${index}\n`)
      await fs.writeFile(file, `final result ${index}\n`)
      await terminalTask(requireTask(taskID), { status: "failed", error: "Second occurrence retained its final evidence" }, "Second occurrence")
      const evidence = await collect(taskID)
      expect(evidence.task.id).toBe(taskID)
      expect(evidence.task.project_id).toBe(Instance.project.id)
      expect(evidence.workspace_checkpoint.initial_tree_sha256).toBe(initialTree)
      expect(evidence.workspace_checkpoint.execution_baseline_tree_sha256).toBe(continuationTree)
      expect(evidence.workspace_checkpoint.baseline.commit).toBe(baseline.commit)
      expect(evidence.workspace_checkpoint.result.kind).toBe("terminal_git")
      if (evidence.workspace_checkpoint.result.kind !== "terminal_git") throw new Error("Expected terminal Git evidence")
      expect(await git(project.path, ["show", `${evidence.workspace_checkpoint.result.commit}:result.txt`])).toBe(`final result ${index}\n`)
      return { directory: project.path, taskID, initialTree, continuationTree, baseline: baseline.commit }
    },
  })))

  await Instance.disposeAll()
  for (const entry of cases) await Instance.provide({ directory: entry.directory, fn: async () => {
    const evidence = await collect(entry.taskID)
    expect(evidence.task.id).toBe(entry.taskID)
    expect(evidence.workspace_checkpoint.initial_tree_sha256).toBe(entry.initialTree)
    expect(evidence.workspace_checkpoint.execution_baseline_tree_sha256).toBe(entry.continuationTree)
    expect(evidence.workspace_checkpoint.baseline.commit).toBe(entry.baseline)
  } })
}, 180_000)
