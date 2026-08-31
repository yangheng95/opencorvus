import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import {
  GlobalChatStartIdentityConflictError,
  GlobalChatStartTestHooks,
  startGlobalChat,
} from "@/chat/global-chat-start"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ImplicitProject } from "@/project/implicit-project"
import { Project } from "@/project/project"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { SessionWake } from "@/session/wake"
import { Database } from "@/storage/db"
import { GlobalCreationAcceptedTargetUnavailableError } from "@/project/global-creation-allocation"
import { GlobalCreationAllocationTable, ProjectTable } from "@/project/project.sql"
import { and, eq } from "drizzle-orm"
import { createRightSidebarConversationSession } from "@/chat/session"
import { InstanceBootstrap } from "@/project/bootstrap"
import {
  canonicalTaskCreationContract,
  taskCreationContractFingerprint,
} from "@/engine/task-creation-contract"

const [mode, barrierDirectory, requestID, apiURL, label, textOverride] = process.argv.slice(2)
if (!mode || !barrierDirectory || !requestID || !apiURL) {
  throw new Error("Global Chat start process worker requires mode, barrier directory, and request identity")
}

declareNativeTaskProcessDeployment()

const model = { providerID: "global-chat-process-test", modelID: "stream-model" }
const body = { requestID, text: textOverride ?? `Cross-process global Chat ${requestID}` }

async function start() {
  try {
    const value = await startGlobalChat(body)
    if (label) await fs.writeFile(path.join(barrierDirectory, `${requestID}-${label}.accepted`), "accepted")
    const deadline = Date.now() + 30_000
    while (true) {
      const settled = (await Session.messages({ sessionID: value.session.id })).find(
        (message) =>
          message.info.role === "assistant" &&
          Message.acceptsInputMessage(message.info, value.messageID) &&
          message.info.time.completed !== undefined,
      )
      if (settled) break
      if (Date.now() >= deadline) throw new Error(`Global Chat ${value.session.id} did not settle its assistant reply`)
      await Bun.sleep(10)
    }
    return {
      status: 202,
      sessionID: value.session.id,
      messageID: value.messageID,
      directory: value.session.directory,
    }
  } catch (error) {
    return {
      status: GlobalChatStartIdentityConflictError.isInstance(error as Error)
        ? 409
        : GlobalCreationAcceptedTargetUnavailableError.isInstance(error as Error)
          ? 410
          : 500,
      error: {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    }
  }
}

async function inspect() {
  const material = `global.chat.start.v1\0${requestID}`
  const sessionID = Identifier.deterministic("session", material)
  const messageID = Identifier.deterministic("message", `${material}\0message`)
  const session = await Session.get(sessionID)
  const messages = await Session.messages({ sessionID })
  const assistant = messages.filter(
    (message) => message.info.role === "assistant" && Message.acceptsInputMessage(message.info, messageID),
  )
  const allocation = Database.use((db) =>
    db
      .select()
      .from(GlobalCreationAllocationTable)
      .where(
        and(
          eq(GlobalCreationAllocationTable.kind, "global_chat_start"),
          eq(GlobalCreationAllocationTable.request_id, requestID),
        ),
      )
      .get(),
  )
  if (!allocation) throw new Error(`Global Chat ${requestID} has no allocation`)
  return {
    sessionID: session.id,
    messageID,
    userCount: messages.filter((message) => message.info.id === messageID && message.info.role === "user").length,
    assistantCount: assistant.length,
    assistantStates: assistant.map((message) => ({
      id: message.info.id,
      finish: message.info.finish,
      error: message.info.error,
    })),
    assistantTexts: assistant.flatMap((message) =>
      message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])),
    ),
    anonymousProjectCount: Project.list().filter((project) => ImplicitProject.isAnonymousDirectory(project.worktree))
      .length,
    frozenModel: ((session.metadata as Record<string, any> | undefined)?.configOverlay as Record<string, unknown> | undefined)?.model,
    identityVersion: (session.metadata as Record<string, any> | undefined)?.globalChatStart?.version,
    allocationProtocol: allocation.request_contract.protocol,
    allocationFingerprint: allocation.request_fingerprint,
    allocationCanonicalFingerprint: taskCreationContractFingerprint(
      canonicalTaskCreationContract(allocation.request_contract),
    ),
  }
}

async function run() {
  if (mode === "init") {
    await Config.updateGlobalPatch({
      model: `${model.providerID}/${model.modelID}`,
      provider: {
        [model.providerID]: {
          name: "Global Chat process test provider",
          npm: "@ai-sdk/openai-compatible",
          api: apiURL,
          models: {
            [model.modelID]: {
              name: "Global Chat process test model",
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
  if (mode === "replace-retained") {
    const sessionID = Identifier.deterministic("session", `global.chat.start.v1\0${requestID}`)
    const original = await Session.get(sessionID)
    const metadata = original.metadata ?? {}
    await Instance.disposeAll()
    Database.transaction((db) => db.delete(ProjectTable).where(eq(ProjectTable.id, original.projectID)).run())
    const replacement = await ImplicitProject.create()
    await Instance.provide({
      directory: replacement.directory,
      init: InstanceBootstrap,
      fn: () =>
        createRightSidebarConversationSession("chat", {
          id: sessionID,
          creationMetadata: metadata,
        }),
    })
    return { replaced: true, sessionID, projectID: replacement.project.id }
  }
  if (mode === "mutate-defaults") {
    await Config.updateGlobalPatch({
      model: `${model.providerID}/stream-model-2`,
      provider: {
        [model.providerID]: {
          name: "Global Chat process test provider",
          npm: "@ai-sdk/openai-compatible",
          api: apiURL,
          models: {
            [model.modelID]: {
              name: "Global Chat process test model",
              tool_call: true,
              modalities: { input: ["text"], output: ["text"] },
              limit: { context: 1_000_000, output: 4_096 },
            },
            "stream-model-2": {
              name: "Changed default model",
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

  if (mode === "race") {
    if (!label) throw new Error("Race worker requires a label")
    await fs.writeFile(path.join(barrierDirectory, `${requestID}-${label}.ready`), "ready")
    while (!(await fs.stat(path.join(barrierDirectory, `${requestID}.go`)).catch(() => undefined))) await Bun.sleep(5)
    return start()
  }
  if (mode === "cut-allocation") {
    using _cut = GlobalChatStartTestHooks.installAfterAllocation(() => process.exit(86))
    await start()
    await new Promise<never>(() => undefined)
  }
  if (mode === "cut-message") {
    using _activationCut = SessionWake.TestHooks.installBeforeWakeLoopActivation(() => process.exit(87))
    await start()
    await new Promise<never>(() => undefined)
  }
  if (mode === "recover") return start()
  throw new Error(`Unknown Global Chat start process worker mode: ${mode}`)
}

try {
  const output = await run()
  console.log(JSON.stringify(output))
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
