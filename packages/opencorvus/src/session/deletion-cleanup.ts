import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { Identifier } from "@/id/id"
import { Global } from "@/global"
import {
  acquireControlLeaseInTransaction,
  assertControlLeaseInTransaction,
  currentControlLeasesInTransaction,
  releaseControlLeaseInTransaction,
  type ControlLease,
} from "@/engine/control-lease"
import { joinProcessLivenessLease, type ProcessLivenessReference } from "@/engine/process-liveness"
import {
  currentRuntimeOccurrenceID,
  currentRuntimeProcessOccurrence,
  observeRuntimeProcessOccurrence,
  type RuntimeProcessOccurrenceInfo,
  type RuntimeProcessOccurrenceObserver,
} from "@/runtime/process-occurrence"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { SessionPromptOwnerTable, SessionTable } from "@/session/session.sql"
import { Database, and, eq, inArray, sql } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"

const SessionDeletionCleanupTarget = z.object({
  sessionID: Identifier.schema("session"),
  directory: z.string().min(1),
  source: z.string().min(1),
  quarantine: z.string().min(1),
  sourcePresent: z.boolean(),
})

const SessionDeletionCleanupManifest = z.object({
  format: z.literal("opencorvus.session-deletion-cleanup.v1"),
  operationID: Identifier.schema("call"),
  databaseInstanceID: z.string().uuid(),
  projectID: z.string().min(1),
  rootSessionID: Identifier.schema("session"),
  rootIdentity: z
    .object({
      kind: z.string().min(1),
      conversationExperience: z.enum(["chat", "work"]).nullable(),
    })
    .strict(),
  sessionIDs: z.array(Identifier.schema("session")).min(1),
  targets: z.array(SessionDeletionCleanupTarget).min(1),
  timeCreated: z.number().int().nonnegative(),
})

export type SessionDeletionCleanupManifest = z.infer<typeof SessionDeletionCleanupManifest>
export type SessionDeletionCleanupPlan = {
  manifest: SessionDeletionCleanupManifest
  manifestPath: string
}
export type SessionDeletionCleanupResidue = { path: string; message: string }

const QUERY_PAGE_SIZE = 64
const PERMANENT_FENCE_EXPIRY = Number.MAX_SAFE_INTEGER

export type SessionDeletionCleanupAuthority = {
  operationID: string
  ownerOccurrenceID: string
  runtimeOccurrenceID: string
  leases: ReadonlyArray<{ sessionID: string; leaseID: string }>
  liveness: ProcessLivenessReference
}

export type SessionDeletionCleanupClaim =
  | { acquired: true; authority: SessionDeletionCleanupAuthority }
  | { acquired: false; ownerOccurrenceID: string }

export class SessionDeletionFenceError extends Error {
  override readonly name = "SessionDeletionFenceError"
}

export class SessionDeletionRuntimeNotSettledError extends Error {
  override readonly name = "SessionDeletionRuntimeNotSettledError"
}

export function assertSessionDeletionAdmissionInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
  now = Date.now(),
): void {
  const fence = activeSessionDeletionFenceInTransaction(db, sessionID, now)
  if (fence) {
    throw new SessionDeletionFenceError(
      `Session ${sessionID} admission is fenced by deletion owner ${fence.ownerOccurrenceID}`,
    )
  }
  const tombstone = db
    .select({ id: ProtocolEventTable.id })
    .from(ProtocolEventTable)
    .where(
      and(
        eq(ProtocolEventTable.aggregate_type, "session"),
        eq(ProtocolEventTable.aggregate_id, sessionID),
        eq(ProtocolEventTable.type, "session.deleted"),
      ),
    )
    .get()
  if (tombstone) {
    throw new SessionDeletionFenceError(`Session ${sessionID} admission is fenced by terminal deletion ${tombstone.id}`)
  }
}

