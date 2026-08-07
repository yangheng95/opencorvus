import { currentProjectDirectory } from "@/project/instance-context"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Database } from "@/storage/db"
import { EngineGitProcess, type EngineGitRepository } from "./git-process"
import { Log } from "@/util/log"
import { requireTask, type TaskRow } from "./store"
import { insertEngineProgressSnapshot } from "./progress"
import { setEngineTaskMetadata } from "./task"
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

function note(
  taskID: string,
  status: "created" | "completed" | "failed",
  summary: string,
  payload: Record<string, unknown>,
  time = Date.now(),
) {
  Database.use((db) => insertEngineProgressSnapshot(db, { taskID, status, summary, payload, timeCreated: time }))
}

function save(task: TaskRow, patch: Record<string, unknown>, time = Date.now()) {
  const meta = structuredClone(dict(task.metadata))
  meta.git = {
    ...dict(meta.git),
    ...patch,
  }
  Database.use((db) => setEngineTaskMetadata(db, { taskID: task.id, metadata: meta, timeUpdated: time }))
  return requireTask(task.id)
}

async function commit(input: {
  task: TaskRow
  mode: "baseline" | "result"
}) {
  const msg = message(input.task, input.mode)
  return checkpointWithGitMaintenance({
    taskID: input.task.id,
    root: taskRootDirectory(input.task),
    subject: msg.subject,
    body: msg.body,
    allowEmptyRoot: false,
    expectedRepositories: input.mode === "result" ? baselineRepositories(input.task) : undefined,
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
  const markerSHA256 = markerKind === "file"
    ? createHash("sha256").update(await fs.readFile(marker)).digest("hex")
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
}

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
    throw new Error(`Initialized gitlink ${repositoryPath} is unreadable: ${gitOutputError(result, "git rev-parse failed")}`)
  }
  const topLevel = path.resolve(result.text().trim())
  const expected = path.resolve(directory)
  const matches = process.platform === "win32" ? topLevel.toLowerCase() === expected.toLowerCase() : topLevel === expected
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

async function withRepositoryTreeLock<T>(fn: () => Promise<T>) {
  const { Worktree } = await import("@/worktree")
  return Worktree.withGitLock(fn)
}

async function checkpointWithGitMaintenance(input: {
  taskID: string
  root: string
  subject: string
  body: string
  allowEmptyRoot: boolean
  declaredFiles?: string[]
  expectedRepositories?: FrozenRepositoryRecord[]
}) {
  try {
    return await ProcessSupervisor.withTaskCheckpointLease(input.taskID, () =>
      withRepositoryTreeLock(async () => {
        if (input.expectedRepositories) await assertRepositoryAuthorities(input.root, input.expectedRepositories)
        if (input.expectedRepositories) return checkpointRepositoryTree(input)
        const gitignorePath = path.join(input.root, ".gitignore")
        const originalGitignore = await fs.readFile(gitignorePath).then(
          (bytes) => ({ existed: true as const, bytes }),
          (error: NodeJS.ErrnoException) => {
            if (error.code === "ENOENT") return { existed: false as const }
            throw error
          },
        )
        try {
          await ensureGitignore(input.root)
          const result = await checkpointRepositoryTree(input)
          if (!("error" in result)) return result
          const maintenanceErrors: string[] = []
          try {
            if (originalGitignore.existed) await fs.writeFile(gitignorePath, originalGitignore.bytes)
            else await fs.rm(gitignorePath, { force: true })
          } catch (error) {
            maintenanceErrors.push(`restore maintenance .gitignore failed: ${String(error)}`)
          }
          const priorRecovery = "recovery" in result ? result.recovery : undefined
          const errors = [...(priorRecovery?.errors ?? []), ...maintenanceErrors]
          return {
            error: maintenanceErrors.length > 0
              ? `${result.error} Maintenance recovery failed: ${maintenanceErrors.join("; ")}`
              : result.error,
            recovery: {
              ...(priorRecovery ?? {}),
              restored: (priorRecovery?.restored ?? true) && maintenanceErrors.length === 0,
              errors,
            },
          }
        } catch (error) {
          const maintenanceErrors: string[] = []
          try {
            if (originalGitignore.existed) await fs.writeFile(gitignorePath, originalGitignore.bytes)
            else await fs.rm(gitignorePath, { force: true })
          } catch (restoreError) {
            maintenanceErrors.push(`restore maintenance .gitignore failed: ${String(restoreError)}`)
          }
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

async function repositoryStatus(repository: RepositoryNode) {
  const [headBefore, ref, conflicts] = await Promise.all([
    repositoryHead(repository),
    EngineGitProcess.symbolicHead(repositoryTarget(repository)),
    EngineGitProcess.unmerged(repositoryTarget(repository)),
  ])
  if (ref.exitCode !== 0 && ref.exitCode !== 1) {
    throw new Error(`Git HEAD inspection failed for repository ${repository.path}: ${gitOutputError(ref, "git symbolic-ref failed")}`)
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

async function restoreRepositoryTransactions(input: {
  transactions: RepositoryTransaction[]
  checkpoints: RepositoryCheckpoint[]
  touchedPaths: Set<string>
}) {
  const errors: string[] = []
  for (const checkpoint of input.checkpoints.toReversed()) {
    if (checkpoint.mode !== "created_commit") continue
    const transaction = input.transactions.find((candidate) => candidate.repository.path === checkpoint.path)!
    const current = checkpoint.commit ?? (await repositoryHead(transaction.repository))
    if (!current) {
      if (transaction.headBefore) {
        const restored = await EngineGitProcess.compareAndSwapRef(
          repositoryTarget(transaction.repository),
          transaction.ref,
          transaction.headBefore,
          "0".repeat(transaction.repository.authority!.object_format === "sha256" ? 64 : 40),
        )
        if (restored.exitCode !== 0) {
          errors.push(`restore ref ${checkpoint.path} failed: ${gitOutputError(restored, "git update-ref failed")}`)
        }
      }
      continue
    }
    if (current === transaction.headBefore) continue
    const restored = transaction.headBefore
      ? await EngineGitProcess.compareAndSwapRef(
          repositoryTarget(transaction.repository),
          transaction.ref,
          transaction.headBefore,
          current,
        )
      : await EngineGitProcess.deleteRef(repositoryTarget(transaction.repository), transaction.ref, current)
    if (restored.exitCode !== 0) {
      errors.push(
        `restore ref ${checkpoint.path} failed: ${gitOutputError(restored, "git update-ref failed")}`,
      )
    }
  }
  for (const transaction of input.transactions) {
    if (!input.touchedPaths.has(transaction.repository.path)) continue
    try {
      if (transaction.indexExisted) await fs.copyFile(transaction.indexBackup, transaction.indexPath)
      else await fs.rm(transaction.indexPath, { force: true })
    } catch (error) {
      errors.push(`restore index ${transaction.repository.path} failed: ${String(error)}`)
    }
  }
  return errors
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
      .filter((candidate) => candidate.path !== "." && (file === candidate.path || file.startsWith(`${candidate.path}/`)))
      .toSorted((a, b) => b.path.length - a.path.length)[0]
    if ((owner?.path ?? ".") !== repository.path || file === repository.path) return []
    return [repository.path === "." ? file : file.slice(repository.path.length + 1)]
  })
}

async function commitRepository(input: {
  repository: RepositoryNode
  repositories: RepositoryNode[]
  transaction: RepositoryTransaction
  status: Awaited<ReturnType<typeof repositoryStatus>>
  subject: string
  body: string
  allowEmpty: boolean
  declaredFiles: string[]
}): Promise<RepositoryCheckpoint | { error: string }> {
  const temporary = await Global.createTemporaryDirectory("engine-git-index-")
  const temporaryIndex = path.join(temporary, "index")
  const target = repositoryTarget(input.repository)
  try {
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
    const existingModes = new Map(
      zeroSeparated(existing.stdout, `index modes in ${input.repository.path}`).flatMap((entry) => {
        const match = /^(\d{6}) [0-9a-f]+ 0\t([\s\S]+)$/i.exec(entry)
        return match?.[1] && match[2] ? [[match[2], match[1]] as const] : []
      }),
    )
    const initialized = await EngineGitProcess.initializeEmptyIndex(target, temporaryIndex)
    if (initialized.exitCode !== 0) {
      return { error: gitOutputError(initialized, `Git temporary index initialization failed for ${input.repository.path}`) }
    }
    const declared = new Set(filesOwnedByRepository(input.declaredFiles, input.repository, input.repositories))
    const paths = new Set(zeroSeparated(listed.stdout, `snapshot paths in ${input.repository.path}`))
    for (const value of declared) paths.add(value)
    for (const relativePath of [...paths].toSorted()) {
      if (!ProjectRuntimePaths.isSourceEnumerationAllowed(relativePath)) continue
      const child = input.repositories.find((candidate) => candidate.path !== "." && (
        input.repository.path === "."
          ? candidate.path === relativePath
          : candidate.path === `${input.repository.path}/${relativePath}`
      ))
      let mode: string
      let objectID: string
      if (child) {
        const childHead = await repositoryHead(child)
        if (!childHead) return { error: `Initialized gitlink ${child.path} has no commit to record.` }
        mode = "160000"
        objectID = childHead
      } else {
        const absolute = path.join(input.repository.directory, relativePath)
        let stat: Awaited<ReturnType<typeof fs.lstat>>
        try {
          stat = await fs.lstat(absolute)
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
          throw error
        }
        if (stat.isDirectory()) continue
        let hashPath = absolute
        if (stat.isSymbolicLink()) {
          hashPath = path.join(temporary, `symlink-${createHash("sha256").update(relativePath).digest("hex")}`)
          await fs.writeFile(hashPath, await fs.readlink(absolute), { flag: "wx" })
          mode = "120000"
        } else if (stat.isFile()) {
          mode = existingModes.get(relativePath) === "100755" || (process.platform !== "win32" && (stat.mode & 0o111) !== 0)
            ? "100755"
            : "100644"
        } else {
          return { error: `Repository ${input.repository.path} snapshot path ${relativePath} has unsupported file type.` }
        }
        const hashed = await EngineGitProcess.hashRawBlob(target, hashPath)
        if (hashed.exitCode !== 0) {
          return { error: gitOutputError(hashed, `Git raw blob hashing failed for ${relativePath}`) }
        }
        objectID = hashed.text().trim()
      }
      const indexed = await EngineGitProcess.addIndexEntry(target, temporaryIndex, mode, objectID, relativePath)
      if (indexed.exitCode !== 0) {
        return { error: gitOutputError(indexed, `Git temporary index update failed for ${relativePath}`) }
      }
    }
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
      return {
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
    const missing = "0".repeat(input.repository.authority!.object_format === "sha256" ? 64 : 40)
    const updated = await EngineGitProcess.compareAndSwapRef(
      target,
      input.status.ref,
      commitID,
      input.status.headBefore ?? missing,
    )
    if (updated.exitCode !== 0) {
      return { error: gitOutputError(updated, `Git owning-ref compare-and-swap failed for ${input.repository.path}`) }
    }
    await fs.copyFile(temporaryIndex, input.transaction.indexPath)
    return {
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
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true })
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
}) {
  const tree = input.expectedRepositories
    ? {
        repositories: input.expectedRepositories.map((repository) => ({
          path: repository.path,
          directory: repository.authority.workspace,
          depth: repository.depth,
          authority: repository.authority,
        })),
        uninitialized: [] as RepositoryCheckpoint[],
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
  const checkpoints: RepositoryCheckpoint[] = []
  const touchedPaths = new Set<string>()
  try {
    for (const repository of repositories.toSorted((a, b) => b.depth - a.depth)) {
      touchedPaths.add(repository.path)
      const checkpoint = await commitRepository({
        repository,
        repositories,
        transaction: transactionSet.transactions.find((candidate) => candidate.repository === repository)!,
        status: statuses.get(repository)!,
        subject: input.subject,
        body: input.body,
        allowEmpty: repository.path === "." && input.allowEmptyRoot,
        declaredFiles: input.declaredFiles ?? [],
      })
      if ("error" in checkpoint) {
        const recoveryErrors = await restoreRepositoryTransactions({
          transactions: transactionSet.transactions,
          checkpoints,
          touchedPaths,
        })
        return {
          error: recoveryErrors.length > 0 ? `${checkpoint.error} Recovery failed: ${recoveryErrors.join("; ")}` : checkpoint.error,
          recovery: {
            restored: recoveryErrors.length === 0,
            committedRepositories: checkpoints
              .filter((candidate) => candidate.mode === "created_commit")
              .map((candidate) => ({ path: candidate.path, commit: candidate.commit })),
            errors: recoveryErrors,
          },
        }
      }
      checkpoints.push(checkpoint)
      if (
        checkpoint.mode === "created_commit" &&
        (!checkpoint.commit || checkpoint.commit === checkpoint.head_before)
      ) {
        const recoveryErrors = await restoreRepositoryTransactions({
          transactions: transactionSet.transactions,
          checkpoints,
          touchedPaths,
        })
        const validationError = checkpoint.commit
          ? `Git commit for repository ${checkpoint.path} did not advance its owning ref.`
          : `Git commit for repository ${checkpoint.path} succeeded but its new commit could not be resolved.`
        return {
          error: recoveryErrors.length > 0
            ? `${validationError} Recovery failed: ${recoveryErrors.join("; ")}`
            : validationError,
          recovery: {
            restored: recoveryErrors.length === 0,
            committedRepositories: checkpoints
              .filter((candidate) => candidate.mode === "created_commit")
              .map((candidate) => ({ path: candidate.path, commit: candidate.commit })),
            errors: recoveryErrors,
          },
        }
      }
    }
    const root = checkpoints.find((checkpoint) => checkpoint.path === ".")
    if (!root) {
      const recoveryErrors = await restoreRepositoryTransactions({
        transactions: transactionSet.transactions,
        checkpoints,
        touchedPaths,
      })
      return {
        error: `Git repository tree checkpoint did not produce a root repository anchor.${
          recoveryErrors.length > 0 ? ` Recovery failed: ${recoveryErrors.join("; ")}` : ""
        }`,
        recovery: { restored: recoveryErrors.length === 0, errors: recoveryErrors },
      }
    }
    return {
      ...root,
      repositories: [...checkpoints, ...tree.uninitialized].toSorted((a, b) => a.path.localeCompare(b.path)),
    }
  } catch (error) {
    const recoveryErrors = await restoreRepositoryTransactions({
      transactions: transactionSet.transactions,
      checkpoints,
      touchedPaths,
    })
    return {
      error: `Repository-tree checkpoint failed: ${String(error)}${
        recoveryErrors.length > 0 ? ` Recovery failed: ${recoveryErrors.join("; ")}` : ""
      }`,
      recovery: {
        restored: recoveryErrors.length === 0,
        committedRepositories: checkpoints
          .filter((candidate) => candidate.mode === "created_commit")
          .map((candidate) => ({ path: candidate.path, commit: candidate.commit })),
        errors: recoveryErrors,
      },
    }
  } finally {
    await fs.rm(transactionSet.backupRoot, { recursive: true, force: true }).catch((error) => {
      log.warn("repository-tree index backup cleanup failed", { backupRoot: transactionSet.backupRoot, error: String(error) })
    })
  }
}

// OpenCorvus owns exactly one project ignore rule, derived from the canonical
// runtime root. Static `.opencorvus/` project inputs remain versionable.
const OPENCORVUS_GITIGNORE_RULE = `${ProjectRuntimePaths.relativeRuntimeRoot()}/`

/** Ensure the canonical raw-byte checkpoint includes the OpenCorvus runtime exclusion. */
export async function ensureGitignore(dir = currentProjectDirectory()) {
  const file = Bun.file(`${dir}/.gitignore`)
  if (await file.exists()) {
    // Preserve user policy verbatim and append only OpenCorvus's own rule.
    const existing = await file.text()
    const lines = new Set(existing.split(/\r?\n/).map((l) => l.trim()))
    if (!lines.has(OPENCORVUS_GITIGNORE_RULE)) {
      const separator = existing.length === 0 || existing.endsWith("\n") ? "" : "\n"
      await Bun.write(`${dir}/.gitignore`, `${existing}${separator}${OPENCORVUS_GITIGNORE_RULE}\n`)
    }
  } else {
    await Bun.write(`${dir}/.gitignore`, `${OPENCORVUS_GITIGNORE_RULE}\n`)
  }
}

function baseline(task: TaskRow) {
  const value = dict(dict(task.metadata).git).baseline
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
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

async function assertRepositoryAuthorities(root: string, repositories: FrozenRepositoryRecord[]) {
  const canonicalRoot = await fs.realpath(root)
  const frozenRoot = repositories.find((repository) => repository.path === ".")!
  if (canonicalRoot !== frozenRoot.authority.workspace) {
    throw new Error(`Task root ${canonicalRoot} does not equal frozen repository root ${frozenRoot.authority.workspace}`)
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
      const digest = createHash("sha256").update(await fs.readFile(marker)).digest("hex")
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
  const value = dict(dict(task.metadata).git).result
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
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
  log.info("commitAcceptanceRound: repository-tree checkpoint start", { cwd })
  const result = await checkpointWithGitMaintenance({
    taskID: input.task.id,
    root: cwd,
    subject: subjectLine,
    body: (input.verdict.summary ?? "").trim(),
    allowEmptyRoot: true,
    declaredFiles: await declaredFilesPresentInWorktree(input.declaredChangedFiles ?? [], cwd),
    expectedRepositories: baselineRepositories(input.task),
  })
  log.info("commitAcceptanceRound: repository-tree checkpoint done", {
    error: "error" in result ? result.error : undefined,
    commit: "commit" in result ? result.commit : undefined,
  })
  if ("error" in result) {
    note(input.task.id, "failed", "Acceptance repository-tree checkpoint failed.", {
      kind: "git",
      stage: "acceptance_round",
      iteration: input.iteration,
      error: result.error,
      recovery: "recovery" in result ? result.recovery : undefined,
    })
    return { mode: "skipped", error: result.error }
  }
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
  export const commitAcceptanceRound = (input: Parameters<typeof _commitAcceptanceRound>[0]) =>
    _commitAcceptanceRound(input)

  export async function prepare(task: TaskRow) {
    if (baseline(task)) return { task }
    const processBinding = readTaskProcessBinding(task.id)
    const initialTreeSHA256 = processBinding.protocol === TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL
      ? processBinding.workspace.initial_tree_sha256
      : processBinding.initial_tree_sha256
    const executionBaselineTreeSHA256 = await executionCapsuleSourceTreeDigest(taskRootDirectory(task))
    if (executionBaselineTreeSHA256 !== initialTreeSHA256) {
      const summary = `Task ${task.id} workspace changed between creation and first execution`
      note(task.id, "failed", summary, {
        kind: "git",
        stage: "baseline",
        initial_tree_sha256: initialTreeSHA256,
        execution_baseline_tree_sha256: executionBaselineTreeSHA256,
      })
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
    const next = await commit({
      task,
      mode: "baseline",
    })
    if ("error" in next) {
      const summary = `Failed to capture the startup git checkpoint: ${next.error}`
      note(task.id, "failed", summary, {
        kind: "git",
        stage: "baseline",
        error: next.error,
        recovery: "recovery" in next ? next.recovery : undefined,
      })
      return { task, error: summary }
    }

    const branch = next.ref === "HEAD" ? undefined : next.ref.replace(/^refs\/heads\//, "")
    const snapshot = next.tree
    const time = Date.now()
    const row = save(
      task,
      {
        branch,
        baseline: {
          mode: next.mode,
          branch,
          commit: next.commit,
          message: next.message,
          head_before: next.head_before,
          repositories: "repositories" in next ? next.repositories : undefined,
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
        },
      },
      time,
    )
    note(
      task.id,
      "created",
      next.mode === "created_commit"
        ? "Created a startup git checkpoint."
        : "Recorded the current HEAD as the startup checkpoint.",
      {
        kind: "git",
        stage: "baseline",
        mode: next.mode,
        branch,
        commit: next.commit,
        message: next.message,
        repositories: "repositories" in next ? next.repositories : undefined,
        snapshot,
      },
      time,
    )
    return { task: row }
  }

  export async function complete(task: TaskRow) {
    const previousResult = result(task)
    const metadataGit = dict(dict(task.metadata).git)
    const resultHistory = Array.isArray(metadataGit.result_history) ? metadataGit.result_history : []
    const next = await commit({
      task,
      mode: "result",
    })
    if ("error" in next) {
      const summary = `Failed to capture the final git checkpoint: ${next.error}`
      note(task.id, "failed", summary, {
        kind: "git",
        stage: "result",
        error: next.error,
        recovery: "recovery" in next ? next.recovery : undefined,
      })
      return { task, error: summary }
    }

    const branch = next.ref === "HEAD" ? undefined : next.ref.replace(/^refs\/heads\//, "")
    const time = Date.now()
    const row = save(
      task,
      {
        branch,
        result: {
          mode: next.mode,
          branch,
          commit: next.commit,
          message: next.message,
          head_before: next.head_before,
          repositories: "repositories" in next ? next.repositories : undefined,
          dirty: next.dirty,
          staged: 0,
          modified: next.dirty ? 1 : 0,
          untracked: 0,
          conflicts: 0,
          ahead: 0,
          behind: 0,
          time,
        },
        result_history: previousResult ? [...resultHistory, previousResult] : resultHistory,
      },
      time,
    )
    note(
      task.id,
      "completed",
      next.mode === "created_commit"
        ? "Committed the final workspace checkpoint."
        : "Recorded the current HEAD as the final workspace checkpoint.",
      {
        kind: "git",
        stage: "result",
        mode: next.mode,
        branch,
        commit: next.commit,
        message: next.message,
        repositories: "repositories" in next ? next.repositories : undefined,
      },
      time,
    )
    return { task: row }
  }

  export function terminalEvidenceCheckpoint(task: TaskRow) {
    const persisted = result(task)
    if (!persisted) throw new Error(`Task ${task.id} has no terminal workspace checkpoint`)
    return persisted
  }
}
