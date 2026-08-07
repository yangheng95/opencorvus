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
      })
      .from(SessionTable)
      .where(eq(SessionTable.id, sessionID))
      .get(),
  )
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
      .all<{ id: string }>(sql`
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
      `)
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

export type SessionProcessAuthority =
  | Readonly<{ kind: "host"; sessionID: string; projectID: string; cwd: string }>
  | Readonly<{ kind: "task"; sessionID: string; projectID: string; taskID: string; cwd: string }>

/** Resolve a process owner from a complete durable Session lineage and an explicit runtime Task identity. */
export async function resolveSessionProcessAuthority(input: {
  sessionID: string
  projectID: string
  rootDirectory: string
  cwd: string
  runtimeTaskID?: string
}): Promise<SessionProcessAuthority> {
  const visited = new Set<string>()
  const taskOwners = new Set<string>()
  let current: string | undefined = input.sessionID
  while (current) {
    if (visited.has(current)) throw new Error(`Session lineage contains a cycle at ${current}`)
    visited.add(current)
    const row = Database.use((db) =>
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
    if (path.resolve(row.directory) !== path.resolve(input.rootDirectory)) {
      throw new Error(`Session ${current} directory ${row.directory} does not match process root ${input.rootDirectory}`)
    }
    const owners = Database.use((db) =>
      db.select({ id: EngineTaskTable.id }).from(EngineTaskTable).where(eq(EngineTaskTable.session_id, current!)).all(),
    )
    for (const owner of owners) taskOwners.add(owner.id)
    current = row.parentID ?? undefined
  }

  if (!input.runtimeTaskID) {
    if (taskOwners.size > 0) {
      throw new Error(`Session ${input.sessionID} has durable Task ownership but no explicit runtime Task authority`)
    }
    return Object.freeze({
      kind: "host",
      sessionID: input.sessionID,
      projectID: input.projectID,
      cwd: path.resolve(input.cwd),
    })
  }

  if (taskOwners.size !== 1 || !taskOwners.has(input.runtimeTaskID)) {
    throw new Error(
      `Session ${input.sessionID} Task ownership does not equal explicit runtime Task ${input.runtimeTaskID}`,
    )
  }
  const execution = await resolveTaskProcessExecution({ taskID: input.runtimeTaskID, cwd: input.cwd })
  return Object.freeze({
    kind: "task",
    sessionID: input.sessionID,
    projectID: input.projectID,
    taskID: input.runtimeTaskID,
    cwd: execution.kind === "task_native" ? execution.cwd : execution.capsule.cwd,
  })
}