let beforeCommittedTargetCleanupForTest: ((target: string) => void | Promise<void>) | undefined
let beforeManifestCreateForTest: ((rootSessionID: string) => void | Promise<void>) | undefined
let beforeManifestReadForTest: ((manifestPath: string) => void | Promise<void>) | undefined
let beforeRetainedBoundaryCommitForTest: ((rootSessionID: string) => void | Promise<void>) | undefined
let retainedSettlementTimeoutForTest: ((rootSessionID: string) => number) | undefined

export async function runBeforeRetainedSessionDeletionBoundaryCommitForTest(rootSessionID: string): Promise<void> {
  await beforeRetainedBoundaryCommitForTest?.(rootSessionID)
}

export function retainedSessionDeletionSettlementTimeoutForTest(rootSessionID: string, defaultTimeout: number): number {
  return retainedSettlementTimeoutForTest?.(rootSessionID) ?? defaultTimeout
}

const SessionDeletionFenceOwner = z.object({
  operationID: Identifier.schema("call"),
  pid: z.number().int().positive(),
  processInstanceID: z.string().min(1),
  occurrenceID: z.string().min(1),
})

function encodeFenceOwner(owner: RuntimeProcessOccurrenceInfo & { operationID: string }): string {
  return JSON.stringify(SessionDeletionFenceOwner.parse(owner))
}

function decodeFenceOwner(owner: string): z.infer<typeof SessionDeletionFenceOwner> {
  return SessionDeletionFenceOwner.parse(JSON.parse(owner))
}

function activeRoot(): string {
  return path.join(Global.Path.data, "maintenance", "session-deletion-cleanup", "active")
}

function completedRoot(databaseInstanceID = Database.Identity()): string {
  return path.join(Global.Path.data, "maintenance", "session-deletion-cleanup", "completed", databaseInstanceID)
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => {
    const resolved = path.resolve(value)
    return process.platform === "win32" ? resolved.toLowerCase() : resolved
  }
  return normalize(left) === normalize(right)
}

function operationID(rootSessionID: string): string {
  return Identifier.deterministic("call", `session-deletion\0${Database.Identity()}\0${rootSessionID}`)
}

function validateManifest(manifest: SessionDeletionCleanupManifest, manifestPath: string): void {
  const expectedOperationID = operationID(manifest.rootSessionID)
  if (manifest.operationID !== expectedOperationID) {
    throw new Error(`Session deletion cleanup operation identity drifted for ${manifest.rootSessionID}`)
  }
  const expectedPath = path.join(activeRoot(), `${manifest.operationID}.json`)
  const completedPath = path.join(completedRoot(manifest.databaseInstanceID), `${manifest.operationID}.json`)
  if (!samePath(manifestPath, expectedPath) && !samePath(manifestPath, completedPath)) {
    throw new Error(`Session deletion cleanup manifest path does not match ${manifest.operationID}`)
  }
  const uniqueSessionIDs = new Set(manifest.sessionIDs)
  if (uniqueSessionIDs.size !== manifest.sessionIDs.length || !uniqueSessionIDs.has(manifest.rootSessionID)) {
    throw new Error(`Session deletion cleanup ${manifest.operationID} has invalid Session membership`)
  }
  if (manifest.targets.length !== manifest.sessionIDs.length) {
    throw new Error(`Session deletion cleanup ${manifest.operationID} target membership is incomplete`)
  }
  const targetSessionIDs = new Set<string>()
  for (const [index, target] of manifest.targets.entries()) {
    if (!uniqueSessionIDs.has(target.sessionID) || targetSessionIDs.has(target.sessionID)) {
      throw new Error(`Session deletion cleanup ${manifest.operationID} has conflicting target ${target.sessionID}`)
    }
    targetSessionIDs.add(target.sessionID)
    const directory = path.resolve(target.directory)
    const source = path.resolve(target.source)
    if (!path.isAbsolute(target.directory) || !samePath(directory, target.directory)) {
      throw new Error(`Session deletion cleanup directory is not canonical: ${target.directory}`)
    }
    const expectedSource = ProjectRuntimePaths.rootSessionRuntimeRoot(directory, target.sessionID)
    if (!path.isAbsolute(target.source) || !samePath(source, expectedSource)) {
      throw new Error(`Session deletion cleanup source is not the exact conversation root: ${target.source}`)
    }
    const expectedQuarantine = `${source}.deleting-${manifest.operationID}-${index}`
    if (!samePath(target.quarantine, expectedQuarantine)) {
      throw new Error(`Session deletion cleanup quarantine does not match ${target.source}`)
    }
  }
}

