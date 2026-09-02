import fs from "node:fs/promises"
import path from "node:path"
import { EngineService } from "@/task-api"
import { Instance } from "@/project/instance"
import { Database } from "@/storage/db"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"

const [projectDirectory, taskID, sessionID, requestID, message, barrierDirectory, label] = process.argv.slice(2)
if (!projectDirectory || !taskID || !sessionID || !requestID || !message || !barrierDirectory || !label) {
  throw new Error("Operator-steer process worker requires project, task, session, request, message, barrier, and label")
}

declareNativeTaskProcessDeployment()

try {
  const result = await Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      await fs.writeFile(path.join(barrierDirectory, `${label}.ready`), "ready")
      while (!(await fs.stat(path.join(barrierDirectory, "go")).catch(() => undefined))) await Bun.sleep(5)
      return EngineService.operatorSteerAgentSession(
        taskID,
        sessionID,
        { request_id: requestID, message },
        async () => {
          await fs.writeFile(path.join(barrierDirectory, `${label}.dispatch`), "dispatched")
          return "accepted" as const
        },
      )
    },
  })
  console.log(JSON.stringify(result))
  await Instance.disposeAll()
  Database.close()
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
