import z from "zod"
import { CreateTaskInput } from "@/engine/model"
import { InstanceBootstrap } from "@/project/bootstrap"
import { ImplicitProject } from "@/project/implicit-project"
import { Instance } from "@/project/instance"
import { EngineService } from "./index"

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
      await carryingProject.discard()
      throw error
    }
  }
}