function parseManifest(serialized: string, manifestPath: string): SessionDeletionCleanupManifest {
  const manifest = SessionDeletionCleanupManifest.parse(JSON.parse(serialized))
  validateManifest(manifest, manifestPath)
  return manifest
}

function rowsForSessionIDs<Row>(
  sessionIDs: readonly string[],
  read: (sessionIDs: readonly string[]) => readonly Row[],
): Row[] {
  const rows: Row[] = []
  for (let offset = 0; offset < sessionIDs.length; offset += QUERY_PAGE_SIZE) {
    rows.push(...read(sessionIDs.slice(offset, offset + QUERY_PAGE_SIZE)))
  }
  return rows
}

export function activeSessionDeletionFenceInTransaction(
  db: Database.TxOrDb,
  sessionID: string,
  now = Date.now(),
): { ownerOccurrenceID: string; leaseID: string } | undefined {
  const current = currentControlLeasesInTransaction(db, "session_deletion", [sessionID]).get(sessionID)
  if (!current || current.expires_at <= now) return
  return {
    ownerOccurrenceID: decodeFenceOwner(current.owner_occurrence_id).occurrenceID,
    leaseID: current.id,
  }
}

function activeDeletionLeasesInTransaction(db: Database.TxOrDb, sessionIDs: readonly string[], now: number) {
  const current = new Map<string, ControlLease>()
  for (let offset = 0; offset < sessionIDs.length; offset += QUERY_PAGE_SIZE) {
    for (const [sessionID, lease] of currentControlLeasesInTransaction(
      db,
      "session_deletion",
      sessionIDs.slice(offset, offset + QUERY_PAGE_SIZE),
    )) {
      if (lease.expires_at > now) current.set(sessionID, lease)
    }
  }
  return current
}

export function claimSessionDeletionCleanup(
  plan: SessionDeletionCleanupPlan,
  now = Date.now(),
  observeProcessOccurrence: RuntimeProcessOccurrenceObserver = observeRuntimeProcessOccurrence,
): SessionDeletionCleanupClaim {
  validateManifest(plan.manifest, plan.manifestPath)
  const liveness = joinProcessLivenessLease(currentRuntimeOccurrenceID(), now)
  const process = currentRuntimeProcessOccurrence()
  const fenceOwner = {
    operationID: plan.manifest.operationID,
    pid: process.pid,
    processInstanceID: process.processInstanceID,
    occurrenceID: liveness.occurrenceID,
  }
  const ownerOccurrenceID = encodeFenceOwner(fenceOwner)
  try {
    const claimed = Database.immediateTransaction((db) => {
      const current = activeDeletionLeasesInTransaction(db, plan.manifest.sessionIDs, now)
      for (const lease of current.values()) {
        const priorOwner = decodeFenceOwner(lease.owner_occurrence_id)
        if (priorOwner.operationID !== plan.manifest.operationID) {
          throw new Error(
            `Session deletion cleanup ${plan.manifest.operationID} conflicts with active occurrence ${priorOwner.operationID}`,
          )
        }
        if (observeProcessOccurrence(priorOwner) !== "dead_or_reused") {
          return { acquired: false as const, ownerOccurrenceID: priorOwner.occurrenceID }
        }
      }
      const leases = plan.manifest.sessionIDs.map((sessionID) => {
        const prior = current.get(sessionID)
        const acquired = acquireControlLeaseInTransaction(db, {
          target: "session_deletion",
          targetID: sessionID,
          ownerOccurrenceID,
          now,
          leaseMilliseconds: PERMANENT_FENCE_EXPIRY - now,
          supersedeLeaseID: prior?.id,
        })
        if (!acquired.acquired) {
          throw new Error(`Session deletion cleanup ${plan.manifest.operationID} lost fence ${sessionID}`)
        }
        return { sessionID, leaseID: acquired.lease.id }
      })
      return { acquired: true as const, leases }
    })
    if (!claimed.acquired) {
      liveness.release()
      return claimed
    }
    return {
      acquired: true,
      authority: {
        operationID: plan.manifest.operationID,
        ownerOccurrenceID,
        runtimeOccurrenceID: liveness.occurrenceID,
        leases: claimed.leases,
        liveness,
      },
    }
  } catch (error) {
    liveness.release()
    throw error
  }
}

