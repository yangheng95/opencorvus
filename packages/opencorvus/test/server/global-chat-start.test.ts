import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Provider, type Provider as ProviderType } from "@/provider/provider"
import { Server } from "@/server/server"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { SessionPrompt } from "@/session/prompt"
import { SessionProcessor } from "@/session/processor"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { GlobalCreationAllocationTable, ProjectTable } from "@/project/project.sql"
import { Database, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { exportMysqlTransferSnapshot, preflightMysqlTransferSnapshot } from "@/storage/mysql-transfer"

const model = { providerID: "global-chat-start-test", modelID: "stream-model" }
const laterModelID = "later-session-model"

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Global Chat Start Stream Test",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      interleaved: false,
      input: { text: true, image: false, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
    },
    api: { id: model.modelID, url: "https://global-chat-start.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-28",
  } as ProviderType.Model
}

beforeAll(async () => {
  await Config.updateGlobalPatch({
    model: `${model.providerID}/${model.modelID}`,
    provider: {
      [model.providerID]: {
        name: "Global Chat Start Test Provider",
        npm: "@ai-sdk/openai-compatible",
        api: "http://127.0.0.1:9/stream-model",
        models: {
          [model.modelID]: {
            name: "Global Chat Start Test Model",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 1_000_000, output: 4_096 },
          },
          [laterModelID]: {
            name: "Later Session Model",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 1_000_000, output: 4_096 },
          },
        },
      },
    },
  })
})

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

afterAll(resetMemoryDatabase)

function sessionEventReader(response: Response) {
  if (!response.body) throw new Error("Global Chat Session event stream response has no body")
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffered = ""
  return {
    async next(type: string): Promise<any> {
      const deadline = Date.now() + 5_000
      while (Date.now() < deadline) {
        const frames = buffered.split("\n\n")
        buffered = frames.pop() ?? ""
        for (const frame of frames) {
          const data = frame
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart())
            .join("\n")
          if (!data) continue
          const event = JSON.parse(data)
          if (event.type === type) return event
        }
        const remaining = deadline - Date.now()
        const result = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), remaining),
          ),
        ])
        if (result.done) break
        buffered += decoder.decode(result.value, { stream: true })
      }
      throw new Error(`Global Chat Session event stream closed before ${type}`)
    },
    cancel: () => reader.cancel(),
  }
}

