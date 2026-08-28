import { EngineTaskTable } from "./engine.sql"
import { SessionTable, type SessionKind } from "@/session/session.sql"
import { Database, eq, sql } from "@/storage/db"
import { LruCache } from "@/util/lru-cache"
import path from "node:path"
import { resolveTaskProcessExecution } from "./task-execution-capsule-binding"

const LRU_LIMIT = 4096

const kindCache = new LruCache<string, SessionKind>(LRU_LIMIT)
const parentCache = new LruCache<string, string | null>(LRU_LIMIT)
const taskIDCache = new LruCache<string, string>(LRU_LIMIT)

function readSessionRow(sessionID: string) {
  return Database.use((db) =>
    db
      .select({
        kind: SessionTable.kind,
        parent_id: SessionTable.parent_id,
        project_id: SessionTable.project_id,
      })
      .from(SessionTable)
      .where(eq(SessionTable.id, sessionID))
      .get(),
  )
}

export type SessionLineageIdentity = Readonly<{
  sessionID: string
  projectID: string
  rootSessionID: string
  sessionIDs: readonly string[]
}>

/**
 * Resolve the canonical durable Session ancestry for event admission. The
 * returned IDs are ordered from the event Session to its root. A missing leaf
 * means the event belongs to a different project database; a broken or
 * cross-project chain is corruption and fails explicitly.
 */
export function sessionLineageIdentity(sessionID: string): SessionLineageIdentity | undefined {
  const initial = sessionID.trim()
  if (!initial) return undefined
  const sessionIDs: string[] = []
  const visited = new Set<string>()
  let projectID: string | undefined
  let current: string | undefined = initial
  while (current) {
    if (visited.has(current)) throw new Error(`Session lineage contains a cycle at ${current}`)
    visited.add(current)
    const row = readSessionRow(current)
    if (!row) {
      if (current === initial) return undefined
      throw new Error(`Session lineage is missing durable Session ${current}`)
    }
    projectID ??= row.project_id
    if (row.project_id !== projectID) {
      throw new Error(`Session ${current} belongs to project ${row.project_id}, expected ${projectID}`)
    }
    sessionIDs.push(current)
    current = row.parent_id ?? undefined
  }
  if (!projectID || sessionIDs.length === 0) return undefined
  return Object.freeze({
    sessionID: initial,
    projectID,
    rootSessionID: sessionIDs[sessionIDs.length - 1]!,
    sessionIDs: Object.freeze(sessionIDs),
  })
}

function loadAndCache(sessionID: string) {
  const row = readSessionRow(sessionID)
  if (!row) return undefined
  kindCache.set(sessionID, row.kind as SessionKind)
  parentCache.set(sessionID, row.parent_id ?? null)
  return row
}

export function sessionRole(sessionID: string): SessionKind | undefined {
  if (!sessionID) return undefined
  const cached = kindCache.get(sessionID)
  if (cached !== undefined) return cached
  return loadAndCache(sessionID)?.kind as SessionKind | undefined
}

export function sessionParentID(sessionID: string): string | undefined {
  if (!sessionID) return undefined
  const cached = parentCache.get(sessionID)
  if (cached !== undefined) return cached === null ? undefined : cached
  return loadAndCache(sessionID)?.parent_id ?? undefined
}

export function taskSession(taskID: string): string | undefined {
  const row = Database.use((db) =>
    db
      .select({ sessionID: EngineTaskTable.session_id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.id, taskID))
      .get(),
  )
  return row?.sessionID ?? undefined
}

export function listTaskSessionIDs(taskID: string): string[] {
  return Database.use((db) =>
    db
      .all<{ id: string }>(
        sql`
        WITH RECURSIVE session_tree(id) AS (
          SELECT session_id
          FROM engine_task
          WHERE id = ${taskID} AND session_id IS NOT NULL
          UNION ALL
          SELECT session.id
          FROM session
          JOIN session_tree ON session.parent_id = session_tree.id
        )
        SELECT id FROM session_tree ORDER BY id
      `,
      )
      .map((row) => row.id),
  )
}