export function assertSessionDeletionPromptOwnersSettledInTransaction(
  db: Database.TxOrDb,
  sessionIDs: readonly string[],
): void {
  const promptOwners = rowsForSessionIDs(sessionIDs, (page) =>
    db
      .select({ sessionID: SessionPromptOwnerTable.session_id })
      .from(SessionPromptOwnerTable)
      .where(inArray(SessionPromptOwnerTable.session_id, page))
      .all(),
  )
  if (promptOwners.length > 0) {
    throw new SessionDeletionRuntimeNotSettledError(
      `Session deletion cannot settle while Prompt owner ${promptOwners[0]!.sessionID} is active`,
    )
  }
}

export function assertSessionDeletionAuthorityInTransaction(
  db: Database.TxOrDb,
  authority: SessionDeletionCleanupAuthority,
  now = Date.now(),
): void {
  for (const lease of authority.leases) {
    assertControlLeaseInTransaction(db, {
      target: "session_deletion",
      targetID: lease.sessionID,
      leaseID: lease.leaseID,
      ownerOccurrenceID: authority.ownerOccurrenceID,
      now,
    })
  }
}

export function releaseSessionDeletionAuthorityInTransaction(
  db: Database.TxOrDb,
  authority: SessionDeletionCleanupAuthority,
  now = Date.now(),
): void {
  for (const lease of authority.leases) {
    if (
      !releaseControlLeaseInTransaction(db, {
        target: "session_deletion",
        targetID: lease.sessionID,
        leaseID: lease.leaseID,
        ownerOccurrenceID: authority.ownerOccurrenceID,
        now,
      })
    ) {
      throw new Error(`Session deletion cleanup ${authority.operationID} lost release fence ${lease.sessionID}`)
    }
  }
}

export function closeSessionDeletionAuthority(authority: SessionDeletionCleanupAuthority): void {
  authority.liveness.release()
}

function immutableManifestIdentity(manifest: SessionDeletionCleanupManifest): string {
  return JSON.stringify({
    format: manifest.format,
    operationID: manifest.operationID,
    databaseInstanceID: manifest.databaseInstanceID,
    projectID: manifest.projectID,
    rootSessionID: manifest.rootSessionID,
    rootIdentity: manifest.rootIdentity,
    sessionIDs: manifest.sessionIDs,
    targets: manifest.targets,
  })
}

function manifestRequestIdentity(manifest: SessionDeletionCleanupManifest): string {
  return JSON.stringify({
    format: manifest.format,
    operationID: manifest.operationID,
    databaseInstanceID: manifest.databaseInstanceID,
    projectID: manifest.projectID,
    rootSessionID: manifest.rootSessionID,
    rootIdentity: manifest.rootIdentity,
    sessionIDs: manifest.sessionIDs,
    targets: manifest.targets.map(({ sourcePresent: _sourcePresent, ...target }) => target),
  })
}

