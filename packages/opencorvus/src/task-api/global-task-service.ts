import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import { EngineService } from "./index"
import {
  GlobalCreationAcceptedTargetConflictError,
  GlobalCreationAcceptedTargetUnavailableError,
  GlobalCreationAllocation,
} from "@/project/global-creation-allocation"
import {
  GlobalTaskCreateInput,
  globalTaskCreateInputContract,
} from "./global-task-request"
import { Config } from "@/config/config"
import { Database, and, eq } from "@/storage/db"
import { EngineTaskTable } from "@/engine/engine.sql"
import { ProjectTable } from "@/project/project.sql"
import { taskDeletedInTransaction } from "@/engine/store"
import {
  TaskChannelBindingGlobalCreationConflictError,
  TaskChannelBindingProjectConflictError,
} from "@/engine/task-project-error"

function acceptTaskWinner(allocationID: string, taskID: string): void {
  try {
    Database.immediateTransaction((db) => {
      const task = db
        .select({ projectID: EngineTaskTable.project_id, acceptedAt: EngineTaskTable.time_created })
        .from(EngineTaskTable)
        .where(eq(EngineTaskTable.id, taskID))
        .get()
      if (!task) throw new Error(`Global Task winner ${taskID} is not persisted`)
      GlobalCreationAllocation.acceptInTransaction(db, {
        allocationID,
        kind: "global_task",
        projectID: task.projectID,
        targetID: taskID,
        acceptedAt: task.acceptedAt,
      })
    })
  } catch (error) {
    if (!GlobalCreationAcceptedTargetConflictError.isInstance(error as Error)) throw error
    const outcome = GlobalCreationAllocation.reject({ allocationID, error: error as Error })
    if (outcome === "accepted") return
    throw error
  }
}

let afterAllocationForTest:
  | ((input: { requestID: string; directory: string }) => void | Promise<void>)
  | undefined
let afterProjectForTest:
  | ((input: { requestID: string; projectID: string; directory: string }) => void | Promise<void>)
  | undefined

export const GlobalTaskRequestIdentityRequiredError = NamedError.create(
  "GlobalTaskRequestIdentityRequiredError",
  z.object({ message: z.string() }),
)

export namespace GlobalTaskService {
  export const TestHooks = {
    replaceAfterAllocation(
      hook: (input: { requestID: string; directory: string }) => void | Promise<void>,
    ): Disposable {
      if (afterAllocationForTest) throw new Error("Global Task allocation hook is already installed")
      afterAllocationForTest = hook
      return {
        [Symbol.dispose]() {
          if (afterAllocationForTest === hook) afterAllocationForTest = undefined
        },
      }
    },
    replaceAfterProjectMaterialized(
      hook: (input: { requestID: string; projectID: string; directory: string }) => void | Promise<void>,
    ): Disposable {
      if (afterProjectForTest) throw new Error("Global Task Project hook is already installed")
      afterProjectForTest = hook
      return {
        [Symbol.dispose]() {
          if (afterProjectForTest === hook) afterProjectForTest = undefined
        },
      }
    },
  }

