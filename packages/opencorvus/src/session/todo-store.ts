import { Bus } from "@/bus"
import { Database, asc, eq, inArray } from "../storage/db"
import { TodoSnapshotTable, TodoTable } from "./session.sql"
import { Todo } from "./todo"

export namespace TodoStore {
  export interface Snapshot {
    todos: Todo.Info[]
    updatedAt: number
  }

  export function update(input: { sessionID: string; todos: Todo.Info[] }) {
    const updatedAt = Database.transaction((db) => {
      const current = db
        .select({ revision: TodoSnapshotTable.revision })
        .from(TodoSnapshotTable)
        .where(eq(TodoSnapshotTable.session_id, input.sessionID))
        .get()
      const revision = Math.max(Date.now(), (current?.revision ?? 0) + 1)
      db.insert(TodoSnapshotTable)
        .values({ session_id: input.sessionID, revision })
        .onConflictDoUpdate({
          target: TodoSnapshotTable.session_id,
          set: { revision },
        })
        .run()
      db.delete(TodoTable).where(eq(TodoTable.session_id, input.sessionID)).run()
      if (input.todos.length > 0) {
        db.insert(TodoTable)
          .values(
            input.todos.map((todo, position) => ({
              session_id: input.sessionID,
              content: todo.content,
              status: todo.status,
              priority: todo.priority,
              position,
            })),
          )
          .run()
      }
      return revision
    })
    return Bus.publish(Todo.Event.Updated, { ...input, updatedAt })
  }

  export function get(sessionID: string) {
    const rows = Database.use((db) =>
      db.select().from(TodoTable).where(eq(TodoTable.session_id, sessionID)).orderBy(asc(TodoTable.position)).all(),
    )
    return rows.map((row) =>
      Todo.Info.parse({
        content: row.content,
        status: row.status,
        priority: row.priority,
      }),
    )
  }

  export function getBySessionIDs(sessionIDsInput: string[]): Map<string, Snapshot> {
    const sessionIDs = [...new Set(sessionIDsInput.map((sessionID) => sessionID.trim()).filter(Boolean))]
    const snapshots = new Map<string, Snapshot>(sessionIDs.map((sessionID) => [sessionID, { todos: [], updatedAt: 0 }]))
    if (sessionIDs.length === 0) return snapshots
    const [rows, revisions] = Database.use((db) => [
      db
        .select()
        .from(TodoTable)
        .where(inArray(TodoTable.session_id, sessionIDs))
        .orderBy(asc(TodoTable.session_id), asc(TodoTable.position))
        .all(),
      db.select().from(TodoSnapshotTable).where(inArray(TodoSnapshotTable.session_id, sessionIDs)).all(),
    ])
    for (const row of revisions) {
      const snapshot = snapshots.get(row.session_id)
      if (!snapshot) {
        throw new Error(`TodoStore.getBySessionIDs returned unrequested snapshot ${row.session_id}`)
      }
      snapshot.updatedAt = row.revision
    }
    for (const row of rows) {
      const snapshot = snapshots.get(row.session_id)
      if (!snapshot) {
        throw new Error(`TodoStore.getBySessionIDs returned unrequested session ${row.session_id}`)
      }
      snapshot.todos.push(
        Todo.Info.parse({
          content: row.content,
          status: row.status,
          priority: row.priority,
        }),
      )
    }
    return snapshots
  }
}