async function pathState(target: string): Promise<"present" | "absent"> {
  try {
    const info = await fs.lstat(target)
    if (!info.isDirectory()) throw new Error(`Session deletion cleanup target is not a directory: ${target}`)
    return "present"
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return "absent"
    throw error
  }
}

async function removeActiveManifest(plan: SessionDeletionCleanupPlan): Promise<void> {
  await fs.rm(plan.manifestPath, { force: true })
  await Filesystem.syncDirectoryMetadata(path.dirname(plan.manifestPath))
}

export async function createSessionDeletionCleanupPlan(input: {
  projectID: string
  rootSessionID: string
  rootIdentity: { kind: string; conversationExperience: "chat" | "work" | null }
  sessions: ReadonlyArray<{ id: string; directory: string }>
}): Promise<SessionDeletionCleanupPlan> {
  const sessions = [...input.sessions]
    .map((session) => ({ id: session.id, directory: path.resolve(session.directory) }))
    .sort((left, right) => left.id.localeCompare(right.id))
  const sessionIDs = sessions.map((session) => session.id)
  if (new Set(sessionIDs).size !== sessionIDs.length || !sessionIDs.includes(input.rootSessionID)) {
    throw new Error(`Session deletion cleanup input has invalid membership for ${input.rootSessionID}`)
  }
  const id = operationID(input.rootSessionID)
  const targets = await Promise.all(
    sessions.map(async (session, index) => {
      const source = ProjectRuntimePaths.rootSessionRuntimeRoot(session.directory, session.id)
      return {
        sessionID: session.id,
        directory: session.directory,
        source,
        quarantine: `${source}.deleting-${id}-${index}`,
        sourcePresent: (await pathState(source)) === "present",
      }
    }),
  )
  const manifest = SessionDeletionCleanupManifest.parse({
    format: "opencorvus.session-deletion-cleanup.v1",
    operationID: id,
    databaseInstanceID: Database.Identity(),
    projectID: input.projectID,
    rootSessionID: input.rootSessionID,
    rootIdentity: input.rootIdentity,
    sessionIDs,
    targets,
    timeCreated: Date.now(),
  })
  const manifestPath = path.join(activeRoot(), `${manifest.operationID}.json`)
  validateManifest(manifest, manifestPath)
  await beforeManifestCreateForTest?.(manifest.rootSessionID)
  const created = await Filesystem.writeDurableAtomicIfAbsent(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    0o600,
  )
  if (created) return { manifest, manifestPath }
  await beforeManifestReadForTest?.(manifestPath)
  const existing = parseManifest(await fs.readFile(manifestPath, "utf8"), manifestPath)
  if (manifestRequestIdentity(existing) !== manifestRequestIdentity(manifest)) {
    throw new Error(`Session deletion cleanup ${manifest.operationID} has conflicting immutable input`)
  }
  return { manifest: existing, manifestPath }
}

export async function stageSessionDeletionCleanup(plan: SessionDeletionCleanupPlan): Promise<void> {
  validateManifest(plan.manifest, plan.manifestPath)
  for (const target of plan.manifest.targets) {
    const [source, quarantine] = await Promise.all([pathState(target.source), pathState(target.quarantine)])
    if (!target.sourcePresent) {
      if (source !== "absent" || quarantine !== "absent") {
        throw new Error(`Session deletion cleanup found an unadmitted runtime root for ${target.sessionID}`)
      }
      continue
    }
    if (source === "present" && quarantine === "present") {
      throw new Error(`Session deletion cleanup found source and quarantine for ${target.sessionID}`)
    }
    if (source === "present") {
      try {
        await Filesystem.renameDurableNoReplace(target.source, target.quarantine)
      } catch (error) {
        const [settledSource, settledQuarantine] = await Promise.all([
          pathState(target.source),
          pathState(target.quarantine),
        ])
        if (settledSource !== "absent" || settledQuarantine !== "present") throw error
      }
    }
    if (source === "absent" && quarantine === "absent") {
      throw new Error(`Session deletion cleanup lost the admitted runtime root for ${target.sessionID}`)
    }
  }
}

