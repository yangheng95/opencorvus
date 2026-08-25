import z from "zod"
import { findGlobalTaskByRequest } from "@/engine/store"
import { CreateTaskInput } from "@/engine/model"
import { InstanceBootstrap } from "@/project/bootstrap"
import { ImplicitProject } from "@/project/implicit-project"
import { Instance } from "@/project/instance"
import { EngineService } from "./index"
import { deleteProject } from "@/project/delete"
import { randomUUID } from "node:crypto"

export namespace GlobalTaskService {
  export async function create(raw: z.input<typeof CreateTaskInput>) {
    const input = CreateTaskInput.parse(raw)
    // The request identity must resolve BEFORE a Project is allocated: a
    // retry that allocates first can never find the first attempt, because
    // the per-project lookup is scoped to the Project it just created — a
    // lost response then duplicated the Project and the Task.
    const requestID = input.requestID?.trim() || undefined
    if (requestID) {
      const committed = findGlobalTaskByRequest(requestID, ImplicitProject.isAnonymousDirectory)
      if (committed) {
        // Re-entering the owning Project runs the same per-project replay
        // path every create uses — one idempotency implementation, including
        // its pillar and artifact-import conflict checks.
        return await Instance.provide({
          directory: committed.directory,
          init: InstanceBootstrap,
          fn: async () => {
            const taskID = await EngineService.createTask(input, { actor: "user" })
            return {
              task_id: taskID,
              project_id: Instance.project.id,
              directory: Instance.directory,
            }
          },
        })
      }
    }
    const carryingProject = await ImplicitProject.create()
    try {
      return await Instance.provide({
        directory: carryingProject.directory,
        init: InstanceBootstrap,
        fn: async () => {
          const taskID = await EngineService.createTask(input, { actor: "user" })
          return {
            task_id: taskID,
            project_id: Instance.project.id,
            directory: Instance.directory,
          }
        },
      })
    } catch (error) {
      await deleteProject(carryingProject.project, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: randomUUID(),
        reason: "Discard failed global Task Project creation",
      })
      throw error
    }
  }
}