  export async function create(raw: z.input<typeof GlobalTaskCreateInput>) {
    const input = GlobalTaskCreateInput.parse(raw)
    const requestID = input.requestID?.trim()
    if (!requestID) {
      throw new GlobalTaskRequestIdentityRequiredError({
        message: "Global Task creation requires requestID or x-opencorvus-request-id",
      })
    }
    const requestContract = globalTaskCreateInputContract(input)
    let allocation = GlobalCreationAllocation.find({ kind: "global_task", requestID, requestContract })
    if (!allocation) {
      // A new occurrence resolves every mutable host default before it owns a
      // directory. If a peer wins during that read-only preflight, reread the
      // immutable allocation and join it instead of consulting current defaults.
      const configSnapshot = await Config.getGlobal()
      let preflight: Awaited<ReturnType<typeof EngineService.preflightGlobalTaskCreation>>
      try {
        preflight = await EngineService.preflightGlobalTaskCreation({
          raw: input,
          requestID,
          configSnapshot,
        })
      } catch (error) {
        allocation = GlobalCreationAllocation.find({ kind: "global_task", requestID, requestContract })
        if (!allocation) throw error
      }
      allocation ??= GlobalCreationAllocation.reserve({
        kind: "global_task",
        requestID,
        requestContract,
        resolutionSeed: configSnapshot,
        taskResolution: preflight!.taskResolution,
      })
    }
    if (!allocation.task_resolution) {
      throw new Error(`Global Task allocation ${allocation.id} has no frozen Task resolution`)
    }
    GlobalCreationAllocation.throwIfRejected(allocation)
    const accepted = GlobalCreationAllocation.acceptedTarget(allocation)
    if (accepted) {
      const target = Database.use((db) =>
        {
          const row = db
          .select({ taskID: EngineTaskTable.id, projectID: ProjectTable.id, directory: ProjectTable.worktree })
          .from(EngineTaskTable)
          .innerJoin(ProjectTable, eq(ProjectTable.id, EngineTaskTable.project_id))
          .where(
            and(
              eq(EngineTaskTable.id, accepted.targetID),
              eq(EngineTaskTable.project_id, accepted.projectID),
            ),
          )
          .get()
          return row && !taskDeletedInTransaction(db, row.taskID) ? row : undefined
        },
      )
      if (!target) {
        throw new GlobalCreationAcceptedTargetUnavailableError({
          message:
            `Global Task request ${requestID} was accepted as ${accepted.targetID}, ` +
            "but that retained target is no longer available",
          kind: "global_task",
          requestID,
          projectID: accepted.projectID,
          targetID: accepted.targetID,
          directory: allocation.directory,
        })
      }
      return Instance.provide({
        directory: target.directory,
        init: InstanceBootstrap,
        fn: async () => {
          const replayedTaskID = await EngineService.createTask(input, { actor: "user" }, {
            taskConfigSnapshot: allocation.resolution_seed as Config.Info,
            taskResolution: allocation.task_resolution,
          })
          if (replayedTaskID !== target.taskID || Instance.project.id !== target.projectID) {
            throw new Error(`Global Task allocation ${allocation.id} replayed another accepted target`)
          }
          return {
            task_id: replayedTaskID,
            project_id: target.projectID,
            directory: target.directory,
          }
        },
      })
    }
    await afterAllocationForTest?.({ requestID, directory: allocation.directory })
    const carryingProject = await GlobalCreationAllocation.materializeProject(allocation)
    await afterProjectForTest?.({
      requestID,
      projectID: carryingProject.project.id,
      directory: carryingProject.directory,
    })
    return Instance.provide({
      directory: carryingProject.directory,
      init: InstanceBootstrap,
      fn: async () => {
        let taskID: string
        try {
          taskID = await EngineService.createTask(input, { actor: "user" }, {
            taskConfigSnapshot: allocation.resolution_seed as Config.Info,
            taskResolution: allocation.task_resolution,
            acceptanceCommit: (db, acceptedTask) =>
              GlobalCreationAllocation.acceptInTransaction(db, {
                allocationID: allocation.id,
                kind: "global_task",
                projectID: acceptedTask.projectID,
                targetID: acceptedTask.taskID,
                acceptedAt: acceptedTask.acceptedAt,
              }),
          })
        } catch (error) {
          if (
            TaskChannelBindingProjectConflictError.isInstance(error as Error) ||
            TaskChannelBindingGlobalCreationConflictError.isInstance(error as Error)
          ) {
            const outcome = GlobalCreationAllocation.reject({ allocationID: allocation.id, error: error as Error })
            if (outcome === "accepted") return GlobalTaskService.create(raw)
          }
          throw error
        }
        // A Task committed by another production entry can satisfy the exact
        // request claim before this Global call. Append the same allocation
        // acceptance before returning; a crash here is idempotently replayed.
        acceptTaskWinner(allocation.id, taskID)
        return {
          task_id: taskID,
          project_id: Instance.project.id,
          directory: Instance.directory,
        }
      },
    })
  }
}