export async function rollbackSessionDeletionCleanup(
  plan: SessionDeletionCleanupPlan,
  authority: SessionDeletionCleanupAuthority,
): Promise<void> {
  validateManifest(plan.manifest, plan.manifestPath)
  if (authority.operationID !== plan.manifest.operationID) {
    throw new Error(`Session deletion rollback authority does not match ${plan.manifest.operationID}`)
  }
  Database.use((db) => assertSessionDeletionAuthorityInTransaction(db, authority))
  for (const target of plan.manifest.targets.toReversed()) {
    const [source, quarantine] = await Promise.all([pathState(target.source), pathState(target.quarantine)])
    if (!target.sourcePresent) {
      if (source !== "absent" || quarantine !== "absent") {
        throw new Error(`Session deletion rollback found an unadmitted runtime root for ${target.sessionID}`)
      }
      continue
    }
    if (source === "present" && quarantine === "present") {
      throw new Error(`Session deletion rollback found source and quarantine for ${target.sessionID}`)
    }
    if (source === "absent" && quarantine === "present") {
      try {
        await Filesystem.renameDurableNoReplace(target.quarantine, target.source)
      } catch (error) {
        const [settledSource, settledQuarantine] = await Promise.all([
          pathState(target.source),
          pathState(target.quarantine),
        ])
        if (settledSource !== "present" || settledQuarantine !== "absent") throw error
      }
    }
    if (source === "absent" && quarantine === "absent") {
      throw new Error(`Session deletion rollback lost the admitted runtime root for ${target.sessionID}`)
    }
  }
  Database.immediateTransaction((db) => releaseSessionDeletionAuthorityInTransaction(db, authority))
  await removeActiveManifest(plan)
}

async function completedManifestMatches(plan: SessionDeletionCleanupPlan, completedPath: string): Promise<boolean> {
  try {
    const completed = parseManifest(await fs.readFile(completedPath, "utf8"), completedPath)
    return immutableManifestIdentity(completed) === immutableManifestIdentity(plan.manifest)
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return false
    throw error
  }
}

export async function cleanupCommittedSessionDeletion(
  plan: SessionDeletionCleanupPlan,
): Promise<SessionDeletionCleanupResidue[]> {
  validateManifest(plan.manifest, plan.manifestPath)
  const residue: SessionDeletionCleanupResidue[] = []
  for (const target of plan.manifest.targets) {
    try {
      if ((await pathState(target.source)) === "present") {
        throw new Error(`committed deletion still has live source ${target.source}`)
      }
      if (!target.sourcePresent) {
        if ((await pathState(target.quarantine)) === "present") {
          throw new Error(`committed deletion has an unadmitted quarantine ${target.quarantine}`)
        }
        continue
      }
      await beforeCommittedTargetCleanupForTest?.(target.quarantine)
      try {
        await fs.rm(target.quarantine, { recursive: true, force: true })
      } catch (error) {
        if ((await pathState(target.quarantine)) !== "absent") throw error
      }
      try {
        await Filesystem.syncDirectoryMetadata(path.dirname(target.quarantine))
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
        if ((code !== "ENOENT" && code !== "ENOTDIR") || (await pathState(target.quarantine)) !== "absent") {
          throw error
        }
      }
    } catch (error) {
      residue.push({ path: target.quarantine, message: error instanceof Error ? error.message : String(error) })
    }
  }
  if (residue.length > 0) return residue
  const root = completedRoot(plan.manifest.databaseInstanceID)
  const completedPath = path.join(root, path.basename(plan.manifestPath))
  try {
    await Filesystem.mkdirDurable(root)
    await Filesystem.renameDurableNoReplace(plan.manifestPath, completedPath)
  } catch (error) {
    if (!(await completedManifestMatches(plan, completedPath))) {
      residue.push({ path: plan.manifestPath, message: error instanceof Error ? error.message : String(error) })
    } else {
      await removeActiveManifest(plan)
    }
  }
  return residue
}

