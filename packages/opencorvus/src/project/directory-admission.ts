import { randomUUID } from "node:crypto"
import { AsyncLocalStorage } from "node:async_hooks"
import * as fsSync from "node:fs"
import * as fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Global } from "@/global"
import {
  currentRuntimeProcessOccurrence,
  observeRuntimeProcessOccurrence,
  type RuntimeProcessOccurrenceInfo,
  type RuntimeProcessOccurrenceObserver,
} from "@/runtime/process-occurrence"
import { and, Database, eq, gte, lt } from "@/storage/db"
import { Filesystem } from "@/util/filesystem"
import { Log } from "@/util/log"
import { ProcessLockCompromisedError, withSharedJsonFactLock } from "@/util/process-lock"
import { ProjectDirectoryAdmissionTable } from "./project.sql"

/**
 * Durable Project-directory ownership admission.
 *
 * The cross-process file lock queues ordinary work but is not safety
 * authority: its renewal can be compromised while a callback is still
 * running. Every external filesystem transition therefore publishes an exact
 * SQLite generation first. Project registry writers reject that generation in
 * their own transaction, so even a peer that acquires a compromised file lock
 * cannot register a directory while the old callback may still remove it.
 */
export namespace ProjectDirectoryAdmission {
  const log = Log.create({ service: "project-directory-admission" })
  const locks = new Map<string, Promise<unknown>>()
  const tokenContext = new AsyncLocalStorage<Token>()
  type Row = typeof ProjectDirectoryAdmissionTable.$inferSelect
  type BeforeAcquireHook = () => void | Promise<void>
  type AfterDurableAcquireHook = (token: Token) => void | Promise<void>
  type AfterQueueCompromisedHook = (error: ProcessLockCompromisedError) => void | Promise<void>
  let beforeAcquire: BeforeAcquireHook | undefined
  let afterDurableAcquire: AfterDurableAcquireHook | undefined
  let afterQueueCompromised: AfterQueueCompromisedHook | undefined

  export const ClosedError = NamedError.create(
    "ProjectDirectoryAdmissionClosedError",
    z.object({
      directory: z.string(),
      operationID: z.string(),
      kind: z.enum(["registration", "reclamation", "promotion_restore", "promotion_publish", "promotion_workspace"]),
      message: z.string(),
    }),
  )

  export type Token = {
    directoryKey: string
    directory: string
    generation: string
    operationID: string
    kind: "registration" | "reclamation" | "promotion_restore" | "promotion_publish" | "promotion_workspace"
    owner: RuntimeProcessOccurrenceInfo
    /** Exact physical occurrence observed before this generation was published.
     * Registration and destructive callers must revalidate it at their final
     * authority boundary; the path key alone is not replacement-safe. */
    occurrence?: DirectoryOccurrence
  }

  export type DirectoryOccurrence = {
    directoryKey: string
    device: number
    inode: number
    birthtimeMs: number
  }

  export function current(): Token | undefined {
    return tokenContext.getStore()
  }

  export async function provide<T>(token: Token, run: () => Promise<T>): Promise<T> {
    assertOwnedNow(token)
    return tokenContext.run(token, run)
  }

  export namespace TestHooks {
    export function installBeforeAcquire(hook: BeforeAcquireHook) {
      const previous = beforeAcquire
      beforeAcquire = hook
      return {
        [Symbol.dispose]() {
          if (beforeAcquire === hook) beforeAcquire = previous
        },
      }
    }

    export function installAfterDurableAcquire(hook: AfterDurableAcquireHook) {
      const previous = afterDurableAcquire
      afterDurableAcquire = hook
      return {
        [Symbol.dispose]() {
          if (afterDurableAcquire === hook) afterDurableAcquire = previous
        },
      }
    }

    export function installAfterQueueCompromised(hook: AfterQueueCompromisedHook) {
      const previous = afterQueueCompromised
      afterQueueCompromised = hook
      return {
        [Symbol.dispose]() {
          if (afterQueueCompromised === hook) afterQueueCompromised = previous
        },
      }
    }
  }

  function lockFilepath(): string {
    return path.join(Global.Path.data, "project-directory-admission.json")
  }

  function normalizeKey(value: string): string {
    const normalized = Filesystem.normalizeWindowsPath(path.resolve(value))
    return process.platform === "win32" ? normalized.toLowerCase() : normalized
  }

