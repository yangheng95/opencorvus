import z from "zod"
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