type SessionDeletionCleanupReconcileResult =
  | { status: "rolled_back" }
  | {
      status: "in_progress"
      operationID: string
      projectID: string
      rootIdentity: SessionDeletionCleanupManifest["rootIdentity"]
      ownerOccurrenceID: string
    }
  | {
      status: "committed"
      operationID: string
      projectID: string
      rootIdentity: SessionDeletionCleanupManifest["rootIdentity"]
      residue: SessionDeletionCleanupResidue[]
    }

function readDatabaseState(manifest: SessionDeletionCleanupManifest) {
  return Database.use((db) => {
    const rows = rowsForSessionIDs(manifest.sessionIDs, (page) =>
      db
        .select({ id: SessionTable.id, projectID: SessionTable.project_id })
        .from(SessionTable)
        .where(inArray(SessionTable.id, page))
        .all(),
    )
    const deleted = rowsForSessionIDs(manifest.sessionIDs, (page) =>
      db
        .select({ sessionID: ProtocolEventTable.aggregate_id })
        .from(ProtocolEventTable)
        .where(
          and(
            eq(ProtocolEventTable.aggregate_type, "session"),
            eq(ProtocolEventTable.type, "session.deleted"),
            sql`json_extract(${ProtocolEventTable.payload}, '$.cleanupOperationID') = ${manifest.operationID}`,
            inArray(ProtocolEventTable.aggregate_id, page),
          ),
        )
        .all(),
    )
    return { rows, deleted }
  })
}

function assertCommittedDatabaseState(manifest: SessionDeletionCleanupManifest): void {
  const state = readDatabaseState(manifest)
  if (state.rows.length !== 0 || state.deleted.length !== manifest.sessionIDs.length) {
    throw new Error(
      `Completed Session deletion cleanup ${manifest.operationID} does not match canonical database facts`,
    )
  }
}

async function reconcileManifest(
  manifestPath: string,
  observeProcessOccurrence: RuntimeProcessOccurrenceObserver = observeRuntimeProcessOccurrence,
): Promise<SessionDeletionCleanupReconcileResult | undefined> {
  let serialized: string
  try {
    serialized = await fs.readFile(manifestPath, "utf8")
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return
    throw error
  }
  const manifest = parseManifest(serialized, manifestPath)
  if (manifest.databaseInstanceID !== Database.Identity()) {
    throw new Error(
      `Session deletion cleanup ${manifest.operationID} belongs to database ${manifest.databaseInstanceID}`,
    )
  }
  const state = readDatabaseState(manifest)
  if (
    state.rows.length === manifest.sessionIDs.length &&
    state.rows.every((row) => row.projectID === manifest.projectID) &&
    state.deleted.length === 0
  ) {
    const claim = claimSessionDeletionCleanup({ manifest, manifestPath }, Date.now(), observeProcessOccurrence)
    if (!claim.acquired) {
      return {
        status: "in_progress",
        operationID: manifest.operationID,
        projectID: manifest.projectID,
        rootIdentity: manifest.rootIdentity,
        ownerOccurrenceID: claim.ownerOccurrenceID,
      }
    }
    try {
      await rollbackSessionDeletionCleanup({ manifest, manifestPath }, claim.authority)
      return { status: "rolled_back" }
    } finally {
      closeSessionDeletionAuthority(claim.authority)
    }
  }
  if (state.rows.length === 0 && state.deleted.length === manifest.sessionIDs.length) {
    const residue = await cleanupCommittedSessionDeletion({ manifest, manifestPath })
    return {
      status: "committed",
      operationID: manifest.operationID,
      projectID: manifest.projectID,
      rootIdentity: manifest.rootIdentity,
      residue,
    }
  }
  throw new Error(`Session deletion cleanup ${manifest.operationID} has ambiguous database evidence`)
}