  /** Resolve aliases through the physical directory or, before publication,
   * through its nearest existing parent. */
  export async function key(directory: string): Promise<string> {
    let candidate = path.resolve(directory)
    const missing: string[] = []
    while (true) {
      try {
        const physical = await fs.realpath(candidate)
        return normalizeKey(path.join(physical, ...missing.reverse()))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
        const parent = path.dirname(candidate)
        if (parent === candidate) return normalizeKey(path.resolve(directory))
        missing.push(path.basename(candidate))
        candidate = parent
      }
    }
  }

  /** Synchronous counterpart for an already active SQLite owner-writer
   * transaction. It performs one bounded ancestor walk and never mutates the
   * namespace. */
  export function keySync(directory: string): string {
    let candidate = path.resolve(directory)
    const missing: string[] = []
    while (true) {
      try {
        const physical = fsSync.realpathSync.native(candidate)
        return normalizeKey(path.join(physical, ...missing.reverse()))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
        const parent = path.dirname(candidate)
        if (parent === candidate) return normalizeKey(path.resolve(directory))
        missing.push(path.basename(candidate))
        candidate = parent
      }
    }
  }

  export function directoryPresentSync(directory: string): boolean {
    try {
      return fsSync.statSync(directory).isDirectory()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
      throw error
    }
  }

  export async function observeDirectory(directory: string): Promise<DirectoryOccurrence> {
    const [directoryKey, info] = await Promise.all([key(directory), fs.stat(directory)])
    if (!info.isDirectory()) throw new Error(`Project directory is not a directory: ${directory}`)
    return { directoryKey, device: info.dev, inode: info.ino, birthtimeMs: info.birthtimeMs }
  }

  export function sameOccurrence(left: DirectoryOccurrence, right: DirectoryOccurrence): boolean {
    return (
      left.directoryKey === right.directoryKey &&
      left.device === right.device &&
      left.inode === right.inode &&
      left.birthtimeMs === right.birthtimeMs
    )
  }

  /** Recursive mutation and durable ownership conflict in either direction. */
  export function overlaps(left: string, right: string): boolean {
    return Filesystem.overlaps(left, right)
  }

  function projectOperationPrefix(projectID: string): string {
    return `project-directory:${Buffer.from(projectID, "utf8").toString("base64url")}:`
  }

  /** Bind a domain operation to one immutable Project without adding another
   * directory-owner table column or relying on a sandbox alias spelling. */
  export function scopeOperationID(projectID: string, operationID: string): string {
    return `${projectOperationPrefix(projectID)}${operationID}`
  }

  export function domainOperationID(projectID: string, operationID: string): string | undefined {
    const prefix = projectOperationPrefix(projectID)
    return operationID.startsWith(prefix) ? operationID.slice(prefix.length) : undefined
  }

  /** Indexed Project-scoped reclamation lookup used inside Session/Task owner
   * writer transactions. A reclamation fences its exact namespace and
   * descendants, but reclaiming one child does not freeze its parent or a
   * sibling namespace. */
  export function projectReclamation(db: Database.TxOrDb, projectID: string, directory?: string): Row | undefined {
    const prefix = projectOperationPrefix(projectID)
    const directoryKey = directory === undefined ? undefined : keySync(directory)
    return db
      .select()
      .from(ProjectDirectoryAdmissionTable)
      .where(
        and(
          gte(ProjectDirectoryAdmissionTable.operation_id, prefix),
          lt(ProjectDirectoryAdmissionTable.operation_id, `${prefix}\uffff`),
        ),
      )
      .all()
      .find(
        (row) =>
          row.kind === "reclamation" &&
          (directoryKey === undefined || Filesystem.contains(row.directory_key, directoryKey)),
      )
  }

  export async function run<T>(operation: () => Promise<T>): Promise<T> {
    await beforeAcquire?.()
    let completed = false
    let result!: T
    try {
      return await withSharedJsonFactLock({
        locks,
        filepath: lockFilepath(),
        empty: "{}",
        mode: 0o600,
        run: async () => {
          result = await operation()
          completed = true
          return result
        },
      })
    } catch (error) {
      if (completed && error instanceof ProcessLockCompromisedError) {
        // This file lock is only a best-effort queue. Every production callback
        // publishes and settles its exact SQLite generation before returning,
        // so a release-time queue compromise cannot overturn that committed
        // result or be attributed from unrelated rows held by another backend.
        log.warn("queue lock was compromised after durable directory callback completed", {
          filepath: lockFilepath(),
          error,
        })
        await afterQueueCompromised?.(error)
        return result
      }
      throw error
    }
  }

