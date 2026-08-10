import {
  TaskArtifactPublicationInventorySchema,
  TaskArtifactRefSchema,
  TaskArtifactResourceSetLocatorSchema,
  TaskArtifactSetSchema,
  TaskArtifactSnapshotIdentitySchema,
  TaskArtifactSnapshotManifestSchema,
  TaskArtifactTreeNameSchema,
  TaskArtifactRelativePathSchema,
  compareTaskArtifactPathsByUTF8,
  type TaskArtifactHost,
  type TaskArtifactMaterialization,
  type TaskArtifactPublication,
  type TaskArtifactPublicationFile,
  type TaskArtifactRef,
  type TaskArtifactResourceSetLocator,
  type TaskArtifactSnapshotIdentity,
  type TaskArtifactSnapshotManifest,
  type TaskArtifactStage,
  type TaskArtifactSet,
} from "@opencorvus-ai/plugin/task-artifact"
import { ArtifactProducerSchema, type ArtifactProducer } from "@opencorvus-ai/plugin/artifact-catalog"
import { ProjectRelativePathSchema } from "@opencorvus-ai/plugin/project-path"
import { createHash, randomUUID } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { requireTask } from "@/engine/store"
import { isTaskTerminal } from "@/engine/task-status"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import type { TaskToolExecutionScope } from "@/tool/task-tool-execution-scope"
import { Filesystem } from "@/util/filesystem"
import { Lock } from "@/util/lock"
import { artifactPackageRevision } from "@/session/runtime-contract"

type SnapshotFile = Readonly<{
  path: string
  bytes: number
  sha256: string
}>

type StageRecord = {
  execution: TaskArtifactStoreExecution
  snapshotID: string
  root: string
  trees: readonly string[]
}

type MaterializationRecord = Readonly<{
  directory: string
  snapshot: TaskArtifactSnapshotIdentity
}>

export type TaskArtifactStoreExecution = Omit<TaskArtifactHost, "publish"> &
  Readonly<{
    publish(
      stage: TaskArtifactStage,
      input: {
        snapshot_kind: "catalog"
        files: readonly TaskArtifactPublicationFile[]
        idempotent?: true
      },
    ): Promise<TaskArtifactPublication>
    close(): Promise<void>
  }>

export type TaskArtifactReadAuthority = Readonly<{
  projectID: string
  projectDirectory: string
  taskID: string
}>

export type TaskArtifactSnapshotRecord = Readonly<{
  identity: TaskArtifactSnapshotIdentity
  manifest: TaskArtifactSnapshotManifest
  manifestBytes: Uint8Array
}>

export type TaskArtifactProjectFile = Readonly<{
  path: string
  mediaType: string
}>

export function taskArtifactSnapshotResourceRefs(record: TaskArtifactSnapshotRecord): readonly TaskArtifactRef[] {
  return Object.freeze(
    Object.entries(record.manifest.trees).flatMap(([tree, inventory]) =>
      inventory.files.map((file) =>
        TaskArtifactRefSchema.parse({
          snapshot: record.identity,
          tree,
          ...file,
        }),
      ),
    ),
  )
}

function taskArtifactResourceSetRefs(
  record: TaskArtifactSnapshotRecord,
  locator: TaskArtifactResourceSetLocator,
): readonly TaskArtifactRef[] {
  const inventory = record.manifest.trees[locator.tree]
  if (!inventory) throw new Error(`TaskArtifactStore: snapshot has no tree ${locator.tree}`)
  return Object.freeze(
    inventory.files.map((file) =>
      TaskArtifactRefSchema.parse({
        snapshot: record.identity,
        tree: locator.tree,
        ...file,
      }),
    ),
  )
}

const stageRecords = new WeakMap<TaskArtifactStage, StageRecord>()

function catalogLockKey(scope: TaskArtifactReadAuthority): string {
  return `task-artifact-catalog:${scope.projectID}:${scope.taskID}`
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex")
}

function contentUUID(canonical: string): string {
  const digest = sha256(Buffer.from(canonical, "utf8"))
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`
}

function stableTaskArtifactPublication(input: {
  taskID: string
  snapshotKind: "catalog"
  producer: ArtifactProducer
  trees: TaskArtifactSnapshotManifest["trees"]
}) {
  const trees = Object.fromEntries(
    Object.entries(input.trees).map(([tree, inventory]) => [
      tree,
      {
        files: inventory.files.map((file) => ({
          path: file.path,
          media_type: file.media_type,
          bytes: file.bytes,
          sha256: file.sha256,
        })),
      },
    ]),
  )
  let owner: Record<string, string>
  if (input.producer.owner_kind === "mission") {
    owner = {
      owner_kind: input.producer.owner_kind,
      mission_id: input.producer.mission_id,
    }
  } else if (input.producer.owner_kind === "core") {
    owner = {
      owner_kind: input.producer.owner_kind,
      component_id: input.producer.component_id,
      operation_id: input.producer.operation_id,
    }
  } else {
    owner = {
      owner_kind: input.producer.owner_kind,
      expert_squad_id: input.producer.expert_squad_id,
      agent_id: input.producer.agent_id,
      projection_hash: input.producer.projection_hash,
    }
  }
  return {
    task_id: input.taskID,
    snapshot_kind: input.snapshotKind,
    owner,
    trees,
  }
}

function canonicalDirectory(value: string): string {
  return Filesystem.normalizePath(path.resolve(value))
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function assertTaskArtifactReadAuthority(scope: TaskArtifactReadAuthority): void {
  const task = requireTask(scope.taskID)
  if (task.project_id !== scope.projectID) throw new Error("TaskArtifactStore: Task project ownership changed")
  const projectDirectory = taskPrimaryProjectRoot(scope.taskID, { activeProjectID: scope.projectID })
  if (canonicalDirectory(projectDirectory) !== canonicalDirectory(scope.projectDirectory)) {
    throw new Error("TaskArtifactStore: Task project root changed")
  }
}

function assertTaskScope(scope: TaskToolExecutionScope): void {
  assertTaskArtifactReadAuthority(scope)
  const task = requireTask(scope.taskID)
  if (isTaskTerminal(task)) throw new Error("TaskArtifactStore: Task is terminal and cannot execute package tools")
  if (
    canonicalDirectory(ProjectRuntimePaths.taskRoot(scope.projectDirectory, scope.taskID)) !==
    canonicalDirectory(scope.taskRuntimeDirectory)
  ) {
    throw new Error("TaskArtifactStore: Task runtime root changed")
  }
}

async function assertManagedDirectoryPath(input: {
  projectDirectory: string
  target: string
  create: boolean
  context: string
}): Promise<void> {
  if (!Filesystem.contains(input.projectDirectory, input.target)) {
    throw new Error(`${input.context}: managed path is outside the Task project`)
  }
  const relative = path.relative(input.projectDirectory, input.target)
  const segments = relative.split(path.sep).filter(Boolean)
  let current = input.projectDirectory
  for (const segment of segments) {
    current = path.join(current, segment)
    let info
    try {
      info = await fs.lstat(current)
    } catch (cause) {
      if (!missing(cause) || !input.create) throw cause
      try {
        await fs.mkdir(current)
      } catch (mkdirCause) {
        if ((mkdirCause as NodeJS.ErrnoException | undefined)?.code !== "EEXIST") throw mkdirCause
      }
      info = await fs.lstat(current)
    }
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`${input.context}: managed ancestor must be a real directory: ${current}`)
    }
  }
  const [realProject, realTarget] = await Promise.all([fs.realpath(input.projectDirectory), fs.realpath(input.target)])
  if (!Filesystem.contains(realProject, realTarget)) {
    throw new Error(`${input.context}: managed path resolves outside the Task project`)
  }
}

function exactStrings(actual: readonly string[], expected: readonly string[], context: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${context}: expected ${expected.join(",")}, found ${actual.join(",")}`)
  }
}

