import { currentProjectDirectory } from "@/project/instance-context"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Database, and, asc, eq } from "@/storage/db"
import {
  EngineGitProcess,
  type EngineGitFileFingerprint,
  type EngineGitIndexEntry,
  type EngineGitRawBlobSource,
  type EngineGitRepository,
} from "./git-process"
import { Log } from "@/util/log"
import { requireTask, type TaskRow } from "./store"
import { EngineGitCheckpointOutcomeTable, EngineGitCheckpointRequestTable } from "./engine.sql"
import { Identifier } from "@/id/id"
import { taskLifecycleProjectionInTransaction } from "./task-lifecycle"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Global } from "@/global"
import { createHash } from "node:crypto"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { readTaskProcessBinding, TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL } from "./task-execution-capsule-binding"
import { Filesystem } from "@/util/filesystem"
import { taskRootDirectory } from "./task-directory"
import { executionCapsuleSourceTreeDigest } from "@/execution-capsule/tree-digest"
import type { Stats } from "node:fs"
import { captureProjectMetadataRollback, ensureGitProjectMetadata } from "./git-project-metadata"

export { ensureGitProjectMetadata } from "./git-project-metadata"

const log = Log.create({ service: "engine-git" })

const AUTHOR = {
  name: "OpenCorvus",
  email: "opencorvus@local",
}

function dict(input: unknown) {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
}

function clean(input: string) {
  return input.replace(/\s+/g, " ").trim()
}