export async function resumeSessionDeletionCleanup(
  rootSessionID: string,
): Promise<SessionDeletionCleanupReconcileResult | undefined> {
  const name = `${operationID(rootSessionID)}.json`
  const reconciled = await reconcileManifest(path.join(activeRoot(), name))
  if (reconciled) return reconciled
  const completedPath = path.join(completedRoot(), name)
  try {
    const manifest = parseManifest(await fs.readFile(completedPath, "utf8"), completedPath)
    if (manifest.rootSessionID !== rootSessionID) {
      throw new Error(`Session deletion cleanup ${manifest.operationID} has conflicting root Session identity`)
    }
    assertCommittedDatabaseState(manifest)
    return {
      status: "committed",
      operationID: manifest.operationID,
      projectID: manifest.projectID,
      rootIdentity: manifest.rootIdentity,
      residue: [],
    }
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return
    throw error
  }
}

export async function recoverSessionDeletionCleanup(
  observeProcessOccurrence: RuntimeProcessOccurrenceObserver = observeRuntimeProcessOccurrence,
): Promise<{ unreconciled: unknown[] }> {
  let names: string[]
  try {
    names = await fs.readdir(activeRoot())
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
    if (code === "ENOENT" || code === "ENOTDIR") return { unreconciled: [] }
    return { unreconciled: [error] }
  }
  const unreconciled: unknown[] = []
  for (const name of names.filter((candidate) => candidate.endsWith(".json")).sort()) {
    try {
      const result = await reconcileManifest(path.join(activeRoot(), name), observeProcessOccurrence)
      if (result?.status === "committed" && result.residue.length > 0) {
        throw new AggregateError(
          result.residue.map((item) => new Error(`${item.path}: ${item.message}`)),
          `Session deletion cleanup ${result.operationID} remains pending`,
        )
      }
    } catch (error) {
      unreconciled.push(error)
    }
  }
  return { unreconciled }
}

export const SessionDeletionCleanupTestHooks = {
  activeRoot,
  completedRoot,
  installBeforeCommittedTargetCleanup(hook: (target: string) => void | Promise<void>): Disposable {
    if (beforeCommittedTargetCleanupForTest) throw new Error("Session deletion cleanup test hook is already installed")
    beforeCommittedTargetCleanupForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeCommittedTargetCleanupForTest === hook) beforeCommittedTargetCleanupForTest = undefined
      },
    }
  },
  installBeforeManifestCreate(hook: (rootSessionID: string) => void | Promise<void>): Disposable {
    if (beforeManifestCreateForTest) throw new Error("Session deletion manifest hook is already installed")
    beforeManifestCreateForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeManifestCreateForTest === hook) beforeManifestCreateForTest = undefined
      },
    }
  },
  installBeforeManifestRead(hook: (manifestPath: string) => void | Promise<void>): Disposable {
    if (beforeManifestReadForTest) throw new Error("Session deletion manifest read hook is already installed")
    beforeManifestReadForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeManifestReadForTest === hook) beforeManifestReadForTest = undefined
      },
    }
  },
  installBeforeRetainedBoundaryCommit(hook: (rootSessionID: string) => void | Promise<void>): Disposable {
    if (beforeRetainedBoundaryCommitForTest) {
      throw new Error("Retained Session deletion boundary hook is already installed")
    }
    beforeRetainedBoundaryCommitForTest = hook
    return {
      [Symbol.dispose]() {
        if (beforeRetainedBoundaryCommitForTest === hook) beforeRetainedBoundaryCommitForTest = undefined
      },
    }
  },
  installRetainedSettlementTimeout(hook: (rootSessionID: string) => number): Disposable {
    if (retainedSettlementTimeoutForTest) {
      throw new Error("Retained Session deletion settlement timeout hook is already installed")
    }
    retainedSettlementTimeoutForTest = hook
    return {
      [Symbol.dispose]() {
        if (retainedSettlementTimeoutForTest === hook) retainedSettlementTimeoutForTest = undefined
      },
    }
  },
}
