import { $ } from "bun"
import { createHash, randomUUID } from "node:crypto"
import fsSync from "node:fs"
import fs from "fs/promises"
import path from "path"
import z from "zod"
import {
  ProjectWorktreeInfo as ProjectWorktreeInfoSchema,
  type ProjectWorktreeInfo as ProjectWorktreeInfoValue,
} from "@opencorvus-ai/transport-protocol"
import { NamedError } from "@opencorvus-ai/util/error"
import { Global } from "../global"
import { Instance } from "../project/instance"
import { Project } from "../project/project"
import { Database, eq, NotFoundError } from "../storage/db"
import { ProjectTable } from "../project/project.sql"
import { fn } from "../util/fn"
import { hostGit as runGit } from "../util/git"
import { Log } from "../util/log"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Shell } from "@/shell/shell"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { InternalGitCommitSubject } from "@/engine/internal-git-commit-subject"
import { SessionPromptState } from "@/session/prompt/state"
import { SessionTable } from "@/session/session.sql"
import { ProjectGitLock } from "@/worktree/git-lock"
import { WorktreeOwnershipCriticalSection } from "@/worktree/ownership-critical-section"
import { WorktreeReadiness } from "./readiness"
import { activeTaskProcessBindingRoots } from "@/engine/task-execution-capsule-binding"
import { Ownership } from "@/engine/ownership"
import { findTask } from "@/engine/store"
import { isTaskTerminal } from "@/engine/task-status"
import { releaseManagedWorktreeSessionOwner as releaseManagedSessionOwner } from "@/worktree/managed-session-owner"
import { ProjectDirectoryAdmission } from "@/project/directory-admission"
import { Filesystem } from "@/util/filesystem"
import {
  assertProjectDeletionRegistryAdmission,
  type ProjectDeletionRegistryAdmission,
} from "@/project/deletion-registry"

export namespace Worktree {
  const log = Log.create({ service: "worktree" })
  const caseInsensitiveCache = new Map<string, boolean>()
  const registeredWorktreeListRequests = new Map<string, Promise<RegisteredWorktreeEntry[]>>()
  const DIRECTORY_REMOVE_MAX_RETRIES = 1200
  const DIRECTORY_REMOVE_RETRY_DELAY_MS = 250
  type AfterPhysicalDirectoryRemovalHook = (directory: string) => void | Promise<void>
  type AfterResetHardHook = (input: { directory: string; targetCommit: string }) => void | Promise<void>
  type AfterSandboxAliasObservationHook = (directory: string) => void | Promise<void>
  type BeforeRemovalSettlementHook = (directory: string) => void | Promise<void>
  type BeforeBranchRemovalHook = (input: { branch: string; targetCommit: string }) => void | Promise<void>
  let afterPhysicalDirectoryRemoval: AfterPhysicalDirectoryRemovalHook | undefined
  let afterResetHard: AfterResetHardHook | undefined
  let afterSandboxAliasObservation: AfterSandboxAliasObservationHook | undefined
  let beforeRemovalSettlement: BeforeRemovalSettlementHook | undefined
  let beforeBranchRemoval: BeforeBranchRemovalHook | undefined

  export namespace TestHooks {
    export function installAfterPhysicalDirectoryRemoval(hook: AfterPhysicalDirectoryRemovalHook) {
      const previous = afterPhysicalDirectoryRemoval
      afterPhysicalDirectoryRemoval = hook
      return {
        [Symbol.dispose]() {
          if (afterPhysicalDirectoryRemoval === hook) afterPhysicalDirectoryRemoval = previous
        },
      }
    }

    export function installAfterResetHard(hook: AfterResetHardHook) {
      const previous = afterResetHard
      afterResetHard = hook
      return {
        [Symbol.dispose]() {
          if (afterResetHard === hook) afterResetHard = previous
        },
      }
    }

    export function installAfterSandboxAliasObservation(hook: AfterSandboxAliasObservationHook) {
      const previous = afterSandboxAliasObservation
      afterSandboxAliasObservation = hook
      return {
        [Symbol.dispose]() {
          if (afterSandboxAliasObservation === hook) afterSandboxAliasObservation = previous
        },
      }
    }

    export function installBeforeRemovalSettlement(hook: BeforeRemovalSettlementHook) {
      const previous = beforeRemovalSettlement
      beforeRemovalSettlement = hook
      return {
        [Symbol.dispose]() {
          if (beforeRemovalSettlement === hook) beforeRemovalSettlement = previous
        },
      }
    }

    export function installBeforeBranchRemoval(hook: BeforeBranchRemovalHook) {
      const previous = beforeBranchRemoval
      beforeBranchRemoval = hook
      return {
        [Symbol.dispose]() {
          if (beforeBranchRemoval === hook) beforeBranchRemoval = previous
        },
      }
    }
  }

  // One filesystem lease serializes every repository mutation across this
  // process and sibling OpenCorvus processes. proper-lockfile owns renewal;
  // the adjacent JSON file is atomic diagnostic metadata, not a second lock.
  export async function withGitLock<T>(fn: (lease: ProjectGitLock.Lease) => Promise<T>): Promise<T> {
    return ProjectGitLock.withLease(
      { projectID: Instance.project.id, primaryWorktreeDir: Instance.project.worktree },
      fn,
    )
  }

  /**
   * Single source for the per-project worktree root. Managed worktrees live
   * under the Task Session that owns them, while unscoped worktrees live under
   * `<primary>/.opencorvus/.r/project/worktrees/` (co-located with other
   * runtime scratch, covered by the `/.opencorvus/` .gitignore entry). `create()`
   * and `WorktreeGC` MUST both derive the root from here — two inline
   * `path.join(...,".opencorvus","worktrees")` would be a double source
   * (rule 8) and the GC sweep could scan the wrong directory.
   */
  export function worktreesRoot(primaryDir: string) {
    return ProjectRuntimePaths.worktreesRoot(primaryDir)
  }

  export const Event = {
    Ready: BusEvent.define(
      "worktree.ready",
      z.object({
        directory: z.string(),
        name: z.string(),
        branch: z.string(),
      }),
    ),
    Failed: BusEvent.define(
      "worktree.failed",
      z.object({
        directory: z.string(),
        message: z.string(),
      }),
    ),
  }

  export const MergeFailedError = NamedError.create(
    "WorktreeMergeFailedError",
    z.object({
      message: z.string(),
      branch: z.string(),
      stderr: z.string().optional(),
    }),
  )

  export function mergeFailureDetail(err: unknown): { reason: string; branch: string; stderr?: string } | undefined {
    if (!MergeFailedError.isInstance(err)) return undefined
    const { message, branch, stderr } = err.data
    return {
      reason: message,
      branch,
      ...(stderr ? { stderr } : {}),
    }
  }

  export type MergeOutcome =
    | {
        status: "merged"
        primaryBranch: string
        primaryHead: string
        primaryRecoveryCommit?: string
      }
    | {
        status: "conflict"
        branch: string
        primaryBranch: string
        primaryTip: string
        conflictPaths: string[]
        worktreeDir: string
      }
    | {
        status: "blocked"
        branch: string
        reason: string
        worktreeDir: string
        dirtyPaths?: string[]
        mergeHead?: boolean
      }
    | {
        status: "infra_error"
        branch: string
        reason: string
        stderr?: string
        worktreeDir?: string
      }

  /**
   * Surfaced when `git merge` against the primary branch hit textual conflicts
   * inside files. Unlike rebase-style flows, the merge is left IN PROGRESS:
   * the worktree is in MERGING state with conflict markers (`<<<<<<<`) in the
   * unmerged paths. The agent reads each path in place, edits the markers
   * away, `git add`s, and `git commit`s — that final commit completes the
   * merge and produces a merge commit at the topology join point. The next
   * `mergeWithMerge` call then sees a clean tree whose tip strictly descends
   * from primary's tip, so step 2 (ff-only) can always advance.
   *
   * Distinct from MergeFailedError (which signals infrastructure problems).
   */
  export const MergeConflictError = NamedError.create(
    "WorktreeMergeConflictError",
    z.object({
      message: z.string(),
      branch: z.string(),
      primaryBranch: z.string(),
      primaryTip: z.string(),
      conflictPaths: z.array(z.string()),
    }),
  )