  function ownerOf(row: Row): RuntimeProcessOccurrenceInfo {
    return {
      pid: row.owner_pid,
      processInstanceID: row.owner_process_instance_id,
      occurrenceID: row.owner_occurrence_id,
    }
  }

  function tokenOf(row: Row, occurrence?: DirectoryOccurrence): Token {
    return {
      directoryKey: row.directory_key,
      directory: row.directory,
      generation: row.generation,
      operationID: row.operation_id,
      kind: row.kind,
      owner: ownerOf(row),
      occurrence,
    }
  }

  function sameOwner(left: RuntimeProcessOccurrenceInfo, right: RuntimeProcessOccurrenceInfo): boolean {
    return (
      left.pid === right.pid &&
      left.processInstanceID === right.processInstanceID &&
      left.occurrenceID === right.occurrenceID
    )
  }

  function closed(row: Row): InstanceType<typeof ClosedError> {
    return new ClosedError({
      directory: row.directory,
      operationID: row.operation_id,
      kind: row.kind,
      message: `Project directory ${row.directory} is owned by ${row.kind} operation ${row.operation_id}`,
    })
  }

  export function assertOwned(db: Database.TxOrDb, token: Token): void {
    const row = db
      .select()
      .from(ProjectDirectoryAdmissionTable)
      .where(
        and(
          eq(ProjectDirectoryAdmissionTable.directory_key, token.directoryKey),
          eq(ProjectDirectoryAdmissionTable.generation, token.generation),
          eq(ProjectDirectoryAdmissionTable.operation_id, token.operationID),
        ),
      )
      .get()
    if (!row || row.kind !== token.kind || !sameOwner(ownerOf(row), token.owner)) {
      throw new Error(`Project directory admission ${token.operationID}/${token.generation} is no longer authoritative`)
    }
  }

  export function assertOwnedNow(token: Token): void {
    Database.use((db) => assertOwned(db, token))
  }

  export async function acquire<T>(input: {
    directory: string
    operationID: string
    kind: Token["kind"]
    findOwner?: (db: Database.TxOrDb) => T | undefined
    observe?: RuntimeProcessOccurrenceObserver
    occurrence?: DirectoryOccurrence
    expectedDirectoryKey?: string
  }): Promise<{ outcome: "owned"; owner: T } | { outcome: "acquired"; token: Token }> {
    const directoryKey = await key(input.directory)
    if (input.expectedDirectoryKey && input.expectedDirectoryKey !== directoryKey) {
      throw new ClosedError({
        directory: input.directory,
        operationID: input.operationID,
        kind: input.kind,
        message: `Project directory key changed before admission: ${input.directory}`,
      })
    }
    if (input.occurrence && input.occurrence.directoryKey !== directoryKey) {
      throw new Error(`Project directory occurrence does not match admission key: ${input.directory}`)
    }
    const owner = currentRuntimeProcessOccurrence()
    const observed = Database.use((db) =>
      db
        .select()
        .from(ProjectDirectoryAdmissionTable)
        .all()
        .find((candidate) => overlaps(candidate.directory_key, directoryKey)),
    )
    const observedOwner = observed ? ownerOf(observed) : undefined
    const ownerObservation =
      observedOwner && !sameOwner(observedOwner, owner)
        ? (input.observe ?? observeRuntimeProcessOccurrence)(observedOwner)
        : undefined
    const recoverExactOperation =
      observed !== undefined &&
      observed.directory_key === directoryKey &&
      observed.operation_id === input.operationID &&
      observed.kind === input.kind &&
      ownerObservation === "dead_or_reused"
    // Registration has no external effect before its registry transaction,
    // and that transaction removes this row atomically with the ownership
    // write. A dead registration row is therefore pure abandoned admission;
    // any conflicting live operation may remove that exact generation.
    const discardDeadRegistration = observed?.kind === "registration" && ownerObservation === "dead_or_reused"

    const result = Database.immediateTransaction((db) => {
      const existingOwner = input.findOwner?.(db)
      if (existingOwner !== undefined) return { outcome: "owned" as const, owner: existingOwner }

      const current = db
        .select()
        .from(ProjectDirectoryAdmissionTable)
        .all()
        .find((candidate) => overlaps(candidate.directory_key, directoryKey))
      if (current) {
        if (
          current.directory_key === directoryKey &&
          current.operation_id === input.operationID &&
          current.kind === input.kind &&
          sameOwner(ownerOf(current), owner)
        ) {
          return { outcome: "acquired" as const, token: tokenOf(current, input.occurrence) }
        }
        if (current.generation !== observed?.generation || (!recoverExactOperation && !discardDeadRegistration)) {
          throw closed(current)
        }
        db.delete(ProjectDirectoryAdmissionTable)
          .where(
            and(
              eq(ProjectDirectoryAdmissionTable.directory_key, current.directory_key),
              eq(ProjectDirectoryAdmissionTable.generation, current.generation),
            ),
          )
          .run()
      }

      const generation = randomUUID()
      db.insert(ProjectDirectoryAdmissionTable)
        .values({
          directory_key: directoryKey,
          directory: path.resolve(input.directory),
          generation,
          operation_id: input.operationID,
          kind: input.kind,
          owner_occurrence_id: owner.occurrenceID,
          owner_pid: owner.pid,
          owner_process_instance_id: owner.processInstanceID,
          time_created: Date.now(),
        })
        .run()
      return {
        outcome: "acquired" as const,
        token: {
          directoryKey,
          directory: path.resolve(input.directory),
          generation,
          operationID: input.operationID,
          kind: input.kind,
          owner,
          occurrence: input.occurrence,
        },
      }
    })
    if (result.outcome === "acquired") await afterDurableAcquire?.(result.token)
    return result
  }