function clip(input: string, limit = 72) {
  const value = clean(input)
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 1).trimEnd()}…`
}

function body(task: TaskRow) {
  return `Task request: ${clean(task.request)}`
}

function message(task: TaskRow, mode: "baseline" | "result") {
  const base = clip(task.title || task.request, mode === "baseline" ? 54 : 72)
  return {
    subject: mode === "baseline" ? clip(`Checkpoint before ${base}`) : base,
    body: body(task),
  }
}

function executionEpoch(taskID: string): number {
  return Database.use((db) => taskLifecycleProjectionInTransaction(db, taskID).epoch)
}

function checkpointOperationKey(taskID: string, stage: "baseline" | "result", epoch = executionEpoch(taskID)) {
  return `${stage}:${epoch}`
}

function checkpointRequestID(taskID: string, operationKey: string) {
  return Identifier.deterministic("artifact", `git-checkpoint\0${taskID}\0${operationKey}`)
}

function beginCheckpointRequest(input: {
  taskID: string
  stage: "baseline" | "result" | "acceptance_round"
  operationKey: string
  effectInput: Record<string, unknown>
}) {
  return Database.immediateTransaction((db) => {
    const id = checkpointRequestID(input.taskID, input.operationKey)
    const existing = db.select().from(EngineGitCheckpointRequestTable)
      .where(eq(EngineGitCheckpointRequestTable.id, id)).get()
    if (existing) {
      const outcome = db.select().from(EngineGitCheckpointOutcomeTable)
        .where(eq(EngineGitCheckpointOutcomeTable.request_id, id)).get()
      // A completed operation key is absorbing. Historical cutover can prove
      // its outcome even when the pre-cutover writer did not retain its exact
      // write-ahead input; replay must return that receipt, never repeat Git.
      if (outcome) return { request: existing, outcome: outcome.result }
      if (
        existing.task_id !== input.taskID || existing.stage !== input.stage ||
        existing.operation_key !== input.operationKey || JSON.stringify(existing.input) !== JSON.stringify(input.effectInput)
      ) throw new Error(`Git checkpoint request ${id} replay changed its exact input`)
      throw new GitCheckpointOutcomeUnknownError(id)
    }
    const request = {
      id,
      task_id: input.taskID,
      stage: input.stage,
      operation_key: input.operationKey,
      input: input.effectInput,
      time_created: Date.now(),
    }
    db.insert(EngineGitCheckpointRequestTable).values(request).run()
    return { request, outcome: undefined }
  })
}

function settleCheckpointRequest(requestID: string, result: Record<string, unknown>) {
  Database.immediateTransaction((db) => {
    const existing = db.select().from(EngineGitCheckpointOutcomeTable)
      .where(eq(EngineGitCheckpointOutcomeTable.request_id, requestID)).get()
    if (existing) {
      if (JSON.stringify(existing.result) !== JSON.stringify(result)) {
        throw new Error(`Git checkpoint request ${requestID} replay changed its outcome`)
      }
      return
    }
    db.insert(EngineGitCheckpointOutcomeTable).values({ request_id: requestID, result, time_created: Date.now() }).run()
  })
}

type CheckpointOutcomePersistenceHook = (input: {
  requestID: string
  result: Record<string, unknown>
}) => void | Promise<void>

let checkpointOutcomePersistenceHookForTest: CheckpointOutcomePersistenceHook | undefined

async function persistProducedCheckpointOutcome(requestID: string, result: Record<string, unknown>) {
  await checkpointOutcomePersistenceHookForTest?.({ requestID, result })
  settleCheckpointRequest(requestID, result)
}

export class GitCheckpointOutcomeUnknownError extends Error {
  constructor(readonly requestID: string) {
    super(`Git checkpoint ${requestID} has an unknown outcome and requires repository reconciliation`)
    this.name = "GitCheckpointOutcomeUnknownError"
  }
}

async function commit(input: { task: TaskRow; mode: "baseline" | "result" }) {
  const msg = message(input.task, input.mode)
  return checkpointWithGitMaintenance({
    taskID: input.task.id,
    checkpointStage: input.mode,
    root: taskRootDirectory(input.task),
    subject: msg.subject,
    body: msg.body,
    allowEmptyRoot: false,
    expectedRepositories: input.mode === "result" ? baselineRepositories(input.task) : undefined,
    expectedUninitialized: input.mode === "result" ? baselineUninitializedRepositories(input.task) : undefined,
  })
}

type RepositoryNode = {
  path: string
  directory: string
  depth: number
  authority?: RepositoryAuthority
}

type RepositoryCheckpoint = {
  path: string
  depth: number
  ref: string
  mode: "created_commit" | "recorded_head" | "uninitialized"
  commit?: string
  tree?: string
  message?: string
  head_before?: string
  dirty: boolean
  authority?: RepositoryAuthority
  receipt?: RepositoryCheckpointReceipt
}

type RepositoryCheckpointReceipt = {
  snapshot_path_count: number
  index_entry_count: number
  regular_file_count: number
  symlink_count: number
  gitlink_count: number
  missing_path_count: number
  directory_path_count: number
  raw_blob_count: number
  raw_byte_count: number
  blob_import_process_count: 1
  index_import_process_count: 1
  phase_ms: {
    enumeration: number
    inspection: number
    blob_import: number
    index_projection: number
    tree_and_commit: number
    apply: number
  }
}

type RepositoryAuthority = {
  workspace: string
  git_marker_kind: "directory" | "file"
  git_marker_realpath: string
  git_marker_sha256?: string
  git_dir: string
  common_dir: string
  index_path: string
  object_format: "sha1" | "sha256"
  ref: string
}

type FrozenRepositoryRecord = Readonly<{
  path: string
  depth: number
  authority: RepositoryAuthority
}>

async function repositoryAuthority(repository: RepositoryNode, ref: string): Promise<RepositoryAuthority> {
  const workspace = await fs.realpath(repository.directory)
  const marker = path.join(workspace, ".git")
  const markerStat = await fs.lstat(marker)
  if (markerStat.isSymbolicLink() || (!markerStat.isFile() && !markerStat.isDirectory())) {
    throw new Error(`Repository ${repository.path} has unsupported .git marker type`)
  }
  const markerKind = markerStat.isDirectory() ? "directory" : "file"
  const markerRealpath = await fs.realpath(marker)
  const markerSHA256 =
    markerKind === "file"
      ? createHash("sha256")
          .update(await fs.readFile(marker))
          .digest("hex")
      : undefined
  const gitDirResult = await EngineGitProcess.absoluteGitDirectory(workspace)
  if (gitDirResult.exitCode !== 0) {
    throw new Error(gitOutputError(gitDirResult, `Repository ${repository.path} gitdir resolution failed`))
  }
  const commonDirResult = await EngineGitProcess.commonDirectory(workspace)
  if (commonDirResult.exitCode !== 0) {
    throw new Error(gitOutputError(commonDirResult, `Repository ${repository.path} common-dir resolution failed`))
  }
  const indexResult = await EngineGitProcess.indexPath(workspace)
  if (indexResult.exitCode !== 0) {
    throw new Error(gitOutputError(indexResult, `Repository ${repository.path} index resolution failed`))
  }
  const objectFormatResult = await EngineGitProcess.objectFormat(workspace)
  if (objectFormatResult.exitCode !== 0) {
    throw new Error(gitOutputError(objectFormatResult, `Repository ${repository.path} object format resolution failed`))
  }
  const objectFormat = objectFormatResult.text().trim()
  if (objectFormat !== "sha1" && objectFormat !== "sha256") {
    throw new Error(`Repository ${repository.path} has unsupported object format ${objectFormat}`)
  }
  const resolveAdminPath = async (value: string) => {
    const resolved = path.resolve(workspace, value.trim())
    try {
      return await fs.realpath(resolved)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolved
      throw error
    }
  }
  return {
    workspace,
    git_marker_kind: markerKind,
    git_marker_realpath: markerRealpath,
    git_marker_sha256: markerSHA256,
    git_dir: await resolveAdminPath(gitDirResult.text()),
    common_dir: await resolveAdminPath(commonDirResult.text()),
    index_path: await resolveAdminPath(indexResult.text()),
    object_format: objectFormat,
    ref,
  }
}

type RepositoryTransaction = {
  repository: RepositoryNode
  ref: string
  headBefore?: string
  indexPath: string
  indexBackup: string
  indexExisted: boolean
  preparedIndex?: string
}

type PreparedRepositoryCheckpoint = {
  checkpoint: RepositoryCheckpoint
  temporaryRoot: string
  temporaryIndex: string
  transaction: RepositoryTransaction
  projectedGitlinks: Array<{ path: string; commit: string }>
}

type GitLease = Readonly<{ assertOwned(): void }>

function repositoryTarget(repository: RepositoryNode): EngineGitRepository {
  const authority = repository.authority
  if (!authority) throw new Error(`Repository ${repository.path} has no frozen Git authority`)
  return { workTree: authority.workspace, gitDir: authority.git_dir }
}

async function repositoryHead(repository: RepositoryNode) {
  const result = await EngineGitProcess.head(repositoryTarget(repository))
  if (result.exitCode !== 0) return
  const value = result.text().trim()
  return value || undefined
}

async function frozenRepositoryRef(transaction: RepositoryTransaction) {
  const target = repositoryTarget(transaction.repository)
  if (transaction.ref === "HEAD") {
    const symbolic = await EngineGitProcess.symbolicHead(target)
    if (symbolic.exitCode === 0) {
      throw new Error(`recovery conflict: detached HEAD authority changed for ${transaction.repository.path}`)
    }
    if (symbolic.exitCode !== 1) {
      throw new Error(
        `recovery conflict: detached HEAD inspection failed for ${transaction.repository.path}: ${gitOutputError(
          symbolic,
          "git symbolic-ref failed",
        )}`,
      )
    }
  }
  const resolved =
    transaction.ref === "HEAD"
      ? await EngineGitProcess.head(target)
      : await EngineGitProcess.resolveRef(target, transaction.ref)
  if (resolved.exitCode === 1 && transaction.ref !== "HEAD") return
  if (resolved.exitCode !== 0) {
    throw new Error(
      `recovery conflict: owning ref inspection failed for ${transaction.repository.path}: ${gitOutputError(
        resolved,
        "git ref inspection failed",
      )}`,
    )
  }
  const value = resolved.text().trim()
  return value || undefined
}

async function repositorySubject(repository: RepositoryNode, ref: string | undefined) {
  if (!ref) return
  const result = await EngineGitProcess.commitSubject(repositoryTarget(repository), ref)
  if (result.exitCode !== 0) return
  const value = result.text().trim()
  return value || undefined
}

function gitOutputError(result: Awaited<ReturnType<typeof EngineGitProcess.head>>, fallback: string) {
  return result.stderr.toString().trim() || result.stdout.toString().trim() || fallback
}

function zeroSeparated(input: Buffer, label: string) {
  const value = input.toString()
  if (!value) return []
  if (!value.endsWith("\0")) throw new Error(`${label} did not end with a NUL record terminator`)
  return value.slice(0, -1).split("\0")
}

async function directGitlinks(cwd: string) {
  const listed = await EngineGitProcess.directGitlinks(cwd)
  if (listed.exitCode !== 0) throw new Error(gitOutputError(listed, `Failed to read gitlinks in ${cwd}`))
  return zeroSeparated(listed.stdout, `gitlinks in ${cwd}`).flatMap((entry) => {
    const match = /^160000 ([0-9a-f]+) 0\t([\s\S]+)$/i.exec(entry)
    return match?.[1] && match[2] ? [{ commit: match[1], path: match[2] }] : []
  })
}

async function initializedRepository(directory: string, repositoryPath: string) {
  try {
    if (!(await fs.stat(directory)).isDirectory()) return false
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
    throw new Error(`Cannot inspect gitlink directory ${repositoryPath}: ${String(error)}`)
  }
  const marker = path.join(directory, ".git")
  try {
    await fs.stat(marker)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`Cannot inspect gitlink metadata ${repositoryPath}: ${String(error)}`)
    }
    const entries = await fs.readdir(directory)
    if (entries.length === 0) return false
    throw new Error(`Gitlink ${repositoryPath} exists but is not an initialized Git repository.`)
  }
  const result = await EngineGitProcess.topLevel(directory)
  if (result.exitCode !== 0) {
    throw new Error(
      `Initialized gitlink ${repositoryPath} is unreadable: ${gitOutputError(result, "git rev-parse failed")}`,
    )
  }
  const topLevel = path.resolve(result.text().trim())
  const expected = path.resolve(directory)
  const matches =
    process.platform === "win32" ? topLevel.toLowerCase() === expected.toLowerCase() : topLevel === expected
  if (!matches) throw new Error(`Gitlink ${repositoryPath} resolved to unexpected repository root ${topLevel}.`)
  return true
}

async function repositoryTree(root: string) {
  const result: RepositoryNode[] = []
  const uninitialized: RepositoryCheckpoint[] = []
  const seen = new Set<string>()
  const visit = async (directory: string, relativePath: string, depth: number) => {
    const identity = process.platform === "win32" ? path.resolve(directory).toLowerCase() : path.resolve(directory)
    if (seen.has(identity)) throw new Error(`Git repository tree contains a cycle at ${relativePath}`)
    seen.add(identity)
    result.push({ path: relativePath, directory, depth })
    for (const gitlink of await directGitlinks(directory)) {
      const childDirectory = path.join(directory, gitlink.path)
      const childPath = relativePath === "." ? gitlink.path : `${relativePath}/${gitlink.path}`
      const normalizedChildPath = childPath.replaceAll("\\", "/")
      if (!(await initializedRepository(childDirectory, normalizedChildPath))) {
        uninitialized.push({
          path: normalizedChildPath,
          depth: depth + 1,
          ref: "gitlink",
          mode: "uninitialized",
          commit: gitlink.commit,
          head_before: gitlink.commit,
          dirty: false,
        })
        continue
      }
      await visit(childDirectory, normalizedChildPath, depth + 1)
    }
  }
  await visit(root, ".", 0)
  return { repositories: result, uninitialized }
}

type FinalizedGitTransaction = {
  rollback(): Promise<string[]>
  cleanup(): Promise<void>
}

type OwnedIndexLock = Readonly<{
  path: string
  fingerprint: EngineGitFileFingerprint
}>

type RegisterFinalizedGitTransaction = (transaction: FinalizedGitTransaction) => void

async function withRepositoryTreeLock<T>(
  fn: (lease: GitLease, register: RegisterFinalizedGitTransaction) => Promise<T>,
) {
  const { Worktree } = await import("@/worktree")
  let finalized: FinalizedGitTransaction | undefined
  try {
    return await Worktree.withGitLock((lease) =>
      fn(lease, (transaction) => {
        if (finalized) throw new Error("Repository-tree checkpoint registered more than one finalized transaction")
        finalized = transaction
      }),
    )
  } catch (error) {
    if (!finalized) throw error
    const recoveryErrors = await finalized.rollback()
    if (recoveryErrors.length > 0) {
      throw new AggregateError(
        [error, ...recoveryErrors.map((failure) => new Error(failure))],
        `Project Git lease failed after checkpoint publication and recovery was incomplete: ${recoveryErrors.join("; ")}`,
      )
    }
    throw error
  } finally {
    await finalized?.cleanup()
  }
}

type CheckpointMaintenanceInput = {
  taskID: string
  checkpointStage: "baseline" | "result" | "acceptance_round"
  root: string
  subject: string
  body: string
  allowEmptyRoot: boolean
  declaredFiles?: string[]
  expectedRepositories?: FrozenRepositoryRecord[]
  expectedUninitialized?: RepositoryCheckpoint[]
  onActive?: () => void
}

async function checkpointWithGitMaintenanceOperation(input: CheckpointMaintenanceInput) {
  try {
    return await ProcessSupervisor.withTaskCheckpointLease(input.taskID, () =>
      withRepositoryTreeLock(async (gitLease, registerFinalizedTransaction) => {
        input.onActive?.()
        if (input.expectedRepositories) await assertRepositoryAuthorities(input.root, input.expectedRepositories)
        if (input.expectedRepositories) {
          return checkpointRepositoryTree({ ...input, gitLease, registerFinalizedTransaction })
        }
        const restoreOriginalProjectMetadata = await captureProjectMetadataRollback(input.root)
        try {
          await ensureGitProjectMetadata(input.root)
          const result = await checkpointRepositoryTree({
            ...input,
            gitLease,
            registerFinalizedTransaction: (transaction) =>
              registerFinalizedTransaction({
                rollback: async () => [
                  ...(await transaction.rollback()),
                  ...(await restoreOriginalProjectMetadata()),
                ],
                cleanup: transaction.cleanup,
              }),
          })
          if (!("error" in result)) return result
          const maintenanceErrors = await restoreOriginalProjectMetadata()
          const priorRecovery = "recovery" in result ? result.recovery : undefined
          const errors = [...(priorRecovery?.errors ?? []), ...maintenanceErrors]
          return {
            error:
              maintenanceErrors.length > 0
                ? `${result.error} Maintenance recovery failed: ${maintenanceErrors.join("; ")}`
                : result.error,
            recovery: {
              ...(priorRecovery ?? {}),
              restored: (priorRecovery?.restored ?? true) && maintenanceErrors.length === 0,
              errors,
            },
          }
        } catch (error) {
          const maintenanceErrors = await restoreOriginalProjectMetadata()
          return {
            error: `Repository-tree checkpoint maintenance failed: ${String(error)}${
              maintenanceErrors.length > 0 ? ` Recovery failed: ${maintenanceErrors.join("; ")}` : ""
            }`,
            recovery: { restored: maintenanceErrors.length === 0, errors: maintenanceErrors },
          }
        }
      }),
    )
  } catch (error) {
    return { error: `Repository-tree checkpoint preflight failed: ${String(error)}` }
  }
}

async function checkpointWithGitMaintenance(input: CheckpointMaintenanceInput) {
  const started = performance.now()
  let activeStarted: number | undefined
  const traced = await EngineGitProcess.withCommandTrace(() =>
    checkpointWithGitMaintenanceOperation({
      ...input,
      onActive: () => {
        activeStarted ??= performance.now()
      },
    }),
  )
  const completed = performance.now()
  const commandCounts = Object.fromEntries(
    [...new Set(traced.commands)]
      .toSorted()
      .map((command) => [command, traced.commands.filter((candidate) => candidate === command).length]),
  )
  const repositories =
    "repositories" in traced.value && Array.isArray(traced.value.repositories)
      ? (traced.value.repositories as RepositoryCheckpoint[])
      : []
  const repositoryReceipts = repositories.flatMap((repository) => (repository.receipt ? [repository.receipt] : []))
  return {
    ...traced.value,
    checkpoint_receipt: {
      task_id: input.taskID,
      checkpoint_stage: input.checkpointStage,
      repository_count: repositories.length,
      snapshot_path_count: repositoryReceipts.reduce((total, receipt) => total + receipt.snapshot_path_count, 0),
      regular_file_count: repositoryReceipts.reduce((total, receipt) => total + receipt.regular_file_count, 0),
      symlink_count: repositoryReceipts.reduce((total, receipt) => total + receipt.symlink_count, 0),
      gitlink_count: repositoryReceipts.reduce((total, receipt) => total + receipt.gitlink_count, 0),
      missing_path_count: repositoryReceipts.reduce((total, receipt) => total + receipt.missing_path_count, 0),
      raw_blob_count: repositoryReceipts.reduce((total, receipt) => total + receipt.raw_blob_count, 0),
      raw_byte_count: repositoryReceipts.reduce((total, receipt) => total + receipt.raw_byte_count, 0),
      blob_import_process_count: traced.commands.filter((command) => command === "fast-import").length,
      index_import_process_count: traced.commands.filter((command) => command === "update-index").length,
      checkpoint_git_process_launch_count: traced.commands.length,
      object_formats: [
        ...new Set(
          repositories.flatMap((repository) =>
            repository.authority?.object_format ? [repository.authority.object_format] : [],
          ),
        ),
      ].toSorted(),
      queue_wait_ms: (activeStarted ?? completed) - started,
      active_checkpoint_ms: completed - (activeStarted ?? started),
      outcome: "error" in traced.value ? ("error" as const) : ("success" as const),
      error_stage: "error" in traced.value ? ("checkpoint" as const) : undefined,
      command_counts: commandCounts,
    },
  }
}

async function repositoryStatus(repository: RepositoryNode) {
  const [headBefore, ref, conflicts] = await Promise.all([
    repositoryHead(repository),
    EngineGitProcess.symbolicHead(repositoryTarget(repository)),
    EngineGitProcess.unmerged(repositoryTarget(repository)),
  ])
  if (ref.exitCode !== 0 && ref.exitCode !== 1) {
    throw new Error(
      `Git HEAD inspection failed for repository ${repository.path}: ${gitOutputError(ref, "git symbolic-ref failed")}`,
    )
  }
  if (conflicts.exitCode !== 0) {
    throw new Error(
      `Git conflict inspection failed for repository ${repository.path}: ${gitOutputError(conflicts, "git ls-files failed")}`,
    )
  }
  const conflictPaths = new Set(
    zeroSeparated(conflicts.stdout, `conflicts in ${repository.path}`).flatMap((entry) => {
      const match = /^\d{6} [0-9a-f]+ [123]\t([\s\S]+)$/i.exec(entry)
      return match?.[1] ? [match[1]] : []
    }),
  )
  return {
    headBefore,
    ref: ref.exitCode === 0 ? ref.text().trim() : "HEAD",
    dirty: false,
    conflicts: [...conflictPaths].toSorted(),
  }
}

async function beginRepositoryTransactions(
  repositories: RepositoryNode[],
  statuses: Map<RepositoryNode, Awaited<ReturnType<typeof repositoryStatus>>>,
) {
  const backupRoot = await Global.createTemporaryDirectory("repository-tree-index-")
  const transactions: RepositoryTransaction[] = []
  try {
    for (const [index, repository] of repositories.entries()) {
      const indexPath = repository.authority!.index_path
      const indexBackup = path.join(backupRoot, `${index}.index`)
      let indexExisted = false
      try {
        await fs.copyFile(indexPath, indexBackup)
        indexExisted = true
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
      const status = statuses.get(repository)!
      transactions.push({
        repository,
        ref: status.ref,
        headBefore: status.headBefore,
        indexPath,
        indexBackup,
        indexExisted,
      })
    }
    return { backupRoot, transactions }
  } catch (error) {
    await fs.rm(backupRoot, { recursive: true, force: true })
    throw error
  }
}

function fingerprint(stat: Stats): EngineGitFileFingerprint {
  return {
    device: stat.dev,
    inode: stat.ino,
    mode: stat.mode,
    size: stat.size,
    modifiedMilliseconds: stat.mtimeMs,
    changedMilliseconds: stat.ctimeMs,
  }
}

function sameFingerprint(left: EngineGitFileFingerprint, right: EngineGitFileFingerprint) {
  return (
    left.device === right.device &&
    left.inode === right.inode &&
    left.mode === right.mode &&
    left.size === right.size &&
    left.modifiedMilliseconds === right.modifiedMilliseconds &&
    left.changedMilliseconds === right.changedMilliseconds
  )
}

async function readOptionalFile(file: string) {
  return fs.readFile(file).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
}

async function writeSyncedFileHandle(handle: Awaited<ReturnType<typeof fs.open>>, bytes: Uint8Array) {
  await handle.truncate(0)
  await handle.writeFile(bytes)
  await handle.sync()
}

async function prepareCanonicalIndexLock(transaction: RepositoryTransaction, temporaryIndex: string) {
  const lockPath = `${transaction.indexPath}.lock`
  const handle = await fs.open(lockPath, "wx", 0o600)
  let failure: unknown
  try {
    const [current, predecessor, next] = await Promise.all([
      readOptionalFile(transaction.indexPath),
      transaction.indexExisted ? fs.readFile(transaction.indexBackup) : Promise.resolve(undefined),
      fs.readFile(temporaryIndex),
    ])
    if (
      (current === undefined) !== (predecessor === undefined) ||
      (current && predecessor && !current.equals(predecessor))
    ) {
      throw new Error(`Canonical Git index changed during checkpoint preparation: ${transaction.repository.path}`)
    }
    await writeSyncedFileHandle(handle, next)
  } catch (error) {
    failure = error
  }
  try {
    await handle.close()
  } catch (closeError) {
    failure = failure
      ? new AggregateError(
          [failure, closeError],
          `Git index lock write and close failed for ${transaction.repository.path}`,
        )
      : closeError
  }
  if (failure) {
    await fs.rm(lockPath, { force: true }).catch(() => undefined)
    throw failure
  }
  return { path: lockPath, fingerprint: fingerprint(await fs.lstat(lockPath)) }
}

async function installCanonicalIndexLock(lock: OwnedIndexLock, transaction: RepositoryTransaction) {
  await Filesystem.renameAfterTransientContention(lock.path, transaction.indexPath)
}

async function removeOwnedIndexLock(lock: OwnedIndexLock) {
  const observed = await fs.lstat(lock.path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (!observed) return
  if (!sameFingerprint(lock.fingerprint, fingerprint(observed))) {
    throw new Error(`Git index lock ownership changed before cleanup: ${lock.path}`)
  }
  await fs.rm(lock.path)
}

async function restoreRepositoryTransaction(
  transaction: RepositoryTransaction,
  checkpoint: RepositoryCheckpoint,
  ownedLock: OwnedIndexLock | undefined,
) {
  if (!transaction.preparedIndex || !checkpoint.commit) {
    throw new Error(`Repository ${transaction.repository.path} has no prepared recovery projection`)
  }
  const lockPath = ownedLock?.path ?? `${transaction.indexPath}.lock`
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined
  let lockAcquired = false
  try {
    if (ownedLock) {
      let recreated = false
      handle = await fs.open(lockPath, "r+", 0o600).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
          recreated = true
          return fs.open(lockPath, "wx", 0o600)
        }
        throw error
      })
      const observed = fingerprint(await handle.stat())
      if (!recreated && !sameFingerprint(ownedLock.fingerprint, observed)) {
        throw new Error(`recovery conflict: Git index lock ownership changed for ${transaction.repository.path}`)
      }
    } else {
      handle = await fs.open(lockPath, "wx", 0o600)
    }
    lockAcquired = true

    const [currentIndex, predecessorIndex, publishedIndex] = await Promise.all([
      readOptionalFile(transaction.indexPath),
      transaction.indexExisted ? fs.readFile(transaction.indexBackup) : Promise.resolve(undefined),
      fs.readFile(transaction.preparedIndex),
    ])
    const expectedCurrentIndex = ownedLock ? predecessorIndex : publishedIndex
    if (
      (currentIndex === undefined) !== (expectedCurrentIndex === undefined) ||
      (currentIndex && expectedCurrentIndex && !currentIndex.equals(expectedCurrentIndex))
    ) {
      throw new Error(`recovery conflict: canonical Git index changed for ${transaction.repository.path}`)
    }

    if (predecessorIndex) await writeSyncedFileHandle(handle, predecessorIndex)
    else {
      await handle.truncate(0)
      await handle.sync()
    }

    const currentRef = await frozenRepositoryRef(transaction)
    if (currentRef !== transaction.headBefore) {
      if (currentRef !== checkpoint.commit) {
        throw new Error(`recovery conflict: owning ref changed for ${transaction.repository.path}`)
      }
      const noDeref = transaction.ref === "HEAD"
      const restored = transaction.headBefore
        ? await EngineGitProcess.compareAndSwapRef(
            repositoryTarget(transaction.repository),
            transaction.ref,
            transaction.headBefore,
            checkpoint.commit,
            { noDeref },
          )
        : await EngineGitProcess.deleteRef(
            repositoryTarget(transaction.repository),
            transaction.ref,
            checkpoint.commit,
            {
              noDeref,
            },
          )
      if (restored.exitCode !== 0) {
        const observed = await frozenRepositoryRef(transaction)
        if (observed !== transaction.headBefore) {
          throw new Error(
            `recovery conflict: owning ref restore failed for ${transaction.repository.path}: ${gitOutputError(
              restored,
              "git update-ref failed",
            )}`,
          )
        }
      }
    }

    if (predecessorIndex) {
      await handle.close()
      handle = undefined
      await Filesystem.renameAfterTransientContention(lockPath, transaction.indexPath)
    } else {
      await fs.rm(transaction.indexPath, { force: true })
      await handle.close()
      handle = undefined
      await fs.rm(lockPath, { force: true })
    }
  } catch (error) {
    await handle?.close().catch(() => undefined)
    handle = undefined
    if (lockAcquired) await fs.rm(lockPath, { force: true }).catch(() => undefined)
    throw error
  } finally {
    await handle?.close().catch(() => undefined)
  }
}

async function restoreRepositoryTransactions(input: {
  transactions: RepositoryTransaction[]
  checkpoints: RepositoryCheckpoint[]
  ownedIndexLocks?: Map<string, OwnedIndexLock>
}) {
  const errors: string[] = []
  for (const checkpoint of input.checkpoints.toReversed()) {
    if (checkpoint.mode !== "created_commit") continue
    const transaction = input.transactions.find((candidate) => candidate.repository.path === checkpoint.path)!
    try {
      await restoreRepositoryTransaction(
        transaction,
        checkpoint,
        input.ownedIndexLocks?.get(transaction.repository.path),
      )
    } catch (error) {
      errors.push(`restore repository ${transaction.repository.path} failed: ${String(error)}`)
    }
  }
  for (const lock of input.ownedIndexLocks?.values() ?? []) {
    await removeOwnedIndexLock(lock).catch((error) => {
      errors.push(`cleanup index lock ${lock.path} failed: ${String(error)}`)
    })
  }
  return errors
}

async function cleanupRepositoryTransaction(input: {
  prepared: PreparedRepositoryCheckpoint[]
  ownedIndexLocks: Map<string, OwnedIndexLock>
  backupRoot: string
}) {
  await Promise.all(
    input.prepared.map((candidate) => fs.rm(candidate.temporaryRoot, { recursive: true, force: true })),
  ).catch((error) => {
    log.warn("repository-tree temporary index cleanup failed", { error: String(error) })
  })
  await Promise.all([...input.ownedIndexLocks.values()].map(removeOwnedIndexLock)).catch((error) => {
    log.warn("repository-tree index lock cleanup failed", { error: String(error) })
  })
  await fs.rm(input.backupRoot, { recursive: true, force: true }).catch((error) => {
    log.warn("repository-tree index backup cleanup failed", {
      backupRoot: input.backupRoot,
      error: String(error),
    })
  })
}

function repositoryCommitMessage(subjectLine: string, bodyText: string, repositoryPath: string) {
  if (repositoryPath === ".") return { subject: subjectLine, body: bodyText }
  return {
    subject: clip(`${subjectLine} [${repositoryPath}]`),
    body: `${bodyText}\n\nRepository: ${repositoryPath}`,
  }
}

function filesOwnedByRepository(files: string[], repository: RepositoryNode, repositories: RepositoryNode[]) {
  if (files.length === 0) return []
  return files.flatMap((file) => {
    const owner = repositories
      .filter(
        (candidate) => candidate.path !== "." && (file === candidate.path || file.startsWith(`${candidate.path}/`)),
      )
      .toSorted((a, b) => b.path.length - a.path.length)[0]
    if ((owner?.path ?? ".") !== repository.path || file === repository.path) return []
    return [repository.path === "." ? file : file.slice(repository.path.length + 1)]
  })
}

async function prepareRepository(input: {
  repository: RepositoryNode
  repositories: RepositoryNode[]
  transaction: RepositoryTransaction
  status: Awaited<ReturnType<typeof repositoryStatus>>
  subject: string
  body: string
  allowEmpty: boolean
  declaredFiles: string[]
  preparedCommits: ReadonlyMap<string, string>
}): Promise<PreparedRepositoryCheckpoint | { error: string }> {
  const temporary = await Global.createTemporaryDirectory("engine-git-index-")
  const temporaryIndex = path.join(temporary, "index")
  const marksFile = path.join(temporary, "blob-marks")
  const target = repositoryTarget(input.repository)
  let retained = false
  try {
    const phase = {
      enumeration: 0,
      inspection: 0,
      blob_import: 0,
      index_projection: 0,
      tree_and_commit: 0,
      apply: 0,
    }
    const enumerationStarted = performance.now()
    const unmerged = await EngineGitProcess.unmerged(target)
    if (unmerged.exitCode !== 0) {
      return { error: gitOutputError(unmerged, `Git unmerged-index inspection failed for ${input.repository.path}`) }
    }
    if (unmerged.stdout.length > 0) {
      return { error: `Repository ${input.repository.path} has unresolved index stages.` }
    }
    const listed = await EngineGitProcess.snapshotPaths(target)
    if (listed.exitCode !== 0) {
      return { error: gitOutputError(listed, `Git snapshot path enumeration failed for ${input.repository.path}`) }
    }
    const existing = await EngineGitProcess.stageEntries(target)
    if (existing.exitCode !== 0) {
      return { error: gitOutputError(existing, `Git index mode inspection failed for ${input.repository.path}`) }
    }
    const existingEntries = new Map(
      zeroSeparated(existing.stdout, `index modes in ${input.repository.path}`).flatMap((entry) => {
        const match = /^(\d{6}) ([0-9a-f]+) 0\t([\s\S]+)$/i.exec(entry)
        return match?.[1] && match[2] && match[3] ? [[match[3], { mode: match[1], objectID: match[2] }] as const] : []
      }),
    )
    const initialized = await EngineGitProcess.initializeEmptyIndex(target, temporaryIndex)
    if (initialized.exitCode !== 0) {
      return {
        error: gitOutputError(initialized, `Git temporary index initialization failed for ${input.repository.path}`),
      }
    }
    const declared = new Set(filesOwnedByRepository(input.declaredFiles, input.repository, input.repositories))
    const paths = new Set(zeroSeparated(listed.stdout, `snapshot paths in ${input.repository.path}`))
    for (const value of declared) paths.add(value)
    phase.enumeration = performance.now() - enumerationStarted

    const inspectionStarted = performance.now()
    const entries: Array<EngineGitIndexEntry | (Omit<EngineGitIndexEntry, "objectID"> & { mark: number })> = []
    const sources: EngineGitRawBlobSource[] = []
    let regularFileCount = 0
    let symlinkCount = 0
    let gitlinkCount = 0
    let missingPathCount = 0
    let directoryPathCount = 0
    let rawByteCount = 0
    let snapshotPathCount = 0
    const projectedGitlinks: Array<{ path: string; commit: string }> = []
    for (const relativePath of [...paths].toSorted()) {
      if (!ProjectRuntimePaths.isSourceEnumerationAllowed(relativePath)) continue
      snapshotPathCount += 1
      const child = input.repositories.find(
        (candidate) =>
          candidate.path !== "." &&
          (input.repository.path === "."
            ? candidate.path === relativePath
            : candidate.path === `${input.repository.path}/${relativePath}`),
      )
      if (child) {
        const childCommit = input.preparedCommits.get(child.path)
        if (!childCommit) return { error: `Initialized gitlink ${child.path} has no prepared commit to record.` }
        gitlinkCount += 1
        projectedGitlinks.push({ path: child.path, commit: childCommit })
        entries.push({ mode: "160000", objectID: childCommit, relativePath })
        continue
      }

      const absolute = path.join(input.repository.directory, relativePath)
      let stat: Awaited<ReturnType<typeof fs.lstat>>
      try {
        stat = await fs.lstat(absolute)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          missingPathCount += 1
          continue
        }
        throw error
      }
      if (stat.isDirectory()) {
        directoryPathCount += 1
        const existing = existingEntries.get(relativePath)
        if (existing?.mode === "160000") {
          gitlinkCount += 1
          projectedGitlinks.push({
            path: input.repository.path === "." ? relativePath : `${input.repository.path}/${relativePath}`,
            commit: existing.objectID,
          })
          entries.push({ mode: "160000", objectID: existing.objectID, relativePath })
        }
        continue
      }

      const mark = sources.length + 1
      if (stat.isSymbolicLink()) {
        const before = fingerprint(stat)
        const bytes = await fs.readlink(absolute, { encoding: "buffer" })
        const after = fingerprint(await fs.lstat(absolute))
        if (!sameFingerprint(before, after)) {
          return { error: `Symbolic link changed during checkpoint inspection: ${relativePath}` }
        }
        symlinkCount += 1
        rawByteCount += bytes.byteLength
        sources.push({ mark, content: { kind: "bytes", bytes } })
        entries.push({ mode: "120000", mark, relativePath })
        continue
      }
      if (!stat.isFile()) {
        return { error: `Repository ${input.repository.path} snapshot path ${relativePath} has unsupported file type.` }
      }
      const sourceFingerprint = fingerprint(stat)
      const mode =
        existingEntries.get(relativePath)?.mode === "100755" ||
        (process.platform !== "win32" && (stat.mode & 0o111) !== 0)
          ? "100755"
          : "100644"
      regularFileCount += 1
      rawByteCount += stat.size
      sources.push({ mark, content: { kind: "file", absolutePath: absolute, fingerprint: sourceFingerprint } })
      entries.push({ mode, mark, relativePath })
    }
    phase.inspection = performance.now() - inspectionStarted

    const blobImportStarted = performance.now()
    const imported = await EngineGitProcess.importRawBlobs(
      target,
      sources,
      marksFile,
      input.repository.authority!.object_format,
    )
    if (imported.result.exitCode !== 0) {
      return { error: gitOutputError(imported.result, `Git raw blob import failed for ${input.repository.path}`) }
    }
    phase.blob_import = performance.now() - blobImportStarted

    const projectedEntries = entries.map(
      (entry): EngineGitIndexEntry =>
        "mark" in entry
          ? {
              mode: entry.mode,
              objectID: imported.objectIDs.get(entry.mark)!,
              relativePath: entry.relativePath,
            }
          : entry,
    )
    const indexProjectionStarted = performance.now()
    const indexed = await EngineGitProcess.replaceIndexEntries(target, temporaryIndex, projectedEntries)
    if (indexed.exitCode !== 0) {
      return { error: gitOutputError(indexed, `Git temporary index projection failed for ${input.repository.path}`) }
    }
    input.transaction.preparedIndex = temporaryIndex
    phase.index_projection = performance.now() - indexProjectionStarted

    const treeAndCommitStarted = performance.now()
    const written = await EngineGitProcess.writeTree(target, temporaryIndex)
    if (written.exitCode !== 0) {
      return { error: gitOutputError(written, `Git tree assembly failed for ${input.repository.path}`) }
    }
    const treeID = written.text().trim()
    let priorTree: string | undefined
    if (input.status.headBefore) {
      const resolved = await EngineGitProcess.resolveTree(target, input.status.headBefore)
      if (resolved.exitCode !== 0) {
        return { error: gitOutputError(resolved, `Git parent tree resolution failed for ${input.repository.path}`) }
      }
      priorTree = resolved.text().trim()
    }
    if (treeID === priorTree && !input.allowEmpty) {
      phase.tree_and_commit = performance.now() - treeAndCommitStarted
      const checkpoint: RepositoryCheckpoint = {
        path: input.repository.path,
        depth: input.repository.depth,
        ref: input.status.ref,
        mode: "recorded_head",
        commit: input.status.headBefore,
        tree: treeID,
        message: await repositorySubject(input.repository, input.status.headBefore),
        head_before: input.status.headBefore,
        dirty: false,
        authority: input.repository.authority,
        receipt: {
          snapshot_path_count: snapshotPathCount,
          index_entry_count: projectedEntries.length,
          regular_file_count: regularFileCount,
          symlink_count: symlinkCount,
          gitlink_count: gitlinkCount,
          missing_path_count: missingPathCount,
          directory_path_count: directoryPathCount,
          raw_blob_count: sources.length,
          raw_byte_count: rawByteCount,
          blob_import_process_count: 1,
          index_import_process_count: 1,
          phase_ms: phase,
        },
      }
      retained = true
      return {
        checkpoint,
        temporaryRoot: temporary,
        temporaryIndex,
        transaction: input.transaction,
        projectedGitlinks,
      }
    }
    const msg = repositoryCommitMessage(input.subject, input.body, input.repository.path)
    const committed = await EngineGitProcess.commitTree(target, {
      tree: treeID,
      parent: input.status.headBefore,
      subject: msg.subject,
      body: msg.body,
      identity: AUTHOR,
    })
    if (committed.exitCode !== 0) {
      return { error: gitOutputError(committed, `Git commit object creation failed for ${input.repository.path}`) }
    }
    const commitID = committed.text().trim()
    phase.tree_and_commit = performance.now() - treeAndCommitStarted
    const checkpoint: RepositoryCheckpoint = {
      path: input.repository.path,
      depth: input.repository.depth,
      ref: input.status.ref,
      mode: "created_commit",
      commit: commitID,
      tree: treeID,
      message: msg.subject,
      head_before: input.status.headBefore,
      dirty: treeID !== priorTree,
      authority: input.repository.authority,
      receipt: {
        snapshot_path_count: snapshotPathCount,
        index_entry_count: projectedEntries.length,
        regular_file_count: regularFileCount,
        symlink_count: symlinkCount,
        gitlink_count: gitlinkCount,
        missing_path_count: missingPathCount,
        directory_path_count: directoryPathCount,
        raw_blob_count: sources.length,
        raw_byte_count: rawByteCount,
        blob_import_process_count: 1,
        index_import_process_count: 1,
        phase_ms: phase,
      },
    }
    retained = true
    return {
      checkpoint,
      temporaryRoot: temporary,
      temporaryIndex,
      transaction: input.transaction,
      projectedGitlinks,
    }
  } finally {
    if (!retained) await fs.rm(temporary, { recursive: true, force: true })
  }
}

async function checkpointRepositoryTree(input: {
  taskID: string
  root: string
  subject: string
  body: string
  allowEmptyRoot: boolean
  declaredFiles?: string[]
  expectedRepositories?: FrozenRepositoryRecord[]
  expectedUninitialized?: RepositoryCheckpoint[]
  gitLease: GitLease
  registerFinalizedTransaction: RegisterFinalizedGitTransaction
}) {
  const tree = input.expectedRepositories
    ? {
        repositories: input.expectedRepositories.map((repository) => ({
          path: repository.path,
          directory: repository.authority.workspace,
          depth: repository.depth,
          authority: repository.authority,
        })),
        uninitialized: input.expectedUninitialized ?? [],
      }
    : await repositoryTree(input.root)
  const repositories = tree.repositories
  if (!input.expectedRepositories) {
    for (const repository of repositories) {
      const refResult = await EngineGitProcess.symbolicHeadAt(repository.directory)
      if (refResult.exitCode !== 0 && refResult.exitCode !== 1) {
        throw new Error(gitOutputError(refResult, `Repository ${repository.path} owning ref resolution failed`))
      }
      const ref = refResult.exitCode === 0 ? refResult.text().trim() : "HEAD"
      repository.authority = await repositoryAuthority(repository, ref)
    }
  }
  const processBinding = readTaskProcessBinding(input.taskID)
  if (processBinding.protocol === TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL) {
    const canonicalRoot = await fs.realpath(input.root)
    for (const repository of repositories) {
      const authority = repository.authority!
      if (authority.git_marker_kind !== "file") {
        throw new Error(`Capsule repository ${repository.path} requires a managed-worktree .git file`)
      }
      for (const [label, adminPath] of [
        ["git directory", authority.git_dir],
        ["common directory", authority.common_dir],
        ["index", authority.index_path],
      ] as const) {
        if (Filesystem.contains(canonicalRoot, adminPath)) {
          throw new Error(`Capsule repository ${repository.path} ${label} must be outside writable Task root`)
        }
      }
    }
  }
  const statuses = new Map<RepositoryNode, Awaited<ReturnType<typeof repositoryStatus>>>()
  for (const repository of repositories) {
    const status = await repositoryStatus(repository)
    if (status.conflicts.length > 0) {
      return { error: `Repository ${repository.path} has unresolved merge conflicts: ${status.conflicts.join(", ")}` }
    }
    statuses.set(repository, status)
  }
  const transactionSet = await beginRepositoryTransactions(repositories, statuses)
  const prepared: PreparedRepositoryCheckpoint[] = []
  const applied: RepositoryCheckpoint[] = []
  const ownedIndexLocks = new Map<string, OwnedIndexLock>()
  let cleanupTransferred = false
  try {
    const preparedCommits = new Map<string, string>()
    for (const repository of repositories.toSorted((a, b) => b.depth - a.depth)) {
      const candidate = await prepareRepository({
        repository,
        repositories,
        transaction: transactionSet.transactions.find((candidate) => candidate.repository === repository)!,
        status: statuses.get(repository)!,
        subject: input.subject,
        body: input.body,
        allowEmpty: repository.path === "." && input.allowEmptyRoot,
        declaredFiles: input.declaredFiles ?? [],
        preparedCommits,
      })
      if ("error" in candidate) throw new Error(candidate.error)
      prepared.push(candidate)
      const checkpoint = candidate.checkpoint
      if (
        checkpoint.mode === "created_commit" &&
        (!checkpoint.commit || checkpoint.commit === checkpoint.head_before)
      ) {
        throw new Error(
          checkpoint.commit
            ? `Git commit for repository ${checkpoint.path} did not advance its owning ref.`
            : `Git commit for repository ${checkpoint.path} succeeded but its new commit could not be resolved.`,
        )
      }
      if (checkpoint.commit) preparedCommits.set(repository.path, checkpoint.commit)
    }

    const checkpoints = prepared.map((candidate) => candidate.checkpoint)
    const projectedGitlinks = new Map(
      prepared.flatMap((candidate) =>
        candidate.projectedGitlinks.map((gitlink) => [gitlink.path, gitlink.commit] as const),
      ),
    )
    const uninitialized = tree.uninitialized.flatMap((checkpoint) => {
      const projectedCommit = projectedGitlinks.get(checkpoint.path)
      return projectedCommit ? [{ ...checkpoint, commit: projectedCommit, head_before: projectedCommit }] : []
    })
    const root = checkpoints.find((checkpoint) => checkpoint.path === ".")
    if (!root) {
      throw new Error("Git repository tree checkpoint did not produce a root repository anchor.")
    }

    for (const candidate of prepared) {
      if (candidate.checkpoint.mode !== "created_commit") continue
      input.gitLease.assertOwned()
      ownedIndexLocks.set(
        candidate.checkpoint.path,
        await prepareCanonicalIndexLock(candidate.transaction, candidate.temporaryIndex),
      )
    }

    for (const candidate of prepared) {
      const checkpoint = candidate.checkpoint
      if (checkpoint.mode !== "created_commit") continue
      input.gitLease.assertOwned()
      const commitID = checkpoint.commit!
      const missing = "0".repeat(candidate.transaction.repository.authority!.object_format === "sha256" ? 64 : 40)
      const updated = await EngineGitProcess.compareAndSwapRef(
        repositoryTarget(candidate.transaction.repository),
        candidate.transaction.ref,
        commitID,
        candidate.transaction.headBefore ?? missing,
        { noDeref: candidate.transaction.ref === "HEAD" },
      )
      if (updated.exitCode !== 0) {
        throw new Error(gitOutputError(updated, `Git owning-ref compare-and-swap failed for ${checkpoint.path}`))
      }
      applied.push(checkpoint)
      const applyStarted = performance.now()
      const ownedIndexLock = ownedIndexLocks.get(checkpoint.path)!
      await installCanonicalIndexLock(ownedIndexLock, candidate.transaction)
      ownedIndexLocks.delete(checkpoint.path)
      checkpoint.receipt!.phase_ms.apply = performance.now() - applyStarted
    }
    input.gitLease.assertOwned()
    const result = {
      ...root,
      repositories: [...checkpoints, ...uninitialized].toSorted((a, b) => a.path.localeCompare(b.path)),
    }
    input.registerFinalizedTransaction({
      rollback: () =>
        restoreRepositoryTransactions({
          transactions: transactionSet.transactions,
          checkpoints: applied,
          ownedIndexLocks,
        }),
      cleanup: () =>
        cleanupRepositoryTransaction({
          prepared,
          ownedIndexLocks,
          backupRoot: transactionSet.backupRoot,
        }),
    })
    cleanupTransferred = true
    return result
  } catch (error) {
    const recoveryErrors = await restoreRepositoryTransactions({
      transactions: transactionSet.transactions,
      checkpoints: applied,
      ownedIndexLocks,
    })
    const failure = error instanceof Error ? error.message : String(error)
    return {
      error: `Repository-tree checkpoint failed: ${failure}${
        recoveryErrors.length > 0 ? ` Recovery failed: ${recoveryErrors.join("; ")}` : ""
      }`,
      recovery: {
        restored: recoveryErrors.length === 0,
        committedRepositories: applied
          .filter((candidate) => candidate.mode === "created_commit")
          .map((candidate) => ({ path: candidate.path, commit: candidate.commit })),
        errors: recoveryErrors,
      },
    }
  } finally {
    if (!cleanupTransferred) {
      await cleanupRepositoryTransaction({
        prepared,
        ownedIndexLocks,
        backupRoot: transactionSet.backupRoot,
      })
    }
  }
}

function baseline(task: TaskRow) {
  return checkpointOutcome(task.id, checkpointOperationKey(task.id, "baseline"))
}

function checkpointOutcome(taskID: string, operationKey: string): Record<string, unknown> | undefined {
  return Database.use((db) => db.select({ result: EngineGitCheckpointOutcomeTable.result })
    .from(EngineGitCheckpointRequestTable)
    .innerJoin(EngineGitCheckpointOutcomeTable, eq(
      EngineGitCheckpointOutcomeTable.request_id,
      EngineGitCheckpointRequestTable.id,
    ))
    .where(and(
      eq(EngineGitCheckpointRequestTable.task_id, taskID),
      eq(EngineGitCheckpointRequestTable.operation_key, operationKey),
    )).get()?.result)
}

function projectGitTask(task: TaskRow): TaskRow {
  const epoch = executionEpoch(task.id)
  const baselineValue = checkpointOutcome(task.id, checkpointOperationKey(task.id, "baseline", epoch))
  const resultValue = checkpointOutcome(task.id, checkpointOperationKey(task.id, "result", epoch))
  const history = Database.use((db) => db.select({ result: EngineGitCheckpointOutcomeTable.result })
    .from(EngineGitCheckpointRequestTable)
    .innerJoin(EngineGitCheckpointOutcomeTable, eq(
      EngineGitCheckpointOutcomeTable.request_id,
      EngineGitCheckpointRequestTable.id,
    ))
    .where(and(
      eq(EngineGitCheckpointRequestTable.task_id, task.id),
      eq(EngineGitCheckpointRequestTable.stage, "result"),
    ))
    .orderBy(asc(EngineGitCheckpointRequestTable.time_created)).all()
    .map((row) => row.result)
    .filter((row) => !("error" in row)))
  const metadata = structuredClone(dict(task.metadata))
  metadata.git = {
    ...(baselineValue && !("error" in baselineValue) ? { branch: baselineValue.branch, baseline: baselineValue } : {}),
    ...(resultValue && !("error" in resultValue) ? { branch: resultValue.branch, result: resultValue } : {}),
    ...(history.length > (resultValue && !("error" in resultValue) ? 1 : 0)
      ? { result_history: resultValue ? history.slice(0, -1) : history }
      : {}),
  }
  return { ...task, metadata }
}

function baselineRepositories(task: TaskRow): FrozenRepositoryRecord[] {
  const repositories = baseline(task)?.repositories
  if (!Array.isArray(repositories)) {
    throw new Error(`Task ${task.id} baseline is missing repository authority records`)
  }
  const authorities = repositories.flatMap((repository) => {
    if (!repository || typeof repository !== "object" || Array.isArray(repository)) return []
    const record = repository as Record<string, unknown>
    const authority = record.authority
    if (!authority || typeof authority !== "object" || Array.isArray(authority)) return []
    const value = authority as Record<string, unknown>
    if (
      typeof record.path !== "string" ||
      !Number.isInteger(record.depth) ||
      (record.depth as number) < 0 ||
      typeof value.workspace !== "string" ||
      (value.git_marker_kind !== "directory" && value.git_marker_kind !== "file") ||
      typeof value.git_marker_realpath !== "string" ||
      typeof value.git_dir !== "string" ||
      typeof value.common_dir !== "string" ||
      typeof value.index_path !== "string" ||
      (value.object_format !== "sha1" && value.object_format !== "sha256") ||
      typeof value.ref !== "string" ||
      (value.git_marker_sha256 !== undefined && typeof value.git_marker_sha256 !== "string")
    ) {
      throw new Error(`Task ${task.id} baseline contains an invalid repository authority record`)
    }
    return [{ path: record.path, depth: record.depth as number, authority: value as RepositoryAuthority }]
  })
  if (authorities.length === 0) throw new Error(`Task ${task.id} baseline has no initialized repository authority`)
  const roots = authorities.filter((repository) => repository.path === ".")
  if (roots.length !== 1 || roots[0]!.depth !== 0) {
    throw new Error(`Task ${task.id} baseline must contain exactly one depth-zero root repository`)
  }
  return authorities
}

function baselineUninitializedRepositories(task: TaskRow): RepositoryCheckpoint[] {
  const repositories = baseline(task)?.repositories
  if (!Array.isArray(repositories)) {
    throw new Error(`Task ${task.id} baseline is missing repository authority records`)
  }
  return repositories.flatMap((repository) => {
    if (!repository || typeof repository !== "object" || Array.isArray(repository)) return []
    const record = repository as Record<string, unknown>
    if (record.mode !== "uninitialized") return []
    if (
      typeof record.path !== "string" ||
      !Number.isInteger(record.depth) ||
      (record.depth as number) <= 0 ||
      record.ref !== "gitlink" ||
      typeof record.commit !== "string" ||
      record.head_before !== record.commit ||
      record.dirty !== false
    ) {
      throw new Error(`Task ${task.id} baseline contains an invalid uninitialized repository record`)
    }
    return [
      {
        path: record.path,
        depth: record.depth as number,
        ref: "gitlink",
        mode: "uninitialized" as const,
        commit: record.commit,
        head_before: record.commit,
        dirty: false,
      },
    ]
  })
}

async function assertRepositoryAuthorities(root: string, repositories: FrozenRepositoryRecord[]) {
  const canonicalRoot = await fs.realpath(root)
  const frozenRoot = repositories.find((repository) => repository.path === ".")!
  if (canonicalRoot !== frozenRoot.authority.workspace) {
    throw new Error(
      `Task root ${canonicalRoot} does not equal frozen repository root ${frozenRoot.authority.workspace}`,
    )
  }
  for (const frozen of repositories) {
    const authority = frozen.authority
    const relative = path.relative(canonicalRoot, authority.workspace)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(`Repository authority workspace is outside the Task root: ${authority.workspace}`)
    }
    const canonicalWorkspace = await fs.realpath(authority.workspace)
    if (canonicalWorkspace !== authority.workspace) {
      throw new Error(`Repository authority workspace identity changed: ${authority.workspace}`)
    }
    const marker = path.join(canonicalWorkspace, ".git")
    const markerStat = await fs.lstat(marker)
    const markerKind = markerStat.isDirectory() ? "directory" : markerStat.isFile() ? "file" : undefined
    if (markerStat.isSymbolicLink() || markerKind !== authority.git_marker_kind) {
      throw new Error(`Repository authority .git marker type changed: ${canonicalWorkspace}`)
    }
    if ((await fs.realpath(marker)) !== authority.git_marker_realpath) {
      throw new Error(`Repository authority .git marker identity changed: ${canonicalWorkspace}`)
    }
    if (markerKind === "file") {
      const digest = createHash("sha256")
        .update(await fs.readFile(marker))
        .digest("hex")
      if (digest !== authority.git_marker_sha256) {
        throw new Error(`Repository authority .git marker bytes changed: ${canonicalWorkspace}`)
      }
    }
    for (const [label, adminPath] of [
      ["git directory", authority.git_dir],
      ["common directory", authority.common_dir],
    ] as const) {
      if ((await fs.realpath(adminPath)) !== adminPath) {
        throw new Error(`Repository authority ${label} identity changed: ${canonicalWorkspace}`)
      }
    }
    const repository: RepositoryNode = {
      path: frozen.path,
      directory: canonicalWorkspace,
      depth: frozen.depth,
      authority,
    }
    const currentRef = await EngineGitProcess.symbolicHead(repositoryTarget(repository))
    const ref = currentRef.exitCode === 0 ? currentRef.text().trim() : "HEAD"
    if (ref !== authority.ref) throw new Error(`Repository authority owning ref changed: ${canonicalWorkspace}`)
  }
}

function result(task: TaskRow) {
  return checkpointOutcome(task.id, checkpointOperationKey(task.id, "result"))
}

/**
 * P0-C.1 — anchor each acceptance picky-loop iteration in git.
 *
 * Acceptance can make bounded final repairs, and each picky-loop iteration needs
 * a git anchor. Rejected rounds identify the exact merged state that acceptance
 * reviewed or repaired; accepted rounds anchor the final state before publishing. Without
 * this helper the loop has no per-round LKG (Last Known Good) anchor and no
 * historical record of which round produced which verdict.
 *
 * Always commits — `--allow-empty` plus `--no-gpg-sign` keep this a
 * pure time anchor when acceptance made no code edits. Best-effort: any
 * git failure is logged and reported back, never thrown, so a broken
 * commit never blocks the surrounding acceptance-evidence publication.
 */
async function commitAcceptanceRound(input: {
  task: TaskRow
  iteration: number
  /** Caller passes the rejection_details length (or 0 for accepted) so this
   *  helper does not need to import the full AcceptanceVerdict type. */
  verdict: { verdict: string; summary?: string; rejection_count?: number }
  declaredChangedFiles?: string[]
}): Promise<{ commit?: string; mode: "created_commit" | "skipped"; error?: string }> {
  const cwd = currentProjectDirectory()
  const issues = input.verdict.rejection_count ?? 0
  const subjectLine = clip(`acceptance round ${input.iteration} | verdict=${input.verdict.verdict} | issues=${issues}`)
  const declaredFiles = await declaredFilesPresentInWorktree(input.declaredChangedFiles ?? [], cwd)
  const operationKey = `acceptance_round:${executionEpoch(input.task.id)}:${input.iteration}`
  const admitted = beginCheckpointRequest({
    taskID: input.task.id,
    stage: "acceptance_round",
    operationKey,
    effectInput: {
      root: cwd,
      subject: subjectLine,
      body: (input.verdict.summary ?? "").trim(),
      allowEmptyRoot: true,
      declaredFiles,
    },
  })
  if (admitted.outcome) {
    return "error" in admitted.outcome
      ? { mode: "skipped", error: String(admitted.outcome.error) }
      : { mode: "created_commit", commit: typeof admitted.outcome.commit === "string" ? admitted.outcome.commit : undefined }
  }
  log.info("commitAcceptanceRound: repository-tree checkpoint start", { cwd })
  const result = await checkpointWithGitMaintenance({
    taskID: input.task.id,
    checkpointStage: "acceptance_round",
    root: cwd,
    subject: subjectLine,
    body: (input.verdict.summary ?? "").trim(),
    allowEmptyRoot: true,
    declaredFiles,
    expectedRepositories: baselineRepositories(input.task),
    expectedUninitialized: baselineUninitializedRepositories(input.task),
  })
  log.info("commitAcceptanceRound: repository-tree checkpoint done", {
    error: "error" in result ? result.error : undefined,
    commit: "commit" in result ? result.commit : undefined,
  })
  if ("error" in result) {
    await persistProducedCheckpointOutcome(admitted.request.id, result)
    return { mode: "skipped", error: result.error }
  }
  await persistProducedCheckpointOutcome(admitted.request.id, result)
  return { mode: "created_commit", commit: result.commit }
}

async function declaredFilesPresentInWorktree(files: string[], cwd: string) {
  const unique = new Set<string>()
  for (const file of files) {
    const normalized = normalizeAcceptancePath(file)
    if (!normalized) continue
    const absolute = path.join(cwd, normalized)
    try {
      const stat = await fs.stat(absolute)
      if (stat.isFile()) unique.add(normalized)
    } catch {
      // Missing declared files remain visible to artifact export instead of
      // being synthesized into the commit.
    }
  }
  return [...unique]
}

function normalizeAcceptancePath(file: string) {
  const trimmed = file.trim()
  if (!trimmed || path.isAbsolute(trimmed)) return undefined
  const normalized = path.normalize(trimmed).replaceAll("\\", "/")
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized === "..") return undefined
  const parts = normalized.split("/")
  if (parts.includes(".git") || parts.includes(".opencorvus")) return undefined
  return normalized
}

// Stash the outer-scope function references so the namespace re-exports
// below don't shadow themselves into an infinite recursion. `export const
// commitAcceptanceRound = (...) => commitAcceptanceRound(...)` inside `namespace
// EngineGit` makes the arrow body's `commitAcceptanceRound` resolve to the
// namespace member itself (TypeScript namespace shadowing), so each call
// dispatched through `EngineGit.commitAcceptanceRound` recursed into itself
// until the stack overflowed — observed as the post-acceptance CPU-spin hang
// in tools.ts:2851 (verdict recorded → no `ensureGitignore start` log).
const _commitAcceptanceRound = commitAcceptanceRound

