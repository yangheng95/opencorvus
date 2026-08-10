import fs from "fs/promises"
import path from "path"
import { Database } from "../storage/db"
import { ProjectTable } from "../project/project.sql"
import { Instance } from "../project/instance"
import { ProjectRuntimePaths } from "../project/runtime-paths"
import { Log } from "../util/log"
import { Scheduler } from "../scheduler"
import { hostGit as runGit } from "../util/git"
import { Worktree } from "./index"

/**
 * Orphan worktree garbage collection.
 *
 * Implements the previously-unimplemented Phase F of
 * `specs/current/architecture/10-worktree-lifecycle.md` §9 — Claude-Code-aligned
 * orphaned-worktree sweep (§2.1 / §6 of that doc, and the addendum
 * `orphan worktree garbage collection contract`).
 *
 * A managed path under a Task Session or `.opencorvus/.r/project/worktrees/` is removed ONLY when
 * it is genuinely abandoned junk. "Older than N days" is necessary but NOT
 * sufficient for physical directories: §2.3 of the lifecycle doc forbids
 * deleting failed / aborted / cancelled / restart worktrees because that
 * in-transit state is the input to the next retry. So a physical worktree is
 * reclaimed only when ALL hold:
 *
 *   1. NOT registered as a Task-owned sandbox.
 *   2. directory mtime older than `retentionDays` (default 3).
 *   3. clean: `git status --porcelain` empty (no uncommitted, no untracked).
 *   4. no in-transit commits: nothing on HEAD that is not yet merged into
 *      the project's primary branch (the no-remote analogue of Claude
 *      Code's "no unpushed commits" gate).
 *
 * OR it is one of the non-physical residues proven by the 2026-06-27 audit:
 * a registry-only prunable entry whose branch has no in-transit commits, or
 * a database (DB) sandbox-only path that no longer has either a directory or git
 * registry entry. Apply always goes through the project-managed remover so
 * `project.sandboxes` converges only after the physical Git removal step
 * succeeds.
 *
 * Any uncertainty (a git probe fails while `.git` is present) → PRESERVE.
 * We never trade a false delete of in-transit acceptance work for tidiness.
 */
export namespace WorktreeGC {
  const log = Log.create({ service: "worktree.gc" })
  const GC_INTERVAL_MS = 6 * 60 * 60 * 1000
  export const DEFAULT_RETENTION_DAYS = 3

  // Re-entrancy guard: a sweep shells out to many slow git commands; runs
  // are 6h apart and idempotent, so simply skip if a prior run is still in
  // flight rather than overlapping git operations on the same repos.
  let running = false

  export type Candidate = {
    projectID: string
    primaryDir: string
    directory: string
    reason: "old-clean" | "old-zombie" | "registry-prunable" | "sandbox-missing"
  }
  export type Preservation = {
    projectID: string
    primaryDir: string
    reason: "registry-unavailable"
    detail: string
  }
  export type Plan = { candidates: Candidate[]; preservations: Preservation[] }
  export type ApplyResult = { removed: number; failed: number }

  export function init() {
    Scheduler.register({
      id: "worktree.gc",
      interval: GC_INTERVAL_MS,
      runAtStart: true,
      scope: "global",
      run: async () => {
        if (running) return
        running = true
        try {
          const plan = await inspect()
          if (plan.candidates.length === 0) return
          await apply(plan)
        } finally {
          running = false
        }
      },
    })
  }

  function canon(input: string): string {
    const abs = path.resolve(input)
    return process.platform === "win32" ? abs.toLowerCase() : abs
  }

  async function realCanon(input: string): Promise<string> {
    const abs = path.resolve(input)
    const real = await fs.realpath(abs).catch(() => abs)
    return process.platform === "win32" ? real.toLowerCase() : real
  }

  function isOlderThan(stat: { mtimeMs: number }, cutoff: number): boolean {
    return stat.mtimeMs < cutoff
  }

  async function gitClean(directory: string): Promise<boolean> {
    const status = await runGit(["status", "--porcelain"], {
      cwd: directory,
      timeoutProfile: "default",
    }).catch(() => undefined)
    // Probe failure with a present .git linkage is uncertainty → not clean.
    if (!status || status.exitCode !== 0) return false
    return decode(status.stdout).trim().length === 0
  }