function sameFileIdentity(
  left: Readonly<{ dev: number | bigint; ino: number | bigint }>,
  right: Readonly<{ dev: number | bigint; ino: number | bigint }>,
): boolean {
  return left.dev === right.dev && left.ino === right.ino
}

async function readRegularFile(file: string, context: string): Promise<Uint8Array> {
  const lexical = await fs.lstat(file)
  if (!lexical.isFile() || lexical.isSymbolicLink()) throw new Error(`${context}: only regular files are allowed`)
  if (lexical.nlink !== 1) throw new Error(`${context}: hard links are not allowed`)
  const handle = await fs.open(file, "r")
  let bytes: Uint8Array | undefined
  let primaryFailure: unknown
  try {
    const before = await handle.stat()
    if (!before.isFile() || before.nlink !== 1 || !sameFileIdentity(lexical, before)) {
      throw new Error(`${context}: opened file identity does not match its path`)
    }
    bytes = await handle.readFile()
    const [after, lexicalAfter] = await Promise.all([handle.stat(), fs.lstat(file)])
    if (
      !after.isFile() ||
      after.nlink !== 1 ||
      !lexicalAfter.isFile() ||
      lexicalAfter.isSymbolicLink() ||
      lexicalAfter.nlink !== 1 ||
      !sameFileIdentity(before, after) ||
      !sameFileIdentity(after, lexicalAfter) ||
      before.size !== after.size ||
      bytes.byteLength !== after.size
    ) {
      throw new Error(`${context}: file changed while it was read`)
    }
  } catch (cause) {
    primaryFailure = cause
  }
  let closeFailure: unknown
  try {
    await handle.close()
  } catch (cause) {
    closeFailure = cause
  }
  if (primaryFailure && closeFailure) {
    throw new AggregateError([primaryFailure, closeFailure], `${context}: read and descriptor cleanup both failed`)
  }
  if (primaryFailure) throw primaryFailure
  if (closeFailure) throw closeFailure
  if (!bytes) throw new Error(`${context}: file read produced no byte buffer`)
  return bytes
}

async function assertProjectFileAncestors(input: {
  projectDirectory: string
  sourceRelativePath: string
}): Promise<void> {
  let current = input.projectDirectory
  const project = await fs.lstat(current)
  if (!project.isDirectory() || project.isSymbolicLink()) {
    throw new Error("TaskArtifactStore project-file root must be a real directory")
  }
  const segments = input.sourceRelativePath.split("/")
  for (const segment of segments.slice(0, -1)) {
    current = path.join(current, segment)
    const info = await fs.lstat(current)
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`TaskArtifactStore project-file ancestor must be a real directory: ${input.sourceRelativePath}`)
    }
  }
}

async function syncRegularFile(file: string, context: string): Promise<void> {
  // Windows FlushFileBuffers requires GENERIC_WRITE even when the caller only
  // flushes bytes that were already copied into this immutable snapshot.
  const handle = await fs.open(file, "r+")
  let syncFailure: unknown
  try {
    // fsync means filesystem synchronization: flush this file's data and
    // metadata through the operating-system cache before publication.
    await handle.sync()
  } catch (cause) {
    syncFailure = cause
  }
  try {
    await handle.close()
  } catch (closeFailure) {
    if (syncFailure) {
      throw new AggregateError([syncFailure, closeFailure], `${context}: sync and close both failed`)
    }
    throw closeFailure
  }
  if (syncFailure) throw syncFailure
}

async function syncDirectoryMetadata(directory: string, context: string): Promise<void> {
  // Node does not expose a Windows directory handle with
  // FILE_FLAG_BACKUP_SEMANTICS, so Windows durability is established by
  // syncing every regular file before the same-volume rename. POSIX
  // (Portable Operating System Interface) additionally permits fsync on the
  // directory itself, which persists the manifest and rename entries.
  if (process.platform === "win32") return
  const handle = await fs.open(directory, "r")
  let syncFailure: unknown
  try {
    await handle.sync()
  } catch (cause) {
    syncFailure = cause
  }
  try {
    await handle.close()
  } catch (closeFailure) {
    if (syncFailure) {
      throw new AggregateError([syncFailure, closeFailure], `${context}: sync and close both failed`)
    }
    throw closeFailure
  }
  if (syncFailure) throw syncFailure
}

async function writeSyncedExclusiveFile(file: string, bytes: Uint8Array, context: string): Promise<void> {
  const handle = await fs.open(file, "wx")
  let writeFailure: unknown
  try {
    await handle.writeFile(bytes)
    await handle.sync()
  } catch (cause) {
    writeFailure = cause
  }
  try {
    await handle.close()
  } catch (closeFailure) {
    if (writeFailure) {
      throw new AggregateError([writeFailure, closeFailure], `${context}: write/sync and close both failed`)
    }
    throw closeFailure
  }
  if (writeFailure) throw writeFailure
}

const PublicationSequenceName = /^[1-9][0-9]*$/

async function listReservedPublicationSequences(scope: TaskArtifactReadAuthority): Promise<readonly number[]> {
  const root = ProjectRuntimePaths.taskArtifactPublicationSequenceRoot(scope.projectDirectory, scope.taskID)
  let entries
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch (cause) {
    if (missing(cause)) return Object.freeze([])
    throw cause
  }
  const sequences: number[] = []
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !PublicationSequenceName.test(entry.name)) {
      throw new Error(`TaskArtifactStore: publication sequence reservation contains invalid entry ${entry.name}`)
    }
    const sequence = Number(entry.name)
    if (!Number.isSafeInteger(sequence) || sequence <= 0 || String(sequence) !== entry.name) {
      throw new Error(
        `TaskArtifactStore: publication sequence reservation is not a canonical safe integer: ${entry.name}`,
      )
    }
    const bytes = await readRegularFile(
      path.join(root, entry.name),
      `TaskArtifactStore publication sequence ${entry.name}`,
    )
    if (Buffer.from(bytes).toString("utf8") !== `${entry.name}\n`) {
      throw new Error(`TaskArtifactStore: publication sequence reservation ${entry.name} is corrupt`)
    }
    sequences.push(sequence)
  }
  sequences.sort((left, right) => left - right)
  for (const [index, sequence] of sequences.entries()) {
    if (sequence !== index + 1) {
      throw new Error(
        `TaskArtifactStore: publication sequence reservations must be contiguous; expected ${index + 1}, found ${sequence}`,
      )
    }
  }
  return Object.freeze(sequences)
}

async function reservePublicationSequence(
  scope: TaskArtifactReadAuthority,
  validateScope: () => void,
): Promise<number> {
  validateScope()
  const root = ProjectRuntimePaths.taskArtifactPublicationSequenceRoot(scope.projectDirectory, scope.taskID)
  await assertManagedDirectoryPath({
    projectDirectory: scope.projectDirectory,
    target: root,
    create: true,
    context: "TaskArtifactStore publication sequence",
  })
  const reserved = await listReservedPublicationSequences(scope)
  const next = (reserved.at(-1) ?? 0) + 1
  if (!Number.isSafeInteger(next)) {
    throw new Error("TaskArtifactStore: publication sequence exhausted the safe integer range")
  }
  await writeSyncedExclusiveFile(
    path.join(root, String(next)),
    Buffer.from(`${next}\n`, "utf8"),
    `TaskArtifactStore publication sequence ${next}`,
  )
  await syncDirectoryMetadata(root, "TaskArtifactStore publication sequence")
  validateScope()
  return next
}