export namespace EngineGit {
  /** Read-only public projection of the sole immutable checkpoint facts. */
  export function project(task: TaskRow) {
    return projectGitTask(task)
  }

  export const commitAcceptanceRound = (input: Parameters<typeof _commitAcceptanceRound>[0]) =>
    _commitAcceptanceRound(input)

  /** Append an outcome obtained from an authoritative repository query or an
   * explicit operator reconciliation. Ordinary execution never guesses an
   * unreceipted Git effect and never replays it under a new activity identity. */
  export function reconcileCheckpoint(input: { requestID: string; result: Record<string, unknown> }) {
    const request = Database.use((db) => db.select({ id: EngineGitCheckpointRequestTable.id })
      .from(EngineGitCheckpointRequestTable)
      .where(eq(EngineGitCheckpointRequestTable.id, input.requestID)).get())
    if (!request) throw new Error(`Git checkpoint request not found: ${input.requestID}`)
    settleCheckpointRequest(input.requestID, input.result)
    return input.result
  }

  export function setCheckpointOutcomePersistenceHookForTest(hook: CheckpointOutcomePersistenceHook) {
    if (checkpointOutcomePersistenceHookForTest) throw new Error("Git checkpoint outcome persistence hook is already installed")
    checkpointOutcomePersistenceHookForTest = hook
    return {
      [Symbol.dispose]() {
        checkpointOutcomePersistenceHookForTest = undefined
      },
    }
  }

