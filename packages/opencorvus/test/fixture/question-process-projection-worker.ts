import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "../../src/config/config"
import { Instance } from "../../src/project/instance"
import { Database, eq } from "../../src/storage/db"
import { Bus } from "../../src/bus"
import { BusPublicationOutboxTable, BusPublicationPhaseReceiptTable } from "../../src/bus/bus.sql"
import { Question } from "../../src/question"
import { Session } from "../../src/session"
import { Server } from "../../src/server/server"
import { SessionPromptOwner } from "../../src/session/prompt/owner"
import { Identifier } from "../../src/id/id"
import { declareNativeTaskProcessDeployment } from "../../src/runtime/task-process-deployment"
import { currentRuntimeProcessOccurrence } from "../../src/runtime/process-occurrence"
import { installProcessShims } from "../../src/runtime/shims"
import { installDefaultControlPlaneToolLoaders } from "../../src/tool/control-plane-tool-composition"

const [mode, runtime, evidence, providerURL, rawDeadline] = process.argv.slice(2)
if (
  !runtime ||
  !evidence ||
  !path.isAbsolute(runtime) ||
  !path.isAbsolute(evidence) ||
  !["crash", "recover"].includes(mode!)
)
  throw Error("Explicit own runtime, evidence and mode required")
const deadlineAt = Number(rawDeadline)
if (!Number.isFinite(deadlineAt) || deadlineAt <= Date.now() || deadlineAt > Date.now() + 180000)
  throw Error("Original child deadline must be within 180000ms")
if (process.env.OPENCORVUS_HOME !== runtime) throw Error("Child runtime binding differs from explicit scope")
const directory = path.join(runtime, "public-project")
const headers = { "content-type": "application/json", "x-opencorvus-directory": directory }
const model = { providerID: "question-crash-local", modelID: "session-prompt-owner-model" }
const controlModel = { providerID: "question-control-local", modelID: "session-prompt-owner-model" }
const receipts: any[] = []
let server: ReturnType<typeof Server.listen> | undefined
let prompt: Promise<unknown> | undefined
let stream: ReturnType<typeof readStream> | undefined
let streamAbort: AbortController | undefined
let suppression: Disposable | undefined
let crash = false
const write = (name: string, data: unknown) =>
  fs.writeFile(path.join(evidence, `${mode}-${name}.json`), JSON.stringify(data, null, 2) + "\n")
const until = async (check: () => Promise<boolean>, label: string) => {
  const end = Math.min(Date.now() + 30000, deadlineAt - 6000)
  while (!(await check())) {
    if (Date.now() >= end) throw Error(`Prerequisite exceeded bounded wait: ${label}`)
    await Bun.sleep(25)
  }
}
async function json(route: string, body?: unknown) {
  const response = await fetch(new URL(route, server!.url), {
    method: body === undefined ? "GET" : "POST",
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  })
  const text = await response.text()
  const data = JSON.parse(text)
  const receipt = { route, method: body === undefined ? "GET" : "POST", status: response.status, body: data }
  receipts.push(receipt)
  return receipt
}
function readStream(response: Response) {
  const reader = response.body!.getReader(),
    decoder = new TextDecoder()
  const events: any[] = [],
    pending: any[] = []
  let buffer = ""
  return {
    events,
    async next(type: string) {
      const end = Math.min(Date.now() + 30000, deadlineAt - 6000)
      for (;;) {
        const frames = buffer.split("\n\n")
        buffer = frames.pop()!
        for (const frame of frames) {
          const raw = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
          if (raw) {
            const event = JSON.parse(raw)
            events.push(event)
            pending.push(event)
          }
        }
        const index = pending.findIndex((event) => event.type === type)
        if (index >= 0) return pending.splice(index, 1)[0]
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
          const chunk = await Promise.race([
            reader.read(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject(Error(`Actual stream deadline waiting for ${type}`)),
                Math.max(1, end - Date.now()),
              )
            }),
          ])
          if (chunk.done) throw Error(`Actual stream closed before ${type}`)
          buffer += decoder.decode(chunk.value, { stream: true })
        } finally {
          clearTimeout(timer)
        }
      }
    },
    close: () => reader.cancel(),
  }
}
async function publication(request: Question.Request) {
  return Instance.provideProjectIdentity({
    directory,
    fn: () => {
      const facts = Question.publicationFacts({
        projectID: Instance.project.id,
        sessionID: request.sessionID,
        requestID: request.id,
      })
      const original = Database.use((db) =>
        db
          .select()
          .from(BusPublicationOutboxTable)
          .where(eq(BusPublicationOutboxTable.occurrence_id, facts.askedOccurrenceID))
          .get(),
      )!
      const phases = Database.use((db) =>
        db
          .select()
          .from(BusPublicationPhaseReceiptTable)
          .where(eq(BusPublicationPhaseReceiptTable.occurrence_id, facts.askedOccurrenceID))
          .all(),
      )
      const owner = SessionPromptOwner.current(request.sessionID)
      return {
        facts,
        original,
        phases,
        promptOwner: owner,
        ...(owner ? { ownerObservation: SessionPromptOwner.observation(owner) } : {}),
      }
    },
  })
}

