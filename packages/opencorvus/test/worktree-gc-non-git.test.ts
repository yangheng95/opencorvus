import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { Project } from "@/project/project"
import { Instance } from "@/project/instance"
import { Worktree } from "@/worktree"
import { WorktreeGC } from "@/worktree/gc"
import { Server } from "@/server/server"
import { Log } from "@/util/log"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const evidence = path.resolve(
  import.meta.dir,
  "../../../specs/artifacts/2026-10-05-connection-workspace-authority/non-git-worktree-gc-101",
)

test("available non-Git and broken Git Projects preserve files while healthy residue remains observable", async () => {
  const owner = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!owner) throw new Error("Canonical isolated test runtime is required")
  const root = await createManagedTemporaryDirectory(path.join(owner, "fixtures"), "gc-non-git-")
  await using healthy = await memoryProject()
  await Log.init({ print: false, dev: true, level: "DEBUG" })
  try {
    const plain = path.join(root, "plain")
    const broken = path.join(root, "broken")
    const unavailable = path.join(root, "unavailable")
    await Promise.all([plain, broken, unavailable].map((directory) => fs.mkdir(directory)))
    const retained = "Owned non-Git file remains readable.\n"
    await fs.writeFile(path.join(plain, "keep.txt"), retained)
    const plainProject = await Project.fromDirectory(plain)
    const brokenProject = await Project.fromDirectory(broken)
    const missingProject = await Project.fromDirectory(unavailable)
    const response = await Server.App().request("/project/current/cleanup-candidates", {
      headers: { "x-opencorvus-directory": plain },
    })
    const publicBody = await response.json()
    await fs.writeFile(path.join(broken, ".git"), "gitdir: missing-owned-git-directory\n")
    await fs.rm(unavailable, { recursive: true })
    const healthyProject = await Project.fromDirectory(healthy.path)
    const zombie = path.join(Worktree.worktreesRoot(healthy.path), "owned-old-zombie")
    await fs.mkdir(zombie, { recursive: true })
    const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    await fs.utimes(zombie, old, old)
    const plan = await Instance.provide({ directory: healthy.path, fn: () => WorktreeGC.inspect({ retentionDays: 3 }) })
    const fileText = await fs.readFile(path.join(plain, "keep.txt"), "utf8")
    await Log.flush()
    const raw = await fs.readFile(Log.file(), "utf8")
    await fs.mkdir(evidence, { recursive: true })
    const capture = path.join(evidence, `baseline-${crypto.randomUUID()}`)
    await fs.writeFile(`${capture}.log`, raw)
    await fs.writeFile(
      `${capture}.json`,
      JSON.stringify(
        {
          inputs: { plain, broken, unavailable, zombie, retained },
          projects: [plainProject.project, brokenProject.project, missingProject.project, healthyProject.project],
          status: response.status,
          publicBody,
          plan,
          fileText,
        },
        null,
        2,
      ),
    )
    console.log(`GC baseline evidence: ${capture}`)
    expect(response.status).toBe(200)
    expect(fileText).toBe(retained)
    expect(WorktreeGC.PreservationReason.parse("non-git-project")).toBe("non-git-project")
    expect(WorktreeGC.PreservationReason.parse("git-state-unavailable")).toBe("git-state-unavailable")
    const logs = raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    expect(
      logs
        .filter((row) => row.service === "worktree.gc" && row.level === "info")
        .map((row) => ({ projectID: row.data.projectID, primaryDir: row.data.primaryDir, message: row.message })),
    ).toContainEqual({
      projectID: plainProject.project.id,
      primaryDir: plain,
      message: "non-Git project does not require worktree collection",
    })
    expect(
      plan.preservations.map(({ projectID, primaryDir, reason }) => ({ projectID, primaryDir, reason })),
    ).toContainEqual({ projectID: brokenProject.project.id, primaryDir: broken, reason: "registry-unavailable" })
    expect(
      plan.preservations.map(({ projectID, primaryDir, reason }) => ({ projectID, primaryDir, reason })),
    ).toContainEqual({
      projectID: missingProject.project.id,
      primaryDir: unavailable,
      reason: "primary-directory-unavailable",
    })
    expect(
      plan.candidates.map(({ projectID, primaryDir, directory, reason }) => ({
        projectID,
        primaryDir,
        directory,
        reason,
      })),
    ).toContainEqual({
      projectID: healthyProject.project.id,
      primaryDir: healthy.path,
      directory: zombie,
      reason: "old-zombie",
    })
    expect(publicBody.worktreeGCPreservations).toContainEqual({
      projectID: plainProject.project.id,
      reason: "non-git-project",
      operation: "inspect-worktree-gc",
      code: "NON_GIT_PROJECT",
    })
    expect(
      plan.preservations.map(({ projectID, primaryDir, reason }) => ({ projectID, primaryDir, reason })),
    ).toContainEqual({ projectID: plainProject.project.id, primaryDir: plain, reason: "non-git-project" })
  } finally {
    await Instance.disposeAll()
    Server.resetProjectRoutesAppForTest()
    await resetMemoryDatabase()
    await removeManagedDirectoryTree(root)
  }
}, 120_000)
