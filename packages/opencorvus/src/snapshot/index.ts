import path from "path"
import fs from "fs/promises"
import { Log } from "../util/log"
import { Flag } from "../flag/flag"
import z from "zod"
import { Config } from "../config/config"
import { ProjectInstanceContext } from "../project/instance-context"
import { Project } from "../project/project"
import { ProjectRuntimePaths } from "../project/runtime-paths"
import { hostGit as runGit, gitProcessArgs, type GitOptions, type GitResult } from "../util/git"
import { Process } from "../util/process"
import {
  EMPTY_TREE_HASH as _EMPTY_TREE_HASH,
  EMPTY_TREE_WHOLE_WORKTREE_FILE_COUNT as _EMPTY_TREE_WHOLE_WORKTREE_FILE_COUNT,
  FileDiff as _FileDiff,
  formatPatchEvidence as _formatPatchEvidence,
  Patch as _Patch,
  patchEvidenceSummary as _patchEvidenceSummary,
} from "./types"
import type {
  FileDiff as _FileDiffType,
  Patch as _PatchType,
  PatchEvidenceSummary as _PatchEvidenceSummaryType,
} from "./types"
import {
  SnapshotEmptyTreeError as _SnapshotEmptyTreeError,
  SnapshotIntegrityError as _SnapshotIntegrityError,
} from "./errors"

// Disk reclamation belongs to ProjectGC alone: every tree object emitted by
// `track()` is dangling immediately (no ref, no reflog), so any local
// `git gc --prune=now` would shred snapshot hashes that live message parts
// and task baselines still point to. The previous hourly Scheduler job and
// the per-deleteTask cleanup had exactly that effect — confirmed by
// snapshot-benchmark.ts. Whole-project rm via ProjectGC is the only safe
// reclaim path; per-snapshot pruning would need ref-anchored snapshots,
// which we deliberately do not maintain.

export namespace Snapshot {
  const log = Log.create({ service: "snapshot" })
  export const EMPTY_TREE_HASH = _EMPTY_TREE_HASH
  export const EMPTY_TREE_WHOLE_WORKTREE_FILE_COUNT = _EMPTY_TREE_WHOLE_WORKTREE_FILE_COUNT
  export const SnapshotIntegrityError = _SnapshotIntegrityError
  export const SnapshotEmptyTreeError = _SnapshotEmptyTreeError
  const coreAutocrlf =
    process.env.OPENCORVUS_SNAPSHOT_CORE_AUTOCRLF || (process.platform === "win32" ? "input" : "false")
  const coreSafecrlf = "false"
  const coreSymlinks =
    process.env.OPENCORVUS_SNAPSHOT_CORE_SYMLINKS || (process.platform === "win32" ? "false" : "true")
  const pendingGitDirs = new Map<string, Promise<void>>()

  function currentProject() {
    return ProjectInstanceContext.use()
  }

  export async function track() {
    const project = currentProject().project
    if (!Project.isGitRepo(project.worktree) || Flag.OPENCORVUS_CLIENT === "acp") return
    const cfg = await Config.get()
    if (cfg.snapshot !== true) return
    return trackRequired()
  }

