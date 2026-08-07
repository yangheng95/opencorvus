import z from "zod"
import { Identifier } from "@/id/id"
import { fn } from "@/util/fn"
import { Database, NotFoundError, and, eq } from "@/storage/db"
import { Project } from "@/project/project"
import { Instance } from "@/project/instance"
import { BusEvent } from "@/bus/bus-event"
import { GlobalBus } from "@/bus/global"
import { Worktree } from "@/worktree"
import { WorkspaceTable } from "./workspace.sql"
import { Config } from "./config"

export namespace Workspace {
  export const Event = {
    Ready: BusEvent.define(
      "workspace.ready",
      z.object({
        name: z.string(),
      }),
    ),
    Failed: BusEvent.define(
      "workspace.failed",
      z.object({
        message: z.string(),
      }),
    ),
  }

  export const Info = z
    .object({
      id: Identifier.schema("workspace"),
      branch: z.string().nullable(),
      projectID: z.string(),
      config: Config,
    })
    .meta({
      ref: "Workspace",
    })
  export type Info = z.infer<typeof Info>

  function fromRow(row: typeof WorkspaceTable.$inferSelect): Info {
    return {
      id: row.id,
      branch: row.branch,
      projectID: row.project_id,
      config: row.config,
    }
  }

  export const create = fn(
    z.object({
      id: Identifier.schema("workspace").optional(),
      projectID: Info.shape.projectID,
    }),
    async (input) => {
      const id = Identifier.ascending("workspace", input.id)

      const worktree = await Worktree.create(undefined)
      const config = { type: "worktree" as const, directory: worktree.directory }

      const info: Info = {
        id,
        projectID: input.projectID,
        branch: worktree.branch,
        config,
      }

      try {
        Database.transaction((db) => {
          db.insert(WorkspaceTable)
            .values({
              id: info.id,
              branch: info.branch,
              project_id: info.projectID,
              config: info.config,
            })
            .run()
        })
      } catch (error) {
        try {
          await Worktree.remove({ directory: worktree.directory })
          await Project.removeSandbox(input.projectID, worktree.directory)
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            `Workspace persistence failed and worktree rollback failed: ${worktree.directory}`,
          )
        }
        throw error
      }

      GlobalBus.emit("event", {
        directory: Instance.directory,
        payload: {
          type: Event.Ready.type,
          properties: {
            name: worktree.name,
          },
        },
      })

      return info
    },
  )

  export function list(project: Project.Info) {
    const rows = Database.use((db) =>
      db.select().from(WorkspaceTable).where(eq(WorkspaceTable.project_id, project.id)).all(),
    )
    return rows.map(fromRow).sort((a, b) => a.id.localeCompare(b.id))
  }

  export const get = fn(Identifier.schema("workspace"), async (id) => {
    const row = Database.use((db) => db.select().from(WorkspaceTable).where(eq(WorkspaceTable.id, id)).get())
    if (!row) return
    return fromRow(row)
  })

  export const remove = fn(
    z.object({
      id: Identifier.schema("workspace"),
      projectID: Info.shape.projectID,
    }),
    async (input) => {
      const row = Database.use((db) =>
        db
          .select()
          .from(WorkspaceTable)
          .where(and(eq(WorkspaceTable.id, input.id), eq(WorkspaceTable.project_id, input.projectID)))
          .get(),
      )
      if (!row) throw new NotFoundError({ message: `Workspace not found: ${input.id}` })
      const info = fromRow(row)
      await Worktree.remove({ directory: info.config.directory })
      Database.use((db) =>
        db
          .delete(WorkspaceTable)
          .where(and(eq(WorkspaceTable.id, input.id), eq(WorkspaceTable.project_id, input.projectID)))
          .run(),
      )
      return info
    },
  )
}