export function taskIDForSession(sessionID: string): string | undefined {
  const initial = sessionID.trim()
  if (!initial) return undefined

  const cachedTask = taskIDCache.get(initial)
  if (cachedTask !== undefined) return cachedTask

  const visited: string[] = []
  let current: string | undefined = initial
  while (current && !visited.includes(current)) {
    visited.push(current)
    const task = Database.use((db) =>
      db.select({ id: EngineTaskTable.id }).from(EngineTaskTable).where(eq(EngineTaskTable.session_id, current!)).get(),
    )
    if (task?.id) {
      for (const visitedSessionID of visited) taskIDCache.set(visitedSessionID, task.id)
      return task.id
    }
    current = sessionParentID(current)
  }
  return undefined
}

export function sessionBelongsToTask(sessionID: string, taskID: string): boolean {
  return Database.runOutsideContext(() => taskIDForSession(sessionID) === taskID)
}

export type SessionExecutionAuthority =
  | Readonly<{ kind: "conversation"; sessionID: string; projectID: string; directory: string }>
  | Readonly<{ kind: "task"; sessionID: string; projectID: string; taskID: string; directory: string }>

/** Resolve a model-effect owner from durable Session lineage and the explicit occurrence contract. */
export async function resolveSessionExecutionAuthority(input: {
  sessionID: string
  projectID: string
  expected: Readonly<{ kind: "conversation" }> | Readonly<{ kind: "task"; taskID: string }>
  /** Fresh worker Session prepared in memory but not yet visible. Its parent
   * lineage remains durable and is validated by the same traversal. */
  pendingSession?: Readonly<{ id: string; projectID: string; parentID?: string; directory: string }>
}): Promise<SessionExecutionAuthority> {
  if (input.pendingSession && input.pendingSession.id !== input.sessionID) {
    throw new Error(
      `Pending Session authority ${input.pendingSession.id} does not match execution Session ${input.sessionID}`,
    )
  }
  const visited = new Set<string>()
  const taskOwners = new Set<string>()
  let executionDirectory: string | undefined
  let current: string | undefined = input.sessionID
  while (current) {
    if (visited.has(current)) throw new Error(`Session lineage contains a cycle at ${current}`)
    visited.add(current)
    const pending = current === input.pendingSession?.id ? input.pendingSession : undefined
    const row =
      pending ??
      Database.use((db) =>
        db
          .select({
            projectID: SessionTable.project_id,
            parentID: SessionTable.parent_id,
            directory: SessionTable.directory,
          })
          .from(SessionTable)
          .where(eq(SessionTable.id, current!))
          .get(),
      )
    if (!row) throw new Error(`Session lineage is missing durable Session ${current}`)
    if (row.projectID !== input.projectID) {
      throw new Error(`Session ${current} belongs to project ${row.projectID}, expected ${input.projectID}`)
    }
    if (current === input.sessionID) executionDirectory = path.resolve(row.directory)
    const owners = Database.use((db) =>
      db.select({ id: EngineTaskTable.id }).from(EngineTaskTable).where(eq(EngineTaskTable.session_id, current!)).all(),
    )
    for (const owner of owners) taskOwners.add(owner.id)
    current = row.parentID ?? undefined
  }

  if (!executionDirectory) throw new Error(`Session ${input.sessionID} has no execution directory`)

  if (input.expected.kind === "conversation") {
    if (taskOwners.size > 0) {
      throw new Error(`Session ${input.sessionID} has durable Task ownership but no explicit runtime Task authority`)
    }
    return Object.freeze({
      kind: "conversation",
      sessionID: input.sessionID,
      projectID: input.projectID,
      directory: executionDirectory,
    })
  }

  if (taskOwners.size !== 1 || !taskOwners.has(input.expected.taskID)) {
    throw new Error(
      `Session ${input.sessionID} Task ownership does not equal explicit runtime Task ${input.expected.taskID}`,
    )
  }
  const execution = await resolveTaskProcessExecution({ taskID: input.expected.taskID, cwd: executionDirectory })
  return Object.freeze({
    kind: "task",
    sessionID: input.sessionID,
    projectID: input.projectID,
    taskID: input.expected.taskID,
    directory: execution.kind === "task_native" ? execution.cwd : execution.capsule.cwd,
  })
}