  /** Capture a tree for an execution contract that requires exact worktree attribution. */
  export async function trackRequired() {
    const project = currentProject().project
    if (!Project.isGitRepo(project.worktree)) {
      throw new SnapshotIntegrityError({
        message: "Required snapshot capture needs a Git project worktree.",
        operation: "required snapshot track",
        cwd: currentProject().directory,
        worktree: currentProject().worktree,
        gitDir: gitdir(),
      })
    }
    const git = gitdir()
    // Use per-call temporary index to prevent race conditions when multiple
    // worktrees call track() concurrently against the same snapshot git repo.
    // Without this, concurrent `git add .` from different work-trees overwrite
    // the shared index, causing `write-tree` to capture the wrong directory's state.
    const indexFile = path.join(git, `index-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    try {
      await add(git, indexFile)
      const hash = (
        await gitText(
          runGit(["--git-dir", git, "--work-tree", currentProject().worktree, "write-tree"], {
            cwd: currentProject().directory,
            env: { GIT_INDEX_FILE: indexFile },
            timeoutProfile: "default",
          }),
          "snapshot write-tree",
        )
      ).trim()
      if (hash === EMPTY_TREE_HASH && (await hasTrackableContent(git, indexFile))) {
        throw new SnapshotEmptyTreeError({
          message: "Snapshot track produced the Git empty tree for a non-empty worktree.",
          operation: "snapshot track",
          cwd: currentProject().directory,
          worktree: currentProject().worktree,
          gitDir: git,
        })
      }
      log.info("tracking", { hash, cwd: currentProject().directory, git })
      return hash
    } finally {
      await cleanupIndexFile(indexFile)
    }
  }

  // Re-exported from ./types so schema-only consumers (engine/store, engine/model)
  // can import directly from "@/snapshot/types" without pulling in the runtime
  // surface (Scheduler, Instance, file I/O). External callers using the
  // `Snapshot.Patch` namespace form keep working unchanged.
  export const Patch = _Patch
  export type Patch = _PatchType
  export function patchEvidenceSummary(patch: Pick<Patch, "hash" | "files">) {
    return _patchEvidenceSummary(normalizePatchEvidence(patch))
  }
  export type PatchEvidenceSummary = _PatchEvidenceSummaryType
  export function formatPatchEvidence(patch: Pick<Patch, "hash" | "files">) {
    return _formatPatchEvidence(normalizePatchEvidence(patch))
  }

  export function assertPatchEvidenceIntegrity(patch: Patch) {
    if (patch.hash !== EMPTY_TREE_HASH) return
    if (patch.files.length < EMPTY_TREE_WHOLE_WORKTREE_FILE_COUNT) return
    throw new SnapshotEmptyTreeError({
      message: "Refusing to persist empty-tree patch evidence that appears to cover the whole worktree.",
      operation: "snapshot patch",
      cwd: currentProject().directory,
      worktree: currentProject().worktree,
      gitDir: gitdir(),
      fileCount: patch.files.length,
    })
  }

  export async function patch(hash: string): Promise<Patch> {
    const git = gitdir()
    const indexFile = path.join(git, `index-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    try {
      await add(git, indexFile)
      const files = await gitText(
        runGit(
          [
            "-c",
            `core.autocrlf=${coreAutocrlf}`,
            "-c",
            `core.safecrlf=${coreSafecrlf}`,
            "-c",
            `core.symlinks=${coreSymlinks}`,
            "-c",
            "core.quotepath=false",
            "--git-dir",
            git,
            "--work-tree",
            currentProject().worktree,
            "diff",
            "--no-ext-diff",
            "--name-only",
            hash,
            "--",
            ".",
          ],
          {
            cwd: currentProject().directory,
            env: { GIT_INDEX_FILE: indexFile },
            timeoutProfile: "default",
          },
        ),
        "snapshot patch diff",
      )
      return {
        hash,
        files: files
          .trim()
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean)
          .map(toWorktreeRelative),
      }
    } finally {
      await cleanupIndexFile(indexFile)
    }
  }

  // Restore = "make the worktree match this snapshot exactly". Implemented
  // by going through the same primitive `revert()` already uses: collect the
  // worktree-vs-snapshot delta via `patch()`, then let `revert()` re-checkout
  // each modified path and unlink the ones absent from the snapshot tree.
  // The previous `read-tree + checkout-index -a -f` form left untracked
  // worktree files behind because checkout-index only writes — it never
  // removes — so restoring after `track() → write extras → restore()` would
  // silently leave the extras on disk.
  export async function restore(snapshot: string) {
    log.info("restore", { commit: snapshot })
    const p = await patch(snapshot)
    await revert([p])
  }

  export async function revert(patches: Patch[]) {
    const seen = new Set<string>()
    const git = gitdir()
    await ensureGitDir(git)
    for (const item of patches) {
      const batch: string[] = []
      for (const file of item.files) {
        if (seen.has(file)) continue
        seen.add(file)
        batch.push(file)
      }

      if (batch.length === 0) continue
      const relative = batch.map(toWorktreeRelative)
      const present = await snapshotPaths(git, item.hash, relative)
      const checkout = relative.filter((file) => present.has(file))
      const remove = relative.filter((file) => !present.has(file))

      if (checkout.length > 0) {
        log.info("reverting files", { count: checkout.length, hash: item.hash })
        await checkoutSnapshotPaths(git, item.hash, checkout)
      }
      for (const file of remove) {
        const target = path.join(currentProject().worktree, file)
        log.info("file did not exist in snapshot, deleting", { file: target })
        await removeSnapshotAbsentFile(target)
      }
    }
  }

