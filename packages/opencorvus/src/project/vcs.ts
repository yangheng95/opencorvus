import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"
import path from "path"
import { Log } from "@/util/log"
import { hostGit as git, type GitResult } from "@/util/git"
import { createInstanceState } from "./instance-state"
import { ProjectInstanceContext } from "./instance-context"
import { Project } from "./project"
import { Filesystem } from "@/util/filesystem"
import { FileWatcher } from "@/file/watcher"
import { NamedError } from "@opencorvus-ai/util/error"
import { VcsBranchRefreshOwner } from "./vcs-branch-refresh"

const log = Log.create({ service: "vcs" })
const PATCH_CONTEXT_LINES = 2_147_483_647
const MAX_PATCH_BYTES = 10_000_000
const MAX_TOTAL_PATCH_BYTES = 10_000_000
const PATCH_LOAD_CONCURRENCY = 8

function currentProject() {
  return ProjectInstanceContext.use()
}

const VcsPrerequisiteError = NamedError.create(
  "VcsPrerequisiteError",
  z.object({
    reason: z.enum([
      "not_git",
      "unborn_head",
      "origin_head_missing",
      "merge_base_missing",
      "branch_missing",
      "branch_switch_failed",
      "nothing_to_commit",
    ]),
    message: z.string(),
  }),
)

type DiffOptions = {
  readonly context?: number
}

type DiffItem = {
  readonly file: string
  readonly status: "added" | "deleted" | "modified"
  readonly code: string
}

type DiffStat = {
  readonly additions: number
  readonly deletions: number
  readonly binary: boolean
}

function patchContext(options?: DiffOptions) {
  return String(options?.context ?? PATCH_CONTEXT_LINES)
}

function normalizeGitPath(file: string) {
  return process.platform === "win32" ? file.replaceAll("\\", "/") : file
}

function parseStatusCode(code: string): DiffItem["status"] {
  if (!/^[ADMUTXB]$/.test(code)) throw new Error(`vcs diff name-status returned unknown status ${code}`)
  if (code.startsWith("A")) return "added"
  if (code.startsWith("D")) return "deleted"
  return "modified"
}

function zeroSeparatedRecords(text: string, label: string): string[] {
  if (text.length === 0) return []
  if (!text.endsWith("\0")) throw new Error(`${label} did not end with a NUL record terminator`)
  return text.slice(0, -1).split("\0")
}

function parseNameStatus(text: string): DiffItem[] {
  const records = zeroSeparatedRecords(text, "vcs diff name-status")
  if (records.length % 2 !== 0) throw new Error("vcs diff name-status returned an incomplete status/path pair")
  const result: DiffItem[] = []
  for (let index = 0; index < records.length; index += 2) {
    const code = records[index]
    const file = records[index + 1]
    if (!code || !file) throw new Error("vcs diff name-status returned an empty status or path")
    if (code.startsWith("R") || code.startsWith("C")) {
      throw new Error(`vcs diff name-status returned unexpected rename/copy status ${code}`)
    }
    result.push({ file: normalizeGitPath(file), code, status: parseStatusCode(code) })
  }
  return result
}

function parseNumstat(text: string) {
  const stats = new Map<string, DiffStat>()
  const records = zeroSeparatedRecords(text, "vcs diff numstat")
  for (let index = 0; index < records.length; index++) {
    const record = records[index]!
    const firstSeparator = record.indexOf("\t")
    const secondSeparator = firstSeparator === -1 ? -1 : record.indexOf("\t", firstSeparator + 1)
    if (firstSeparator <= 0 || secondSeparator <= firstSeparator + 1) {
      throw new Error("vcs diff numstat returned a malformed record")
    }
    const rawAdditions = record.slice(0, firstSeparator)
    const rawDeletions = record.slice(firstSeparator + 1, secondSeparator)
    let file = record.slice(secondSeparator + 1)
    if (!file) {
      const source = records[++index]
      const destination = records[++index]
      if (!source || !destination) throw new Error("vcs diff numstat returned an incomplete source/destination pair")
      file = destination === "/dev/null" ? source : destination
    }
    const binary = rawAdditions === "-" && rawDeletions === "-"
    const additions = Number.parseInt(rawAdditions, 10)
    const deletions = Number.parseInt(rawDeletions, 10)
    if (!binary && (!Number.isFinite(additions) || !Number.isFinite(deletions))) {
      throw new Error(`vcs diff numstat returned invalid counts for ${file}`)
    }
    stats.set(normalizeGitPath(file), {
      additions: binary ? 0 : additions,
      deletions: binary ? 0 : deletions,
      binary,
    })
  }
  return stats
}