  async function noInTransitCommits(directory: string, primaryBranch: string): Promise<boolean> {
    const revs = await runGit(["rev-list", "--count", `${primaryBranch}..HEAD`], {
      cwd: directory,
      timeoutProfile: "fast",
    }).catch(() => undefined)
    if (!revs || revs.exitCode !== 0) return false
    return decode(revs.stdout).trim() === "0"
  }

  async function branchHasNoInTransitCommits(
    primaryDir: string,
    primaryBranch: string,
    branch: string,
  ): Promise<boolean> {
    const revs = await runGit(["rev-list", "--count", `${primaryBranch}..${branch}`], {
      cwd: primaryDir,
      timeoutProfile: "fast",
    }).catch(() => undefined)
    if (!revs || revs.exitCode !== 0) return false
    return decode(revs.stdout).trim() === "0"
  }

  function decode(input: Uint8Array | undefined): string {
    if (!input?.length) return ""
    return new TextDecoder().decode(input)
  }

  async function worktreeDirectories(primaryDir: string): Promise<string[]> {
    const root = Worktree.worktreesRoot(primaryDir)
    const entries = await fs.readdir(root, { withFileTypes: true }).catch((err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return [] as import("fs").Dirent[]
      throw err
    })
    const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(root, entry.name))
    const tasksRoot = ProjectRuntimePaths.taskCollectionRoot(primaryDir)
    const tasks = await fs.readdir(tasksRoot, { withFileTypes: true }).catch((err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") return [] as import("fs").Dirent[]
      throw err
    })
    for (const task of tasks) {
      if (!task.isDirectory() || task.isSymbolicLink()) continue
      const sessionsRoot = path.join(tasksRoot, task.name, "sessions")
      const sessions = await fs.readdir(sessionsRoot, { withFileTypes: true }).catch(() => [] as import("fs").Dirent[])
      for (const session of sessions) {
        if (!session.isDirectory() || session.isSymbolicLink()) continue
        const worktree = path.join(sessionsRoot, session.name, "worktree")
        const stat = await fs.stat(worktree).catch(() => undefined)
        if (stat?.isDirectory()) directories.push(worktree)
      }
    }
    return directories
  }

  async function primaryBranchOf(primaryDir: string): Promise<string | undefined> {
    const head = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: primaryDir,
      timeoutProfile: "fast",
    }).catch(() => undefined)
    if (!head || head.exitCode !== 0) return undefined
    const branch = decode(head.stdout).trim()
    if (!branch || branch === "HEAD") return undefined
    return branch
  }

  async function addManagedPath(input: { primaryDir: string; directory: string; out: Map<string, string> }) {
    if (!(await Worktree.isManagedWorktreeDirectory(input.primaryDir, input.directory))) return
    input.out.set(await realCanon(input.directory), input.directory)
  }

  export async function inspect(opts?: { retentionDays?: number; now?: number }): Promise<Plan> {
    const days = opts?.retentionDays ?? DEFAULT_RETENTION_DAYS
    const cutoff = (opts?.now ?? Date.now()) - days * 24 * 60 * 60 * 1000

    const projects = Database.use((db) =>
      db
        .select({ id: ProjectTable.id, worktree: ProjectTable.worktree, sandboxes: ProjectTable.sandboxes })
        .from(ProjectTable)
        .all(),
    )

    const candidates: Candidate[] = []
    const preservations: Preservation[] = []

    for (const project of projects) {
      const primaryDir = project.worktree
      if (!primaryDir) continue
      const directories = new Map<string, string>()
      for (const directory of await worktreeDirectories(primaryDir)) {
        await addManagedPath({ primaryDir, directory, out: directories })
      }

      const registeredByDirectory = new Map<string, Worktree.RegisteredWorktreeEntry>()
      const sandboxKeys = new Set<string>()
      let registered: Worktree.RegisteredWorktreeEntry[]
      try {
        registered = await Worktree.listRegisteredWorktrees(primaryDir)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        preservations.push({
          projectID: project.id,
          primaryDir,
          reason: "registry-unavailable",
          detail,
        })
        log.warn("failed to read git worktree registry; preserving the entire project", {
          projectID: project.id,
          primaryDir,
          error: detail,
        })
        continue
      }
      for (const entry of registered) {
        if (!(await Worktree.isManagedWorktreeDirectory(primaryDir, entry.path))) continue
        const key = await realCanon(entry.path)
        registeredByDirectory.set(key, entry)
        directories.set(key, entry.path)
      }
      for (const sandbox of project.sandboxes ?? []) {
        if (!(await Worktree.isManagedWorktreeDirectory(primaryDir, sandbox))) continue
        const key = await realCanon(sandbox)
        sandboxKeys.add(key)
        directories.set(key, sandbox)
      }
      // Resolved once per project; if we cannot determine primary branch we
      // cannot evaluate the in-transit-commits gate → preserve everything.
      const primaryBranch = await primaryBranchOf(primaryDir)

      for (const directory of directories) {
        const [key, displayDirectory] = directory
        const registeredEntry = registeredByDirectory.get(key)
        const stat = await fs.stat(displayDirectory).catch(() => undefined)
        if (!stat) {
          if (
            registeredEntry?.prunable === true &&
            primaryBranch &&
            registeredEntry.branch &&
            (await branchHasNoInTransitCommits(primaryDir, primaryBranch, registeredEntry.branch))
          ) {
            candidates.push({
              projectID: project.id,
              primaryDir,
              directory: displayDirectory,
              reason: "registry-prunable",
            })
            continue
          }
          if (sandboxKeys.has(key) && !registeredEntry) {
            candidates.push({
              projectID: project.id,
              primaryDir,
              directory: displayDirectory,
              reason: "sandbox-missing",
            })
          }
          continue
        }
        if (!isOlderThan(stat, cutoff)) continue
        // A sandbox registration is durable Task/workflow ownership. Physical
        // age is not orphan evidence while that ownership still exists.
        if (sandboxKeys.has(key)) continue

        const gitLink = path.join(displayDirectory, ".git")
        const hasGitLink = await fs
          .stat(gitLink)
          .then(() => true)
          .catch(() => false)

        if (!hasGitLink) {
          // Zombie residue (lifecycle §8.1): old, under the worktrees root,
          // no git linkage and no Task-owned sandbox registration
          // binding → reclaim.
          candidates.push({ projectID: project.id, primaryDir, directory: displayDirectory, reason: "old-zombie" })
          continue
        }

        if (!primaryBranch) continue
        if (!(await gitClean(displayDirectory))) continue
        if (!(await noInTransitCommits(displayDirectory, primaryBranch))) continue

        candidates.push({ projectID: project.id, primaryDir, directory: displayDirectory, reason: "old-clean" })
      }
    }

    return { candidates, preservations }
  }

  export async function apply(plan: Plan): Promise<ApplyResult> {
    let removed = 0
    let failed = 0
    const projects = Database.use((db) =>
      db.select({ worktree: ProjectTable.worktree }).from(ProjectTable).all(),
    )
    for (const project of projects) {
      if (!project.worktree) continue
      await Instance.provide({
        directory: project.worktree,
        fn: () => Worktree.reconcileOrphanWorktreeOwners(),
      }).catch((error) => {
        failed += 1
        log.warn("orphan worktree owner reconciliation failed", {
          primaryDir: project.worktree,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }
    for (const c of plan.candidates) {
      try {
        const result = await Instance.provide({
          directory: c.primaryDir,
          fn: () =>
            Worktree.removeManagedProjectWorktreeDirectory({
              projectID: c.projectID,
              directory: c.directory,
            }),
        })
        if (!result.removed) continue
        removed++
        log.info("orphan worktree removed", {
          projectID: c.projectID,
          directory: c.directory,
          reason: c.reason,
        })
      } catch (err) {
        failed++
        log.warn("orphan worktree removal failed", {
          projectID: c.projectID,
          directory: c.directory,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    if (removed > 0 || failed > 0) log.info("applied", { removed, failed })
    return { removed, failed }
  }
}