  export async function prepare(task: TaskRow) {
    if (baseline(task)) return { task: projectGitTask(task) }
    const processBinding = readTaskProcessBinding(task.id)
    const initialTreeSHA256 =
      processBinding.protocol === TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL
        ? processBinding.workspace.initial_tree_sha256
        : processBinding.initial_tree_sha256
    const executionBaselineTreeSHA256 = await executionCapsuleSourceTreeDigest(taskRootDirectory(task))
    // The guard is what its message says: the workspace must not be swapped
    // between task creation and the task's *first* execution. Checkpoints are
    // keyed per epoch, so a reopened Task finds no baseline for its new epoch
    // and reaches this comparison — where its own prior output is guaranteed
    // to differ from the creation digest. Enforcing it there would terminally
    // fail every reopen of a Task that produced anything, which is precisely
    // the recovery path an operator reaches for after a failure.
    const firstExecution = executionEpoch(task.id) <= 1
    if (firstExecution && executionBaselineTreeSHA256 !== initialTreeSHA256) {
      const summary = `Task ${task.id} workspace changed between creation and first execution`
      return {
        task,
        error: summary,
        terminalFailure: {
          code: "IMMUTABLE_CREATION_WORKSPACE_MISMATCH" as const,
          initialTreeSHA256,
          executionTreeSHA256: executionBaselineTreeSHA256,
        },
      }
    }
    const operationKey = checkpointOperationKey(task.id, "baseline")
    let admitted: ReturnType<typeof beginCheckpointRequest>
    try {
      admitted = beginCheckpointRequest({
        taskID: task.id,
        stage: "baseline",
        operationKey,
        effectInput: { root: taskRootDirectory(task), initialTreeSHA256, executionBaselineTreeSHA256 },
      })
    } catch (error) {
      if (error instanceof GitCheckpointOutcomeUnknownError) return { task: projectGitTask(task), error: error.message }
      throw error
    }
    if (admitted.outcome) {
      return "error" in admitted.outcome
        ? { task: projectGitTask(task), error: String(admitted.outcome.error) }
        : { task: projectGitTask(task) }
    }
    const next = await commit({
      task,
      mode: "baseline",
    })
    if ("error" in next) {
      const summary = `Failed to capture the startup git checkpoint: ${next.error}`
      await persistProducedCheckpointOutcome(admitted.request.id, next)
      return { task: projectGitTask(task), error: summary }
    }

    const branch = next.ref === "HEAD" ? undefined : next.ref.replace(/^refs\/heads\//, "")
    const snapshot = next.tree
    const time = Date.now()
    await persistProducedCheckpointOutcome(admitted.request.id, {
          mode: next.mode,
          branch,
          commit: next.commit,
          message: next.message,
          head_before: next.head_before,
          repositories: "repositories" in next ? next.repositories : undefined,
          checkpoint_receipt: next.checkpoint_receipt,
          snapshot,
          workspace_tree_sha256: executionBaselineTreeSHA256,
          dirty: next.dirty,
          staged: 0,
          modified: next.dirty ? 1 : 0,
          untracked: 0,
          conflicts: 0,
          ahead: 0,
          behind: 0,
          time,
    })
    return { task: projectGitTask(task) }
  }

  export async function complete(task: TaskRow) {
    if (result(task)) return { task: projectGitTask(task) }
    const operationKey = checkpointOperationKey(task.id, "result")
    let admitted: ReturnType<typeof beginCheckpointRequest>
    try {
      admitted = beginCheckpointRequest({
        taskID: task.id,
        stage: "result",
        operationKey,
        effectInput: { root: taskRootDirectory(task), baselineRequest: checkpointRequestID(task.id, checkpointOperationKey(task.id, "baseline")) },
      })
    } catch (error) {
      if (error instanceof GitCheckpointOutcomeUnknownError) return { task: projectGitTask(task), error: error.message }
      throw error
    }
    if (admitted.outcome) {
      return "error" in admitted.outcome
        ? { task: projectGitTask(task), error: String(admitted.outcome.error) }
        : { task: projectGitTask(task) }
    }
    const next = await commit({
      task,
      mode: "result",
    })
    if ("error" in next) {
      const summary = `Failed to capture the final git checkpoint: ${next.error}`
      await persistProducedCheckpointOutcome(admitted.request.id, next)
      return { task: projectGitTask(task), error: summary }
    }

    const branch = next.ref === "HEAD" ? undefined : next.ref.replace(/^refs\/heads\//, "")
    const time = Date.now()
    await persistProducedCheckpointOutcome(admitted.request.id, {
          mode: next.mode,
          branch,
          commit: next.commit,
          message: next.message,
          head_before: next.head_before,
          repositories: "repositories" in next ? next.repositories : undefined,
          checkpoint_receipt: next.checkpoint_receipt,
          dirty: next.dirty,
          staged: 0,
          modified: next.dirty ? 1 : 0,
          untracked: 0,
          conflicts: 0,
          ahead: 0,
          behind: 0,
          time,
    })
    return { task: projectGitTask(task) }
  }

  export function terminalEvidenceCheckpoint(task: TaskRow) {
    const persisted = result(task)
    if (!persisted) throw new Error(`Task ${task.id} has no terminal workspace checkpoint`)
    return persisted
  }
}
