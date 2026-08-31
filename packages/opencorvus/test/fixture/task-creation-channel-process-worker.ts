import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import {
  EngineChannelBindingTable,
  EngineTaskCreationContractTable,
  EngineTaskRootIngressTable,
  EngineTaskTable,
} from "@/engine/engine.sql"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { Server } from "@/server/server"
import { SessionTable } from "@/session/session.sql"
import { Database, eq } from "@/storage/db"
import { Project } from "@/project/project"

const [mode, barrierDirectory, projectDirectory, requestID, label, revisionText, channelOccurrence] = process.argv.slice(2)
if (!mode || !barrierDirectory || !projectDirectory || !requestID) {
  throw new Error("Task channel process worker requires mode, barrier, Project directory and request ID")
}

declareNativeTaskProcessDeployment()

const channelBinding = {
  platform: "test-channel",
  channel: "canonical-create",
  thread: channelOccurrence || requestID,
  payload: { revision: Number(revisionText ?? "1") },
}

async function request() {
  const response = await Server.App().request("/task", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-opencorvus-directory": projectDirectory,
      "x-opencorvus-request-id": requestID,
    },
    body: JSON.stringify({
      title: "Cross-process channel identity",
      request: "Create exactly one Task through the project HTTP surface",
      productPillar: "code",
      source: "test",
      channelBinding,
    }),
  })
  return { status: response.status, body: await response.json() }
}

async function inspect() {
  return Instance.provide({
    directory: projectDirectory,
    init: InstanceBootstrap,
    fn: () =>
      Database.use((db) => {
        const tasks = db
          .select({ id: EngineTaskTable.id, sessionID: EngineTaskTable.session_id })
          .from(EngineTaskTable)
          .where(eq(EngineTaskTable.request_id, requestID))
          .all()
        const taskIDs = new Set(tasks.map((task) => task.id))
        return {
          tasks,
          contracts: db
            .select({ taskID: EngineTaskCreationContractTable.task_id })
            .from(EngineTaskCreationContractTable)
            .all()
            .filter((row) => taskIDs.has(row.taskID)),
          bindings: db
            .select({ taskID: EngineChannelBindingTable.task_id, payload: EngineChannelBindingTable.payload })
            .from(EngineChannelBindingTable)
            .all()
            .filter((row) => taskIDs.has(row.taskID)),
          ingresses: db
            .select({ taskID: EngineTaskRootIngressTable.task_id })
            .from(EngineTaskRootIngressTable)
            .all()
            .filter((row) => taskIDs.has(row.taskID)),
          rootSessions: db
            .select({ id: SessionTable.id })
            .from(SessionTable)
            .all()
            .filter((row) => tasks.some((task) => task.sessionID === row.id)),
        }
      }),
  })
}

async function run() {
  if (mode === "init") {
    await Config.updateGlobalPatch({
      model: "channel-create-provider/channel-create-model",
      provider: {
        "channel-create-provider": {
          name: "Channel creation test provider",
          npm: "@ai-sdk/openai-compatible",
          api: "http://127.0.0.1:9/channel-create-model",
          models: {
            "channel-create-model": {
              name: "Channel creation test model",
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
  if (mode === "register-project") {
    const registered = await Project.fromDirectory(projectDirectory)
    return { registered: true, projectID: registered.project.id }
  }
  if (mode === "race") {
    if (!label) throw new Error("Task channel race worker requires a label")
    const barrierKey = channelOccurrence || requestID
    await fs.writeFile(path.join(barrierDirectory, `${barrierKey}-${label}.ready`), "ready")
    while (!(await fs.stat(path.join(barrierDirectory, `${barrierKey}.go`)).catch(() => undefined))) await Bun.sleep(5)
  }
  return request()
}

try {
  console.log(JSON.stringify(await run()))
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