function parseZeroSeparatedFiles(text: string) {
  return zeroSeparatedRecords(text, "vcs file list").map((file) => {
    if (!file) throw new Error("vcs file list returned an empty path")
    return normalizeGitPath(file)
  })
}

function mergeDiffItems(...lists: DiffItem[][]) {
  const out = new Map<string, DiffItem>()
  for (const item of lists.flat()) {
    if (!out.has(item.file)) out.set(item.file, item)
  }
  return [...out.values()].toSorted((a, b) => a.file.localeCompare(b.file))
}

async function gitText(command: Promise<GitResult>, label: string) {
  const result = await command
  if (result.exitCode === 0) return result.text()
  const stderr = result.stderr.toString().trim()
  throw new Error(`${label} failed${stderr ? `: ${stderr}` : ""}`)
}

async function gitDiffText(command: Promise<GitResult>, label: string) {
  const result = await command
  if (result.exitCode === 0) return result.text()
  if (result.exitCode === 1 && result.stdout.length > 0 && result.stderr.length === 0) return result.text()
  const stderr = result.stderr.toString().trim()
  throw new Error(`${label} failed${stderr ? `: ${stderr}` : ` with exit code ${result.exitCode}`}`)
}

async function hasHead(cwd: string) {
  const result = await git(["rev-parse", "--verify", "--quiet", "HEAD"], { cwd, timeoutProfile: "fast" })
  if (result.exitCode === 0) return true
  if (result.exitCode === 1 && result.stderr.length === 0 && result.stdout.length === 0) return false
  const stderr = result.stderr.toString().trim()
  throw new Error(`vcs resolve HEAD failed${stderr ? `: ${stderr}` : ` with exit code ${result.exitCode}`}`)
}

async function untrackedFiles(cwd: string) {
  return parseZeroSeparatedFiles(
    await gitText(
      git(["ls-files", "--others", "--exclude-standard", "-z", "--", "."], {
        cwd,
        timeoutProfile: "default",
      }),
      "vcs untracked files",
    ),
  )
}

async function statUntracked(cwd: string, file: string): Promise<DiffStat> {
  const stats = parseNumstat(
    await gitDiffText(
      git(
        [
          "-c",
          "core.autocrlf=false",
          "diff",
          "--no-ext-diff",
          "--no-renames",
          "--numstat",
          "-z",
          "--no-index",
          "--",
          "/dev/null",
          file,
        ],
        {
          cwd,
          timeoutProfile: "default",
        },
      ),
      "vcs diff untracked numstat",
    ),
  )
  const stat = stats.get(file)
  if (!stat) throw new Error(`vcs diff untracked numstat omitted ${file}`)
  return stat
}

async function patchUntracked(cwd: string, file: string, options?: DiffOptions) {
  const patch = await gitDiffText(
    git(
      [
        "-c",
        "core.autocrlf=false",
        "diff",
        "--no-ext-diff",
        "--no-renames",
        `--unified=${patchContext(options)}`,
        "--no-index",
        "--",
        "/dev/null",
        file,
      ],
      {
        cwd,
        timeoutProfile: "default",
      },
    ),
    "vcs diff untracked patch",
  )
  return patch
}

async function defaultBranchRef(cwd: string): Promise<string> {
  const result = await git(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], {
    cwd,
    timeoutProfile: "fast",
  })
  if (result.exitCode === 1 && result.stderr.length === 0 && result.stdout.length === 0) {
    throw new VcsPrerequisiteError({
      reason: "origin_head_missing",
      message: "vcs branch diff requires refs/remotes/origin/HEAD",
    })
  }
  const ref = (await gitText(Promise.resolve(result), "vcs resolve origin HEAD")).trim()
  if (!ref) throw new Error("vcs resolve origin HEAD returned an empty ref")
  return ref
}