  export async function diff(hash: string) {
    const git = gitdir()
    const indexFile = path.join(git, `index-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    try {
      await add(git, indexFile)
      return (
        await gitText(
          runGit(
            [
              "-c",
              `core.autocrlf=${coreAutocrlf}`,
              "-c",
              `core.safecrlf=${coreSafecrlf}`,
              "-c",
              `core.symlinks=${coreSymlinks}`,
              "-c",
              "core.quotepath=false",
              "--git-dir",
              git,
              "--work-tree",
              currentProject().worktree,
              "diff",
              "--no-ext-diff",
              hash,
              "--",
              ".",
            ],
            {
              cwd: currentProject().worktree,
              env: { GIT_INDEX_FILE: indexFile },
              timeoutProfile: "default",
            },
          ),
          "snapshot diff",
        )
      ).trim()
    } finally {
      await cleanupIndexFile(indexFile)
    }
  }

  // Re-exported from ./types — see Patch above for rationale.
  export const FileDiff = _FileDiff
  export type FileDiff = _FileDiffType
  export async function diffFull(from: string, to: string): Promise<FileDiff[]> {
    const git = gitdir()
    await ensureGitDir(git)
    const result: FileDiff[] = []
    const status = new Map<string, "added" | "deleted" | "modified">()

    const statuses = await gitText(
      runGit(
        [
          "-c",
          `core.autocrlf=${coreAutocrlf}`,
          "-c",
          `core.safecrlf=${coreSafecrlf}`,
          "-c",
          `core.symlinks=${coreSymlinks}`,
          "-c",
          "core.quotepath=false",
          "--git-dir",
          git,
          "--work-tree",
          currentProject().worktree,
          "diff",
          "--no-ext-diff",
          "--name-status",
          "--no-renames",
          from,
          to,
          "--",
          ".",
        ],
        { cwd: currentProject().directory, timeoutProfile: "default" },
      ),
      "diffFull name-status",
    )

    for (const line of statuses.trim().split("\n")) {
      if (!line) continue
      const [code, file] = line.split("\t")
      if (!code || !file) continue
      const kind = code.startsWith("A") ? "added" : code.startsWith("D") ? "deleted" : "modified"
      status.set(file, kind)
    }

    const numstat = await gitText(
      runGit(
        [
          "-c",
          `core.autocrlf=${coreAutocrlf}`,
          "-c",
          `core.safecrlf=${coreSafecrlf}`,
          "-c",
          `core.symlinks=${coreSymlinks}`,
          "-c",
          "core.quotepath=false",
          "--git-dir",
          git,
          "--work-tree",
          currentProject().worktree,
          "diff",
          "--no-ext-diff",
          "--no-renames",
          "--numstat",
          from,
          to,
          "--",
          ".",
        ],
        { cwd: currentProject().directory, timeoutProfile: "default" },
      ),
      "diffFull numstat",
    )
    const textFiles: string[] = []
    const rows: Array<{ additions: string; deletions: string; file: string; isBinaryFile: boolean }> = []
    for (const line of numstat.trim().split("\n")) {
      if (!line) continue
      const [additions, deletions, file] = line.split("\t")
      if (!additions || !deletions || !file) continue
      const isBinaryFile = additions === "-" && deletions === "-"
      rows.push({ additions, deletions, file, isBinaryFile })
      if (!isBinaryFile) textFiles.push(file)
    }

    const [fromObjects, toObjects] = await Promise.all([
      treeObjects(git, from, textFiles),
      treeObjects(git, to, textFiles),
    ])
    const objectIDs = new Set<string>()
    for (const row of rows) {
      if (row.isBinaryFile) continue
      const beforeObject = fromObjects.get(row.file)
      const afterObject = toObjects.get(row.file)
      if (beforeObject) objectIDs.add(beforeObject)
      if (afterObject) objectIDs.add(afterObject)
    }
    const objectText = await catFileBatch(git, [...objectIDs])

    for (const row of rows) {
      const before = row.isBinaryFile ? "" : (objectText.get(fromObjects.get(row.file) ?? "") ?? "")
      const after = row.isBinaryFile ? "" : (objectText.get(toObjects.get(row.file) ?? "") ?? "")
      const added = row.isBinaryFile ? 0 : parseInt(row.additions)
      const deleted = row.isBinaryFile ? 0 : parseInt(row.deletions)
      result.push({
        file: row.file,
        before,
        after,
        additions: Number.isFinite(added) ? added : 0,
        deletions: Number.isFinite(deleted) ? deleted : 0,
        status: status.get(row.file) ?? "modified",
      })
    }
    return result
  }

  function gitdir() {
    const project = currentProject().project
    return ProjectRuntimePaths.snapshotCacheRoot(project.worktree, project.id)
  }

  async function gitText(command: Promise<GitResult>, label: string) {
    const result = await command
    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString().trim()
      const stdout = result.stdout.toString().trim()
      throw new SnapshotIntegrityError({
        message: `${label} failed${stderr ? `: ${stderr}` : ""}`,
        operation: label,
        cwd: currentProject().directory,
        worktree: currentProject().worktree,
        gitDir: gitdir(),
        exitCode: result.exitCode,
        stderr: stderr.slice(0, 4_000) || undefined,
        stdout: stdout.slice(0, 4_000) || undefined,
      })
    }
    return result.text()
  }

  async function ensureGitDir(git: string) {
    const pending = pendingGitDirs.get(git)
    if (pending) {
      await pending
      return
    }
    const next = ensureGitDirInner(git).finally(() => {
      pendingGitDirs.delete(git)
    })
    pendingGitDirs.set(git, next)
    await next
  }

  async function ensureGitDirInner(git: string) {
    await fs.mkdir(git, { recursive: true })
    if (await isUsableGitDir(git)) return
    await gitText(
      runGit(["init"], {
        cwd: currentProject().directory,
        env: { GIT_DIR: git, GIT_WORK_TREE: currentProject().worktree },
        timeoutProfile: "default",
      }),
      "snapshot init",
    )
    log.info("initialized", { cwd: currentProject().directory, git })
    await gitText(
      runGit(["--git-dir", git, "config", "core.autocrlf", coreAutocrlf], {
        cwd: currentProject().directory,
        timeoutProfile: "fast",
      }),
      "snapshot config core.autocrlf",
    )
    await gitText(
      runGit(["--git-dir", git, "config", "core.safecrlf", coreSafecrlf], {
        cwd: currentProject().directory,
        timeoutProfile: "fast",
      }),
      "snapshot config core.safecrlf",
    )
    await gitText(
      runGit(["--git-dir", git, "config", "core.symlinks", coreSymlinks], {
        cwd: currentProject().directory,
        timeoutProfile: "fast",
      }),
      "snapshot config core.symlinks",
    )
    await gitText(
      runGit(["--git-dir", git, "config", "core.fsmonitor", "false"], {
        cwd: currentProject().directory,
        timeoutProfile: "fast",
      }),
      "snapshot config core.fsmonitor",
    )
  }

  async function isUsableGitDir(git: string) {
    const result = await runGit(
      ["--git-dir", git, "--work-tree", currentProject().worktree, "status", "--short", "--untracked-files=no"],
      {
        cwd: currentProject().directory,
        timeoutProfile: "fast",
      },
    )
    return result.exitCode === 0
  }

  async function cleanupIndexFile(indexFile: string) {
    await Promise.all([fs.unlink(indexFile).catch(() => {}), fs.unlink(`${indexFile}.lock`).catch(() => {})])
  }

  async function hasTrackableContent(git: string, indexFile: string) {
    const text = await gitText(
      runGit(
        [
          "-c",
          `core.safecrlf=${coreSafecrlf}`,
          "-c",
          "core.quotepath=false",
          "--git-dir",
          git,
          "--work-tree",
          currentProject().worktree,
          "ls-files",
          "--cached",
          "--others",
          "--exclude-standard",
          "-z",
          "--",
          ".",
        ],
        {
          cwd: currentProject().directory,
          env: { GIT_INDEX_FILE: indexFile },
          timeoutProfile: "default",
        },
      ),
      "snapshot list trackable content",
    )
    return text.split("\0").some((entry) => entry.trim().length > 0)
  }

  function normalizePatchEvidence<P extends Pick<Patch, "hash" | "files">>(patch: P): P {
    return {
      ...patch,
      files: patch.files.map(toWorktreeRelative),
    }
  }

  function toWorktreeRelative(file: string) {
    const absolute = path.isAbsolute(file) ? file : path.join(currentProject().worktree, file)
    const relative = path.relative(currentProject().worktree, absolute)
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`snapshot path outside worktree: ${file}`)
    }
    return relative.replaceAll("\\", "/")
  }

  async function snapshotPaths(git: string, hash: string, files: string[]) {
    return new Set((await treeObjects(git, hash, files)).keys())
  }

  async function checkoutSnapshotPaths(git: string, hash: string, files: string[]) {
    for (const chunk of chunks(files, 200)) {
      await gitText(
        runGit(
          [
            "-c",
            `core.symlinks=${coreSymlinks}`,
            "--git-dir",
            git,
            "--work-tree",
            currentProject().worktree,
            "checkout",
            hash,
            "--",
            ...chunk,
          ],
          { cwd: currentProject().worktree, timeoutProfile: "default" },
        ),
        "snapshot checkout",
      )
    }
  }

  async function removeSnapshotAbsentFile(file: string) {
    try {
      await fs.unlink(file)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return
      throw err
    }
  }

  async function treeObjects(git: string, hash: string, files: string[]) {
    const objects = new Map<string, string>()
    if (files.length === 0) return objects
    for (const chunk of chunks(files, 200)) {
      const text = await gitText(
        runGit(
          [
            "-c",
            `core.symlinks=${coreSymlinks}`,
            "-c",
            "core.quotepath=false",
            "--git-dir",
            git,
            "--work-tree",
            currentProject().worktree,
            "ls-tree",
            "-r",
            "-z",
            hash,
            "--",
            ...chunk,
          ],
          { cwd: currentProject().worktree, timeoutProfile: "default" },
        ),
        "snapshot ls-tree",
      )
      for (const entry of text.split("\0")) {
        if (!entry) continue
        const tab = entry.indexOf("\t")
        if (tab < 0) throw new Error(`unexpected ls-tree entry: ${entry}`)
        const header = entry.slice(0, tab)
        const file = entry.slice(tab + 1)
        const [, type, object] = header.split(" ")
        if (type !== "blob" || !object) continue
        objects.set(file, object)
      }
    }
    return objects
  }

  async function catFileBatch(git: string, objects: string[]) {
    const out = new Map<string, string>()
    if (objects.length === 0) return out
    // git()'s spawn flow can't pipe stdin (it sets stdin: "ignore"), so this
    // path uses Process.spawn directly. To match the rest of util/git, give
    // it the same wall-clock deadline + abort-on-timeout semantics:
    // long-running cat-file batches would otherwise pin diffFull forever
    // when the git child stalls (Windows fsmonitor, antivirus locking the
    // pack files, etc.).
    const controller = new AbortController()
    const timeoutMs = 90_000
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const proc = await Process.spawnHost(gitProcessArgs(["--git-dir", git, "cat-file", "--batch"]), {
        cwd: currentProject().worktree,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        abort: controller.signal,
      })
      if (!proc.stdin) throw new Error("snapshot cat-file: stdin not available")
      await proc.stdin.write(new TextEncoder().encode(`${objects.join("\n")}\n`))
      await proc.stdin.close()
      const [stdout, stderr, exitCode] = await Promise.all([
        Process.readBytes(proc.stdout),
        Process.readText(proc.stderr),
        proc.exited,
      ])
      if (exitCode !== 0) {
        if (controller.signal.aborted) {
          throw new Error(`snapshot cat-file timed out after ${timeoutMs}ms`)
        }
        throw new Error(`snapshot cat-file failed: ${stderr.trim()}`)
      }

      const bytes = stdout
      const decoder = new TextDecoder()
      let offset = 0
      while (offset < bytes.length) {
        const lineEnd = bytes.indexOf(10, offset)
        if (lineEnd < 0) throw new Error("snapshot cat-file returned truncated header")
        const header = decoder.decode(bytes.subarray(offset, lineEnd))
        offset = lineEnd + 1
        const [object, type, rawSize] = header.split(" ")
        const size = Number(rawSize)
        if (!object || type !== "blob" || !Number.isInteger(size) || size < 0) {
          throw new Error(`unexpected cat-file header: ${header}`)
        }
        const end = offset + size
        if (end > bytes.length) throw new Error(`snapshot cat-file truncated blob: ${object}`)
        out.set(object, decoder.decode(bytes.subarray(offset, end)))
        offset = end
        if (offset < bytes.length) {
          if (bytes[offset] !== 10) throw new Error(`snapshot cat-file missing separator after ${object}`)
          offset++
        }
      }
      return out
    } finally {
      clearTimeout(timer)
    }
  }

  function chunks<T>(items: T[], size: number) {
    const out: T[][] = []
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
    return out
  }

  async function add(git: string, indexFile?: string) {
    await ensureGitDir(git)
    await syncExclude(git)
    const opts: GitOptions = {
      cwd: currentProject().directory,
      timeoutProfile: "default",
    }
    if (indexFile) opts.env = { GIT_INDEX_FILE: indexFile }
    await gitText(
      runGit(
        [
          "-c",
          `core.autocrlf=${coreAutocrlf}`,
          "-c",
          `core.safecrlf=${coreSafecrlf}`,
          "-c",
          `core.symlinks=${coreSymlinks}`,
          "--git-dir",
          git,
          "--work-tree",
          currentProject().worktree,
          "add",
          ".",
        ],
        opts,
      ),
      "snapshot add",
    )
  }

  // Baseline exclude rules layered on top of the user project's own
  // .gitignore / .git/info/exclude. These are the paths that every modern
  // language ecosystem treats as disposable build output or dependency cache:
  // blobs here have no value as a version-history waypoint, and silently
  // including them is what bloats snapshots from ~1 MB to ~200 MB+.
  //
  // The list is intentionally conservative — only well-known directory names
  // and unambiguous binary extensions. Source material never lives here under
  // conventional layouts, so false positives are unlikely. If a future
  // project legitimately wants one of these tracked, it can override via its
  // own `.git/info/exclude` (negation rules apply the usual gitignore
  // precedence).
  const BASELINE_EXCLUDE = [
    "# --- opencorvus snapshot baseline (auto-managed, do not edit) ---",
    ".opencorvus/",
    "node_modules/",
    "dist/",
    "build/",
    "out/",
    "target/",
    ".next/",
    ".nuxt/",
    ".svelte-kit/",
    ".turbo/",
    ".parcel-cache/",
    ".cache/",
    ".venv/",
    "venv/",
    "__pycache__/",
    "*.pyc",
    "coverage/",
    ".nyc_output/",
    "*.exe",
    "*.dll",
    "*.dylib",
    "*.pdb",
    "# --- end baseline ---",
    "",
  ].join("\n")

  async function syncExclude(git: string) {
    const file = await excludes()
    const target = path.join(git, "info", "exclude")
    await fs.mkdir(path.join(git, "info"), { recursive: true })
    const userText = file
      ? await Bun.file(file)
          .text()
          .catch(() => "")
      : ""
    // Baseline FIRST, user rules AFTER. gitignore later-rule-wins semantics
    // means the user's `.git/info/exclude` (and any negation via `!path`)
    // continues to take precedence — the baseline is a floor, not a ceiling.
    const merged = BASELINE_EXCLUDE + (userText.endsWith("\n") ? userText : userText + (userText ? "\n" : ""))
    await Bun.write(target, merged)
  }

  async function excludes() {
    const result = await runGit(["rev-parse", "--path-format=absolute", "--git-path", "info/exclude"], {
      cwd: currentProject().worktree,
      timeoutProfile: "fast",
    })
    if (result.exitCode !== 0) return
    const file = result.text()
    if (!file.trim()) return
    const exists = await fs
      .stat(file.trim())
      .then(() => true)
      .catch(() => false)
    if (!exists) return
    return file.trim()
  }
}
