import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { EngineTaskCreationContractTable, EngineTaskTable } from "@/engine/engine.sql"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { Database, eq } from "@/storage/db"
import { GlobalTaskService } from "@/task-api/global-task-service"
import { TaskCreationCommitTestHooks } from "@/task-api"
import { GlobalCreationAllocationTable, ProjectTable } from "@/project/project.sql"
import { ProjectRuntimePaths } from "@/project/runtime-paths"

const [mode, barrierDirectory, requestID] = process.argv.slice(2)
if (!mode || !barrierDirectory || !requestID) {
  throw new Error("Global Task request worker requires mode, barrier directory and request ID")
}

declareNativeTaskProcessDeployment()

const input = {
  title: "Cross-process global request",
  request: "Create exactly one Task after allocation-owner death",
  productPillar: "code" as const,
  source: "test",
  requestID,
}

function inspect() {
  return Database.use((db) => {
    const tasks = db
      .select({ id: EngineTaskTable.id, projectID: EngineTaskTable.project_id })
      .from(EngineTaskTable)
      .where(eq(EngineTaskTable.request_id, requestID))
      .all()
    const taskIDs = new Set(tasks.map((task) => task.id))
    return {
      allocations: db
      .select()
      .from(GlobalCreationAllocationTable)
      .where(eq(GlobalCreationAllocationTable.request_id, requestID))
      .all()
      .map((row) => ({
        directory: row.directory,
        fingerprint: row.request_fingerprint,
        projectID: row.accepted_project_id,
        materializedProjectID: row.materialized_project_id,
        materializedProjectGeneration: row.materialized_project_generation,
        targetID: row.accepted_target_id,
        taskResolution: row.task_resolution,
      })),
      tasks,
      contracts: db
        .select({ taskID: EngineTaskCreationContractTable.task_id, contract: EngineTaskCreationContractTable.contract })
        .from(EngineTaskCreationContractTable)
        .all()
        .filter((row) => taskIDs.has(row.taskID)),
      projectCount: db.select({ id: ProjectTable.id }).from(ProjectTable).all().length,
    }
  })
}

async function run() {
  if (mode === "init") {
    await Config.updateGlobalPatch({
      model: "global-owner-provider/global-owner-model",
      provider: {
        "global-owner-provider": {
          name: "Global owner test provider",
          npm: "@ai-sdk/openai-compatible",
          api: "http://127.0.0.1:9/global-owner-model",
          models: {
            "global-owner-model": {
              name: "Global owner test model",
              tool_call: true,
              modalities: { input: ["text"], output: ["text"] },
              limit: { context: 1_000_000, output: 4_096 },
            },
          },
        },
      },
    })
    Database.Client()
    return { initialized: true }
  }
  if (mode === "inspect") return inspect()
  if (mode === "delete-materialized") {
    const projectID = Database.use((db) =>
      db
        .select({ projectID: GlobalCreationAllocationTable.materialized_project_id })
        .from(GlobalCreationAllocationTable)
        .where(eq(GlobalCreationAllocationTable.request_id, requestID))
        .get()?.projectID,
    )
    if (!projectID) throw new Error(`Global Task request ${requestID} has no materialized Project`)
    let error: unknown
    try {
      Database.immediateTransaction((db) => db.delete(ProjectTable).where(eq(ProjectTable.id, projectID)).run())
    } catch (cause) {
      error = cause
    }
    return {
      deletionError: error instanceof Error ? error.message : undefined,
      ...inspect(),
    }
  }
  if (mode === "cut") {
    using _cut = GlobalTaskService.TestHooks.replaceAfterAllocation(async ({ directory }) => {
      await fs.writeFile(path.join(barrierDirectory, "allocation.ready.json"), JSON.stringify({ directory }))
      await new Promise<never>(() => undefined)
    })
    await GlobalTaskService.create(input)
    throw new Error("allocation cut unexpectedly returned")
  }
  if (mode === "cut-committed") {
    using _cut = TaskCreationCommitTestHooks.installBeforeAcceptedReconciliation(() => process.exit(88))
    await GlobalTaskService.create(input)
    throw new Error("committed Task cut unexpectedly returned")
  }
  if (mode === "cut-resolved") {
    using _cut = TaskCreationCommitTestHooks.installBeforePersist(() => process.exit(89))
    await GlobalTaskService.create(input)
    throw new Error("resolved Task cut unexpectedly returned")
  }
  if (mode === "mutate-defaults") {
    await Config.updateGlobalPatch({
      model: "global-owner-provider/global-owner-model-2",
      provider: {
        "global-owner-provider": {
          name: "Global owner test provider",
          npm: "@ai-sdk/openai-compatible",
          api: "http://127.0.0.1:9/global-owner-model",
          models: {
            "global-owner-model": {
              name: "Global owner test model",
              tool_call: true,
              modalities: { input: ["text"], output: ["text"] },
              limit: { context: 1_000_000, output: 4_096 },
            },
            "global-owner-model-2": {
              name: "Changed global owner default",
              tool_call: true,
              modalities: { input: ["text"], output: ["text"] },
              limit: { context: 1_000_000, output: 4_096 },
            },
          },
        },
      },
    })
    return { mutated: true }
  }
  if (mode === "recover") {
    const result = await GlobalTaskService.create(input)
    const intentPath = ProjectRuntimePaths.intentPaths(result.directory, result.task_id).absolute
    const deadline = Date.now() + 30_000
    while (!(await fs.stat(intentPath).catch(() => undefined))) {
      if (Date.now() >= deadline) throw new Error(`Task ${result.task_id} intent projection was not materialized`)
      await Bun.sleep(10)
    }
    const intent = await fs.readFile(intentPath, "utf8")
    return { result, intent, ...inspect() }
  }
  throw new Error(`Unknown worker mode: ${mode}`)
}

try {
  const output = await run()
  console.log(JSON.stringify(output))
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