async function mergeBase(cwd: string, ref: string): Promise<string> {
  const result = await git(["merge-base", "HEAD", ref], { cwd, timeoutProfile: "fast" })
  if (result.exitCode === 1 && result.stderr.length === 0 && result.stdout.length === 0) {
    throw new VcsPrerequisiteError({
      reason: "merge_base_missing",
      message: `vcs branch diff has no merge base between HEAD and ${ref}`,
    })
  }
  const base = (await gitText(Promise.resolve(result), "vcs merge-base")).trim()
  if (!base) throw new Error(`vcs merge-base returned an empty ref for ${ref}`)
  return base
}

async function emptyTree(cwd: string): Promise<string> {
  // mktree reads EOF from the ignored stdin and returns the repository's own object-format empty-tree ID.
  const tree = (await gitText(git(["mktree"], { cwd, timeoutProfile: "fast" }), "vcs create empty tree")).trim()
  if (!tree) throw new Error("vcs create empty tree returned an empty object ID")
  return tree
}

async function diffAgainstRef(cwd: string, ref: string, options?: DiffOptions): Promise<Vcs.FileDiff[]> {
  const [nameStatus, numstat, untracked] = await Promise.all([
    gitText(
      git(["diff", "--no-ext-diff", "--no-renames", "--name-status", "-z", ref, "--", "."], {
        cwd,
        timeoutProfile: "default",
      }),
      "vcs diff name-status",
    ),
    gitText(
      git(["diff", "--no-ext-diff", "--no-renames", "--numstat", "-z", ref, "--", "."], {
        cwd,
        timeoutProfile: "default",
      }),
      "vcs diff numstat",
    ),
    untrackedFiles(cwd),
  ])

  return diffFiles(
    cwd,
    mergeDiffItems(
      parseNameStatus(nameStatus),
      untracked.map((file) => ({ file, code: "??", status: "added" as const })),
    ),
    parseNumstat(numstat),
    ref,
    options,
  )
}

async function diffWithoutHead(cwd: string, options?: DiffOptions): Promise<Vcs.FileDiff[]> {
  return diffAgainstRef(cwd, await emptyTree(cwd), options)
}

async function diffFiles(
  cwd: string,
  items: DiffItem[],
  stats: Map<string, DiffStat>,
  ref: string,
  options?: DiffOptions,
): Promise<Vcs.FileDiff[]> {
  const result: Vcs.FileDiff[] = []
  let total = 0
  let aggregateCapped = false

  for (let index = 0; index < items.length; index += PATCH_LOAD_CONCURRENCY) {
    const batch = items.slice(index, index + PATCH_LOAD_CONCURRENCY)
    const loaded = await Promise.all(
      batch.map(async (item) => {
        const stat = stats.get(item.file) ?? (item.code === "??" ? await statUntracked(cwd, item.file) : undefined)
        if (!stat) throw new Error(`vcs diff numstat omitted ${item.file}`)
        if (stat.binary || aggregateCapped) return { item, stat, rawPatch: undefined }
        const rawPatch =
          item.code === "??"
            ? await patchUntracked(cwd, item.file, options)
            : await gitText(
                git(
                  [
                    "diff",
                    "--no-ext-diff",
                    "--no-renames",
                    `--unified=${patchContext(options)}`,
                    ref,
                    "--",
                    `:(literal)${item.file}`,
                  ],
                  { cwd, timeoutProfile: "default" },
                ),
                `vcs diff patch for ${item.file}`,
              )
        return { item, stat, rawPatch }
      }),
    )

    for (const { item, stat, rawPatch } of loaded) {
      const patchBytes = Buffer.byteLength(rawPatch ?? "")
      const patchTruncated =
        !stat.binary && (aggregateCapped || patchBytes > MAX_PATCH_BYTES || total + patchBytes > MAX_TOTAL_PATCH_BYTES)
      if (!aggregateCapped && rawPatch !== undefined && total + patchBytes > MAX_TOTAL_PATCH_BYTES) {
        aggregateCapped = true
      }
      if (rawPatch !== undefined && !patchTruncated) total += patchBytes
      result.push({
        file: item.file,
        ...(rawPatch !== undefined && !patchTruncated ? { patch: rawPatch } : {}),
        ...(patchTruncated ? { patchTruncated: true } : {}),
        additions: stat.additions,
        deletions: stat.deletions,
        status: item.status,
      })
    }
  }

  return result
}