describe("global Chat start API", () => {
  test("accepts one visible streamed Chat turn and converges an exact retry", async () => {
    let physicalTurns = 0
    let releaseAssistant!: () => void
    const assistantGate = new Promise<void>((resolve) => {
      releaseAssistant = resolve
    })
    const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
    const processor = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
      const assistant = input.assistantMessage
      return {
        message: assistant,
        partFromToolCall() {
          return undefined
        },
        async process() {
          physicalTurns += 1
          await assistantGate
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: assistant.sessionID,
            messageID: assistant.id,
            type: "text",
            text: "global Chat streamed reply",
          })
          assistant.finish = "stop"
          assistant.time.completed = Date.now()
          await Session.updateMessage(assistant)
          return "stop"
        },
      } as any
    })
    try {
      const body = {
        requestID: "global-chat-start-contract-1",
        text: "Start one canonical global Chat",
        attachments: [
          {
            data: "TQ==",
            filename: "brief.txt",
            mime: "text/plain",
          },
        ],
      }
      const send = (value: typeof body) =>
        Server.App().request("/global/chat/start", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(value),
        })

      const [firstResponse, concurrentResponse] = await Promise.all([
        send(body),
        send({ ...body, attachments: [{ ...body.attachments[0], data: "TQ" }] }),
      ])
      const first = (await firstResponse.json()) as {
        requestID: string
        session: Session.Info
        messageID: string
      }
      const concurrent = (await concurrentResponse.json()) as typeof first
      const streamResponse = await Server.App().request(
        `/session/${encodeURIComponent(first.session.id)}/events?directory=${encodeURIComponent(first.session.directory)}`,
      )
      const events = sessionEventReader(streamResponse)
      const connected = await events.next("session.connected")
      const liveAssistantPartPromise = (async () => {
        while (true) {
          const event = await events.next("message.part.updated")
          if (
            event.payload.part.messageID !== first.messageID &&
            event.payload.part.type === "text" &&
            event.payload.part.text === "global Chat streamed reply"
          ) {
            return event
          }
        }
      })()
      releaseAssistant()
      const liveAssistantPart = await liveAssistantPartPromise
      await SessionPrompt.waitForFinish(first.session.id, first.session.directory)
      await events.cancel()
      const messages = await Session.messages({ sessionID: first.session.id })
      const ledgerResponse = await Server.App().request("/work-ledger")
      const ledger = (await ledgerResponse.json()) as {
        rows: Array<{ kind: string; sessionID?: string }>
      }
      const visibleChat = ledger.rows.find((row) => row.kind === "chat" && row.sessionID === first.session.id)
      const retryResponse = await send({
        ...body,
        attachments: [{ ...body.attachments[0], data: "TQ" }],
      })
      const retry = (await retryResponse.json()) as typeof first
      await SessionPrompt.waitForFinish(first.session.id, first.session.directory)
      const promotionParent = path.join(process.env.OPENCORVUS_TEST_PROCESS_ROOT!, "promoted-global-chat")
      await mkdir(promotionParent, { recursive: true })
      const promotionResponse = await Server.App().request(
        `/project/current/promote-anonymous?directory=${encodeURIComponent(first.session.directory)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ destinationParent: promotionParent, name: "saved-chat" }),
        },
      )
      const promotion = (await promotionResponse.json()) as { directory: string }
      const promotedRetryResponse = await send(body)
      const promotedRetry = (await promotedRetryResponse.json()) as typeof first
      const currentDefaults = spyOn(Config, "getGlobal").mockRejectedValue(
        new Error("current Global Chat defaults are no longer resolvable"),
      )
      const invalidDefaultRetryResponse = await send(body)
      const invalidDefaultRetry = (await invalidDefaultRetryResponse.json()) as typeof first
      const invalidDefaultConflictResponse = await send({
        ...body,
        text: "Changed payload while the current model default is invalid",
      })
      currentDefaults.mockRestore()

      expect({
        status: firstResponse.status,
        concurrentStatus: concurrentResponse.status,
        concurrentSessionID: concurrent.session.id,
        concurrentMessageID: concurrent.messageID,
        retryStatus: retryResponse.status,
        requestID: first.requestID,
        sessionID: first.session.id,
        messageID: first.messageID,
        experience: (first.session.metadata as any)?.conversation?.experience,
        connectedSessionID: connected.payload.sessionID,
        connectedMessageIDs: connected.payload.conversationSnapshot.transcript.map((message: any) => message.info.id),
        liveAssistantSessionID: liveAssistantPart.session_id,
        liveAssistantMessageID: liveAssistantPart.payload.part.messageID,
        liveAssistantText: liveAssistantPart.payload.part.text,
        roles: messages.map((message) => message.info.role),
        texts: messages.flatMap((message) =>
          message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])),
        ),
        files: messages.flatMap((message) =>
          message.parts.flatMap((part) =>
            part.type === "file" ? [{ filename: part.filename, mime: part.mime, url: part.url }] : [],
          ),
        ),
        ledgerStatus: ledgerResponse.status,
        visibleChat: visibleChat && { kind: visibleChat.kind, sessionID: visibleChat.sessionID },
        retryRequestID: retry.requestID,
        retrySessionID: retry.session.id,
        retryMessageID: retry.messageID,
        promotionStatus: promotionResponse.status,
        promotedRetryStatus: promotedRetryResponse.status,
        promotedDirectory: promotedRetry.session.directory,
        promotedRetrySessionID: promotedRetry.session.id,
        promotedRetryMessageID: promotedRetry.messageID,
        invalidDefaultRetryStatus: invalidDefaultRetryResponse.status,
        invalidDefaultRetrySessionID: invalidDefaultRetry.session.id,
        invalidDefaultConflictStatus: invalidDefaultConflictResponse.status,
        invalidDefaultConflictName: ((await invalidDefaultConflictResponse.json()) as any).name,
        physicalTurns,
      }).toEqual({
        status: 202,
        concurrentStatus: 202,
        concurrentSessionID: first.session.id,
        concurrentMessageID: first.messageID,
        retryStatus: 202,
        requestID: body.requestID,
        sessionID: expect.stringMatching(/^ses_/),
        messageID: expect.stringMatching(/^msg_/),
        experience: "chat",
        connectedSessionID: first.session.id,
        connectedMessageIDs: expect.arrayContaining([first.messageID]),
        liveAssistantSessionID: first.session.id,
        liveAssistantMessageID: messages.find((message) => message.info.role === "assistant")?.info.id,
        liveAssistantText: "global Chat streamed reply",
        roles: ["user", "assistant"],
        texts: [body.text, "global Chat streamed reply"],
        files: [
          {
            filename: body.attachments[0].filename,
            mime: body.attachments[0].mime,
            url: expect.stringMatching(/^\/attachment\//),
          },
        ],
        ledgerStatus: 200,
        visibleChat: { kind: "chat", sessionID: first.session.id },
        retryRequestID: first.requestID,
        retrySessionID: first.session.id,
        retryMessageID: first.messageID,
        promotionStatus: 200,
        promotedRetryStatus: 202,
        promotedDirectory: promotion.directory,
        promotedRetrySessionID: first.session.id,
        promotedRetryMessageID: first.messageID,
        invalidDefaultRetryStatus: 202,
        invalidDefaultRetrySessionID: first.session.id,
        invalidDefaultConflictStatus: 409,
        invalidDefaultConflictName: "GlobalChatStartIdentityConflictError",
        physicalTurns: 1,
      })

      const conflictResponse = await send({ ...body, text: "Changed payload under the same request identity" })
      expect({ status: conflictResponse.status, body: await conflictResponse.json() }).toMatchObject({
        status: 409,
        body: {
          name: "GlobalChatStartIdentityConflictError",
          data: { requestID: body.requestID, sessionID: first.session.id },
        },
      })
      await Instance.provide({
        directory: promotion.directory,
        fn: () =>
          Session.mergeConfigOverlayInProject({
            sessionID: first.session.id,
            projectID: first.session.projectID,
            patch: { model: `${model.providerID}/${laterModelID}` },
          }),
      })
      expect(preflightMysqlTransferSnapshot(exportMysqlTransferSnapshot())).toMatchObject({
        schemaFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      })

      const deterministicMessageID = Identifier.deterministic(
        "message",
        `global.chat.start.v1\0${body.requestID}\0message`,
      )
      const deterministicTextPartID = Identifier.deterministic("part", `global.chat.start.v1\0${body.requestID}\0text`)
      const deterministicAttachmentPartID = Identifier.deterministic(
        "part",
        `global.chat.start.v1\0${body.requestID}\0attachment\0${0}`,
      )
      const deterministicControlID = Identifier.deterministic(
        "session_control",
        `global.chat.start.v1\0${body.requestID}\0control`,
      )
      const transferMutations: Array<{
        expected: string
        mutate: (snapshot: ReturnType<typeof exportMysqlTransferSnapshot>) => void
      }> = [
        {
          expected: "input Message diverges",
          mutate(snapshot) {
            const row = snapshot.tables
              .find((table) => table.name === "message")
              ?.rows.find((candidate) => candidate.id === deterministicMessageID)
            if (!row) throw new Error("Global Chat transfer omitted its deterministic Message")
            const data = JSON.parse(String(row.data)) as Record<string, any>
            data.extra.wake_reason.requestFingerprint = "0".repeat(64)
            row.data = JSON.stringify(data)
          },
        },
        {
          expected: "input text Part diverges",
          mutate(snapshot) {
            const row = snapshot.tables
              .find((table) => table.name === "part")
              ?.rows.find((candidate) => candidate.id === deterministicTextPartID)
            if (!row) throw new Error("Global Chat transfer omitted its deterministic text Part")
            const data = JSON.parse(String(row.data)) as Record<string, any>
            data.text = "divergent transferred text"
            row.data = JSON.stringify(data)
          },
        },
        {
          expected: "attachment Part 1 diverges",
          mutate(snapshot) {
            const row = snapshot.tables
              .find((table) => table.name === "part")
              ?.rows.find((candidate) => candidate.id === deterministicAttachmentPartID)
            if (!row) throw new Error("Global Chat transfer omitted its deterministic attachment Part")
            const data = JSON.parse(String(row.data)) as Record<string, any>
            data.url = "/attachment/foreign/sha.txt"
            row.data = JSON.stringify(data)
          },
        },
        {
          expected: "wake control diverges",
          mutate(snapshot) {
            const row = snapshot.tables
              .find((table) => table.name === "session_control_record")
              ?.rows.find((candidate) => candidate.id === deterministicControlID)
            if (!row) throw new Error("Global Chat transfer omitted its deterministic wake control")
            const payload = JSON.parse(String(row.payload)) as Record<string, any>
            payload.messageID = Identifier.ascending("message")
            row.payload = JSON.stringify(payload)
          },
        },
      ]
      for (const mutation of transferMutations) {
        const changed = structuredClone(exportMysqlTransferSnapshot())
        mutation.mutate(changed)
        expect(() => preflightMysqlTransferSnapshot(changed)).toThrow(
          expect.objectContaining({
            name: "MysqlTransferValidationError",
            data: expect.objectContaining({ message: expect.stringContaining(mutation.expected) }),
          }),
        )
      }
      const malformedTransfer = structuredClone(exportMysqlTransferSnapshot())
      const acceptedSession = malformedTransfer.tables
        .find((table) => table.name === "session")
        ?.rows.find((row) => row.id === first.session.id)
      if (!acceptedSession) throw new Error("Global Chat transfer omitted its accepted Session")
      const acceptedMetadata = JSON.parse(String(acceptedSession.metadata)) as Record<string, any>
      acceptedMetadata.globalChatStart.messageID = Identifier.ascending("message")
      acceptedSession.metadata = JSON.stringify(acceptedMetadata)
      expect(() => preflightMysqlTransferSnapshot(malformedTransfer)).toThrow(
        expect.objectContaining({
          name: "MysqlTransferValidationError",
          data: expect.objectContaining({
            message: expect.stringContaining("deterministic request identity"),
          }),
        }),
      )
      expect(await EngineService.deleteSession(first.session.id, { projectID: first.session.projectID })).toEqual({
        ok: true,
        status: "tombstoned",
        sessionID: first.session.id,
        sessionHistoryRetained: true,
        authorizationAuditRetained: true,
        residue: [],
      })
      const deletedReplay = await send(body)
      expect({ status: deletedReplay.status, body: await deletedReplay.json() }).toMatchObject({
        status: 410,
        body: {
          name: "GlobalCreationAcceptedTargetUnavailableError",
          data: { requestID: body.requestID, projectID: first.session.projectID, targetID: first.session.id },
        },
      })
      await Instance.disposeAll()
      Database.transaction((db) => db.delete(ProjectTable).where(eq(ProjectTable.id, first.session.projectID)).run())
      expect(preflightMysqlTransferSnapshot(exportMysqlTransferSnapshot())).toMatchObject({
        schemaFingerprint: expect.any(String),
      })
    } finally {
      processor.mockRestore()
      provider.mockRestore()
    }
  }, 60_000)

  test("maps a request-derived Message occurrence already owned by another Session to a typed conflict", async () => {
    const requestID = "global-chat-start-foreign-message-claim"
    const messageID = Identifier.deterministic("message", `global.chat.start.v1\0${requestID}\0message`)
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const foreign = await Session.create({
          kind: "assistant",
          title: "Foreign Message occurrence owner",
        })
        await Session.updateMessage({
          id: messageID,
          sessionID: foreign.id,
          role: "user",
          author: "user",
          time: { created: Date.now() },
          agent: "chat",
          model,
        })
      },
    })

    const response = await Server.App().request("/global/chat/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestID, text: "Do not join a foreign Message occurrence" }),
    })

    expect({ status: response.status, body: await response.json() }).toMatchObject({
      status: 409,
      body: {
        name: "GlobalChatStartIdentityConflictError",
        data: { requestID },
      },
    })
  })

  test("maps an empty inline attachment MIME to the declared request validation error", async () => {
    const response = await Server.App().request("/global/chat/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestID: "global-chat-start-invalid-inline-mime",
        text: "Validate the initial attachment before allocating the Chat",
        attachments: [{ data: Buffer.from("invalid MIME", "utf8").toString("base64"), mime: "" }],
      }),
    })

    expect({ status: response.status, body: await response.json() }).toMatchObject({
      status: 400,
      body: {
        success: false,
        error: [{ code: "too_small", path: ["attachments", 0, "mime"] }],
      },
    })
  })

  test("rejects an unavailable explicit model before reserving a Global Chat allocation or Project", async () => {
    const facts = () =>
      Database.use((db) => ({
        allocations: db.select().from(GlobalCreationAllocationTable).all(),
        projects: db.select().from(ProjectTable).all(),
      }))
    const before = facts()
    const response = await Server.App().request("/global/chat/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestID: "global-chat-start-unavailable-model",
        text: "Validate this model before publishing a carrying Project",
        model: "missing-provider/missing-model",
      }),
    })
    expect({ status: response.status, body: await response.json() }).toMatchObject({
      status: 400,
      body: {
        name: "ProviderModelNotFoundError",
        data: { providerID: "missing-provider", modelID: "missing-model" },
      },
    })
    expect(facts()).toEqual(before)
  })
})