try {
  installProcessShims()
  installDefaultControlPlaneToolLoaders()
  declareNativeTaskProcessDeployment()
  await fs.mkdir(directory, { recursive: true })
  await write("owner", {
    mode,
    pid: process.pid,
    occurrence: currentRuntimeProcessOccurrence(),
    startedAt: Date.now(),
    deadlineAt,
    directory,
    runtime,
  })
  if (mode === "crash") {
    await Instance.provide({
      directory,
      fn: async () => {
        await Config.updateGlobalPatch({
          model: `${model.providerID}/${model.modelID}`,
          small_model: `${model.providerID}/${model.modelID}`,
          permission_mode: "ask",
          prompt_profile: { active: "base" },
          enabled_providers: [model.providerID, controlModel.providerID],
          provider: {
            [model.providerID]: {
              npm: "@ai-sdk/openai-compatible",
              api: providerURL,
              options: { apiKey: "local-controlled-provider" },
              models: {
                [model.modelID]: {
                  name: "Public local Question crash probe",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1000000, output: 4096 },
                },
              },
            },
            [controlModel.providerID]: {
              npm: "@ai-sdk/openai-compatible",
              api: process.env.OPENCORVUS_QUESTION_PROJECTION_CONTROL_URL,
              options: { apiKey: "local-controlled-provider" },
              models: {
                [controlModel.modelID]: {
                  name: "Public local current Question control",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1000000, output: 4096 },
                },
              },
            },
          },
        })
        await Config.updateProjectPatch({ mcp: { browser: { enabled: false }, computer: { enabled: false } } })
      },
    })
  }
  server = Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })
  await write("listener", { url: server.url.toString(), directory, pid: process.pid, deadlineAt })
  if (mode === "crash") {
    const created = await json("/session", { kind: "assistant", title: "Public ordinary Question crash boundary" })
    if (created.status !== 200) throw Error(`Public Session creation returned ${created.status}`)
    const session = created.body
    const messageID = Identifier.ascending("message")
    suppression = Bus.TestHooks.suppressAutomaticDurableDrain()
    prompt = json(`/session/${session.id}/message`, {
      messageID,
      agent: "chat",
      model,
      parts: [
        {
          type: "text",
          text: "Ask the public question about Cedar. I will answer through the normal Question interface.",
        },
      ],
    })
    void prompt.catch((error) => {
      receipts.push({ route: "original prompt", error: String(error) })
    })
    let request: Question.Request | undefined
    await until(async () => {
      const current = await json("/question")
      if (current.status !== 200 || !Array.isArray(current.body))
        throw Error("Public Question list prerequisite failed")
      request = current.body.find((item: Question.Request) => item.sessionID === session.id)
      return Boolean(request)
    }, "actual Question Tool admission")
    const messages = await json(`/session/${session.id}/message`)
    const tool = messages.body
      .flatMap((entry: any) => entry.parts)
      .find((part: any) => part.type === "tool" && part.tool === "question")
    if (
      tool?.state?.status !== "running" ||
      request!.tool?.callID !== tool.callID ||
      request!.tool?.messageID !== tool.messageID
    )
      throw Error("Actual Question Tool binding differs from canonical Request")
    const fact = await publication(request!)
    if (
      fact.original.event_type !== "question.asked" ||
      fact.phases.some((phase) => phase.phase === "wildcard") ||
      fact.facts.terminal
    )
      throw Error("Original Asked commit/unsettled-wildcard checkpoint failed")
    await fs.writeFile(
      path.join(evidence, "checkpoint.json"),
      JSON.stringify(
        { session, messageID, request, tool, publication: fact, originalProcess: currentRuntimeProcessOccurrence() },
        null,
        2,
      ) + "\n",
    )
    await write("http", receipts)
    console.log(
      JSON.stringify({
        checkpoint: "real ordinary Question accepted; wildcard unsettled",
        sessionID: session.id,
        requestID: request!.id,
        exitCode: 23,
      }),
    )
    crash = true
    process.exit(23)
  }
  const checkpoint = JSON.parse(await fs.readFile(path.join(evidence, "checkpoint.json"), "utf8"))
  const request = Question.Request.parse(checkpoint.request)
  streamAbort = new AbortController()
  const response = await fetch(new URL(`/session/${request.sessionID}/events`, server.url), {
    headers,
    signal: AbortSignal.any([streamAbort.signal, AbortSignal.timeout(30000)]),
  })
  if (response.status !== 200) throw Error(`Cold public events returned ${response.status}: ${await response.text()}`)
  stream = readStream(response)
  const connected = await stream.next("session.connected")
  const cold = await json(`/session/${request.sessionID}/conversation`)
  await write("before-bootstrap", { connected, cold, publication: await publication(request) })
  const listed = await json("/question")
  await until(async () => {
    const observed = await publication(request)
    return ["exact", "wildcard", "global"].every((phase) => observed.phases.some((value) => value.phase === phase))
  }, "original publication's normal resumed delivery settlement")
  const after = await json(`/session/${request.sessionID}/conversation`)
  const reply = await json(`/question/${request.id}/reply`, { answers: [["Public recovered Cedar answer"]] })
  const fact = await publication(request)
  const originalMessages = await json(`/session/${request.sessionID}/message`)
  const originalTool = originalMessages.body
    .flatMap((entry: any) => entry.parts)
    .find((part: any) => part.id === checkpoint.tool.id)
  const createdControl = await json("/session", {
    kind: "assistant",
    parentID: request.sessionID,
    title: "Public current replyable Question control",
  })
  if (createdControl.status !== 200) throw Error("Public current child Session creation failed")
  const controlSessionID = createdControl.body.id
  prompt = json(`/session/${controlSessionID}/message`, {
    messageID: Identifier.ascending("message"),
    agent: "chat",
    model: controlModel,
    parts: [{ type: "text", text: "Ask the current public Question so I can answer it normally." }],
  })
  void prompt.catch(() => undefined)
  let current: Question.Request | undefined
  await until(async () => {
    const pending = await json("/question")
    current = pending.body.find((item: Question.Request) => item.sessionID === controlSessionID)
    return Boolean(current)
  }, "real current control Question Tool admission")
  let event: any
  do {
    event = await stream.next("question.asked")
  } while (event.payload.id !== current!.id)
  const canonical = await json(`/session/${request.sessionID}/conversation`)
  const pendingEvents = stream.events.slice()
  const controlReply = await json(`/question/${current!.id}/reply`, { answers: [["Actual current Cedar answer"]] })
  const completed = await prompt
  const controlMessages = await json(`/session/${controlSessionID}/message`)
  const controlTool = controlMessages.body
    .flatMap((entry: any) => entry.parts)
    .find((part: any) => part.type === "tool" && part.tool === "question")
  const control = {
    session: createdControl.body,
    pending: current,
    canonical,
    reply: controlReply,
    completed,
    tool: controlTool,
  }
  const firstEvents = stream.events.slice()
  await stream.close()
  streamAbort.abort()
  streamAbort = new AbortController()
  const reopened = await fetch(new URL(`/session/${request.sessionID}/events`, server.url), {
    headers,
    signal: AbortSignal.any([streamAbort.signal, AbortSignal.timeout(30000)]),
  })
  if (reopened.status !== 200) throw Error(`Reconnect returned ${reopened.status}`)
  stream = readStream(reopened)
  const reconnected = await stream.next("session.connected")
  await write("observation", {
    connected,
    cold,
    listed,
    after,
    reply,
    publication: fact,
    originalTool,
    control,
    pendingEvents,
    firstEvents,
    reconnected,
  })
  console.log(
    JSON.stringify({
      observation: "normal Project bootstrap and public API complete",
      requestID: request.id,
      replyStatus: reply.status,
    }),
  )
} catch (error) {
  await write("failure", {
    name: error instanceof Error ? error.name : "unknown",
    message: String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
  console.error(error)
  process.exitCode = 1
} finally {
  if (!crash) {
    suppression?.[Symbol.dispose]()
    await stream?.close().catch(() => undefined)
    streamAbort?.abort()
    await server?.stop(true)
    await prompt?.catch(() => undefined)
    await Instance.disposeAll()
    await Database.awaitEffectIdle(5000)
    Database.close()
    await write("http", receipts)
    await write("closed", {
      finishedAt: Date.now(),
      pid: process.pid,
      serverStopped: true,
      databaseClosed: true,
      deadlineAt,
    })
  }
}