export namespace Vcs {
  export const PrerequisiteError = VcsPrerequisiteError

  export const Event = {
    BranchUpdated: BusEvent.define(
      "vcs.branch.updated",
      z.object({
        branch: z.string().optional(),
      }),
    ),
  }

  export const Info = z
    .object({
      /** True when a git repository exists at the working directory. False means no .git is present. */
      initialized: z.boolean(),
      /** Current branch name. Undefined for an unborn or detached HEAD. */
      branch: z.string().optional(),
      /** Current HEAD commit short hash. Undefined when no commits exist (unborn HEAD). */
      commit: z.string().optional(),
      clean: z.boolean(),
      dirty: z.boolean(),
      staged: z.number().int().nonnegative(),
      modified: z.number().int().nonnegative(),
      untracked: z.number().int().nonnegative(),
      conflicts: z.number().int().nonnegative(),
      ahead: z.number().int().nonnegative(),
      behind: z.number().int().nonnegative(),
      /** True when this repository has at least one configured Git remote. */
      hasRemote: z.boolean(),
    })
    .meta({
      ref: "VcsInfo",
    })
  export type Info = z.infer<typeof Info>

  export const Mode = z.enum(["git", "branch"])
  export type Mode = z.infer<typeof Mode>

  export const Branch = z
    .object({
      name: z.string(),
      current: z.boolean(),
    })
    .meta({
      ref: "VcsBranch",
    })
  export type Branch = z.infer<typeof Branch>

  export const FileDiff = z
    .object({
      file: z.string(),
      patch: z.string().optional(),
      patchTruncated: z.boolean().optional(),
      additions: z.number(),
      deletions: z.number(),
      status: z.enum(["added", "deleted", "modified"]).optional(),
    })
    .meta({
      ref: "VcsFileDiff",
    })
  export type FileDiff = z.infer<typeof FileDiff>

  export const CommitResult = z
    .object({
      commit: z.string(),
      info: Info,
    })
    .meta({
      ref: "VcsCommitResult",
    })
  export type CommitResult = z.infer<typeof CommitResult>

  export const PushResult = z
    .object({
      info: Info,
    })
    .meta({
      ref: "VcsPushResult",
    })
  export type PushResult = z.infer<typeof PushResult>

  function parse(
    text: string,
    input: { initialized: boolean; branch?: string; commit?: string; hasRemote: boolean },
  ): Info {
    let ahead = 0
    let behind = 0
    let staged = 0
    let modified = 0
    let untracked = 0
    let conflicts = 0

    const records = zeroSeparatedRecords(text, "vcs status")
    for (let index = 0; index < records.length; index++) {
      const line = records[index]!
      if (line.startsWith("## ")) {
        const status = line.match(/\[(.*?)\]/)?.[1]
        if (!status) continue
        for (const item of status
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)) {
          const nextAhead = item.match(/^ahead (\d+)$/)
          if (nextAhead) {
            ahead = Number(nextAhead[1])
            continue
          }
          const nextBehind = item.match(/^behind (\d+)$/)
          if (nextBehind) behind = Number(nextBehind[1])
        }
        continue
      }

      const x = line[0] ?? " "
      const y = line[1] ?? " "
      if (!" MTADRCU?!".includes(x) || !" MTADRCU?!".includes(y) || line[2] !== " ") {
        throw new Error(`vcs status returned an unknown porcelain record: ${line}`)
      }
      if (x === "R" || x === "C" || y === "R" || y === "C") {
        const source = records[++index]
        if (!source) throw new Error("vcs status returned an incomplete rename/copy path pair")
      }
      if (x === "?" && y === "?") {
        untracked += 1
        continue
      }
      if (x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")) {
        conflicts += 1
      }
      if (x !== " " && x !== "?") staged += 1
      if (y !== " " && y !== "?") modified += 1
    }