async function inventoryTree(root: string, context: string): Promise<readonly SnapshotFile[]> {
  const files: SnapshotFile[] = []
  const seen = new Map<string, string>()
  const walk = async (directory: string, prefix: string): Promise<number> => {
    const before = await fs.lstat(directory)
    if (!before.isDirectory() || before.isSymbolicLink()) {
      throw new Error(`${context}: ${prefix || "tree root"} must be a real directory`)
    }
    const entries = await fs.readdir(directory, { withFileTypes: true })
    let descendantFiles = 0
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      TaskArtifactRelativePathSchema.parse(relative)
      const folded = relative.toLowerCase()
      const prior = seen.get(folded)
      if (prior) throw new Error(`${context}: ${relative} case-collides with ${prior}`)
      seen.set(folded, relative)
      const absolute = path.join(directory, entry.name)
      const info = await fs.lstat(absolute)
      if (info.isSymbolicLink()) {
        throw new Error(`${context}: symbolic links and junctions are not allowed at ${relative}`)
      }
      if (info.isDirectory()) {
        const nestedFiles = await walk(absolute, relative)
        if (nestedFiles === 0) throw new Error(`${context}: empty directories are not allowed at ${relative}`)
        descendantFiles += nestedFiles
        continue
      }
      if (!info.isFile()) throw new Error(`${context}: special files are not allowed at ${relative}`)
      const bytes = await readRegularFile(absolute, `${context}/${relative}`)
      files.push(Object.freeze({ path: relative, bytes: bytes.byteLength, sha256: sha256(bytes) }))
      descendantFiles += 1
    }
    const after = await fs.lstat(directory)
    if (!after.isDirectory() || after.isSymbolicLink() || !sameFileIdentity(before, after)) {
      throw new Error(`${context}: directory changed while it was inventoried at ${prefix || "tree root"}`)
    }
    const entriesAfter = await fs.readdir(directory, { withFileTypes: true })
    exactStrings(
      entriesAfter.map((entry) => entry.name).sort(compareTaskArtifactPathsByUTF8),
      entries.map((entry) => entry.name).sort(compareTaskArtifactPathsByUTF8),
      `${context}: directory entries changed at ${prefix || "tree root"}`,
    )
    return descendantFiles
  }
  if ((await walk(root, "")) === 0) throw new Error(`${context}: tree must contain at least one file`)
  files.sort((left, right) => compareTaskArtifactPathsByUTF8(left.path, right.path))
  return Object.freeze(files)
}

async function assertSnapshotRootEntries(root: string, trees: readonly string[]): Promise<void> {
  const before = await fs.lstat(root)
  if (!before.isDirectory() || before.isSymbolicLink()) {
    throw new Error("TaskArtifactStore: snapshot root must be a real directory")
  }
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`TaskArtifactStore: snapshot root contains linked entry ${entry.name}`)
  }
  exactStrings(
    entries.map((entry) => entry.name).sort(compareTaskArtifactPathsByUTF8),
    ["manifest.json", ...trees].sort(compareTaskArtifactPathsByUTF8),
    "TaskArtifactStore snapshot root entries",
  )
  for (const tree of trees) {
    const info = await fs.lstat(path.join(root, tree))
    if (!info.isDirectory() || info.isSymbolicLink()) {
      throw new Error(`TaskArtifactStore: snapshot tree ${tree} must be a real directory`)
    }
  }
  const after = await fs.lstat(root)
  if (!after.isDirectory() || after.isSymbolicLink() || !sameFileIdentity(before, after)) {
    throw new Error("TaskArtifactStore: snapshot root changed while it was inventoried")
  }
  const entriesAfter = await fs.readdir(root, { withFileTypes: true })
  exactStrings(
    entriesAfter.map((entry) => entry.name).sort(compareTaskArtifactPathsByUTF8),
    entries.map((entry) => entry.name).sort(compareTaskArtifactPathsByUTF8),
    "TaskArtifactStore snapshot root changed during inventory",
  )
}

function assertArtifactRef(manifest: TaskArtifactSnapshotManifest, ref: TaskArtifactRef): void {
  const declared = manifest.trees[ref.tree]?.files.find((file) => file.path === ref.path)
  if (
    !declared ||
    declared.media_type !== ref.media_type ||
    declared.bytes !== ref.bytes ||
    declared.sha256 !== ref.sha256
  ) {
    throw new Error("TaskArtifactStore: artifact ref does not match its manifest")
  }
}

async function verifySnapshotManifestAtRoot(
  scope: TaskArtifactReadAuthority,
  identityInput: TaskArtifactSnapshotIdentity,
  root: string,
  validateScope: () => void,
): Promise<{ root: string; manifest: TaskArtifactSnapshotManifest; manifestBytes: Uint8Array }> {
  const identity = TaskArtifactSnapshotIdentitySchema.parse(identityInput)
  if (identity.project_id !== scope.projectID || identity.task_id !== scope.taskID) {
    throw new Error("TaskArtifactStore: snapshot identity is outside the current Task")
  }
  validateScope()
  await assertManagedDirectoryPath({
    projectDirectory: scope.projectDirectory,
    target: root,
    create: false,
    context: "TaskArtifactStore snapshot",
  })
  const manifestBytes = await readRegularFile(path.join(root, "manifest.json"), "TaskArtifactStore manifest")
  if (sha256(manifestBytes) !== identity.manifest_sha256) throw new Error("TaskArtifactStore: manifest digest mismatch")
  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(manifestBytes).toString("utf8"))
  } catch (cause) {
    throw new Error("TaskArtifactStore: manifest JSON is invalid", { cause })
  }
  const manifest = TaskArtifactSnapshotManifestSchema.parse(decoded)
  const canonicalManifestBytes = Buffer.from(JSON.stringify(manifest), "utf8")
  if (!Buffer.from(manifestBytes).equals(canonicalManifestBytes)) {
    throw new Error("TaskArtifactStore: manifest bytes are not canonical")
  }
  if (
    manifest.project_id !== identity.project_id ||
    manifest.task_id !== identity.task_id ||
    manifest.snapshot_id !== identity.snapshot_id
  ) {
    throw new Error("TaskArtifactStore: manifest identity mismatch")
  }
  const trees = Object.keys(manifest.trees)
  await assertSnapshotRootEntries(root, trees)
  validateScope()
  return { root, manifest: deepFreeze(manifest) as TaskArtifactSnapshotManifest, manifestBytes }
}

async function verifySnapshotAtRoot(
  scope: TaskArtifactReadAuthority,
  identityInput: TaskArtifactSnapshotIdentity,
  root: string,
  validateScope: () => void,
): Promise<{ root: string; manifest: TaskArtifactSnapshotManifest; manifestBytes: Uint8Array }> {
  const verified = await verifySnapshotManifestAtRoot(scope, identityInput, root, validateScope)
  const identity = TaskArtifactSnapshotIdentitySchema.parse(identityInput)
  const { manifest } = verified
  const trees = Object.keys(manifest.trees)
  for (const tree of trees) {
    const actual = await inventoryTree(
      path.join(root, tree),
      `TaskArtifactStore snapshot ${identity.snapshot_id}/${tree}`,
    )
    const expected = manifest.trees[tree]!.files
    if (
      actual.length !== expected.length ||
      actual.some((file, index) => {
        const declared = expected[index]!
        return file.path !== declared.path || file.bytes !== declared.bytes || file.sha256 !== declared.sha256
      })
    ) {
      throw new Error(`TaskArtifactStore: snapshot inventory mismatch for tree ${tree}`)
    }
  }
  validateScope()
  return verified
}

async function verifyCommittedSnapshot(
  scope: TaskArtifactReadAuthority,
  identity: TaskArtifactSnapshotIdentity,
  validateScope: () => void,
): Promise<{ root: string; manifest: TaskArtifactSnapshotManifest; manifestBytes: Uint8Array }> {
  return verifySnapshotAtRoot(
    scope,
    identity,
    ProjectRuntimePaths.taskArtifactSnapshotRoot(scope.projectDirectory, scope.taskID, identity.snapshot_id),
    validateScope,
  )
}