  /**
   * Bring a managed dispatch branch's commits onto the primary branch via merge.
   *
   * Sequence (single canonical path, all under `withGitLock` for atomicity):
   *   1. Resolve the currently checked-out branch of the primary worktree.
   *   2. From the managed worktree, run `git merge --no-edit <primary-branch>`.
   *      - Already-up-to-date / fast-forward: tree advances; tip strictly
   *        descends primary tip.
   *      - 3-way merge succeeds: a merge commit is created; tip strictly
   *        descends both sides.
   *      - Conflict: the worktree is left IN MERGING state (MERGE_HEAD set,
   *        conflict markers in files). We capture the path list and throw
   *        MergeConflictError WITHOUT aborting. The caller (in-session agent)
   *        edits the markers away in place, `git add`s, `git commit`s — that
   *        completes the merge. Host callers must preserve the same MERGING
   *        worktree so the next physical dispatch can continue from the conflict
   *        state.
   *   3. From the primary worktree, `git merge --ff-only <branch>`. ff is
   *      guaranteed because the managed tip strictly descends primary tip.
   *
   * Why merge, not rebase: rebase replays dispatch commits one-by-one onto
   * primary; on conflict, an agent's reconcile commit appended *after* the
   * conflicting commit never participates in the next replay — the same
   * conflict re-appears on the next dispatch, making the protocol non-convergent.
   * Merge produces a single three-way reconcile that the agent commits once,
   * positioning the resolution at the topology join point so subsequent
   * dispatches advance instead of re-conflicting.
   *
   * The earlier ff-only-only design assumed serial dispatch and broke under
   * parallel dispatch (late workers can branch from stale primary HEAD and
   * cannot fast-forward). Merge preserves worker commits exactly, surfaces real
   * textual conflicts via MergeConflictError, and converges in one round of
   * reconcile per actual divergence.
   */
  export const mergeWithMerge = fn(
    z.object({
      branch: z
        .string()
        .describe(
          "Local branch ref to merge (e.g. `opencorvus/build-foo`). Must already contain the dispatch's commits.",
        ),
      worktreeDir: z.string().describe("Filesystem path of the managed dispatch worktree where the merge runs."),
    }),
    async (input) => {
      if (!Project.isGitRepo(Instance.directory)) {
        throw new NotGitError({ message: "mergeWithMerge: not a git project" })
      }
      const primary = await primaryWorktreeInfo().catch((err) => {
        throw new MergeFailedError({
          message: `mergeWithMerge(${input.branch}): ${err instanceof Error ? err.message : String(err)}`,
          branch: input.branch,
        })
      })
      return withGitLock(async () => {
        const primaryDir = primary.directory
        const primaryBranch = primary.branch
        let primaryRecoveryCommit: string | undefined
        if (primaryDir !== input.worktreeDir) {
          const validity = await isValid(input.worktreeDir)
          if (!validity.valid) {
            throw new MergeFailedError({
              message:
                `mergeWithMerge(${input.branch}): worktree git linkage is invalid at ${input.worktreeDir}: ` +
                `${validity.reason ?? "unknown reason"}. Reattach or recreate the managed worktree before merge_back.`,
              branch: input.branch,
            })
          }
        }

        // Pre-flight: refuse to start a new merge if the worktree still has
        // an unfinished one (MERGE_HEAD present) or uncommitted changes.
        // Either is a contract violation — the caller must complete the
        // previous merge (`git commit`) and commit ordinary edits before
        // retrying, otherwise we silently subsume their state into a new
        // merge commit and lose the signal.
        const mergeHead = await runGit(["rev-parse", "--verify", "--quiet", "MERGE_HEAD"], {
          cwd: input.worktreeDir,
          timeoutProfile: "fast",
        })
        requireMergeHeadProbe(mergeHead, input.worktreeDir)
        if (mergeHead.exitCode === 0) {
          throw new MergeFailedError({
            message:
              `mergeWithMerge(${input.branch}): worktree is in an unfinished MERGING state ` +
              `(MERGE_HEAD exists). Resolve conflicts and \`git commit\` to finalize, or ` +
              `report the blocker before retrying.`,
            branch: input.branch,
          })
        }
        const status = await runGit(["-c", "core.quotepath=false", "status", "--porcelain"], {
          cwd: input.worktreeDir,
          timeoutProfile: "default",
        })
        requireStatusProbe(status, input.worktreeDir)
        const dirty = statusLinesBlockingMerge(outputText(status.stdout))
        if (dirty.length > 0) {
          throw new MergeFailedError({
            message:
              `mergeWithMerge(${input.branch}): worktree is dirty. Commit or revert ` +
              `before retrying merge_back.\n${dirty.join("\n")}`,
            branch: input.branch,
          })
        }
        const internalRuntimeDiffs = await committedInternalRuntimeDiffs(input.worktreeDir, primaryBranch, input.branch)
        if (internalRuntimeDiffs.length > 0) {
          throw new MergeFailedError({
            message:
              `mergeWithMerge(${input.branch}): refusing to merge committed OpenCorvus internal runtime files. ` +
              `.opencorvus/.r/ is host-owned task/session state and cannot be a durable build deliverable. ` +
              `Move the deliverable into a project source/docs path and retry merge_back:\n${internalRuntimeDiffs.join("\n")}`,
            branch: input.branch,
          })
        }
        if (primaryDir !== input.worktreeDir) {
          const primaryState = await inspectBlockedMergeWorktree(primaryDir)
          if (primaryState.mergeHead) {
            throw new MergeFailedError({
              message:
                `mergeWithMerge(${input.branch}): primary worktree ${primaryDir} is in an unfinished ` +
                `MERGING state. Resolve that merge and commit it before retrying merge_back.`,
              branch: input.branch,
            })
          }
          if (primaryState.dirtyPaths.length > 0) {
            primaryRecoveryCommit = await commitPrimaryDirtyWorktree({
              branch: input.branch,
              primaryDir,
              dirtyPaths: primaryState.dirtyPaths,
            })
          }
        }

        // Step 1 — merge primary into the managed worktree. Fast-forward is
        // allowed when it has no own commits; otherwise a 3-way merge
        // produces a merge commit. Conflicts leave MERGE_HEAD + markers in
        // files; we capture and re-throw without aborting so the in-session
        // agent can reconcile in place. Host-path callers preserve the same
        // worktree for the next physical dispatch.
        const merged = await runGit(["merge", "--no-edit", primaryBranch], {
          cwd: input.worktreeDir,
          timeoutProfile: "default",
        })
        if (merged.exitCode !== 0) {
          const conflictList = await runGit(["diff", "--name-only", "--diff-filter=U"], {
            cwd: input.worktreeDir,
            timeoutProfile: "default",
          })
          const conflictPaths = outputText(conflictList.stdout)
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)

          const primaryTipProbe = await runGit(["rev-parse", `refs/heads/${primaryBranch}`], {
            cwd: primaryDir,
            timeoutProfile: "fast",
          })
          const primaryTip = outputText(primaryTipProbe.stdout)

          throw new MergeConflictError({
            message:
              `mergeWithMerge(${input.branch}): merge of ${primaryBranch} hit conflicts in ` +
              `${conflictPaths.length} file(s); worktree left in MERGING state. ` +
              `Reconcile each path in place, \`git add\`, then \`git commit\` to finalize ` +
              `the merge and retry.`,
            branch: input.branch,
            primaryBranch,
            primaryTip,
            conflictPaths,
          })
        }

        // Step 2 — ff-merge into primary. Must succeed: the managed branch tip
        // now strictly descends primary's tip (either via ff or via merge
        // commit produced in step 1).
        const ff = await runGit(["merge", "--ff-only", "--no-edit", input.branch], {
          cwd: primaryDir,
          timeoutProfile: "default",
        })
        if (ff.exitCode !== 0) {
          const stderr = errorText(ff) || "git merge --ff-only failed after successful merge"
          throw new MergeFailedError({
            message: `mergeWithMerge(${input.branch}): post-merge ff-merge failed: ${stderr}`,
            branch: input.branch,
            stderr,
          })
        }

        const headProbe = await runGit(["rev-parse", "HEAD"], {
          cwd: primaryDir,
          timeoutProfile: "fast",
        })
        const primaryHead = outputText(headProbe.stdout)
        return { primaryBranch, primaryHead, primaryRecoveryCommit }
      })
    },
  )

  /**
   * Public merge publication boundary. This is the only merge API callers
   * should use from agent/session paths: every repository condition resolves
   * to a typed outcome, so merge publication cannot crash the session loop.
   * `mergeWithMerge` remains the lower-level implementation that preserves
   * the exact git topology and named errors for focused unit tests.
   */
  export async function mergeSafely(input: { branch: string; worktreeDir: string }): Promise<MergeOutcome> {
    try {
      const result = await mergeWithMerge(input)
      return {
        status: "merged",
        primaryBranch: result.primaryBranch,
        primaryHead: result.primaryHead,
        ...(result.primaryRecoveryCommit ? { primaryRecoveryCommit: result.primaryRecoveryCommit } : {}),
      }
    } catch (err) {
      if (MergeConflictError.isInstance(err)) {
        const { branch, primaryBranch, primaryTip, conflictPaths } = err.data
        return {
          status: "conflict",
          branch,
          primaryBranch,
          primaryTip,
          conflictPaths,
          worktreeDir: input.worktreeDir,
        }
      }

      if (MergeFailedError.isInstance(err)) {
        const { message, branch } = err.data
        let details: Awaited<ReturnType<typeof inspectBlockedMergeWorktree>>
        try {
          details = await inspectBlockedMergeWorktree(input.worktreeDir)
        } catch (inspectionError) {
          return {
            status: "infra_error",
            branch,
            reason:
              `${message}\nFailed to inspect blocked worktree state: ` +
              (inspectionError instanceof Error ? inspectionError.message : String(inspectionError)),
            worktreeDir: input.worktreeDir,
          }
        }
        return {
          status: "blocked",
          branch,
          reason: message,
          worktreeDir: input.worktreeDir,
          ...(details.dirtyPaths.length > 0 ? { dirtyPaths: details.dirtyPaths } : {}),
          ...(details.mergeHead ? { mergeHead: true } : {}),
        }
      }

      if (NotGitError.isInstance(err)) {
        return {
          status: "infra_error",
          branch: input.branch,
          reason: err.data.message,
          worktreeDir: input.worktreeDir,
        }
      }

      return {
        status: "infra_error",
        branch: input.branch,
        reason: err instanceof Error ? err.message : String(err),
        worktreeDir: input.worktreeDir,
      }
    }
  }

  export const Info = z
    .object({
      name: z.string(),
      branch: z.string(),
      directory: z.string(),
    })
    .meta({
      ref: "Worktree",
    })

  export type Info = z.infer<typeof Info>

  export const ProjectWorktreeInfo = ProjectWorktreeInfoSchema

  export type ProjectWorktreeInfo = ProjectWorktreeInfoValue

  export const CreateInput = z
    .object({
      name: z.string().optional(),
      startCommand: z
        .string()
        .optional()
        .describe("Additional startup script to run after the project's start command"),
      reuseIfValid: z
        .boolean()
        .optional()
        .describe(
          "When true and `name` is supplied, return the existing worktree only when `isValid()` confirms its `.git` linkage and `git worktree list` registration. " +
            "A resumed physical dispatch may use this to continue in its verified Session worktree. Invalid existing trees continue through the standard reclaim path, so corrupt state is not preserved.",
        ),
      taskID: z.string().optional(),
      sessionID: z.string().optional(),
    })
    .strict()
    .superRefine((value, context) => {
      if ((value.taskID === undefined) !== (value.sessionID === undefined)) {
        context.addIssue({
          code: "custom",
          message: "Task-scoped worktrees require both taskID and sessionID",
        })
      }
    })
    .meta({
      ref: "WorktreeCreateInput",
    })

  export type CreateInput = z.infer<typeof CreateInput>

  export const RemoveInput = z
    .object({
      directory: z.string(),
    })
    .meta({
      ref: "WorktreeRemoveInput",
    })

  export type RemoveInput = z.infer<typeof RemoveInput>

  export const ResetInput = z
    .object({
      directory: z.string(),
      baseRef: z.string().optional(),
    })
    .meta({
      ref: "WorktreeResetInput",
    })

  export type ResetInput = z.infer<typeof ResetInput>

  export const NotGitError = NamedError.create(
    "WorktreeNotGitError",
    z.object({
      message: z.string(),
    }),
  )

  export const NameGenerationFailedError = NamedError.create(
    "WorktreeNameGenerationFailedError",
    z.object({
      message: z.string(),
    }),
  )

  export const CreateFailedError = NamedError.create(
    "WorktreeCreateFailedError",
    z.object({
      message: z.string(),
    }),
  )

  export const StartCommandFailedError = NamedError.create(
    "WorktreeStartCommandFailedError",
    z.object({
      message: z.string(),
    }),
  )

  export const RemoveFailedError = NamedError.create(
    "WorktreeRemoveFailedError",
    z.object({
      message: z.string(),
    }),
  )

  export const ResetFailedError = NamedError.create(
    "WorktreeResetFailedError",
    z.object({
      message: z.string(),
    }),
  )

  const ADJECTIVES = [
    "brave",
    "calm",
    "clever",
    "cosmic",
    "crisp",
    "curious",
    "eager",
    "gentle",
    "glowing",
    "happy",
    "hidden",
    "jolly",
    "kind",
    "lucky",
    "mighty",
    "misty",
    "neon",
    "nimble",
    "playful",
    "proud",
    "quick",
    "quiet",
    "shiny",
    "silent",
    "stellar",
    "sunny",
    "swift",
    "tidy",
    "witty",
  ] as const

  const NOUNS = [
    "cabin",
    "cactus",
    "canyon",
    "circuit",
    "comet",
    "eagle",
    "engine",
    "falcon",
    "forest",
    "garden",
    "harbor",
    "island",
    "knight",
    "lagoon",
    "meadow",
    "moon",
    "mountain",
    "nebula",
    "orchid",
    "otter",
    "panda",
    "pixel",
    "planet",
    "river",
    "rocket",
    "sailor",
    "squid",
    "star",
    "tiger",
    "wizard",
    "wolf",
  ] as const

  function pick<const T extends readonly string[]>(list: T) {
    return list[Math.floor(Math.random() * list.length)]
  }

  function slug(input: string) {
    return input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "")
  }

  function shortName(input: string) {
    return slug(input).slice(-8) || "worktree"
  }

  function randomName() {
    return `${pick(ADJECTIVES)}-${pick(NOUNS)}`
  }

  async function exists(target: string) {
    return fs
      .stat(target)
      .then(() => true)
      .catch(() => false)
  }

  function outputText(input: Uint8Array | undefined) {
    if (!input?.length) return ""
    return new TextDecoder().decode(input).trim()
  }

  function errorText(result: { stdout?: Uint8Array; stderr?: Uint8Array }) {
    return [outputText(result.stderr), outputText(result.stdout)].filter(Boolean).join("\n")
  }

  function statusLinesBlockingMerge(statusText: string): string[] {
    return statusText
      .split("\n")
      .map((line) => line.trimEnd())
      .filter(Boolean)
  }

  async function committedInternalRuntimeDiffs(
    worktreeDir: string,
    primaryBranch: string,
    branch: string,
  ): Promise<string[]> {
    const result = await runGit(
      ["-c", "core.quotepath=false", "diff", "--name-only", "--no-renames", primaryBranch, branch, "--", "."],
      { cwd: worktreeDir, timeoutProfile: "default" },
    )
    if (result.exitCode !== 0) {
      throw new MergeFailedError({
        message:
          `mergeWithMerge(${branch}): failed to inspect committed OpenCorvus internal runtime files before merge_back. ` +
          (errorText(result) || "git diff returned a non-zero exit code"),
        branch,
      })
    }
    return ProjectRuntimePaths.internalRuntimeRelativePaths(
      outputText(result.stdout)
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    )
  }

  async function inspectBlockedMergeWorktree(directory: string) {
    const mergeHeadResult = await runGit(["rev-parse", "--verify", "--quiet", "MERGE_HEAD"], {
      cwd: directory,
      timeoutProfile: "fast",
    })
    requireMergeHeadProbe(mergeHeadResult, directory)
    const mergeHead = mergeHeadResult.exitCode === 0
    const dirtyResult = await runGit(["-c", "core.quotepath=false", "status", "--porcelain"], {
      cwd: directory,
      timeoutProfile: "default",
    })
    requireStatusProbe(dirtyResult, directory)
    const dirtyPaths = statusLinesBlockingMerge(outputText(dirtyResult.stdout))
    return { mergeHead, dirtyPaths }
  }

  function requireMergeHeadProbe(
    result: { exitCode: number; stdout?: Uint8Array; stderr?: Uint8Array },
    directory: string,
  ) {
    if (result.exitCode === 0 || result.exitCode === 1) return
    throw new Error(
      `Failed to inspect MERGE_HEAD in ${directory}: ${errorText(result) || `git exited ${result.exitCode}`}`,
    )
  }

  function requireStatusProbe(
    result: { exitCode: number; stdout?: Uint8Array; stderr?: Uint8Array },
    directory: string,
  ) {
    if (result.exitCode === 0) return
    throw new Error(
      `Failed to inspect git status in ${directory}: ${errorText(result) || `git exited ${result.exitCode}`}`,
    )
  }

  async function commitPrimaryDirtyWorktree(input: { branch: string; primaryDir: string; dirtyPaths: string[] }) {
    const changedPaths = dirtyStatusPaths(input.dirtyPaths)
    for (const chunk of chunks(changedPaths, 50)) {
      const add = await runGit(["add", "--", ...chunk], { cwd: input.primaryDir, timeoutProfile: "default" })
      if (add.exitCode !== 0) {
        throw new MergeFailedError({
          message:
            `mergeWithMerge(${input.branch}): primary worktree is dirty but could not be staged ` +
            `for merge_back recovery: ${errorText(add)}`,
          branch: input.branch,
          stderr: errorText(add),
        })
      }
    }
    const commit = await runGit(
      [
        "-c",
        "user.name=opencorvus",
        "-c",
        "user.email=opencorvus@local",
        "commit",
        "-m",
        InternalGitCommitSubject.preservePrimaryWorktree,
      ],
      { cwd: input.primaryDir, timeoutProfile: "default" },
    )
    if (commit.exitCode !== 0) {
      throw new MergeFailedError({
        message:
          `mergeWithMerge(${input.branch}): primary worktree is dirty but recovery commit failed ` +
          `for ${input.dirtyPaths.length} path(s): ${errorText(commit)}`,
        branch: input.branch,
        stderr: errorText(commit),
      })
    }
    const head = await runGit(["rev-parse", "HEAD"], {
      cwd: input.primaryDir,
      timeoutProfile: "fast",
    })
    if (head.exitCode !== 0) {
      throw new MergeFailedError({
        message:
          `mergeWithMerge(${input.branch}): primary recovery commit succeeded but HEAD could not ` +
          `be resolved: ${errorText(head)}`,
        branch: input.branch,
        stderr: errorText(head),
      })
    }
    return outputText(head.stdout)
  }

  function dirtyStatusPaths(lines: string[]): string[] {
    return uniqueStrings(lines.flatMap((line) => statusLinePaths(line)))
  }

  function statusLinePaths(line: string): string[] {
    const file = statusLinePathPayload(line).trim()
    if (!file) return []
    const renameArrow = " -> "
    if (!file.includes(renameArrow)) return [file]
    return file
      .split(renameArrow)
      .map((part) => part.trim())
      .filter(Boolean)
  }

  function statusLinePathPayload(line: string): string {
    if (line.startsWith("?? ")) return line.slice(3)
    if (line.length >= 3 && line[2] === " ") return line.slice(3)
    if (line.length >= 2 && line[1] === " ") return line.slice(2)
    return line.slice(3)
  }

  function uniqueStrings(input: string[]): string[] {
    return [...new Set(input)]
  }

  function chunks<T>(input: T[], size: number): T[][] {
    const out: T[][] = []
    for (let index = 0; index < input.length; index += size) {
      out.push(input.slice(index, index + size))
    }
    return out
  }

  function failed(result: { stdout?: Uint8Array; stderr?: Uint8Array }) {
    return [outputText(result.stderr), outputText(result.stdout)].filter(Boolean).flatMap((chunk) =>
      chunk
        .split("\n")
        .map((line) => line.trim())
        .flatMap((line) => {
          const match = line.match(/^warning:\s+failed to remove\s+(.+):\s+/i)
          if (!match) return []
          const value = match[1]?.trim().replace(/^['"]|['"]$/g, "")
          if (!value) return []
          return [value]
        }),
    )
  }

  async function prune(root: string, entries: string[]) {
    const base = await canonical(root)
    await Promise.all(
      entries.map(async (entry) => {
        const target = await canonical(path.resolve(root, entry))
        if (target === base) return
        if (!target.startsWith(`${base}${path.sep}`)) return
        await fs.rm(target, { recursive: true, force: true }).catch(() => undefined)
      }),
    )
  }

  async function sweep(root: string) {
    const first = await runGit(["clean", "-ffdx"], { cwd: root, timeoutProfile: "default" })
    if (first.exitCode === 0) return first

    const entries = failed(first)
    if (!entries.length) return first

    await prune(root, entries)
    return runGit(["clean", "-ffdx"], { cwd: root, timeoutProfile: "default" })
  }

  async function canonical(input: string) {
    const abs = path.resolve(input)
    const real = await fs.realpath(abs).catch(() => abs)
    const normalized = path.normalize(real)
    const insensitive = await isCaseInsensitiveFilesystem(normalized)
    return insensitive ? normalized.toLowerCase() : normalized
  }

  type PrimaryWorktreeInfo = { directory: string; branch: string }
  export type RegisteredWorktreeEntry = {
    path: string
    branch?: string
    locked?: boolean
    lockReason?: string
    prunable?: boolean
    prunableReason?: string
  }

  function parseWorktreeList(stdout: Uint8Array | Buffer | undefined): RegisteredWorktreeEntry[] {
    const entries: RegisteredWorktreeEntry[] = []
    for (const line of outputText(stdout)
      .split("\n")
      .map((item) => item.trim())) {
      if (!line) continue
      if (line.startsWith("worktree ")) {
        const value = line.slice("worktree ".length).trim()
        if (value) entries.push({ path: value })
        continue
      }
      const current = entries[entries.length - 1]
      if (!current) continue
      if (line.startsWith("branch ")) {
        current.branch = line
          .slice("branch ".length)
          .trim()
          .replace(/^refs\/heads\//, "")
        continue
      }
      if (line.startsWith("locked")) {
        current.locked = true
        const reason = line.slice("locked".length).trim()
        if (reason) current.lockReason = reason
        continue
      }
      if (line.startsWith("prunable")) {
        current.prunable = true
        const reason = line.slice("prunable".length).trim()
        if (reason) current.prunableReason = reason
      }
    }
    return entries
  }

  export async function listRegisteredWorktrees(primaryDir = Instance.worktree): Promise<RegisteredWorktreeEntry[]> {
    const requestKey = path.resolve(primaryDir)
    const active = registeredWorktreeListRequests.get(requestKey)
    if (active) return (await active).map((entry) => ({ ...entry }))

    const request = (async () => {
      const list = await runGit(["worktree", "list", "--porcelain"], {
        cwd: primaryDir,
        timeoutProfile: "default",
      })
      if (list.exitCode !== 0) {
        throw new RemoveFailedError({ message: errorText(list) || "Failed to read git worktrees" })
      }
      return parseWorktreeList(list.stdout)
    })()
    registeredWorktreeListRequests.set(requestKey, request)
    try {
      return (await request).map((entry) => ({ ...entry }))
    } finally {
      if (registeredWorktreeListRequests.get(requestKey) === request) {
        registeredWorktreeListRequests.delete(requestKey)
      }
    }
  }

  export async function isManagedWorktreeDirectory(primaryDir: string, directory: string): Promise<boolean> {
    const target = await canonical(directory)
    return ProjectRuntimePaths.isManagedWorktreePath(await canonical(primaryDir), target)
  }

  async function findWorktreeEntry(stdout: Uint8Array | Buffer | undefined, directory: string) {
    for (const entry of parseWorktreeList(stdout)) {
      const key = await canonical(entry.path)
      if (key === directory) return entry
    }
  }

  /**
   * Resolve the primary worktree and its currently checked-out branch.
   * `git worktree list --porcelain` reports the original worktree first;
   * child worktrees follow. Managed branches are created from this branch and
   * merge_back publishes back to this same branch, whether it is dev, trunk,
   * main, master, or another local branch name.
   */
  async function primaryWorktreeInfo(): Promise<PrimaryWorktreeInfo> {
    const list = await runGit(["worktree", "list", "--porcelain"], {
      cwd: Instance.worktree,
      timeoutProfile: "default",
    })
    if (list.exitCode !== 0) {
      throw new Error(errorText(list) || "Failed to read git worktrees")
    }

    const firstEntry = parseWorktreeList(list.stdout)[0]
    const first: { directory?: string; branch?: string } = {
      directory: firstEntry?.path,
      branch: firstEntry?.branch,
    }

    if (!first.directory) {
      throw new Error("Primary worktree not found")
    }
    if (!first.branch) {
      throw new Error(`Primary worktree is detached: ${first.directory}`)
    }
    return { directory: first.directory, branch: first.branch }
  }

  export const NamedPlan = z
    .object({
      projectID: z.string().min(1),
      projectGeneration: z.string().uuid(),
      primaryDirectory: z.string().min(1),
      primaryBranch: z.string().min(1),
      info: Info,
    })
    .strict()
  export type NamedPlan = z.infer<typeof NamedPlan>

  /** Resolve the immutable path/ref identity of a caller-named managed tree.
   * This is read-only and must run before a higher-level lifecycle publishes
   * its intent; `create` consumes the same name and therefore the same plan. */
  export async function planNamed(name: string): Promise<NamedPlan> {
    if (!Project.isGitRepo(Instance.directory)) {
      throw new NotGitError({ message: "Worktrees are only supported for git projects" })
    }
    const base = slug(name)
    if (!base) throw new CreateFailedError({ message: "Managed worktree name must not be empty" })
    const primary = await primaryWorktreeInfo()
    const projectOccurrence = Project.occurrence(Instance.project.id)
    if (!projectOccurrence) throw new CreateFailedError({ message: `Project not found: ${Instance.project.id}` })
    return NamedPlan.parse({
      projectID: Instance.project.id,
      projectGeneration: projectOccurrence.generation,
      primaryDirectory: primary.directory,
      primaryBranch: primary.branch,
      info: {
        name: base,
        branch: `opencorvus/${base}`,
        directory: path.join(worktreesRoot(primary.directory), base),
      },
    })
  }

  export async function listProjectWorktrees(projectID = Instance.project.id): Promise<ProjectWorktreeInfo[]> {
    if (!Project.isGitRepo(Instance.directory)) {
      throw new NotGitError({ message: "Worktrees are only supported for git projects" })
    }

    const parsed = await listRegisteredWorktrees(Instance.worktree)
    const primaryEntry = parsed[0]
    if (!primaryEntry?.path) {
      throw new RemoveFailedError({ message: "Primary worktree not found" })
    }
    const primaryKey = await canonical(primaryEntry.path)
    const out: ProjectWorktreeInfo[] = []
    for (const entry of parsed) {
      const key = await canonical(entry.path)
      const isPrimary = key === primaryKey
      const owned = ProjectRuntimePaths.isManagedWorktreePath(primaryKey, key)
      if (!isPrimary && !owned) continue
      const status = isPrimary ? "primary" : "managed"
      out.push(
        ProjectWorktreeInfo.parse({
          name: path.basename(entry.path),
          branch: entry.branch,
          directory: entry.path,
          status,
          removable: owned && entry.locked !== true && !SessionPromptState.hasOwnedPromptInDirectory(entry.path),
        }),
      )
    }
    return out
  }

  export const removeProjectWorktree = fn(RemoveInput, async (input) => {
    const directory = await canonical(input.directory)
    let target: ProjectWorktreeInfo | undefined
    for (const entry of await listProjectWorktrees(Instance.project.id)) {
      if (!entry.removable) continue
      if ((await canonical(entry.directory)) === directory) {
        target = entry
        break
      }
    }
    if (!target) {
      throw new NotFoundError({ message: `Project worktree not found: ${input.directory}` })
    }
    const result = await removeManagedProjectWorktreeDirectory({
      projectID: Instance.project.id,
      directory: target.directory,
      releaseSandboxOwnership: true,
    })
    if (!result.removed) {
      throw new RemoveFailedError({ message: `Worktree is actively owned: ${target.directory}` })
    }
    return { target, receipt: result.receipt }
  })

  export const resetProjectWorktree = fn(ResetInput, async (input) => {
    const directory = await canonical(input.directory)
    let target: ProjectWorktreeInfo | undefined
    for (const entry of await listProjectWorktrees(Instance.project.id)) {
      if (!entry.removable) continue
      if ((await canonical(entry.directory)) === directory) {
        target = entry
        break
      }
    }
    if (!target) {
      throw new NotFoundError({ message: `Project worktree not found: ${input.directory}` })
    }
    await reset({ directory: target.directory, baseRef: input.baseRef })
    return target
  })

  export const ManagedRemovalPlan = z
    .object({
      version: z.literal(2),
      projectID: z.string().min(1),
      projectGeneration: z.string().uuid(),
      primaryDirectory: z.string().min(1),
      directoryKey: z.string().min(1),
      device: z.number(),
      inode: z.number(),
      birthtimeMs: z.number(),
      authority: z.discriminatedUnion("kind", [
        z
          .object({
            kind: z.literal("public"),
            releaseSandboxOwnership: z.boolean(),
          })
          .strict(),
        z.object({ kind: z.literal("project_delete") }).strict(),
      ]),
      registration: z
        .object({
          directory: z.string().min(1),
          branch: z.string().min(1),
          targetCommit: z.string().regex(/^[a-f0-9]{40,64}$/),
        })
        .strict(),
      sandboxAuthority: z.object({ sandboxes: z.array(z.string()), timeUpdated: z.number() }).nullable(),
      matchedSandboxes: z.array(
        z.object({
          directory: z.string(),
          device: z.number(),
          inode: z.number(),
          birthtimeMs: z.number(),
          symbolicLink: z.boolean(),
        }),
      ),
    })
    .strict()
  export type ManagedRemovalPlan = z.infer<typeof ManagedRemovalPlan>

  function removeOperationID(identity: ManagedRemovalPlan): string {
    return `worktree-remove:${Buffer.from(JSON.stringify(identity), "utf8").toString("base64url")}`
  }

  function parseRemoveOperationID(operationID: string): ManagedRemovalPlan | undefined {
    const prefix = "worktree-remove:"
    if (!operationID.startsWith(prefix)) return undefined
    try {
      return ManagedRemovalPlan.parse(
        JSON.parse(Buffer.from(operationID.slice(prefix.length), "base64url").toString("utf8")),
      )
    } catch {
      return undefined
    }
  }

  async function directoryNamespaceMissing(directory: string): Promise<boolean> {
    try {
      await fs.lstat(directory)
      return false
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return true
      throw error
    }
  }

  class RetainedReclamationConflict extends Error {}

  function namespacePresentSync(directory: string): boolean {
    try {
      fsSync.lstatSync(directory)
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
      throw error
    }
  }

  function aliasQuarantine(identity: ManagedRemovalPlan, alias: string, index: number): string {
    const suffix = createHash("sha256")
      .update(`${removeOperationID(identity)}\0${index}\0${path.resolve(alias)}`)
      .digest("hex")
      .slice(0, 24)
    return `${alias}.opencorvus-remove-${suffix}`
  }

  function matchesAliasOccurrence(
    current: Awaited<ReturnType<typeof fs.lstat>>,
    alias: ManagedRemovalPlan["matchedSandboxes"][number],
  ): boolean {
    return (
      current.dev === alias.device &&
      current.ino === alias.inode &&
      current.birthtimeMs === alias.birthtimeMs &&
      current.isSymbolicLink() === alias.symbolicLink
    )
  }

  async function restoreAliasQuarantine(source: string, quarantine: string): Promise<void> {
    if (!(await directoryNamespaceMissing(source))) return
    await Filesystem.renameDurableNoReplace(quarantine, source).catch(() => undefined)
  }

  async function settleExactSandboxAliases(identity: ManagedRemovalPlan, targetDirectory: string): Promise<void> {
    for (const [index, alias] of identity.matchedSandboxes.entries()) {
      if (!alias.symbolicLink || Project.samePath(alias.directory, targetDirectory)) continue
      const quarantine = aliasQuarantine(identity, alias.directory, index)
      let source: Awaited<ReturnType<typeof fs.lstat>> | undefined
      let retained: Awaited<ReturnType<typeof fs.lstat>> | undefined
      try {
        source = await fs.lstat(alias.directory)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
      try {
        retained = await fs.lstat(quarantine)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
      if (source && retained) {
        throw new RetainedReclamationConflict(`Sandbox alias and quarantine both exist: ${alias.directory}`)
      }
      if (source) {
        await afterSandboxAliasObservation?.(alias.directory)
        await Filesystem.renameDurableNoReplace(alias.directory, quarantine)
        retained = await fs.lstat(quarantine)
      }
      if (!retained) continue
      if (!matchesAliasOccurrence(retained, alias)) {
        await restoreAliasQuarantine(alias.directory, quarantine)
        throw new RetainedReclamationConflict(`Sandbox alias occurrence changed during removal: ${alias.directory}`)
      }
      try {
        await fs.rm(quarantine, { recursive: true, force: false })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
        throw error
      }
    }
  }

  function assertRemovalNamespacesClear(identity: ManagedRemovalPlan, targetDirectory: string): void {
    if (namespacePresentSync(targetDirectory)) {
      throw new RetainedReclamationConflict(`Replacement appeared before retained settlement: ${targetDirectory}`)
    }
    for (const [index, alias] of identity.matchedSandboxes.entries()) {
      if (!alias.symbolicLink || Project.samePath(alias.directory, targetDirectory)) continue
      if (
        !namespacePresentSync(alias.directory) &&
        !namespacePresentSync(aliasQuarantine(identity, alias.directory, index))
      ) {
        continue
      }
      throw new RetainedReclamationConflict(`Sandbox alias namespace changed before settlement: ${alias.directory}`)
    }
  }

  export async function captureManagedRemovalPlan(input: {
    projectID?: string
    directory: string
    authority?: "public" | "project_delete"
    releaseSandboxOwnership?: boolean
  }): Promise<ManagedRemovalPlan> {
    const projectID = input.projectID ?? Instance.project.id
    if (projectID !== Instance.project.id) {
      throw new RemoveFailedError({ message: `Managed worktree Project context mismatch: ${projectID}` })
    }
    const occurrence = await ProjectDirectoryAdmission.observeDirectory(input.directory)
    const directoryIdentity = await Ownership.Worktree.observeIdentity(input.directory, "capture-remove-operation")
    const projectOccurrence = Project.occurrence(projectID)
    if (!projectOccurrence) throw new RemoveFailedError({ message: `Project not found: ${projectID}` })
    return withGitLock(async () => {
      const registered = await listRegisteredWorktrees(Instance.worktree)
      const primaryEntry = registered[0]
      const primaryDirectory = primaryEntry?.path ?? Instance.worktree
      const primaryIdentity = await Ownership.Worktree.observeIdentity(primaryDirectory, "capture-remove-primary")
      if (!ProjectRuntimePaths.isManagedWorktreePath(primaryIdentity.key, directoryIdentity.key)) {
        throw new RemoveFailedError({ message: `Refusing to remove unmanaged project worktree: ${input.directory}` })
      }
      let registration: RegisteredWorktreeEntry | undefined
      for (const entry of registered) {
        if (
          (await Ownership.Worktree.compareIdentity(directoryIdentity, entry.path, "capture-remove-registration")) ===
          "same"
        ) {
          registration = entry
          break
        }
      }
      const branch = registration?.branch?.replace(/^refs\/heads\//, "")
      if (!registration?.path || !branch) {
        throw new RemoveFailedError({ message: `Managed worktree has no exact Git registration: ${input.directory}` })
      }
      const target = await runGit(["rev-parse", "--verify", `${branch}^{commit}`], {
        cwd: primaryDirectory,
        timeoutProfile: "fast",
      })
      const targetCommit = outputText(target.stdout).trim()
      if (target.exitCode !== 0 || !/^[a-f0-9]{40,64}$/.test(targetCommit)) {
        throw new RemoveFailedError({
          message: errorText(target) || `Managed worktree branch cannot be resolved: ${branch}`,
        })
      }
      const sandboxAuthority = Project.exactSandboxAuthority(projectID) ?? null
      const matchedSandboxes: ManagedRemovalPlan["matchedSandboxes"] = []
      for (const sandbox of sandboxAuthority?.sandboxes ?? []) {
        if (
          (await Ownership.Worktree.compareIdentity(directoryIdentity, sandbox, "capture-remove-sandbox")) !== "same"
        ) {
          continue
        }
        const alias = await fs.lstat(sandbox)
        matchedSandboxes.push({
          directory: sandbox,
          device: alias.dev,
          inode: alias.ino,
          birthtimeMs: alias.birthtimeMs,
          symbolicLink: alias.isSymbolicLink(),
        })
      }
      if (matchedSandboxes.length === 0 && input.authority === "project_delete") {
        throw new RemoveFailedError({
          message: `Managed worktree has no Project sandbox authority: ${input.directory}`,
        })
      }
      return ManagedRemovalPlan.parse({
        version: 2,
        projectID,
        projectGeneration: projectOccurrence.generation,
        primaryDirectory,
        directoryKey: await ProjectDirectoryAdmission.key(input.directory),
        device: occurrence.device,
        inode: occurrence.inode,
        birthtimeMs: occurrence.birthtimeMs,
        authority:
          input.authority === "project_delete"
            ? { kind: "project_delete" }
            : { kind: "public", releaseSandboxOwnership: input.releaseSandboxOwnership === true },
        registration: { directory: registration.path, branch, targetCommit },
        sandboxAuthority,
        matchedSandboxes,
      })
    })
  }

  export async function inspectManagedRemovalSettlement(planInput: ManagedRemovalPlan): Promise<{
    directoryRemoved: boolean
    registrationPruned: boolean
    branchRemoved: boolean
    sandboxSettled: boolean
  }> {
    const plan = ManagedRemovalPlan.parse(planInput)
    const directoryRemoved = await directoryNamespaceMissing(plan.registration.directory)
    return withGitLock(async () => {
      const registrationPruned = !(await listRegisteredWorktrees(plan.primaryDirectory)).some((entry) =>
        Project.samePath(entry.path, plan.registration.directory),
      )
      const branch = await runGit(["show-ref", "--verify", "--quiet", `refs/heads/${plan.registration.branch}`], {
        cwd: plan.primaryDirectory,
        timeoutProfile: "fast",
      })
      let branchRemoved = false
      if (branch.exitCode === 1) {
        branchRemoved = true
      } else if (branch.exitCode !== 0) {
        throw new RemoveFailedError({
          message: errorText(branch) || `Failed to inspect worktree branch ${plan.registration.branch}`,
        })
      } else {
        const target = await runGit(["rev-parse", "--verify", `${plan.registration.branch}^{commit}`], {
          cwd: plan.primaryDirectory,
          timeoutProfile: "fast",
        })
        const currentTarget = outputText(target.stdout).trim()
        if (target.exitCode !== 0) {
          throw new RemoveFailedError({
            message: errorText(target) || `Failed to resolve worktree branch ${plan.registration.branch}`,
          })
        }
        if (currentTarget !== plan.registration.targetCommit) {
          throw new RemoveFailedError({
            message:
              `Worktree branch ${plan.registration.branch} was replaced: expected ` +
              `${plan.registration.targetCommit}, observed ${currentTarget}`,
          })
        }
      }
      const sandbox = Project.exactSandboxAuthority(plan.projectID)
      const sandboxSettled =
        plan.authority.kind === "project_delete"
          ? JSON.stringify(sandbox ?? null) === JSON.stringify(plan.sandboxAuthority)
          : plan.authority.releaseSandboxOwnership
            ? plan.matchedSandboxes.every(
                (matched) => !(sandbox?.sandboxes ?? []).some((entry) => Project.samePath(entry, matched.directory)),
              )
            : JSON.stringify(sandbox ?? null) === JSON.stringify(plan.sandboxAuthority)
      return { directoryRemoved, registrationPruned, branchRemoved, sandboxSettled }
    })
  }

  export async function removeManagedProjectWorktreeDirectory(input: {
    projectID?: string
    directory: string
    plan?: ManagedRemovalPlan
    projectDeletionAdmission?: ProjectDeletionRegistryAdmission
    releaseSandboxOwnership?: boolean
    ownershipAcquisition?: WorktreeOwnershipCriticalSection.Acquisition
  }): Promise<{
    directory: string
    removed: boolean
    proof?: "owned" | "ownerless"
    receipt?: import("@opencorvus-ai/transport-protocol").ProjectWorktreeDeleteReceipt
  }> {
    const projectID = input.projectID ?? Instance.project.id
    const projectOccurrence = Project.occurrence(projectID)
    const operationDirectoryKey = await ProjectDirectoryAdmission.key(input.directory)
    let occurrence: ProjectDirectoryAdmission.DirectoryOccurrence | undefined
    try {
      occurrence = await ProjectDirectoryAdmission.observeDirectory(input.directory)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    const activeMutation = occurrence
      ? await ProjectDirectoryAdmission.activeOverlappingOperation(input.directory)
      : undefined
    if (
      activeMutation &&
      activeMutation.kind !== "reclamation" &&
      activeMutation.ownerObservation !== "dead_or_reused"
    ) {
      return { directory: input.directory, removed: false, proof: "owned" }
    }
    const activePartial = occurrence
      ? undefined
      : await ProjectDirectoryAdmission.activeExactOperation(input.directory, "reclamation")
    let removalIdentity = input.plan ? ManagedRemovalPlan.parse(input.plan) : undefined
    if (!removalIdentity && occurrence) {
      removalIdentity = await captureManagedRemovalPlan({
        projectID,
        directory: input.directory,
        releaseSandboxOwnership: input.releaseSandboxOwnership === true,
      })
    } else if (!removalIdentity && activePartial) {
      removalIdentity = parseRemoveOperationID(
        ProjectDirectoryAdmission.domainOperationID(projectID, activePartial.operationID) ?? "",
      )
    }
    if (
      !removalIdentity ||
      !projectOccurrence ||
      removalIdentity.projectID !== projectID ||
      removalIdentity.projectGeneration !== projectOccurrence.generation ||
      removalIdentity.directoryKey !== operationDirectoryKey ||
      (occurrence !== undefined &&
        (removalIdentity.device !== occurrence.device ||
          removalIdentity.inode !== occurrence.inode ||
          removalIdentity.birthtimeMs !== occurrence.birthtimeMs))
    ) {
      return { directory: input.directory, removed: false, proof: "owned" }
    }
    if (
      (removalIdentity.authority.kind === "public" &&
        removalIdentity.authority.releaseSandboxOwnership !== (input.releaseSandboxOwnership === true)) ||
      (removalIdentity.authority.kind === "project_delete" && !input.projectDeletionAdmission)
    ) {
      return { directory: input.directory, removed: false, proof: "owned" }
    }
    if (removalIdentity.authority.kind === "project_delete") {
      const deletion = input.projectDeletionAdmission
      if (
        !deletion ||
        deletion.projectID !== projectID ||
        deletion.snapshot.generation !== removalIdentity.projectGeneration
      ) {
        throw new RemoveFailedError({ message: `Managed worktree Project-deletion authority is missing or changed` })
      }
      Database.use((db) => assertProjectDeletionRegistryAdmission(db, deletion))
    } else if (input.projectDeletionAdmission) {
      throw new RemoveFailedError({ message: `Public managed-worktree removal cannot use Project-deletion authority` })
    }
    if (
      activePartial &&
      ProjectDirectoryAdmission.domainOperationID(projectID, activePartial.operationID) !==
        removeOperationID(removalIdentity)
    ) {
      return { directory: input.directory, removed: false, proof: "owned" }
    }
    const immutableRemoval = removalIdentity
    const operationID =
      activePartial?.operationID ??
      ProjectDirectoryAdmission.scopeOperationID(projectID, removeOperationID(removalIdentity))
    const acquired = await ProjectDirectoryAdmission.acquire({
      directory: input.directory,
      operationID,
      kind: "reclamation",
      occurrence,
      expectedDirectoryKey: operationDirectoryKey,
    }).catch((error) => {
      if (ProjectDirectoryAdmission.ClosedError.isInstance(error)) return undefined
      throw error
    })
    if (!acquired) return { directory: input.directory, removed: false, proof: "owned" }
    if (acquired.outcome !== "acquired") throw new Error(`Managed worktree reclamation admission was not acquired`)
    const admission = acquired.token
    let effectStarted = false
    let settled = false
    try {
      if (activePartial && !(await directoryNamespaceMissing(input.directory))) {
        throw new RetainedReclamationConflict(`Replacement appeared during retained removal: ${input.directory}`)
      }
      const outcome = await withGitLock(async () => {
        const registered = await listRegisteredWorktrees(Instance.worktree)
        const primary = immutableRemoval.primaryDirectory
        const primaryIdentity = await Ownership.Worktree.observeIdentity(primary, "resolve-primary-worktree")
        const directoryIdentity = await Ownership.Worktree.observeIdentity(input.directory, "resolve-target-worktree")
        if (occurrence && !(await ProjectDirectoryAdmission.ownsCurrentOccurrence(admission, input.directory))) {
          throw new RemoveFailedError({ message: `Worktree occurrence changed before removal: ${input.directory}` })
        }
        const managedRoot = ProjectRuntimePaths.isManagedWorktreePath(primaryIdentity.key, directoryIdentity.key)
        if (!managedRoot) {
          throw new RemoveFailedError({ message: `Refusing to remove unmanaged project worktree: ${input.directory}` })
        }
        let registeredTarget: RegisteredWorktreeEntry | undefined
        for (const entry of registered) {
          const sameTarget =
            directoryIdentity.status === "missing"
              ? (await ProjectDirectoryAdmission.key(entry.path)) === operationDirectoryKey
              : (await Ownership.Worktree.compareIdentity(
                  directoryIdentity,
                  entry.path,
                  "compare-registered-worktree",
                )) === "same"
          if (sameTarget) {
            registeredTarget = entry
            break
          }
        }
        if (
          registeredTarget &&
          (registeredTarget.branch?.replace(/^refs\/heads\//, "") !== immutableRemoval.registration.branch ||
            (await ProjectDirectoryAdmission.key(registeredTarget.path)) !==
              (await ProjectDirectoryAdmission.key(immutableRemoval.registration.directory)))
        ) {
          throw new RetainedReclamationConflict(`Git worktree registration changed during removal: ${input.directory}`)
        }
        const matchedSandboxes = immutableRemoval.matchedSandboxes.map((sandbox) => sandbox.directory)
        const sandboxAuthority = immutableRemoval.sandboxAuthority ?? undefined
        const projectDelete = immutableRemoval.authority.kind === "project_delete"
        const releaseSandboxOwnership =
          immutableRemoval.authority.kind === "public" && immutableRemoval.authority.releaseSandboxOwnership
        const result = await WorktreeOwnershipCriticalSection.remove({
          directory: directoryIdentity.key,
          acquisition: input.ownershipAcquisition,
          proveOwnerless: async () => {
            if (activePartial && !(await directoryNamespaceMissing(input.directory))) {
              throw new RetainedReclamationConflict(
                `Replacement appeared before retained owner proof: ${input.directory}`,
              )
            }
            if (!projectDelete) {
              const sessions = Database.use((db) =>
                db
                  .select({ directory: SessionTable.directory })
                  .from(SessionTable)
                  .where(eq(SessionTable.project_id, projectID))
                  .all(),
              )
              for (const session of sessions) {
                if (
                  (await Ownership.Worktree.compareIdentity(
                    directoryIdentity,
                    session.directory,
                    "compare-session-directory-owner",
                  )) === "same"
                ) {
                  return WorktreeOwnershipCriticalSection.owned()
                }
              }
              for (const binding of activeTaskProcessBindingRoots({
                projectID,
                diagnosticRoot: primaryIdentity.requested,
              })) {
                if (
                  (await Ownership.Worktree.compareIdentity(
                    directoryIdentity,
                    binding.directory,
                    "compare-process-binding-owner",
                  )) === "same"
                ) {
                  return WorktreeOwnershipCriticalSection.owned()
                }
              }
            }
            const markerProof = await Ownership.Worktree.proveOwnerless({
              primaryWorktreeDir: primaryIdentity.requested,
              worktreeDir: directoryIdentity.requested,
              canReleaseDeadOwner: (taskID) => {
                const task = findTask(taskID)
                return !task || (projectDelete && task.project_id === projectID && isTaskTerminal(task))
              },
            })
            if (markerProof.status === "owned") return WorktreeOwnershipCriticalSection.owned()
            const currentSandboxAuthority = Project.exactSandboxAuthority(projectID)
            if (JSON.stringify(currentSandboxAuthority ?? null) !== JSON.stringify(immutableRemoval.sandboxAuthority)) {
              if (activePartial)
                throw new RetainedReclamationConflict(`Sandbox authority changed during retained removal`)
              return WorktreeOwnershipCriticalSection.owned()
            }
            return WorktreeOwnershipCriticalSection.ownerless(markerProof)
          },
          remove: async (proof) => {
            if (activePartial && !(await directoryNamespaceMissing(input.directory))) {
              throw new RetainedReclamationConflict(`Replacement appeared before retained destructive effect`)
            }
            if (occurrence && !(await ProjectDirectoryAdmission.ownsCurrentOccurrence(admission, input.directory))) {
              throw new RemoveFailedError({
                message: `Worktree occurrence changed before destructive effect: ${input.directory}`,
              })
            }
            if (projectDelete) {
              Database.use((db) => assertProjectDeletionRegistryAdmission(db, input.projectDeletionAdmission!))
            }
            effectStarted = true
            await removePhysical({
              directory: directoryIdentity,
              primary: primaryIdentity,
              registered: registeredTarget,
              registration: immutableRemoval.registration,
            })
            await settleExactSandboxAliases(immutableRemoval, input.directory)
            if (activePartial && !(await directoryNamespaceMissing(input.directory))) {
              throw new RetainedReclamationConflict(`Replacement appeared before retained settlement`)
            }
            const preservationErrors: InstanceType<typeof Ownership.Worktree.ObservationError>[] = []
            const markerCleanup = await Ownership.Worktree.settleOwnerlessProof(proof.evidence)
            if (markerCleanup.integrity.status !== "complete")
              preservationErrors.push(...markerCleanup.integrity.errors)
            await beforeRemovalSettlement?.(input.directory)
            if (preservationErrors.length === 0) {
              try {
                if (projectDelete) {
                  ProjectDirectoryAdmission.settle(admission, (db) => {
                    assertRemovalNamespacesClear(immutableRemoval, input.directory)
                    assertProjectDeletionRegistryAdmission(db, input.projectDeletionAdmission!)
                  })
                } else if (releaseSandboxOwnership && matchedSandboxes.length > 0) {
                  if (!sandboxAuthority) throw new Error(`Project sandbox authority disappeared: ${projectID}`)
                  Project.removeExactSandboxesWithAdmission({
                    id: projectID,
                    directories: matchedSandboxes,
                    expected: sandboxAuthority,
                    admission,
                    assertFilesystemSettlement: () => assertRemovalNamespacesClear(immutableRemoval, input.directory),
                  })
                } else {
                  ProjectDirectoryAdmission.settle(admission, () =>
                    assertRemovalNamespacesClear(immutableRemoval, input.directory),
                  )
                }
                settled = true
              } catch (error) {
                if (error instanceof RetainedReclamationConflict) throw error
                preservationErrors.push(
                  Ownership.observationFailure({
                    operation: "release-project-sandbox",
                    code: "SANDBOX_RELEASE_FAILED",
                    scope: "worktree-cleanup",
                    diagnosticPath: input.directory,
                    cause: error,
                    message: "Worktree was removed but cleanup remains preserved",
                  }),
                )
              }
            }
            return preservationErrors
          },
        })
        if (result.status === "owned") {
          ProjectDirectoryAdmission.settle(admission, () => undefined)
          settled = true
          return { directory: input.directory, removed: false, proof: "owned" as const }
        }
        return {
          directory: input.directory,
          removed: true,
          proof: "ownerless" as const,
          receipt: result.value.length
            ? {
                ok: true as const,
                status: "removed_with_preservation" as const,
                preservations: result.value.map((preservation) => ({
                  operation: preservation.data.operation,
                  code: preservation.data.code,
                  scope: "worktree-cleanup" as const,
                  message: preservation.data.message,
                })),
              }
            : { ok: true as const, status: "removed" as const },
        }
      })
      return outcome
    } catch (error) {
      if (error instanceof RetainedReclamationConflict) {
        return { directory: input.directory, removed: false, proof: "owned" }
      }
      if (!effectStarted && !settled) {
        ProjectDirectoryAdmission.settle(admission, () => undefined)
        settled = true
      }
      throw error
    }
  }

  /** Hold one exact physical-directory occurrence across sandbox admission
   * and the durable Task process-binding publication that makes it owned. */
  export async function withSandboxAdmission<T>(
    directory: string,
    admit: (admission: ProjectDirectoryAdmission.Token) => Promise<T>,
  ): Promise<T> {
    const occurrence = await ProjectDirectoryAdmission.observeDirectory(directory)
    const acquisition = WorktreeOwnershipCriticalSection.acquire(occurrence.directoryKey)
    let durable:
      | Extract<Awaited<ReturnType<typeof ProjectDirectoryAdmission.acquire>>, { outcome: "acquired" }>
      | undefined
    try {
      const acquired = await ProjectDirectoryAdmission.acquire({
        directory,
        operationID: randomUUID(),
        kind: "registration",
        occurrence,
      })
      if (acquired.outcome !== "acquired") throw new Error(`Task execution directory admission was not acquired`)
      durable = acquired
      const token = acquired.token
      return await ProjectDirectoryAdmission.provide(token, () => withGitLock(() => admit(token)))
    } finally {
      try {
        if (durable) ProjectDirectoryAdmission.settle(durable.token, () => undefined)
      } finally {
        acquisition[Symbol.dispose]()
      }
    }
  }

  export async function renewManagedWorktreeOwner(input: {
    projectID?: string
    directory: string
    taskID: string
    sessionID: string
  }): Promise<void> {
    await withGitLock(async () => {
      const directory = await canonical(input.directory)
      const primaryEntry = (await listRegisteredWorktrees(Instance.worktree))[0]
      const primary = primaryEntry?.path ?? Instance.worktree
      if (!(await isManagedWorktreeDirectory(primary, directory))) {
        throw new CreateFailedError({ message: `Refusing to own unmanaged project worktree: ${input.directory}` })
      }
      await Project.addSandbox(input.projectID ?? Instance.project.id, input.directory)
      await Ownership.Worktree.record({
        primaryWorktreeDir: primary,
        worktreeDir: input.directory,
        taskID: input.taskID,
        sessionID: input.sessionID,
      })
    })
  }

  export async function releaseManagedWorktreeSessionOwner(input: {
    projectID: string
    primaryWorktreeDir: string
    directory: string
    sessionID: string
  }): Promise<Ownership.ReleaseReceipt> {
    return releaseManagedSessionOwner(input)
  }

  export async function releaseManagedWorktreeTaskOwners(
    taskID: string,
    options?: { signal?: AbortSignal },
  ): Promise<void> {
    options?.signal?.throwIfAborted()
    await withGitLock(async () => {
      options?.signal?.throwIfAborted()
      Ownership.Worktree.requireCompleteRelease(
        await Ownership.Worktree.releaseTaskOwners({ primaryWorktreeDir: Instance.project.worktree, taskID }),
      )
      options?.signal?.throwIfAborted()
    })
  }

  export async function reconcileOrphanWorktreeOwners(): Promise<Ownership.Worktree.ReconcileReceipt> {
    return withGitLock(async () => {
      const primaryWorktreeDir = Instance.project.worktree
      const result = await Ownership.Worktree.reconcileOrphans({
        primaryWorktreeDir,
        canReleaseDeadOwner: (taskID) => {
          const task = findTask(taskID)
          return !task || isTaskTerminal(task)
        },
      })
      return result
    })
  }

  async function isCaseInsensitiveFilesystem(target: string) {
    if (process.platform === "win32") return true
    if (process.platform !== "darwin") return false

    const absolute = path.resolve(target)
    const root = path.parse(absolute).root || "/"
    const cached = caseInsensitiveCache.get(root)
    if (cached !== undefined) return cached

    const dir = await fs.realpath(path.dirname(absolute)).catch(() => path.dirname(absolute))
    const parent = path.dirname(dir)
    const base = path.basename(dir)
    const index = base.search(/[a-zA-Z]/)
    if (index < 0 || parent === dir) {
      caseInsensitiveCache.set(root, false)
      return false
    }

    const toggled =
      base.slice(0, index) +
      (base[index] === base[index].toLowerCase() ? base[index].toUpperCase() : base[index].toLowerCase()) +
      base.slice(index + 1)
    const probe = path.join(parent, toggled)

    const insensitive = await Promise.all([
      fs.stat(dir).catch(() => undefined),
      fs.stat(probe).catch(() => undefined),
    ]).then(([original, variant]) =>
      Boolean(original && variant && original.dev === variant.dev && original.ino === variant.ino),
    )

    caseInsensitiveCache.set(root, insensitive)
    return insensitive
  }

  /** Remove a leftover worktree directory and its branch ref so the same
   *  `name` can be reused. Called only when the caller explicitly passed a
   *  `base` name — i.e. asked for a deterministic physical path. Any
   *  failure throws; we do NOT silently fall back to a randomized suffix
   *  because that rotation is exactly what silently breaks prompt-cache
   *  continuity across retries (new path → new system-prompt bytes → new
   *  1h system cache). Surfacing a hard error here is the contract: the
   *  operator sees that reclaim failed and can intervene. */
  async function reclaimInfo(
    info: Info,
    ownershipAcquisition: WorktreeOwnershipCriticalSection.Acquisition,
  ): Promise<Info> {
    const { name, branch, directory } = info
    const ref = `refs/heads/${branch}`

    const dirExists = await exists(directory)
    const branchCheck = await runGit(["show-ref", "--verify", "--quiet", ref], {
      cwd: Instance.worktree,
      timeoutProfile: "fast",
    })
    const branchExists = branchCheck.exitCode === 0

    if (dirExists || branchExists) {
      log.info("worktree reclaim: stale artifacts present, cleaning before reuse", {
        name,
        directory,
        dirExists,
        branchExists,
      })
      // Delegate directory teardown to remove() — it unregisters the git
      // worktree, stops fsmonitor, rm -rf's the directory, AND deletes the
      // associated branch if the worktree is still registered. If it throws,
      // let it propagate: the caller must see the reclaim failure, not get
      // a silently renamed workspace.
      if (dirExists) {
        await removeWithAcquisition({ directory }, ownershipAcquisition)
      }
      // Branch may still be there if: (a) dir didn't exist but a dangling
      // branch ref was left over from a prior crash, or (b) the worktree was
      // never registered against this branch (so remove() didn't touch it).
      // Re-probe and clean up independently.
      const stillExists = await runGit(["show-ref", "--verify", "--quiet", ref], {
        cwd: Instance.worktree,
        timeoutProfile: "fast",
      })
      if (stillExists.exitCode === 0) {
        const del = await runGit(["branch", "-D", branch], {
          cwd: Instance.worktree,
          timeoutProfile: "fast",
        })
        if (del.exitCode !== 0) {
          throw new CreateFailedError({
            message:
              `worktree reclaim: failed to delete stale branch ${branch}: ` + (errorText(del) || "unknown error"),
          })
        }
      }
      // Sanity check — if anything is still there after reclaim, fail loud.
      if (await exists(directory)) {
        throw new CreateFailedError({
          message: `worktree reclaim: directory still present after remove: ${directory}`,
        })
      }
    }

    return Info.parse({ name, branch, directory })
  }

  async function candidate(root: string) {
    // Non-deterministic path: caller didn't name the workspace. Try a random
    // name; retry on conflict (collisions here are rare and non-deterministic,
    // so iterating is a genuine retry, not a fallback that masks a lifecycle
    // bug the way the old base-name-plus-suffix branch did).
    for (let attempt = 0; attempt < 26; attempt++) {
      const name = randomName()
      const branch = `opencorvus/${name}`
      const directory = path.join(root, name)

      if (await exists(directory)) continue

      const ref = `refs/heads/${branch}`
      const branchCheck = await runGit(["show-ref", "--verify", "--quiet", ref], {
        cwd: Instance.worktree,
        timeoutProfile: "fast",
      })
      if (branchCheck.exitCode === 0) continue

      return Info.parse({ name, branch, directory })
    }

    throw new NameGenerationFailedError({ message: "Failed to generate a unique worktree name" })
  }

  async function runStartCommand(directory: string, cmd: string) {
    if (process.platform === "win32") {
      return $`cmd /c ${cmd}`.nothrow().cwd(directory)
    }
    const shell = Shell.acceptable()
    return $`${shell} -c ${cmd}`.nothrow().cwd(directory)
  }

  type StartKind = "project" | "worktree"

  async function runStartScript(directory: string, cmd: string, kind: StartKind) {
    const text = cmd.trim()
    if (!text) return true

    const ran = await runStartCommand(directory, text)
    if (ran.exitCode === 0) return true

    log.error("worktree start command failed", {
      kind,
      directory,
      message: errorText(ran),
    })
    return false
  }

  async function runStartScripts(directory: string, input: { projectID: string; extra?: string }) {
    const row = Database.use((db) => db.select().from(ProjectTable).where(eq(ProjectTable.id, input.projectID)).get())
    const project = row ? Project.fromRow(row) : undefined
    const startup = project?.commands?.start?.trim() ?? ""
    const ok = await runStartScript(directory, startup, "project")
    if (!ok) return false

    const extra = input.extra ?? ""
    await runStartScript(directory, extra, "worktree")
    return true
  }

  type Gitlink = { object: string; path: string }

  async function readGitlinks(directory: string): Promise<Gitlink[]> {
    const listed = await runGit(["ls-files", "--stage", "-z"], {
      cwd: directory,
      timeoutProfile: "default",
    })
    if (listed.exitCode !== 0) {
      throw new Error(errorText(listed) || "Failed to read gitlinks")
    }

    return new TextDecoder()
      .decode(listed.stdout)
      .split("\0")
      .flatMap((record): Gitlink[] => {
        if (!record) return []
        const match = record.match(/^160000\s+([0-9a-f]+)\s+\d+\t(.+)$/)
        if (!match?.[1] || !match[2]) return []
        return [{ object: match[1], path: match[2] }]
      })
  }

  async function readUrlBackedSubmodulePaths(directory: string): Promise<Set<string>> {
    if (!(await exists(path.join(directory, ".gitmodules")))) return new Set()

    const paths = await runGit(["config", "-f", ".gitmodules", "--get-regexp", "^submodule\\..*\\.path$"], {
      cwd: directory,
      timeoutProfile: "fast",
    })
    if (paths.exitCode === 1) return new Set()
    if (paths.exitCode !== 0) {
      throw new Error(errorText(paths) || "Failed to read .gitmodules paths")
    }

    const result = new Set<string>()
    for (const line of outputText(paths.stdout).split("\n")) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const separator = trimmed.search(/\s/)
      if (separator < 0) continue
      const key = trimmed.slice(0, separator)
      const submodulePath = trimmed.slice(separator).trim()
      const urlKey = key.replace(/\.path$/, ".url")
      const url = await runGit(["config", "-f", ".gitmodules", "--get", urlKey], {
        cwd: directory,
        timeoutProfile: "fast",
      })
      if (url.exitCode === 0 && outputText(url.stdout)) result.add(submodulePath)
    }
    return result
  }

  async function isGitWorkTree(directory: string) {
    const checked = await runGit(["rev-parse", "--is-inside-work-tree"], {
      cwd: directory,
      timeoutProfile: "fast",
    }).catch(() => undefined)
    return checked?.exitCode === 0 && outputText(checked.stdout) === "true"
  }

  function pathInside(root: string, relativePath: string) {
    const base = path.resolve(root)
    const target = path.resolve(base, relativePath)
    const relative = path.relative(base, target)
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Gitlink path escapes worktree root: ${relativePath}`)
    }
    return target
  }

  async function updateUrlBackedGitlinks(directory: string, paths: string[], input?: { force?: boolean }) {
    if (!paths.length) return

    const args = ["-c", "protocol.file.allow=always", "submodule", "update", "--init"]
    if (input?.force) args.push("--force")
    args.push("--", ...paths)

    const updated = await runGit(args, {
      cwd: directory,
      timeoutProfile: "network",
    })
    if (updated.exitCode !== 0) {
      throw new Error(errorText(updated) || "Failed to update URL-backed gitlinks")
    }
  }

  async function materializeLocalGitlink(input: { sourceRoot: string; targetRoot: string; gitlink: Gitlink }) {
    const source = pathInside(input.sourceRoot, input.gitlink.path)
    const target = pathInside(input.targetRoot, input.gitlink.path)
    if (!(await isGitWorkTree(source))) {
      throw new Error(
        `Gitlink ${input.gitlink.path} has no .gitmodules URL and no local nested Git checkout at ${source}`,
      )
    }

    const commit = await runGit(["cat-file", "-e", `${input.gitlink.object}^{commit}`], {
      cwd: source,
      timeoutProfile: "fast",
    })
    if (commit.exitCode !== 0) {
      throw new Error(
        `Local nested Git checkout ${source} does not contain gitlink commit ${input.gitlink.object}: ${errorText(commit)}`,
      )
    }

    await fs.rm(target, { recursive: true, force: true })
    await fs.mkdir(path.dirname(target), { recursive: true })

    const cloned = await runGit(
      ["-c", "protocol.file.allow=always", "clone", "--local", "--no-checkout", source, target],
      {
        cwd: input.targetRoot,
        timeoutProfile: "network",
      },
    )
    if (cloned.exitCode !== 0) {
      throw new Error(errorText(cloned) || `Failed to clone local gitlink ${input.gitlink.path}`)
    }

    const reset = await runGit(["reset", "--hard", input.gitlink.object], {
      cwd: target,
      timeoutProfile: "default",
    })
    if (reset.exitCode !== 0) {
      throw new Error(errorText(reset) || `Failed to checkout local gitlink ${input.gitlink.path}`)
    }
  }

  async function materializeGitlinks(input: { sourceRoot: string; targetRoot: string; force?: boolean }) {
    const gitlinks = await readGitlinks(input.targetRoot)
    if (!gitlinks.length) return

    const urlBackedPaths = await readUrlBackedSubmodulePaths(input.targetRoot)
    const urlBacked = gitlinks.filter((gitlink) => urlBackedPaths.has(gitlink.path))
    await updateUrlBackedGitlinks(
      input.targetRoot,
      urlBacked.map((gitlink) => gitlink.path),
      {
        force: input.force,
      },
    )

    for (const gitlink of gitlinks) {
      if (urlBackedPaths.has(gitlink.path)) continue
      await materializeLocalGitlink({
        sourceRoot: input.sourceRoot,
        targetRoot: input.targetRoot,
        gitlink,
      })
    }

    for (const gitlink of gitlinks) {
      const target = pathInside(input.targetRoot, gitlink.path)
      if (!(await isGitWorkTree(target))) {
        throw new Error(`Gitlink ${gitlink.path} was not materialized at ${target}`)
      }
      const source = pathInside(input.sourceRoot, gitlink.path)
      await materializeGitlinks({
        sourceRoot: (await isGitWorkTree(source)) ? source : target,
        targetRoot: target,
        force: input.force,
      })
    }
  }

  async function resetMaterializedGitlinks(directory: string) {
    const gitlinks = await readGitlinks(directory)
    for (const gitlink of gitlinks) {
      const target = pathInside(directory, gitlink.path)
      if (!(await isGitWorkTree(target))) {
        throw new Error(`Gitlink ${gitlink.path} was not materialized at ${target}`)
      }

      const reset = await runGit(["reset", "--hard"], {
        cwd: target,
        timeoutProfile: "default",
      })
      if (reset.exitCode !== 0) {
        throw new Error(errorText(reset) || `Failed to reset gitlink ${gitlink.path}`)
      }

      const clean = await runGit(["clean", "-ffdx"], {
        cwd: target,
        timeoutProfile: "default",
      })
      if (clean.exitCode !== 0) {
        throw new Error(errorText(clean) || `Failed to clean gitlink ${gitlink.path}`)
      }

      await resetMaterializedGitlinks(target)
    }
  }

  async function initializeSubmodules(input: { sourceRoot: string; targetRoot: string }) {
    await materializeGitlinks(input).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      log.error("worktree gitlink materialization failed", { directory: input.targetRoot, message })
      throw new CreateFailedError({ message })
    })
  }

  function createFailureMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }

  function publishCreateFailure(projectDirectory: string, info: Info, error: unknown) {
    GlobalBus.emit("event", {
      directory: projectDirectory,
      payload: {
        type: Event.Failed.type,
        properties: {
          directory: info.directory,
          message: createFailureMessage(error),
        },
      },
    })
  }

  function publishCreateReady(projectDirectory: string, info: Info) {
    GlobalBus.emit("event", {
      directory: projectDirectory,
      payload: {
        type: Event.Ready.type,
        properties: {
          directory: info.directory,
          name: info.name,
          branch: info.branch,
        },
      },
    })
  }

  async function convergeFailedCreate(input: {
    info: Info
    projectID: string
    primaryDirectory: string
    cause: unknown
    ownershipAcquisition: WorktreeOwnershipCriticalSection.Acquisition
  }): Promise<unknown> {
    return withGitLock(async () => {
      const cleanupErrors: unknown[] = []

      try {
        await removeWithAcquisition({ directory: input.info.directory }, input.ownershipAcquisition)
      } catch (error) {
        cleanupErrors.push(error)
      }

      const branchRef = await runGit(["show-ref", "--verify", "--quiet", `refs/heads/${input.info.branch}`], {
        cwd: input.primaryDirectory,
        timeoutProfile: "fast",
      })
      if (branchRef.exitCode === 0) {
        const deleted = await runGit(["branch", "-D", input.info.branch], {
          cwd: input.primaryDirectory,
          timeoutProfile: "fast",
        })
        if (deleted.exitCode !== 0) {
          cleanupErrors.push(new Error(errorText(deleted) || `Failed to delete worktree branch ${input.info.branch}`))
        }
      }

      const directoryResidue = await exists(input.info.directory)
      let registryResidue = false
      try {
        const target = await canonical(input.info.directory)
        for (const entry of await listRegisteredWorktrees(input.primaryDirectory)) {
          if ((await canonical(entry.path)) !== target) continue
          registryResidue = true
          break
        }
      } catch (error) {
        cleanupErrors.push(error)
        registryResidue = true
      }
      const remainingBranch =
        (
          await runGit(["show-ref", "--verify", "--quiet", `refs/heads/${input.info.branch}`], {
            cwd: input.primaryDirectory,
            timeoutProfile: "fast",
          })
        ).exitCode === 0
      const physicalResidue = directoryResidue || registryResidue || remainingBranch

      try {
        if (physicalResidue) {
          await Project.addSandbox(input.projectID, input.info.directory)
        } else {
          await Project.removeSandbox(input.projectID, input.info.directory)
        }
      } catch (error) {
        cleanupErrors.push(error)
      }

      const ownerResidue = Project.get(input.projectID)?.sandboxes.includes(input.info.directory) === true
      const ownerMismatch = ownerResidue !== physicalResidue
      const residues = [
        ...(directoryResidue ? [`directory=${input.info.directory}`] : []),
        ...(registryResidue ? [`git_registry=${input.info.directory}`] : []),
        ...(remainingBranch ? [`branch=${input.info.branch}`] : []),
        ...(ownerMismatch
          ? [`sandbox_owner=${ownerResidue ? "present_without_resource" : "missing_for_residue"}`]
          : []),
      ]

      if (cleanupErrors.length > 0 || residues.length > 0) {
        return new AggregateError(
          [input.cause, ...cleanupErrors],
          `Worktree creation failed and rollback left diagnostics: ${residues.join(", ") || "cleanup error"}`,
        )
      }
      return input.cause
    })
  }

  export const create = fn(CreateInput.optional(), async (input) => {
    if (!Project.isGitRepo(Instance.directory)) {
      throw new NotGitError({ message: "Worktrees are only supported for git projects" })
    }
    const projectDirectory = Instance.directory
    const projectID = Instance.project.id

    // Resolve the PRIMARY worktree (main repo root) first so a dispatched
    // Session whose Instance.directory is itself a child worktree
    // doesn't cause nested `.opencorvus/.r/.opencorvus/.r/...`
    // recursion. `primaryWorktreeInfo()` always returns the primary repo root.
    //
    // Worktrees live UNDER `<primary>/.opencorvus/.r/` — co-located
    // with other runtime scratch (attachments, visual-diff output). Previous
    // design placed them in the PARENT of the project root, which leaked
    // scratch dirs into the user's workspace for real projects and piled
    // hundreds of zombie dirs into %TEMP% for benchmarks. One `.gitignore`
    // entry (`/.opencorvus/`) covers the entire tree now.
    const primary = await primaryWorktreeInfo().catch((err) => {
      throw new CreateFailedError({ message: err instanceof Error ? err.message : String(err) })
    })
    const primaryDir = primary.directory
    const root = worktreesRoot(primaryDir)
    await fs.mkdir(root, { recursive: true })

    const base = input?.name ? slug(input.name) : ""
    const scopedInfo = (() => {
      if (input?.taskID && input.sessionID) {
        const name = base || `session-${shortName(input.sessionID)}`
        return Info.parse({
          name,
          branch: ProjectRuntimePaths.worktreeBranch({
            taskID: input.taskID,
            sessionID: input.sessionID,
          }),
          directory: ProjectRuntimePaths.worktreeDir(primaryDir, input.taskID, input.sessionID),
        })
      }
      return undefined
    })()

    const extra = input?.startCommand?.trim()
    const populateWorktree = async (target: Info) => {
      const populated = await runGit(["reset", "--hard"], {
        cwd: target.directory,
        timeoutProfile: "default",
      })
      if (populated.exitCode !== 0) {
        const message = errorText(populated) || "Failed to populate worktree"
        log.error("worktree checkout failed", { directory: target.directory, message })
        throw new CreateFailedError({ message })
      }

      await initializeSubmodules({ sourceRoot: primaryDir, targetRoot: target.directory })

      const started = await runStartScripts(target.directory, { projectID, extra })
      if (!started) {
        throw new StartCommandFailedError({ message: `Worktree startup scripts failed: ${target.directory}` })
      }
    }

    // Optional fast path: caller asked to reuse a previously-created worktree
    // with the same deterministic name (resumed Build Session that
    // produced files but skipped merge_back). Only honoured when the existing
    // dir + git linkage is still healthy via isValid() AND the durable ready
    // receipt exists; a registered tree without its receipt is an incomplete
    // population and is resumed to convergence before anything reuses it.
    if (base && input?.reuseIfValid) {
      const directory = scopedInfo?.directory ?? path.join(root, base)
      const branch = scopedInfo?.branch ?? `opencorvus/${base}`
      const ownership = WorktreeOwnershipCriticalSection.acquire(directory)
      try {
        const reused = await withGitLock(async () => {
          const validity = await isValid(directory)
          if (!validity.valid) return { validity }
          const info = Info.parse({ name: base, branch, directory })
          await Project.addSandbox(projectID, directory)
          if (input?.taskID && input.sessionID) {
            await Ownership.Worktree.record({
              primaryWorktreeDir: primaryDir,
              worktreeDir: directory,
              taskID: input.taskID,
              sessionID: input.sessionID,
            })
          }
          return { validity, info }
        })
        if (reused.info) {
          if (!(await WorktreeReadiness.isReady(reused.info.directory))) {
            // Registration is not readiness: this tree's population never
            // committed (a create killed after `git worktree add`, or a tree
            // that predates the receipt). Resume population to convergence
            // before the checkout is exposed.
            const readinessID = await WorktreeReadiness.resume({
              projectID,
              directory: reused.info.directory,
              branch: reused.info.branch,
              name: reused.info.name,
              primaryBranch: primary.branch,
            })
            await populateWorktree(reused.info)
            await WorktreeReadiness.markPopulated(readinessID)
            await WorktreeReadiness.commitReady(readinessID)
            log.info("worktree reuse: resumed population to readiness", { directory: reused.info.directory })
          }
          log.info("worktree reuse: existing valid worktree, skipping create", { name: base, directory, branch })
          publishCreateReady(projectDirectory, reused.info)
          return reused.info
        }
        log.info("worktree reuse: existing tree invalid, continuing to reclaim", {
          name: base,
          directory,
          reason: reused.validity.reason,
        })
      } catch (error) {
        publishCreateFailure(projectDirectory, Info.parse({ name: base, branch, directory }), error)
        throw error
      } finally {
        ownership[Symbol.dispose]()
      }
    }

    const intendedInfo =
      scopedInfo ??
      (base
        ? Info.parse({ name: base, branch: `opencorvus/${base}`, directory: path.join(root, base) })
        : await candidate(root))
    const ownership = WorktreeOwnershipCriticalSection.acquire(intendedInfo.directory)
    let info = intendedInfo

    let createdByCall = false
    let readinessID: string | undefined
    try {
      // All git operations serialized to prevent concurrent corruption
      await Worktree.withGitLock(async () => {
        if (base) info = await reclaimInfo(intendedInfo, ownership)
        // CONTRACT: project opening always commits the baseline Git metadata
        // first (see engine/git-project-metadata.ts), so HEAD is non-empty by
        // the time any worktree is requested. If we still see no HEAD here,
        // bootstrap broke earlier — fail loud rather than paper over with a
        // `git add -A` "initial scaffold" empty commit that historically
        // swallowed `node_modules/` into HEAD before .gitignore landed.
        const hasCommits =
          (
            await runGit(["rev-parse", "--verify", "HEAD"], {
              cwd: primaryDir,
              timeoutProfile: "fast",
            })
          ).exitCode === 0
        if (!hasCommits) {
          throw new CreateFailedError({
            message:
              `Worktree create requires HEAD to exist on the primary repo (${primaryDir}). ` +
              `The project bootstrap path (Instance.provide → Project.initGit → ensureGitProjectMetadata) ` +
              `must seed the baseline metadata commit before any worktree dispatch — investigate ` +
              `why project metadata did not land a first commit instead of patching here.`,
          })
        }

        // The readiness occurrence is durable BEFORE the git mutation: a
        // death from here on leaves an open occurrence whose reuse path
        // resumes population instead of trusting bare git linkage.
        readinessID = await WorktreeReadiness.begin({
          projectID,
          directory: info.directory,
          branch: info.branch,
          name: info.name,
          primaryBranch: primary.branch,
        })
        const created = await runGit(
          ["worktree", "add", "--no-checkout", "-b", info.branch, info.directory, primary.branch],
          { cwd: primaryDir, timeoutProfile: "default" },
        )
        if (created.exitCode !== 0) {
          throw new CreateFailedError({ message: errorText(created) || "Failed to create git worktree" })
        }
        createdByCall = true
        await WorktreeReadiness.markCreated(readinessID!)
        await Project.addSandbox(projectID, info.directory)
        if (input?.taskID && input.sessionID) {
          await Ownership.Worktree.record({
            primaryWorktreeDir: primaryDir,
            worktreeDir: info.directory,
            taskID: input.taskID,
            sessionID: input.sessionID,
          })
        }
      })
      await populateWorktree(info)
      await WorktreeReadiness.markPopulated(readinessID!)
      await WorktreeReadiness.commitReady(readinessID!)
    } catch (error) {
      if (readinessID) {
        await WorktreeReadiness.rollback(readinessID, error instanceof Error ? error.message : String(error)).catch(
          () => undefined,
        )
      }
      const failure = createdByCall
        ? await convergeFailedCreate({
            info,
            projectID,
            primaryDirectory: primaryDir,
            cause: error,
            ownershipAcquisition: ownership,
          })
        : error
      publishCreateFailure(projectDirectory, info, failure)
      throw failure
    } finally {
      ownership[Symbol.dispose]()
    }

    publishCreateReady(projectDirectory, info)
    return info
  })

  /**
   * Verify that `directory` is a *live* git worktree: both the per-worktree
   * `.git` linkage (file or dir) is present on disk AND the primary repo's
   * `git worktree list` still has it registered.
   *
   * Exists because Windows cleanup has a partial-failure mode that silently
   * creates "zombie" worktrees: `git worktree remove --force` deletes the
   * per-worktree `.git` link + the primary repo's `.git/worktrees/<name>/`
   * metadata in one step, then tries to `rm -rf` the directory. If a child
   * process (bun test runner, fsmonitor, vite dev server, MSVC-file-locked
   * `node_modules/*.dll`) still holds a handle, the rm fails — but the two
   * git-level deletes already succeeded. Residue on disk: everything except
   * `.git`. If cleanup clears the Task-owned sandbox registration despite
   * that physical failure, the next dispatch loses the only pointer to the
   * leaked worktree. If it
   * reuses a directory with broken `.git` linkage, git operations can walk
   * up and land on the PRIMARY repo's `.git` — commits go to master, the
   * managed branch never advances and later work silently overwrites itself.
   */
  export async function isValid(directory: string): Promise<{ valid: boolean; reason?: string }> {
    const gitLink = path.join(directory, ".git")
    if (!(await exists(gitLink))) {
      return { valid: false, reason: `missing .git linkage at ${gitLink}` }
    }
    const list = await runGit(["worktree", "list", "--porcelain"], {
      cwd: Instance.worktree,
      timeoutProfile: "default",
    })
    if (list.exitCode !== 0) {
      return { valid: false, reason: errorText(list) || "git worktree list failed" }
    }
    const target = await canonical(directory)
    const lines = outputText(list.stdout).split("\n")
    for (const line of lines) {
      if (!line.startsWith("worktree ")) continue
      const entryPath = line.slice("worktree ".length).trim()
      if (!entryPath) continue
      const entryKey = await canonical(entryPath)
      if (entryKey === target) return { valid: true }
    }
    return { valid: false, reason: `directory not registered in 'git worktree list'` }
  }

  export async function recoverRecorded(input: {
    directory: string
    branch: string
  }): Promise<
    { status: "recovered"; directory: string; branch: string } | { status: "unrecoverable"; reason: string }
  > {
    const validity = await isValid(input.directory)
    if (validity.valid) {
      return { status: "recovered", directory: input.directory, branch: input.branch }
    }

    const branchCheck = await runGit(["show-ref", "--verify", "--quiet", `refs/heads/${input.branch}`], {
      cwd: Instance.worktree,
      timeoutProfile: "fast",
    })
    if (branchCheck.exitCode !== 0) {
      return { status: "unrecoverable", reason: `branch ${input.branch} does not exist` }
    }

    const gitLink = path.join(input.directory, ".git")
    const gitLinkExists = await exists(gitLink)
    if (gitLinkExists) {
      return { status: "unrecoverable", reason: validity.reason ?? "worktree registration is invalid" }
    }

    const dirExists = await exists(input.directory)
    if (dirExists) {
      const entries = await fs.readdir(input.directory).catch(() => [])
      if (entries.length > 0) {
        return {
          status: "unrecoverable",
          reason:
            `missing .git linkage at ${gitLink}, but directory contains ${entries.length} item(s); ` +
            `preserving it instead of reclaiming automatically`,
        }
      }
    }

    await fs.mkdir(path.dirname(input.directory), { recursive: true })
    const added = await runGit(["worktree", "add", "--force", input.directory, input.branch], {
      cwd: Instance.worktree,
      timeoutProfile: "default",
    })
    if (added.exitCode !== 0) {
      return { status: "unrecoverable", reason: errorText(added) || "git worktree add failed" }
    }

    const nextValidity = await isValid(input.directory)
    if (!nextValidity.valid) {
      return { status: "unrecoverable", reason: nextValidity.reason ?? "reattached worktree is still invalid" }
    }
    return { status: "recovered", directory: input.directory, branch: input.branch }
  }

  async function removePhysical(input: {
    directory: Ownership.StrictIdentity
    primary: Ownership.StrictIdentity
    registered?: RegisteredWorktreeEntry
    registration: ManagedRemovalPlan["registration"]
  }): Promise<void> {
    if (!Project.isGitRepo(Instance.directory)) {
      throw new NotGitError({ message: "Worktrees are only supported for git projects" })
    }

    if (
      (await Ownership.Worktree.compareIdentity(input.primary, input.directory.requested, "compare-primary-target")) ===
      "same"
    ) {
      throw new RemoveFailedError({ message: "Cannot remove the primary workspace" })
    }

    const clean = (target: string) =>
      fs
        .rm(target, {
          recursive: true,
          force: true,
          maxRetries: DIRECTORY_REMOVE_MAX_RETRIES,
          retryDelay: DIRECTORY_REMOVE_RETRY_DELAY_MS,
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error)
          throw new RemoveFailedError({ message: message || "Failed to remove git worktree directory" })
        })

    const stop = async (target: string) => {
      await runGit(["fsmonitor--daemon", "stop"], { cwd: target, timeoutProfile: "fast" })
    }

    // All git operations serialized to prevent concurrent corruption with create/merge
    return withGitLock(async () => {
      const list = await runGit(["worktree", "list", "--porcelain"], {
        cwd: Instance.worktree,
        timeoutProfile: "default",
      })
      if (list.exitCode !== 0) {
        throw new RemoveFailedError({ message: errorText(list) || "Failed to read git worktrees" })
      }

      const entry = input.registered

      const settleBranch = async () => {
        const branch = input.registration.branch
        const exists = await runGit(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
          cwd: input.primary.requested,
          timeoutProfile: "fast",
        })
        if (exists.exitCode === 1) return
        if (exists.exitCode !== 0) {
          throw new RemoveFailedError({
            message: errorText(exists) || `Failed to inspect worktree branch ${branch}`,
          })
        }
        const current = await runGit(["rev-parse", "--verify", `${branch}^{commit}`], {
          cwd: input.primary.requested,
          timeoutProfile: "fast",
        })
        if (current.exitCode !== 0) {
          throw new RemoveFailedError({
            message: errorText(current) || `Failed to resolve worktree branch ${branch}`,
          })
        }
        const currentTarget = outputText(current.stdout).trim()
        if (currentTarget !== input.registration.targetCommit) {
          throw new RemoveFailedError({
            message:
              `Refusing to delete replaced worktree branch ${branch}: expected ` +
              `${input.registration.targetCommit}, observed ${currentTarget}`,
          })
        }
        await beforeBranchRemoval?.({ branch, targetCommit: input.registration.targetCommit })
        const deleted = await runGit(["branch", "-D", branch], {
          cwd: input.primary.requested,
          timeoutProfile: "fast",
        })
        if (deleted.exitCode !== 0) {
          throw new RemoveFailedError({ message: errorText(deleted) || "Failed to delete worktree branch" })
        }
      }

      if (!entry?.path) {
        if (input.directory.status === "present") {
          await stop(input.directory.requested)
          await clean(input.directory.requested)
          await afterPhysicalDirectoryRemoval?.(input.directory.requested)
        }
        await WorktreeReadiness.forget(input.directory.requested)
        await settleBranch()
        return
      }

      if (input.directory.status === "present") {
        await stop(entry.path)
        await clean(entry.path)
        await afterPhysicalDirectoryRemoval?.(entry.path)
      }
      // A removed worktree has no readiness: the receipt goes with the tree,
      // before the registry prune so a death here leaves no stale READY fact.
      await WorktreeReadiness.forget(entry.path)

      const pruned = await runGit(["worktree", "prune"], {
        cwd: Instance.worktree,
        timeoutProfile: "default",
      })
      if (pruned.exitCode !== 0) {
        throw new RemoveFailedError({
          message: `Failed to prune git worktree registry for ${entry.path}: ` + (errorText(pruned) || "unknown error"),
        })
      }
      const next = await runGit(["worktree", "list", "--porcelain"], {
        cwd: Instance.worktree,
        timeoutProfile: "default",
      })
      if (next.exitCode !== 0) {
        throw new RemoveFailedError({
          message: errorText(next) || "Failed to read git worktrees after prune",
        })
      }
      // The filesystem occurrence may no longer exist after the deletion. At
      // this point the exact Git registry row captured before deletion is the
      // authority, so compare its stored path key instead of re-observing the
      // now-missing target as a filesystem identity.
      const registryPathKey = async (value: string) => {
        const normalized = path.normalize(path.resolve(value))
        return (await isCaseInsensitiveFilesystem(normalized)) ? normalized.toLowerCase() : normalized
      }
      const removedRegistryKey = await registryPathKey(entry.path)
      let stale: RegisteredWorktreeEntry | undefined
      for (const candidate of parseWorktreeList(next.stdout)) {
        const candidateRegistryKey = await registryPathKey(candidate.path)
        if (candidateRegistryKey === removedRegistryKey) {
          stale = candidate
          break
        }
      }
      if (stale?.path) {
        throw new RemoveFailedError({
          message: `Git worktree registry still lists ${entry.path} after prune`,
        })
      }

      await settleBranch()

      return
    })
  }

  async function removeWithAcquisition(
    input: z.infer<typeof RemoveInput>,
    ownershipAcquisition?: WorktreeOwnershipCriticalSection.Acquisition,
  ) {
    const result = await removeManagedProjectWorktreeDirectory({
      projectID: Instance.project.id,
      directory: input.directory,
      releaseSandboxOwnership: true,
      ownershipAcquisition,
    })
    if (!result.removed) throw new RemoveFailedError({ message: `Worktree is actively owned: ${input.directory}` })
    return true
  }

  export const remove = fn(RemoveInput, (input) => removeWithAcquisition(input))

  async function resolveResetPlanUnderGitLock(input: {
    directory: string
    primaryDirectory: string
    targetRef: string
  }): Promise<{ worktreePath: string; branch: string; targetCommit: string }> {
    const list = await runGit(["worktree", "list", "--porcelain"], {
      cwd: input.primaryDirectory,
      timeoutProfile: "default",
    })
    if (list.exitCode !== 0) {
      throw new ResetFailedError({ message: errorText(list) || "Failed to read git worktrees" })
    }
    const entries = outputText(list.stdout)
      .split("\n")
      .map((line) => line.trim())
      .reduce<{ path?: string; branch?: string }[]>((acc, line) => {
        if (!line) return acc
        if (line.startsWith("worktree ")) {
          acc.push({ path: line.slice("worktree ".length).trim() })
          return acc
        }
        const current = acc[acc.length - 1]
        if (current && line.startsWith("branch ")) current.branch = line.slice("branch ".length).trim()
        return acc
      }, [])
    let entry: { path?: string; branch?: string } | undefined
    for (const candidate of entries) {
      if (candidate.path && (await canonical(candidate.path)) === input.directory) {
        entry = candidate
        break
      }
    }
    if (!entry?.path) throw new ResetFailedError({ message: "Worktree not found" })
    const target = await runGit(["rev-parse", "--verify", `${input.targetRef}^{commit}`], {
      cwd: input.primaryDirectory,
      timeoutProfile: "fast",
    })
    if (target.exitCode !== 0) {
      throw new ResetFailedError({ message: errorText(target) || `Reset target not found: ${input.targetRef}` })
    }
    return {
      worktreePath: entry.path,
      branch: entry.branch ?? "",
      targetCommit: outputText(target.stdout).trim(),
    }
  }

  async function resolveResetPlan(input: {
    directory: string
    primaryDirectory: string
    targetRef: string
  }): Promise<{ worktreePath: string; branch: string; targetCommit: string }> {
    return withGitLock(() => resolveResetPlanUnderGitLock(input))
  }

  const ResetOperationIdentity = z.object({
    version: z.literal(1),
    projectID: z.string().min(1),
    directoryKey: z.string().min(1),
    device: z.number(),
    inode: z.number(),
    birthtimeMs: z.number(),
    branch: z.string(),
    requestedRef: z.string().min(1),
    targetCommit: z.string().regex(/^[0-9a-f]{40,64}$/),
  })
  type ResetOperationIdentity = z.infer<typeof ResetOperationIdentity>

  function resetOperationID(identity: ResetOperationIdentity): string {
    return `worktree-reset:${Buffer.from(JSON.stringify(identity), "utf8").toString("base64url")}`
  }

  function parseResetOperationID(operationID: string): ResetOperationIdentity | undefined {
    const prefix = "worktree-reset:"
    if (!operationID.startsWith(prefix)) return undefined
    try {
      return ResetOperationIdentity.parse(
        JSON.parse(Buffer.from(operationID.slice(prefix.length), "base64url").toString("utf8")),
      )
    } catch {
      return undefined
    }
  }

  export const reset = fn(ResetInput, async (input) => {
    if (!Project.isGitRepo(Instance.directory)) {
      throw new NotGitError({ message: "Worktrees are only supported for git projects" })
    }

    const primaryInfo = await primaryWorktreeInfo().catch((err) => {
      throw new ResetFailedError({ message: err instanceof Error ? err.message : String(err) })
    })
    const directory = await canonical(input.directory)
    const primary = await canonical(primaryInfo.directory)
    if (directory === primary) {
      throw new ResetFailedError({ message: "Cannot reset the primary workspace" })
    }
    const projectID = Instance.project.id
    const directoryIdentity = await Ownership.Worktree.observeIdentity(input.directory, "resolve-reset-worktree")
    const occurrence = await ProjectDirectoryAdmission.observeDirectory(input.directory)
    const requestedRef = input.baseRef ?? primaryInfo.branch
    const activeReset = await ProjectDirectoryAdmission.activeExactOperation(input.directory, "reclamation")
    const persistedReset = activeReset
      ? parseResetOperationID(ProjectDirectoryAdmission.domainOperationID(projectID, activeReset.operationID) ?? "")
      : undefined
    const persistedIntentMatches =
      persistedReset !== undefined &&
      persistedReset.projectID === projectID &&
      persistedReset.directoryKey === directoryIdentity.key &&
      persistedReset.device === occurrence.device &&
      persistedReset.inode === occurrence.inode &&
      persistedReset.birthtimeMs === occurrence.birthtimeMs &&
      persistedReset.requestedRef === requestedRef
    const resetPlan = await resolveResetPlan({
      directory,
      primaryDirectory: primaryInfo.directory,
      targetRef: persistedIntentMatches ? persistedReset.targetCommit : requestedRef,
    })
    const resumePersistedIntent =
      persistedIntentMatches &&
      persistedReset.branch === resetPlan.branch &&
      persistedReset.targetCommit === resetPlan.targetCommit
    const operationIdentity: ResetOperationIdentity = {
      version: 1,
      projectID,
      directoryKey: directoryIdentity.key,
      device: occurrence.device,
      inode: occurrence.inode,
      birthtimeMs: occurrence.birthtimeMs,
      branch: resetPlan.branch,
      requestedRef,
      targetCommit: resetPlan.targetCommit,
    }
    const operationID = resumePersistedIntent
      ? activeReset!.operationID
      : ProjectDirectoryAdmission.scopeOperationID(projectID, resetOperationID(operationIdentity))
    const acquired = await ProjectDirectoryAdmission.acquire({
      directory: input.directory,
      operationID,
      kind: "reclamation",
      occurrence,
    }).catch((error) => {
      if (ProjectDirectoryAdmission.ClosedError.isInstance(error)) {
        throw new ResetFailedError({ message: `Worktree is actively owned: ${input.directory}` })
      }
      throw error
    })
    if (acquired.outcome !== "acquired") throw new ResetFailedError({ message: "Reset admission was not acquired" })
    const admission = acquired.token
    let mutationStarted = false
    let settled = false
    try {
      const mutation = await WorktreeOwnershipCriticalSection.mutate({
        directory: directoryIdentity.key,
        mutate: async () => {
          if (!(await ProjectDirectoryAdmission.ownsCurrentOccurrence(admission, input.directory))) {
            throw new ResetFailedError({ message: `Worktree occurrence changed before reset: ${input.directory}` })
          }
          const sessions = Database.use((db) =>
            db
              .select({ directory: SessionTable.directory })
              .from(SessionTable)
              .where(eq(SessionTable.project_id, projectID))
              .all(),
          )
          for (const session of sessions) {
            if (
              (await Ownership.Worktree.compareIdentity(
                directoryIdentity,
                session.directory,
                "compare-reset-session-owner",
              )) === "same"
            ) {
              throw new ResetFailedError({ message: `Worktree is owned by a durable Session: ${input.directory}` })
            }
          }
          for (const binding of activeTaskProcessBindingRoots({ projectID, diagnosticRoot: primaryInfo.directory })) {
            if (
              (await Ownership.Worktree.compareIdentity(
                directoryIdentity,
                binding.directory,
                "compare-reset-process-binding-owner",
              )) === "same"
            ) {
              throw new ResetFailedError({ message: `Worktree is owned by a Task process: ${input.directory}` })
            }
          }
          const markerProof = await Ownership.Worktree.proveOwnerless({
            primaryWorktreeDir: primaryInfo.directory,
            worktreeDir: directoryIdentity.requested,
            canReleaseDeadOwner: (taskID) => !findTask(taskID),
          })
          if (markerProof.status === "owned") {
            throw new ResetFailedError({ message: `Worktree is owned by a durable Task: ${input.directory}` })
          }
          Ownership.Worktree.requireCompleteRelease(await Ownership.Worktree.settleOwnerlessProof(markerProof))
          const worktreePath = await withGitLock(async () => {
            const currentPlan = await resolveResetPlanUnderGitLock({
              directory,
              primaryDirectory: primaryInfo.directory,
              targetRef: resetPlan.targetCommit,
            })
            if (
              (await canonical(currentPlan.worktreePath)) !== (await canonical(resetPlan.worktreePath)) ||
              currentPlan.branch !== resetPlan.branch ||
              currentPlan.targetCommit !== resetPlan.targetCommit
            ) {
              throw new ResetFailedError({
                message: `Worktree reset intent changed before mutation: ${input.directory}`,
              })
            }
            if (!(await ProjectDirectoryAdmission.ownsCurrentOccurrence(admission, input.directory))) {
              throw new ResetFailedError({
                message: `Worktree occurrence changed before destructive reset: ${input.directory}`,
              })
            }
            mutationStarted = true
            const resetToTarget = await runGit(["reset", "--hard", resetPlan.targetCommit], {
              cwd: resetPlan.worktreePath,
              timeoutProfile: "default",
            })
            if (resetToTarget.exitCode !== 0) {
              throw new ResetFailedError({ message: errorText(resetToTarget) || "Failed to reset worktree to target" })
            }
            await afterResetHard?.({ directory: resetPlan.worktreePath, targetCommit: resetPlan.targetCommit })

            const clean = await sweep(resetPlan.worktreePath)
            if (clean.exitCode !== 0) {
              throw new ResetFailedError({ message: errorText(clean) || "Failed to clean worktree" })
            }

            await materializeGitlinks({
              sourceRoot: primaryInfo.directory,
              targetRoot: resetPlan.worktreePath,
              force: true,
            }).catch((error) => {
              throw new ResetFailedError({ message: error instanceof Error ? error.message : String(error) })
            })

            await resetMaterializedGitlinks(resetPlan.worktreePath).catch((error) => {
              throw new ResetFailedError({ message: error instanceof Error ? error.message : String(error) })
            })

            const status = await runGit(["status", "--porcelain=v1"], {
              cwd: resetPlan.worktreePath,
              timeoutProfile: "default",
            })
            if (status.exitCode !== 0) {
              throw new ResetFailedError({ message: errorText(status) || "Failed to read git status" })
            }

            const dirty = statusLinesBlockingMerge(outputText(status.stdout))
            if (dirty.length > 0) {
              throw new ResetFailedError({ message: `Worktree reset left local changes:\n${dirty.join("\n")}` })
            }

            return resetPlan.worktreePath
          })
          const started = await runStartScripts(worktreePath, { projectID })
          if (!started) {
            throw new StartCommandFailedError({ message: `Worktree startup scripts failed: ${worktreePath}` })
          }
          return worktreePath
        },
      })
      if (mutation.status === "owned") {
        ProjectDirectoryAdmission.settle(admission, () => undefined)
        settled = true
        throw new ResetFailedError({ message: `Worktree is actively owned: ${input.directory}` })
      }
      ProjectDirectoryAdmission.settle(admission, () => undefined)
      settled = true
      return true
    } catch (error) {
      if (!mutationStarted && !settled) {
        ProjectDirectoryAdmission.settle(admission, () => undefined)
        settled = true
      }
      throw error
    }
  })
}