    const dirty = staged > 0 || modified > 0 || untracked > 0 || conflicts > 0
    return {
      initialized: input.initialized,
      branch: input.branch,
      commit: input.commit,
      clean: !dirty,
      dirty,
      staged,
      modified,
      untracked,
      conflicts,
      ahead,
      behind,
      hasRemote: input.hasRemote,
    }
  }

  async function hasConfiguredRemote(cwd: string): Promise<boolean> {
    const text = await gitText(
      git(["remote"], {
        cwd,
        timeoutProfile: "fast",
      }),
      "vcs list configured remotes",
    )
    return text.split(/\r?\n/).some((remote) => remote.trim().length > 0)
  }

  async function currentCommit(cwd: string): Promise<string | undefined> {
    const out = (
      await gitText(
        git(["rev-parse", "--short", "HEAD"], { cwd, timeoutProfile: "fast" }),
        "vcs resolve current commit",
      )
    ).trim()
    if (!out) throw new Error("vcs resolve current commit returned an empty object ID")
    return out
  }

  async function currentBranch(): Promise<string | undefined> {
    const result = await git(["symbolic-ref", "--quiet", "--short", "HEAD"], {
      cwd: currentProject().worktree,
      timeoutProfile: "fast",
    })
    if (result.exitCode === 1 && result.stderr.length === 0 && result.stdout.length === 0) return undefined
    const out = (await gitText(Promise.resolve(result), "vcs resolve current branch")).trim()
    if (!out) throw new Error("vcs resolve current branch returned an empty name")
    return out
  }

  const state = createInstanceState(
    async () => {
      if (!Project.isGitRepo(currentProject().directory)) {
        return { branch: async () => undefined, unsubscribe: undefined }
      }
      const current = await currentBranch()
      log.info("initialized", { branch: current })

      const branchRefresh = new VcsBranchRefreshOwner(current, currentBranch, async (next, previous) => {
        log.info("branch changed", { from: previous, to: next })
        await Bus.publish(Event.BranchUpdated, { branch: next })
      })
      const unsubscribe = Bus.subscribe(FileWatcher.Event.Updated, async (evt) => {
        if (!evt.properties.file.endsWith("HEAD")) return
        await branchRefresh.refresh()
      })

      return {
        branch: async () => branchRefresh.current(),
        branchRefresh,
        unsubscribe,
      }
    },
    async (state) => {
      state.unsubscribe?.()
      await state.branchRefresh?.dispose()
    },
    "vcs",
  )

  export async function init() {
    return state()
  }

  /**
   * Discard the cached VCS state for the current instance directory.
   * The next call to `info()` or `branch()` will re-initialize from scratch,
   * re-probing `.git` on disk and re-attaching the `.git/HEAD` file watcher.
   * Call this after `git init` completes while active sessions prevent a full
   * `Instance.dispose()`.
   */
  export async function resetState() {
    await state.reset()
  }

  export async function branch() {
    return await state().then((s) => s.branch())
  }

  export async function branches(): Promise<Branch[]> {
    const project = currentProject()
    if (!Project.isGitRepo(project.directory)) {
      throw new PrerequisiteError({ reason: "not_git", message: "vcs branches requires a git repository" })
    }
    const text = await gitText(
      git(["for-each-ref", "--format=%(refname:short)", "--sort=refname", "refs/heads"], {
        cwd: project.directory,
        timeoutProfile: "fast",
      }),
      "vcs list local branches",
    )
    const names = text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((name) => name.trim())
    if (names.some((name) => !name)) throw new Error("vcs list local branches returned an empty branch name")
    const current = await branch()
    return names
      .map((name) => ({ name, current: name === current }))
      .toSorted((left, right) => Number(right.current) - Number(left.current) || left.name.localeCompare(right.name))
  }

  export async function switchBranch(name: string): Promise<Info> {
    const requested = name.trim()
    const localBranches = await branches()
    if (!localBranches.some((item) => item.name === requested)) {
      throw new PrerequisiteError({
        reason: "branch_missing",
        message: `vcs branch "${requested}" is not a local branch`,
      })
    }
    if (localBranches.some((item) => item.name === requested && item.current)) return info()

    const result = await git(["switch", "--no-guess", "--", requested], {
      cwd: currentProject().directory,
      timeoutProfile: "default",
    })
    if (result.exitCode !== 0) {
      const detail = result.stderr.toString().trim() || result.stdout.toString().trim()
      throw new PrerequisiteError({
        reason: "branch_switch_failed",
        message: `vcs switch to "${requested}" failed${detail ? `: ${detail}` : ""}`,
      })
    }
    await resetState()
    return info()
  }

  export async function recentSubjects(limit: number): Promise<string[]> {
    if (!Number.isInteger(limit) || limit <= 0) throw new Error("vcs recent subjects requires a positive limit")
    const project = currentProject()
    if (!Project.isGitRepo(project.directory) || !(await hasHead(project.directory))) return []
    const text = await gitText(
      git(["log", `-${limit}`, "--format=%s"], {
        cwd: project.directory,
        timeoutProfile: "fast",
      }),
      "vcs recent commit subjects",
    )
    return text
      .split(/\r?\n/)
      .map((subject) => subject.trim())
      .filter(Boolean)
  }

  export async function commit(message: string): Promise<CommitResult> {
    const requested = message.trim()
    if (!requested) throw new Error("vcs commit requires a non-empty message")
    const project = currentProject()
    if (!Project.isGitRepo(project.directory)) {
      throw new PrerequisiteError({ reason: "not_git", message: "vcs commit requires a git repository" })
    }
    if (!(await info()).dirty) {
      throw new PrerequisiteError({ reason: "nothing_to_commit", message: "vcs commit requires working-tree changes" })
    }
    await gitText(
      git(["add", "--all", "--", "."], {
        cwd: project.directory,
        timeoutProfile: "default",
      }),
      "vcs stage working tree",
    )
    await gitText(
      git(["commit", "-m", requested, "--"], {
        cwd: project.directory,
        timeoutProfile: "default",
      }),
      "vcs commit",
    )
    const commit = await currentCommit(project.directory)
    if (!commit) throw new Error("vcs commit completed without a HEAD commit")
    return { commit, info: await info() }
  }

  export async function push(): Promise<PushResult> {
    const project = currentProject()
    if (!Project.isGitRepo(project.directory)) {
      throw new PrerequisiteError({ reason: "not_git", message: "vcs push requires a git repository" })
    }
    if (!(await hasHead(project.directory))) {
      throw new PrerequisiteError({ reason: "unborn_head", message: "vcs push requires a committed HEAD" })
    }
    await gitText(
      git(["push"], {
        cwd: project.directory,
        timeoutProfile: "network",
      }),
      "vcs push",
    )
    return { info: await info() }
  }

  export async function info() {
    // Single source of truth for "is this a git repo": disk probe via
    // Project.isGitRepo. Never consult a cached column/field — rule 22.
    const initialized = Project.isGitRepo(currentProject().directory)
    if (!initialized) {
      return parse("", { initialized: false, hasRemote: false })
    }
    // Suppress branch when no commits exist (unborn HEAD). git rev-parse
    // --abbrev-ref HEAD returns the configured default (e.g. "main") even
    // before any commit; we only report it once a commit exists.
    const head = await hasHead(currentProject().directory)
    const commit = head ? await currentCommit(currentProject().directory) : undefined
    const rawBranch = await state().then((s) => s.branch())
    const branch = commit ? rawBranch : undefined
    const [text, hasRemote] = await Promise.all([
      gitText(
        git(["status", "--porcelain=v1", "-z", "--branch", "--untracked-files=all"], {
          cwd: currentProject().directory,
          timeoutProfile: "default",
        }),
        "vcs status",
      ),
      hasConfiguredRemote(currentProject().directory),
    ])
    return parse(text, { initialized: true, branch, commit, hasRemote })
  }

  export async function diff(mode: Mode, options?: DiffOptions): Promise<FileDiff[]> {
    if (!Project.isGitRepo(currentProject().directory)) {
      throw new PrerequisiteError({ reason: "not_git", message: "vcs diff requires a git repository" })
    }
    if (mode === "git") {
      if (!(await hasHead(currentProject().directory))) return diffWithoutHead(currentProject().directory, options)
      return diffAgainstRef(currentProject().directory, "HEAD", options)
    }

    if (!(await hasHead(currentProject().directory))) {
      throw new PrerequisiteError({ reason: "unborn_head", message: "vcs branch diff requires a committed HEAD" })
    }
    const target = await defaultBranchRef(currentProject().directory)
    const ref = await mergeBase(currentProject().directory, target)
    return diffAgainstRef(currentProject().directory, ref, options)
  }
}
