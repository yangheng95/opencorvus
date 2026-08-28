import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { GlobalConversationService } from "@/chat/global-chat-service"
import { GlobalChatStartIdentityConflictError, startGlobalChat } from "@/chat/global-chat-start"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { ImplicitProject } from "@/project/implicit-project"
import { Project } from "@/project/project"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { SessionWake } from "@/session/wake"
import { Database } from "@/storage/db"

const [mode, barrierDirectory, requestID, apiURL, label, textOverride] = process.argv.slice(2)
if (!mode || !barrierDirectory || !requestID || !apiURL) {
  throw new Error("Global Chat start process worker requires mode, barrier directory, and request identity")
}

declareNativeTaskProcessDeployment()

const model = { providerID: "global-chat-process-test", modelID: "stream-model" }
const body = { requestID, text: textOverride ?? `Cross-process global Chat ${requestID}` }

function startIdentity() {
  const material = `global.chat.start.v1\0${requestID}`
  return {
    sessionID: Identifier.deterministic("session", material),
    messageID: Identifier.deterministic("message", `${material}\0message`),
    textPartID: Identifier.deterministic("part", `${material}\0text`),
    requestFingerprint: createHash("sha256")
      .update(JSON.stringify({ text: body.text, attachments: [], model: null }))
      .digest("hex"),
  }
}

async function createSessionOnly() {
  const identity = startIdentity()
  const created = await GlobalConversationService.create({
    experience: "chat",
    sessionID: identity.sessionID,
    creationMetadata: {
      globalChatStart: {
        version: 1,
        requestID,
        requestFingerprint: identity.requestFingerprint,
        messageID: identity.messageID,
      },
    },
  })
  return { ...identity, session: created.session }
}

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
      status: GlobalChatStartIdentityConflictError.isInstance(error as Error) ? 409 : 500,
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

  if (mode === "race") {
    if (!label) throw new Error("Race worker requires a label")
    await fs.writeFile(path.join(barrierDirectory, `${requestID}-${label}.ready`), "ready")
    while (!(await fs.stat(path.join(barrierDirectory, `${requestID}.go`)).catch(() => undefined))) await Bun.sleep(5)
    return start()
  }
  if (mode === "cut-session") {
    await createSessionOnly()
    process.exit(86)
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
  Database.close()
  process.exit(0)
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
