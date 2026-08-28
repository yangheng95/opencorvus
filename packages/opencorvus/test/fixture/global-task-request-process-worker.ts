import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { EngineTaskTable } from "@/engine/engine.sql"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { Instance } from "@/project/instance"
import { Database, eq } from "@/storage/db"
import { GlobalTaskService } from "@/task-api/global-task-service"
import { GlobalTaskRequestOwnerTestHooks } from "@/engine/task-creation-owner"

const [mode, barrierDirectory, requestID] = process.argv.slice(2)
if (!mode || !barrierDirectory || !requestID) {
  throw new Error("Global Task request worker requires mode, barrier directory and request ID")
}

declareNativeTaskProcessDeployment()

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

  if (mode !== "holder" && mode !== "contender") throw new Error(`Unknown worker mode: ${mode}`)
  using _ownerAttempt = GlobalTaskRequestOwnerTestHooks.replaceAfterProcessOwnerStarted(async () => {
    if (mode === "contender") {
      await fs.writeFile(path.join(barrierDirectory, "contender.owner-started"), "started")
    }
  })
  using _lookupCut = GlobalTaskService.TestHooks.replaceAfterReplayLookup(async ({ committed }) => {
    await fs.writeFile(path.join(barrierDirectory, `${mode}.lookup`), JSON.stringify({ committed }))
    if (mode !== "holder") return
    while (!(await fs.stat(path.join(barrierDirectory, "holder.release")).catch(() => undefined))) {
      await Bun.sleep(5)
    }
  })
  const result = await GlobalTaskService.create({
    title: "Cross-process global request",
    request: "Create exactly one Task across two backend processes",
    productPillar: "code",
    source: "test",
    requestID,
  })
  const rows = Database.use((db) =>
    db.select().from(EngineTaskTable).where(eq(EngineTaskTable.request_id, requestID)).all(),
  )
  return { result, rows: rows.map((row) => ({ id: row.id, projectID: row.project_id })) }
}

try {
  const output = await run()
  await Instance.disposeAll()
  console.log(JSON.stringify(output))
  Database.close()
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