  /** Re-observe the physical directory and prove it is the exact occurrence
   * captured before admission. Callers choose their domain-specific typed
   * error, while this helper supplies the shared fact comparison. */
  export async function ownsCurrentOccurrence(token: Token, directory = token.directory): Promise<boolean> {
    if (!token.occurrence) return false
    const current = await observeDirectory(directory).catch(() => undefined)
    return current !== undefined && sameOccurrence(token.occurrence, current)
  }

  /** Read the exact active operation only for a path whose physical occurrence
   * is already gone. This lets a partial destructive operation resume cleanup
   * without ever adopting a present replacement at the same pathname. */
  export async function activeExactOperation(
    directory: string,
    kind: Token["kind"],
  ): Promise<{ operationID: string; generation: string } | undefined> {
    const directoryKey = await key(directory)
    return Database.use((db) => {
      const row = db
        .select()
        .from(ProjectDirectoryAdmissionTable)
        .where(eq(ProjectDirectoryAdmissionTable.directory_key, directoryKey))
        .get()
      return row && row.kind === kind ? { operationID: row.operation_id, generation: row.generation } : undefined
    })
  }

  /** Read the current overlapping mutation before a caller enters another
   * external writer lease. This is a liveness preflight only: the later
   * durable acquire remains the authority and revalidates the same overlap in
   * its immediate transaction. */
  export async function activeOverlappingOperation(
    directory: string,
    observe: RuntimeProcessOccurrenceObserver = observeRuntimeProcessOccurrence,
  ): Promise<
    | {
        operationID: string
        generation: string
        kind: Token["kind"]
        ownerObservation: "exact_live" | "dead_or_reused" | "unknown_live"
      }
    | undefined
  > {
    const directoryKey = await key(directory)
    const row = Database.use((db) =>
      db
        .select()
        .from(ProjectDirectoryAdmissionTable)
        .all()
        .find((candidate) => overlaps(candidate.directory_key, directoryKey)),
    )
    if (!row) return undefined
    const owner = ownerOf(row)
    const current = currentRuntimeProcessOccurrence()
    return {
      operationID: row.operation_id,
      generation: row.generation,
      kind: row.kind,
      ownerObservation: sameOwner(owner, current) ? "exact_live" : observe(owner),
    }
  }

  /** Apply the final registry mutation and release this exact generation in
   * one SQLite transaction. A callback failure leaves the durable owner open. */
  export function settle(token: Token, mutation: (db: Database.TxOrDb) => void): void {
    settleMany([token], mutation)
  }

  /** Atomically publish one registry mutation and release every path it owns. */
  export function settleMany(tokens: readonly Token[], mutation: (db: Database.TxOrDb) => void): void {
    Database.immediateTransaction((db) => {
      for (const token of tokens) assertOwned(db, token)
      mutation(db)
      for (const token of tokens) {
        db.delete(ProjectDirectoryAdmissionTable)
          .where(
            and(
              eq(ProjectDirectoryAdmissionTable.directory_key, token.directoryKey),
              eq(ProjectDirectoryAdmissionTable.generation, token.generation),
              eq(ProjectDirectoryAdmissionTable.operation_id, token.operationID),
            ),
          )
          .run()
      }
    })
  }
}