async function verifyCommittedSnapshotManifest(
  scope: TaskArtifactReadAuthority,
  identity: TaskArtifactSnapshotIdentity,
  validateScope: () => void,
): Promise<{ root: string; manifest: TaskArtifactSnapshotManifest; manifestBytes: Uint8Array }> {
  return verifySnapshotManifestAtRoot(
    scope,
    identity,
    ProjectRuntimePaths.taskArtifactSnapshotRoot(scope.projectDirectory, scope.taskID, identity.snapshot_id),
    validateScope,
  )
}

async function listCommittedSnapshotRecordsUnlocked(
  scope: TaskArtifactReadAuthority,
  validateScope: () => void = () => assertTaskArtifactReadAuthority(scope),
): Promise<readonly TaskArtifactSnapshotRecord[]> {
  validateScope()
  const reservedSequences = await listReservedPublicationSequences(scope)
  const reservedSequenceSet = new Set(reservedSequences)
  const snapshotsRoot = path.join(ProjectRuntimePaths.taskArtifactRoot(scope.projectDirectory, scope.taskID), "snapshots")
  let entries
  try {
    entries = await fs.readdir(snapshotsRoot, { withFileTypes: true })
  } catch (cause) {
    if (missing(cause)) return Object.freeze([])
    throw cause
  }
  const records: TaskArtifactSnapshotRecord[] = []
  for (const entry of entries.sort((left, right) => compareTaskArtifactPathsByUTF8(left.name, right.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      throw new Error(`TaskArtifactStore: committed snapshot root contains invalid entry ${entry.name}`)
    }
    const root = path.join(snapshotsRoot, entry.name)
    const manifestBytes = await readRegularFile(path.join(root, "manifest.json"), "TaskArtifactStore manifest")
    let decoded: unknown
    try {
      decoded = JSON.parse(Buffer.from(manifestBytes).toString("utf8"))
    } catch (cause) {
      throw new Error(`TaskArtifactStore: snapshot ${entry.name} manifest JSON is invalid`, { cause })
    }
    const manifest = TaskArtifactSnapshotManifestSchema.parse(decoded)
    if (manifest.snapshot_id !== entry.name) {
      throw new Error(`TaskArtifactStore: snapshot directory ${entry.name} does not match manifest identity`)
    }
    const identity = TaskArtifactSnapshotIdentitySchema.parse({
      schema_version: 2,
      project_id: manifest.project_id,
      task_id: manifest.task_id,
      snapshot_id: manifest.snapshot_id,
      manifest_sha256: sha256(manifestBytes),
    })
    const verified = await verifySnapshotManifestAtRoot(scope, identity, root, validateScope)
    records.push(
      Object.freeze({
        identity: deepFreeze(identity) as TaskArtifactSnapshotIdentity,
        manifest: verified.manifest,
        manifestBytes: verified.manifestBytes,
      }),
    )
  }
  records.sort(
    (left, right) =>
      left.manifest.publication_sequence - right.manifest.publication_sequence ||
      compareTaskArtifactPathsByUTF8(left.identity.snapshot_id, right.identity.snapshot_id),
  )
  for (const [index, record] of records.entries()) {
    if (!reservedSequenceSet.has(record.manifest.publication_sequence)) {
      throw new Error(
        `TaskArtifactStore: snapshot publication sequence ${record.manifest.publication_sequence} has no durable reservation`,
      )
    }
    const previous = records[index - 1]
    if (previous && previous.manifest.publication_sequence === record.manifest.publication_sequence) {
      throw new Error(`TaskArtifactStore: duplicate publication sequence ${record.manifest.publication_sequence}`)
    }
  }
  return Object.freeze(records)
}

export async function listTaskArtifactSnapshots(
  scope: TaskArtifactReadAuthority,
): Promise<readonly TaskArtifactSnapshotRecord[]> {
  const lock = await Lock.read(catalogLockKey(scope))
  try {
    return await listCommittedSnapshotRecordsUnlocked(scope)
  } finally {
    lock[Symbol.dispose]()
  }
}

/** Holds the immutable Task Artifact catalog read lock while a consumer
 * captures correlated authoritative facts from another single-source store. */
export async function withTaskArtifactSnapshotCatalog<T>(
  scope: TaskArtifactReadAuthority,
  callback: (records: readonly TaskArtifactSnapshotRecord[]) => T & { readonly then?: never },
): Promise<T> {
  const lock = await Lock.read(catalogLockKey(scope))
  try {
    return callback(await listCommittedSnapshotRecordsUnlocked(scope))
  } finally {
    lock[Symbol.dispose]()
  }
}

export async function readTaskArtifactSnapshotManifest(
  input: TaskArtifactReadAuthority & { snapshot: TaskArtifactSnapshotIdentity },
): Promise<TaskArtifactSnapshotRecord> {
  const lock = await Lock.read(catalogLockKey(input))
  try {
    const verified = await verifyCommittedSnapshotManifest(input, input.snapshot, () =>
      assertTaskArtifactReadAuthority(input),
    )
    return Object.freeze({
      identity: deepFreeze(input.snapshot) as TaskArtifactSnapshotIdentity,
      manifest: verified.manifest,
      manifestBytes: verified.manifestBytes,
    })
  } finally {
    lock[Symbol.dispose]()
  }
}

export async function readTaskArtifactResourceSet(
  input: TaskArtifactReadAuthority & { resourceSet: TaskArtifactResourceSetLocator },
): Promise<readonly TaskArtifactRef[]> {
  const locator = TaskArtifactResourceSetLocatorSchema.parse(input.resourceSet)
  const record = await readTaskArtifactSnapshotManifest({ ...input, snapshot: locator.snapshot })
  return taskArtifactResourceSetRefs(record, locator)
}

type VerifiedDirectory = Readonly<{
  path: string
  identity: Awaited<ReturnType<typeof fs.lstat>>
}>

async function verifiedArtifactParentDirectories(root: string, tree: string, artifactPath: string) {
  const relativeDirectories = [tree, ...artifactPath.split("/").slice(0, -1)]
  const directories: VerifiedDirectory[] = []
  let current = root
  for (const segment of relativeDirectories) {
    current = path.join(current, segment)
    const identity = await fs.lstat(current)
    if (!identity.isDirectory() || identity.isSymbolicLink()) {
      throw new Error(`TaskArtifactStore: artifact parent must be a real directory at ${current}`)
    }
    directories.push(Object.freeze({ path: current, identity }))
  }
  return directories
}

async function revalidateArtifactParentDirectories(directories: readonly VerifiedDirectory[]) {
  for (const directory of directories) {
    const current = await fs.lstat(directory.path)
    if (!current.isDirectory() || current.isSymbolicLink() || !sameFileIdentity(directory.identity, current)) {
      throw new Error(`TaskArtifactStore: artifact parent changed during read at ${directory.path}`)
    }
  }
}

async function readVerifiedTaskArtifactRef(
  scope: TaskArtifactReadAuthority,
  refInput: TaskArtifactRef,
  validateScope: () => void,
): Promise<Uint8Array> {
  const ref = TaskArtifactRefSchema.parse(refInput)
  const before = await verifyCommittedSnapshotManifest(scope, ref.snapshot, validateScope)
  assertArtifactRef(before.manifest, ref)
  const parentDirectories = await verifiedArtifactParentDirectories(before.root, ref.tree, ref.path)
  const bytes = await readRegularFile(
    path.join(before.root, ref.tree, ...ref.path.split("/")),
    "TaskArtifactStore artifact",
  )
  await revalidateArtifactParentDirectories(parentDirectories)
  if (bytes.byteLength !== ref.bytes || sha256(bytes) !== ref.sha256) {
    throw new Error("TaskArtifactStore: artifact bytes do not match ref")
  }
  const after = await verifyCommittedSnapshotManifest(scope, ref.snapshot, validateScope)
  assertArtifactRef(after.manifest, ref)
  return bytes
}

export async function readTaskArtifactRef(input: TaskArtifactReadAuthority & { ref: TaskArtifactRef }) {
  const lock = await Lock.read(catalogLockKey(input))
  try {
    return await readVerifiedTaskArtifactRef(input, input.ref, () => assertTaskArtifactReadAuthority(input))
  } finally {
    lock[Symbol.dispose]()
  }
}

type EngineResourceFile = Readonly<{
  path: string
  mediaType: string
  bytes: Uint8Array
}>

async function publishEngineResourceSnapshot(input: {
  targetProjectID: string
  targetProjectDirectory: string
  targetTaskID: string
  allowUncommittedTarget: boolean
  producer: ArtifactProducer
  files: readonly EngineResourceFile[]
  context: string
}): Promise<TaskArtifactPublication> {
  if (input.files.length === 0) throw new Error(`${input.context} requires at least one resource`)
  const targetScope: TaskArtifactReadAuthority = {
    projectID: input.targetProjectID,
    projectDirectory: input.targetProjectDirectory,
    taskID: input.targetTaskID,
  }
  const publicationLock = await Lock.write(catalogLockKey(targetScope))
  const snapshotID = randomUUID()
  const stageRoot = ProjectRuntimePaths.taskArtifactStageRoot(
    input.targetProjectDirectory,
    input.targetTaskID,
    snapshotID,
  )
  const finalRoot = ProjectRuntimePaths.taskArtifactSnapshotRoot(
    input.targetProjectDirectory,
    input.targetTaskID,
    snapshotID,
  )
  const tree = "resources"
  let renamed = false
  try {
    await assertManagedDirectoryPath({
      projectDirectory: input.targetProjectDirectory,
      target: path.dirname(stageRoot),
      create: true,
      context: `${input.context} stage`,
    })
    await fs.mkdir(stageRoot)
    await fs.mkdir(path.join(stageRoot, tree))
    const files = input.files.map((source) => {
      const resourcePath = TaskArtifactRelativePathSchema.parse(source.path)
      return {
        path: resourcePath,
        media_type: source.mediaType,
        bytes: source.bytes.byteLength,
        sha256: sha256(source.bytes),
        source,
      }
    })
    files.sort((left, right) => compareTaskArtifactPathsByUTF8(left.path, right.path))
    for (const [index, file] of files.entries()) {
      if (index > 0 && file.path === files[index - 1]!.path) {
        throw new Error(`${input.context} resource path is duplicated: ${file.path}`)
      }
      const target = path.join(stageRoot, tree, ...file.path.split("/"))
      await fs.mkdir(path.dirname(target), { recursive: true })
      await writeSyncedExclusiveFile(target, file.source.bytes, `${input.context} ${tree}/${file.path}`)
    }
    const manifestFiles = files.map(({ source: _source, ...file }) => file)
    const manifest = TaskArtifactSnapshotManifestSchema.parse({
      schema_version: 2,
      snapshot_kind: "engine_resource",
      project_id: input.targetProjectID,
      task_id: input.targetTaskID,
      snapshot_id: snapshotID,
      publication_sequence: await reservePublicationSequence(
        targetScope,
        input.allowUncommittedTarget ? () => undefined : () => assertTaskArtifactReadAuthority(targetScope),
      ),
      created_at_ms: Date.now(),
      producer: input.producer,
      trees: { [tree]: { files: manifestFiles } },
    })
    const manifestBytes = Buffer.from(JSON.stringify(manifest), "utf8")
    await writeSyncedExclusiveFile(path.join(stageRoot, "manifest.json"), manifestBytes, `${input.context} manifest`)
    await syncDirectoryMetadata(path.join(stageRoot, tree), `${input.context} resource tree`)
    await syncDirectoryMetadata(stageRoot, `${input.context} staged snapshot`)
    const identity = deepFreeze(
      TaskArtifactSnapshotIdentitySchema.parse({
        schema_version: 2,
        project_id: input.targetProjectID,
        task_id: input.targetTaskID,
        snapshot_id: snapshotID,
        manifest_sha256: sha256(manifestBytes),
      }),
    ) as TaskArtifactSnapshotIdentity
    await verifySnapshotAtRoot(targetScope, identity, stageRoot, () => undefined)
    await assertManagedDirectoryPath({
      projectDirectory: input.targetProjectDirectory,
      target: path.dirname(finalRoot),
      create: true,
      context: `${input.context} publication`,
    })
    await fs.rename(stageRoot, finalRoot)
    renamed = true
    await syncDirectoryMetadata(path.dirname(finalRoot), `${input.context} snapshot catalog`)
    const artifacts = Object.freeze(
      manifestFiles.map(
        (file) =>
          deepFreeze({
            snapshot: identity,
            tree,
            ...file,
          }) as TaskArtifactRef,
      ),
    )
    return Object.freeze({ snapshot: identity, manifest, artifacts })
  } catch (cause) {
    const residue = renamed ? finalRoot : stageRoot
    try {
      await removeExact(residue, input.context)
    } catch (cleanupCause) {
      throw new AggregateError([cause, cleanupCause], `${input.context} failed and left residue ${residue}`)
    }
    throw cause
  } finally {
    publicationLock[Symbol.dispose]()
  }
}

/**
 * Capture Host-produced files into one immutable target-owned resource
 * snapshot. The source files must already be inside this Task's runtime tree;
 * callers persist their Engine envelope only after this publication succeeds.
 */
export async function publishEngineArtifactResources(input: {
  projectID: string
  projectDirectory: string
  taskID: string
  producer: ArtifactProducer
  files: readonly {
    sourcePath: string
    resourcePath: string
    mediaType: string
  }[]
}): Promise<TaskArtifactPublication> {
  const authority = {
    projectID: input.projectID,
    projectDirectory: input.projectDirectory,
    taskID: input.taskID,
  }
  assertTaskArtifactReadAuthority(authority)
  const taskRuntimeRoot = path.resolve(ProjectRuntimePaths.taskRoot(input.projectDirectory, input.taskID))
  const resources = await Promise.all(
    input.files.map(async (file, index) => {
      const sourcePath = path.resolve(file.sourcePath)
      if (!Filesystem.contains(taskRuntimeRoot, sourcePath)) {
        throw new Error(`Engine Artifact resource source is outside Task runtime: ${file.sourcePath}`)
      }
      const [realTaskRoot, realSourcePath] = await Promise.all([fs.realpath(taskRuntimeRoot), fs.realpath(sourcePath)])
      if (!Filesystem.contains(realTaskRoot, realSourcePath)) {
        throw new Error(`Engine Artifact resource source resolves outside Task runtime: ${file.sourcePath}`)
      }
      return {
        path: `${String(index).padStart(4, "0")}/${TaskArtifactRelativePathSchema.parse(file.resourcePath)}`,
        mediaType: file.mediaType,
        bytes: await readRegularFile(sourcePath, "Engine Artifact resource source"),
      }
    }),
  )
  return publishEngineResourceSnapshot({
    targetProjectID: input.projectID,
    targetProjectDirectory: input.projectDirectory,
    targetTaskID: input.taskID,
    allowUncommittedTarget: false,
    producer: input.producer,
    files: resources,
    context: "Engine Artifact resource publication",
  })
}

export async function discardEngineArtifactResources(
  input: TaskArtifactReadAuthority & {
    snapshot: TaskArtifactSnapshotIdentity
  },
): Promise<void> {
  assertTaskArtifactReadAuthority(input)
  if (input.snapshot.project_id !== input.projectID || input.snapshot.task_id !== input.taskID) {
    throw new Error("Engine Artifact resource cleanup snapshot is outside Task authority")
  }
  const lock = await Lock.write(catalogLockKey(input))
  try {
    // The catalog lock is intentionally non-reentrant. Verify through the
    // unlocked catalog reader while this write lock owns the complete Task
    // snapshot namespace.
    const records = await listCommittedSnapshotRecordsUnlocked(input)
    const record = records.find((candidate) => candidate.identity.snapshot_id === input.snapshot.snapshot_id)
    if (!record) {
      throw new Error("Engine Artifact resource cleanup snapshot does not exist")
    }
    if (
      record.identity.project_id !== input.snapshot.project_id ||
      record.identity.task_id !== input.snapshot.task_id ||
      record.identity.manifest_sha256 !== input.snapshot.manifest_sha256
    ) {
      throw new Error("Engine Artifact resource cleanup snapshot identity is stale")
    }
    if (record.manifest.snapshot_kind !== "engine_resource") {
      throw new Error("Engine Artifact resource cleanup refuses a catalog snapshot")
    }
    await removeExact(
      ProjectRuntimePaths.taskArtifactSnapshotRoot(input.projectDirectory, input.taskID, input.snapshot.snapshot_id),
      "Engine Artifact resource cleanup",
    )
    await syncDirectoryMetadata(
      path.dirname(
        ProjectRuntimePaths.taskArtifactSnapshotRoot(input.projectDirectory, input.taskID, input.snapshot.snapshot_id),
      ),
      "Engine Artifact resource cleanup catalog",
    )
  } finally {
    lock[Symbol.dispose]()
  }
}

/**
 * Publish one target-owned resource snapshot before the target Task row is
 * visible. This is intentionally separate from package-tool publication:
 * cross-Task import owns no live target Session yet, and its snapshot is an
 * exact resource dependency of the Engine receipt rather than a second
 * top-level Catalog Artifact.
 */
export async function publishImportedTaskArtifactResources(input: {
  sourceAuthority: TaskArtifactReadAuthority
  targetProjectID: string
  targetProjectDirectory: string
  targetTaskID: string
  producer: ArtifactProducer
  resources: readonly TaskArtifactRef[]
}): Promise<TaskArtifactPublication> {
  if (input.resources.length === 0) {
    throw new Error("Cross-Task Artifact import resource publication requires at least one resource")
  }
  const resources = input.resources.map((resource) => TaskArtifactRefSchema.parse(resource))
  for (const resource of resources) {
    if (
      resource.snapshot.project_id !== input.sourceAuthority.projectID ||
      resource.snapshot.task_id !== input.sourceAuthority.taskID
    ) {
      throw new Error("Cross-Task Artifact import resource is outside the source Task authority")
    }
  }
  const sourceBytes = await Promise.all(
    resources.map((resource) => readTaskArtifactRef({ ...input.sourceAuthority, ref: resource })),
  )
  return publishEngineResourceSnapshot({
    targetProjectID: input.targetProjectID,
    targetProjectDirectory: input.targetProjectDirectory,
    targetTaskID: input.targetTaskID,
    allowUncommittedTarget: true,
    producer: input.producer,
    files: resources.map((resource, index) => ({
      path: `${String(index).padStart(4, "0")}/${resource.tree}/${resource.path}`,
      mediaType: resource.media_type,
      bytes: sourceBytes[index]!,
    })),
    context: "Cross-Task Artifact import",
  })
}

async function removeExact(target: string, context: string): Promise<void> {
  try {
    await fs.rm(target, { recursive: true, force: true })
  } catch (cause) {
    throw new Error(`${context}: cleanup failed for ${target}`, { cause })
  }
}

export function createTaskArtifactStoreExecution(scope: TaskToolExecutionScope): TaskArtifactStoreExecution {
  const stages = new Set<StageRecord>()
  const materializations = new Map<string, MaterializationRecord>()
  const publications = new Map<string, TaskArtifactSnapshotIdentity>()
  const operations = new Set<Promise<unknown>>()
  let active = true
  const requireActive = () => {
    if (!active) throw new Error("TaskArtifactStore: execution is closed")
    assertTaskScope(scope)
  }
  const track = <T>(operation: () => Promise<T>): Promise<T> => {
    try {
      requireActive()
    } catch (cause) {
      return Promise.reject(cause)
    }
    const pending = operation()
    operations.add(pending)
    void pending.then(
      () => operations.delete(pending),
      () => operations.delete(pending),
    )
    return pending
  }
  let result!: TaskArtifactStoreExecution

  const execution = {
    stage(input: { trees: readonly string[] }): Promise<TaskArtifactStage> {
      return track(async () => {
        const trees = input.trees.map((tree) => TaskArtifactTreeNameSchema.parse(tree))
        if (trees.length === 0) throw new Error("TaskArtifactStore: stage requires at least one tree")
        const sorted = [...trees].sort(compareTaskArtifactPathsByUTF8)
        exactStrings(trees, sorted, "TaskArtifactStore stage trees")
        if (new Set(trees.map((tree) => tree.toLowerCase())).size !== trees.length) {
          throw new Error("TaskArtifactStore: stage tree names must not collide")
        }
        const snapshotID = randomUUID()
        const root = ProjectRuntimePaths.taskArtifactStageRoot(scope.projectDirectory, scope.taskID, snapshotID)
        let rootCreated = false
        try {
          await assertManagedDirectoryPath({
            projectDirectory: scope.projectDirectory,
            target: path.dirname(root),
            create: true,
            context: "TaskArtifactStore stage",
          })
          await fs.mkdir(root)
          rootCreated = true
          const treeDirectories: Record<string, string> = {}
          for (const tree of trees) {
            const directory = path.join(root, tree)
            await fs.mkdir(directory)
            treeDirectories[tree] = directory
          }
          const handle = Object.freeze({ id: randomUUID(), treeDirectories: Object.freeze(treeDirectories) })
          const record = { execution: result, snapshotID, root, trees: Object.freeze([...trees]) }
          assertTaskScope(scope)
          stages.add(record)
          stageRecords.set(handle, record)
          return handle
        } catch (cause) {
          if (!rootCreated) throw cause
          try {
            await removeExact(root, "TaskArtifactStore stage")
          } catch (cleanupCause) {
            throw new AggregateError([cause, cleanupCause], "TaskArtifactStore stage creation and cleanup both failed")
          }
          throw cause
        }
      })
    },

    publish(
      handle: TaskArtifactStage,
      input: {
        snapshot_kind: "catalog"
        files: readonly TaskArtifactPublicationFile[]
        idempotent?: true
      },
    ): Promise<TaskArtifactPublication> {
      return track(async () => {
        const publicationLock = await Lock.write(catalogLockKey(scope))
        try {
          const record = stageRecords.get(handle)
          if (!record || record.execution !== result || !stages.delete(record)) {
            throw new Error("TaskArtifactStore: stage handle is foreign, stale, or already consumed")
          }
          stageRecords.delete(handle)
          let finalRoot = ProjectRuntimePaths.taskArtifactSnapshotRoot(
            scope.projectDirectory,
            scope.taskID,
            record.snapshotID,
          )
          let renamed = false
          try {
            const files = TaskArtifactPublicationInventorySchema.parse(input.files)
            const declaredTrees = [...new Set(files.map((file) => file.tree))].sort(compareTaskArtifactPathsByUTF8)
            exactStrings(declaredTrees, record.trees, "TaskArtifactStore publication trees")
            const trees: Record<
              string,
              { files: Array<{ path: string; media_type: string; bytes: number; sha256: string }> }
            > = {}
            const artifactFiles: Array<{
              tree: string
              path: string
              media_type: string
              bytes: number
              sha256: string
            }> = []
            for (const tree of record.trees) {
              const inventory = await inventoryTree(
                path.join(record.root, tree),
                `TaskArtifactStore stage ${record.snapshotID}/${tree}`,
              )
              const declared = files.filter((file) => file.tree === tree)
              exactStrings(
                inventory.map((file) => file.path),
                declared.map((file) => file.path),
                `TaskArtifactStore publication inventory ${tree}`,
              )
              const treeFiles = inventory.map((file, index) => ({ ...file, media_type: declared[index]!.media_type }))
              trees[tree] = { files: treeFiles }
              artifactFiles.push(...treeFiles.map((file) => ({ tree, ...file })))
            }
            const packageRevision = artifactPackageRevision(scope.owner.packageRevision)
            const producer = ArtifactProducerSchema.parse({
              owner_kind: scope.owner.kind,
              expert_squad_id: scope.owner.expertSquadID,
              package_revision: packageRevision,
              agent_id: scope.owner.agentID,
              projection_hash: scope.owner.projectionHash,
              session_id: scope.sessionID,
              message_id: scope.messageID,
              tool_call_id: scope.toolCallID,
            })
            const stablePublication = stableTaskArtifactPublication({
              taskID: scope.taskID,
              snapshotKind: input.snapshot_kind,
              producer,
              trees,
            })
            const snapshotID = input.idempotent ? contentUUID(JSON.stringify(stablePublication)) : record.snapshotID
            finalRoot = ProjectRuntimePaths.taskArtifactSnapshotRoot(scope.projectDirectory, scope.taskID, snapshotID)
            if (input.idempotent) {
              const existingRoot = await fs.lstat(finalRoot).catch((error: NodeJS.ErrnoException) => {
                if (error.code === "ENOENT") return undefined
                throw error
              })
              if (existingRoot) {
                if (!existingRoot.isDirectory() || existingRoot.isSymbolicLink()) {
                  throw new Error("TaskArtifactStore: idempotent snapshot target is not a real directory")
                }
                const existingManifestBytes = await readRegularFile(
                  path.join(finalRoot, "manifest.json"),
                  "TaskArtifactStore idempotent manifest",
                )
                const existingManifest = TaskArtifactSnapshotManifestSchema.parse(
                  JSON.parse(Buffer.from(existingManifestBytes).toString("utf8")),
                )
                const existingStable = stableTaskArtifactPublication({
                  taskID: existingManifest.task_id,
                  snapshotKind: "catalog",
                  producer: existingManifest.producer,
                  trees: existingManifest.trees,
                })
                if (JSON.stringify(existingStable) !== JSON.stringify(stablePublication)) {
                  throw new Error("TaskArtifactStore: idempotent snapshot identity collision")
                }
                const identity = TaskArtifactSnapshotIdentitySchema.parse({
                  schema_version: 2,
                  project_id: scope.projectID,
                  task_id: scope.taskID,
                  snapshot_id: snapshotID,
                  manifest_sha256: sha256(existingManifestBytes),
                })
                const committed = await verifySnapshotAtRoot(scope, identity, finalRoot, () => assertTaskScope(scope))
                await removeExact(record.root, "TaskArtifactStore idempotent retry stage")
                const artifacts = taskArtifactSnapshotResourceRefs({
                  identity,
                  manifest: committed.manifest,
                  manifestBytes: existingManifestBytes,
                })
                publications.set(identity.snapshot_id, identity)
                return Object.freeze({
                  snapshot: deepFreeze(identity) as TaskArtifactSnapshotIdentity,
                  manifest: committed.manifest,
                  artifacts,
                })
              }
            }
            const manifest = TaskArtifactSnapshotManifestSchema.parse({
              schema_version: 2,
              snapshot_kind: input.snapshot_kind,
              project_id: scope.projectID,
              task_id: scope.taskID,
              snapshot_id: snapshotID,
              publication_sequence: await reservePublicationSequence(scope, () => assertTaskScope(scope)),
              created_at_ms: Date.now(),
              producer,
              trees,
            })
            const manifestBytes = Buffer.from(JSON.stringify(manifest), "utf8")
            for (const file of artifactFiles) {
              await syncRegularFile(
                path.join(record.root, file.tree, ...file.path.split("/")),
                `TaskArtifactStore publication ${file.tree}/${file.path}`,
              )
            }
            await writeSyncedExclusiveFile(
              path.join(record.root, "manifest.json"),
              manifestBytes,
              "TaskArtifactStore manifest",
            )
            for (const tree of record.trees) {
              await syncDirectoryMetadata(path.join(record.root, tree), `TaskArtifactStore publication tree ${tree}`)
            }
            await syncDirectoryMetadata(record.root, "TaskArtifactStore staged snapshot")
            const identity = deepFreeze(
              TaskArtifactSnapshotIdentitySchema.parse({
                schema_version: 2,
                project_id: scope.projectID,
                task_id: scope.taskID,
                snapshot_id: snapshotID,
                manifest_sha256: sha256(manifestBytes),
              }),
            ) as TaskArtifactSnapshotIdentity
            await verifySnapshotAtRoot(scope, identity, record.root, () => assertTaskScope(scope))
            await assertManagedDirectoryPath({
              projectDirectory: scope.projectDirectory,
              target: path.dirname(finalRoot),
              create: true,
              context: "TaskArtifactStore publication",
            })
            assertTaskScope(scope)
            await fs.rename(record.root, finalRoot)
            renamed = true
            await syncDirectoryMetadata(path.dirname(finalRoot), "TaskArtifactStore snapshot catalog")
            const committed = await verifyCommittedSnapshot(scope, identity, () => assertTaskScope(scope))
            const artifacts = Object.freeze(
              artifactFiles.map((file) => deepFreeze({ snapshot: identity, ...file }) as TaskArtifactRef),
            )
            publications.set(identity.snapshot_id, identity)
            return Object.freeze({ snapshot: identity, manifest: committed.manifest, artifacts })
          } catch (cause) {
            const residue = renamed ? finalRoot : record.root
            try {
              await removeExact(residue, "TaskArtifactStore publish")
            } catch (cleanupCause) {
              throw new AggregateError(
                [cause, cleanupCause],
                `TaskArtifactStore publish failed and left residue ${residue}`,
              )
            }
            throw cause
          }
        } finally {
          publicationLock[Symbol.dispose]()
        }
      })
    },

    resources(input: TaskArtifactResourceSetLocator): Promise<readonly TaskArtifactRef[]> {
      return track(async () => {
        const locator = TaskArtifactResourceSetLocatorSchema.parse(input)
        const verified = await verifyCommittedSnapshot(scope, locator.snapshot, () => assertTaskScope(scope))
        return taskArtifactResourceSetRefs(
          {
            identity: locator.snapshot,
            manifest: verified.manifest,
            manifestBytes: verified.manifestBytes,
          },
          locator,
        )
      })
    },

    materialize(input: { snapshot: TaskArtifactSnapshotIdentity; tree: string }): Promise<TaskArtifactMaterialization> {
      return track(async () => {
        const snapshot = deepFreeze(
          TaskArtifactSnapshotIdentitySchema.parse(input.snapshot),
        ) as TaskArtifactSnapshotIdentity
        const tree = TaskArtifactTreeNameSchema.parse(input.tree)
        const verified = await verifyCommittedSnapshot(scope, snapshot, () => assertTaskScope(scope))
        if (!verified.manifest.trees[tree]) throw new Error(`TaskArtifactStore: snapshot has no tree ${tree}`)
        const id = randomUUID()
        const directory = ProjectRuntimePaths.taskArtifactMaterializationRoot(scope.projectDirectory, scope.taskID, id)
        try {
          await assertManagedDirectoryPath({
            projectDirectory: scope.projectDirectory,
            target: path.dirname(directory),
            create: true,
            context: "TaskArtifactStore materialization",
          })
          await fs.cp(path.join(verified.root, tree), directory, { recursive: true, force: false, errorOnExist: true })
          const copied = await inventoryTree(directory, `TaskArtifactStore materialization ${id}`)
          const expected = verified.manifest.trees[tree]!.files
          if (
            copied.length !== expected.length ||
            copied.some((file, index) => {
              const declared = expected[index]!
              return file.path !== declared.path || file.bytes !== declared.bytes || file.sha256 !== declared.sha256
            })
          ) {
            throw new Error("TaskArtifactStore: materialized inventory mismatch")
          }
          await verifyCommittedSnapshot(scope, snapshot, () => assertTaskScope(scope))
          materializations.set(directory, Object.freeze({ directory, snapshot }))
          return Object.freeze({ id, directory })
        } catch (cause) {
          try {
            await removeExact(directory, "TaskArtifactStore materialization")
          } catch (cleanupCause) {
            throw new AggregateError(
              [cause, cleanupCause],
              `TaskArtifactStore materialization failed and left residue ${directory}`,
            )
          }
          throw cause
        }
      })
    },

    verify(input: TaskArtifactSet): Promise<void> {
      return track(async () => {
        const artifactSet = TaskArtifactSetSchema.parse(input)
        const snapshot = artifactSet.manifest.snapshot
        const verified = await verifyCommittedSnapshot(scope, snapshot, () => assertTaskScope(scope))
        const expected = verified.manifest.trees[artifactSet.manifest.tree]?.files
        if (!expected) throw new Error(`TaskArtifactStore: snapshot has no tree ${artifactSet.manifest.tree}`)
        if (artifactSet.artifacts.length !== expected.length) {
          throw new Error("TaskArtifactStore: artifact set does not match the complete manifest tree inventory")
        }
        for (const [index, artifact] of artifactSet.artifacts.entries()) {
          const declared = expected[index]!
          if (
            artifact.path !== declared.path ||
            artifact.media_type !== declared.media_type ||
            artifact.bytes !== declared.bytes ||
            artifact.sha256 !== declared.sha256
          ) {
            throw new Error("TaskArtifactStore: artifact set does not match the complete manifest tree inventory")
          }
          assertArtifactRef(verified.manifest, artifact)
        }
      })
    },

    read(refInput: TaskArtifactRef): Promise<Uint8Array> {
      return track(() => readVerifiedTaskArtifactRef(scope, refInput, () => assertTaskScope(scope)))
    },

    async close(): Promise<void> {
      if (!active) throw new Error("TaskArtifactStore: execution is already closed")
      active = false
      const failures: unknown[] = []
      const operationResults = await Promise.allSettled([...operations])
      for (const outcome of operationResults) {
        if (outcome.status === "rejected") failures.push(outcome.reason)
      }
      const snapshots = new Map(publications)
      for (const materialization of materializations.values()) {
        snapshots.set(materialization.snapshot.snapshot_id, materialization.snapshot)
      }
      for (const snapshot of snapshots.values()) {
        try {
          await verifyCommittedSnapshot(scope, snapshot, () => assertTaskScope(scope))
        } catch (cause) {
          failures.push(cause)
        }
      }
      const cleanup = [...[...stages].map((stage) => stage.root), ...materializations.keys()]
      stages.clear()
      materializations.clear()
      for (const target of cleanup) {
        try {
          await removeExact(target, "TaskArtifactStore execution")
        } catch (cause) {
          failures.push(cause)
        }
      }
      if (failures.length > 0)
        throw new AggregateError(failures, "TaskArtifactStore execution validation or cleanup failed")
    },
  }
  result = Object.freeze(execution) as TaskArtifactStoreExecution
  return result
}

/**
 * Publish files owned by the current Task product repository as one immutable
 * catalog snapshot. The model supplies only project-relative source paths;
 * the Host reads stable bytes and returns the exact refs it minted.
 */
export async function publishTaskArtifactProjectFiles(input: {
  scope: TaskToolExecutionScope
  files: readonly TaskArtifactProjectFile[]
}): Promise<TaskArtifactPublication> {
  if (input.scope.owner.kind !== "projected-worker") {
    throw new Error("TaskArtifactStore project-file publication requires a projected worker owner")
  }
  if (input.files.length === 0) {
    throw new Error("TaskArtifactStore project-file publication requires at least one file")
  }
  const execution = createTaskArtifactStoreExecution(input.scope)
  let publication: TaskArtifactPublication | undefined
  let primaryFailure: unknown
  try {
    const stage = await execution.stage({ trees: ["resources"] })
    const realProjectRoot = await fs.realpath(input.scope.projectDirectory)
    const inventory: TaskArtifactPublicationFile[] = []
    const seen = new Set<string>()
    for (const [index, file] of input.files.entries()) {
      const sourceRelativePath = ProjectRelativePathSchema.parse(file.path)
      const folded = sourceRelativePath.toLowerCase()
      if (seen.has(folded)) {
        throw new Error(`TaskArtifactStore project-file publication repeats path ${sourceRelativePath}`)
      }
      seen.add(folded)
      const sourcePath = path.resolve(input.scope.projectDirectory, ...sourceRelativePath.split("/"))
      if (!Filesystem.contains(input.scope.projectDirectory, sourcePath)) {
        throw new Error(`TaskArtifactStore project-file source is outside the Task project: ${sourceRelativePath}`)
      }
      await assertProjectFileAncestors({
        projectDirectory: input.scope.projectDirectory,
        sourceRelativePath,
      })
      const realSourcePath = await fs.realpath(sourcePath)
      if (!Filesystem.contains(realProjectRoot, realSourcePath)) {
        throw new Error(
          `TaskArtifactStore project-file source resolves outside the Task project: ${sourceRelativePath}`,
        )
      }
      const resourcePath = `${String(index).padStart(4, "0")}/${sourceRelativePath}`
      const targetPath = path.join(stage.treeDirectories.resources!, ...resourcePath.split("/"))
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await writeSyncedExclusiveFile(
        targetPath,
        await readRegularFile(sourcePath, `TaskArtifactStore project-file source ${sourceRelativePath}`),
        `TaskArtifactStore project-file stage ${resourcePath}`,
      )
      inventory.push({
        tree: "resources",
        path: resourcePath,
        media_type: file.mediaType,
      })
    }
    publication = await execution.publish(stage, {
      snapshot_kind: "catalog",
      idempotent: true,
      files: inventory,
    })
  } catch (cause) {
    primaryFailure = cause
  }
  let cleanupFailure: unknown
  try {
    await execution.close()
  } catch (cause) {
    cleanupFailure = cause
  }
  if (primaryFailure && cleanupFailure) {
    throw new AggregateError(
      [primaryFailure, cleanupFailure],
      "TaskArtifactStore project-file publication and cleanup both failed",
    )
  }
  if (primaryFailure) throw primaryFailure
  if (cleanupFailure) throw cleanupFailure
  if (!publication) {
    throw new Error("TaskArtifactStore project-file publication completed without a snapshot")
  }
  return publication
}

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT"
}

export async function removeTaskArtifactRoot(input: { projectDirectory: string; taskID: string }): Promise<void> {
  const root = ProjectRuntimePaths.taskArtifactRoot(input.projectDirectory, input.taskID)
  try {
    await assertManagedDirectoryPath({
      projectDirectory: input.projectDirectory,
      target: root,
      create: false,
      context: "TaskArtifactStore committed Task deletion",
    })
  } catch (cause) {
    if (missing(cause)) return
    throw cause
  }
  await removeExact(root, "TaskArtifactStore committed Task deletion")
}
