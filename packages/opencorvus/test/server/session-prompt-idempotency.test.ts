import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { createHash } from "node:crypto"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Provider, type Provider as ProviderType } from "../../src/provider/provider"
import { serverErrorResponse } from "../../src/server/error-handler"
import { SessionRoutes } from "../../src/server/routes/session"
import { Session } from "../../src/session"
import { SessionContext } from "../../src/session/context"
import { SessionControl } from "../../src/session/control"
import { SessionPrompt } from "../../src/session/prompt"
import { SessionPromptState } from "../../src/session/prompt/state"
import { SessionProcessor } from "../../src/session/processor"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const model = { providerID: "test", modelID: "direct-session-prompt" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Direct Session Prompt Test",
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
    api: { id: model.modelID, url: "https://direct-session-prompt.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-14",
  } as ProviderType.Model
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("direct Session prompt identity", () => {
  test("returns one exact assistant reply for first submission and exact retry", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Direct prompt identity" })
        const messageID = Identifier.ascending("message")
        let physicalTurns = 0
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
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: assistant.sessionID,
                messageID: assistant.id,
                type: "text",
                text: "one durable direct reply",
              })
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const body = {
            messageID,
            model,
            agent: "chat",
            parts: [{ type: "text", text: "execute this exact direct prompt" }],
          }
          const send = (value: typeof body) =>
            app.fetch(
              new Request(`http://opencorvus.test/session/${session.id}/message`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(value),
              }),
            )

          const firstResponse = await send(body)
          const first = (await firstResponse.json()) as any
          const responseProjection = (message: any) => ({
            origin: {
              role: message.info.role,
              author: message.info.author,
              channel: message.info.channel,
              resolvedRole: message.info.resolvedRole,
              agentID: message.info.agentID,
              sessionAgentID: message.info.sessionAgentID,
              originSource: message.info.originSource,
            },
            messageOrderKey: message.info.orderKey,
            partOrderKeys: message.parts.map((part: any) => part.orderKey),
          })
          const firstProjection = responseProjection(first)
          expect({
            status: firstResponse.status,
            parentID: first.info.parentID,
            ...firstProjection,
            physicalTurns,
          }).toEqual({
            status: 200,
            parentID: messageID,
            origin: {
              role: "assistant",
              author: "chat",
              channel: "assistant",
              resolvedRole: "chat",
              agentID: "chat",
              sessionAgentID: "chat",
              originSource: "",
            },
            messageOrderKey: expect.any(String),
            partOrderKeys: [expect.any(String)],
            physicalTurns: 1,
          })

          const retryResponse = await send(body)
          const retry = (await retryResponse.json()) as any
          const persisted = await Session.messages({ sessionID: session.id })
          expect({
            status: retryResponse.status,
            sameAssistant: retry.info.id === first.info.id,
            sameProjection: responseProjection(retry),
            messageRoles: persisted.map((message) => message.info.role),
            physicalTurns,
          }).toEqual({
            status: 200,
            sameAssistant: true,
            sameProjection: firstProjection,
            messageRoles: ["user", "assistant"],
            physicalTurns: 1,
          })

          const conflictResponse = await send({
            ...body,
            parts: [{ type: "text", text: "conflicting reuse of the same identity" }],
          })
          expect({ status: conflictResponse.status, body: await conflictResponse.json() }).toMatchObject({
            status: 409,
            body: {
              name: "PublicSessionPromptIdentityConflictError",
              data: { sessionID: session.id, messageID },
            },
          })
        } finally {
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("retries one persisted failed reply under the same public input identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Retry failed direct prompt" })
        const messageID = Identifier.ascending("message")
        let physicalTurns = 0
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
              assistant.finish = physicalTurns === 1 ? "error" : "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const body = {
            messageID,
            model,
            agent: "chat",
            parts: [{ type: "text", text: "retry the failed physical turn" }],
          }
          const send = () =>
            app.fetch(
              new Request(`http://opencorvus.test/session/${session.id}/message`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              }),
            )

          const failed = await send()
          const failedBody = (await failed.json()) as any
          const retried = await send()
          const retriedBody = (await retried.json()) as any
          expect({
            statuses: [failed.status, retried.status],
            finishes: [failedBody.info.finish, retriedBody.info.finish],
            parents: [failedBody.info.parentID, retriedBody.info.parentID],
            distinctAssistants: failedBody.info.id !== retriedBody.info.id,
            physicalTurns,
          }).toEqual({
            statuses: [200, 200],
            finishes: ["error", "stop"],
            parents: [messageID, messageID],
            distinctAssistants: true,
            physicalTurns: 2,
          })
        } finally {
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("settles concurrent reuse of one public identity against one canonical request", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Concurrent direct prompt identity" })
        const messageID = Identifier.ascending("message")
        let physicalTurns = 0
        let confirmStarted!: () => void
        let releaseTurn!: () => void
        const started = new Promise<void>((resolve) => (confirmStarted = resolve))
        const released = new Promise<void>((resolve) => (releaseTurn = resolve))
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
              confirmStarted()
              await released
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: assistant.sessionID,
                messageID: assistant.id,
                type: "text",
                text: "canonical concurrent reply",
              })
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const body = {
            messageID,
            model,
            agent: "chat",
            parts: [{ type: "text", text: "canonical concurrent request" }],
          }
          const send = (value: typeof body) =>
            app.fetch(
              new Request(`http://opencorvus.test/session/${session.id}/message`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(value),
              }),
            )

          const canonicalResponse = send(body)
          await started
          const conflictResponse = await send({
            ...body,
            parts: [{ type: "text", text: "different concurrent request" }],
          })
          expect({ status: conflictResponse.status, body: await conflictResponse.json(), physicalTurns }).toMatchObject(
            {
              status: 409,
              body: {
                name: "PublicSessionPromptIdentityConflictError",
                data: { sessionID: session.id, messageID },
              },
              physicalTurns: 1,
            },
          )

          releaseTurn()
          const response = await canonicalResponse
          const persisted = await Session.messages({ sessionID: session.id })
          expect({
            status: response.status,
            roles: persisted.map((message) => message.info.role),
            userText: persisted[0]?.parts[0]?.type === "text" ? persisted[0].parts[0].text : undefined,
            physicalTurns,
          }).toEqual({
            status: 200,
            roles: ["user", "assistant"],
            userText: "canonical concurrent request",
            physicalTurns: 1,
          })
        } finally {
          releaseTurn()
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("Host-mints identities and delivers overlapping inputs through one Session owner to exact replies", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Overlapping distinct direct prompts" })
        const started = [Promise.withResolvers<void>(), Promise.withResolvers<void>(), Promise.withResolvers<void>()]
        const releases = [Promise.withResolvers<void>(), Promise.withResolvers<void>(), Promise.withResolvers<void>()]
        const physicalParents: string[] = []
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        const processor = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
          const assistant = input.assistantMessage
          const turnIndex = physicalParents.length
          physicalParents.push(assistant.parentID)
          return {
            message: assistant,
            partFromToolCall() {
              return undefined
            },
            async process() {
              started[turnIndex]!.resolve()
              await releases[turnIndex]!.promise
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: assistant.sessionID,
                messageID: assistant.id,
                type: "text",
                text: `reply for ${assistant.parentID}`,
              })
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const send = (text: string) =>
            app.fetch(
              new Request(`http://opencorvus.test/session/${session.id}/message`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  model,
                  agent: "chat",
                  parts: [{ type: "text", text }],
                }),
              }),
            )

          const firstResponse = send("first overlapping input")
          await started[0].promise
          const secondResponse = send("second overlapping input")
          const thirdResponse = send("third overlapping input")
          const secondInputDeadline = Date.now() + 10_000
          while (
            (await Session.messages({ sessionID: session.id })).filter((item) => item.info.role === "user").length < 3
          ) {
            if (Date.now() >= secondInputDeadline) throw new Error("Overlapping inputs were not persisted")
            await Bun.sleep(10)
          }
          expect(SessionPromptState.TestHooks.promptResourceSnapshot(session.id)).toMatchObject({ promptOwners: 1 })

          releases[0].resolve()
          const first = await firstResponse
          await started[1].promise
          expect(SessionPromptState.TestHooks.promptResourceSnapshot(session.id)).toMatchObject({ promptOwners: 1 })
          releases[1].resolve()
          const second = await secondResponse
          await started[2].promise
          expect(SessionPromptState.TestHooks.promptResourceSnapshot(session.id)).toMatchObject({ promptOwners: 1 })
          releases[2].resolve()
          const third = await thirdResponse
          const [firstBody, secondBody, thirdBody] = (await Promise.all([
            first.json(),
            second.json(),
            third.json(),
          ])) as any[]
          const persisted = await Session.messages({ sessionID: session.id })
          const persistedUserIDs = persisted.flatMap((message) =>
            message.info.role === "user" ? [message.info.id] : [],
          )
          expect({
            statuses: [first.status, second.status, third.status],
            responseParents: [firstBody.info.parentID, secondBody.info.parentID, thirdBody.info.parentID],
            physicalParents,
            persistedParents: persisted.flatMap((message) =>
              message.info.role === "assistant" ? [message.info.parentID] : [],
            ),
          }).toEqual({
            statuses: [200, 200, 200],
            responseParents: persistedUserIDs,
            physicalParents: persistedUserIDs,
            persistedParents: persistedUserIDs,
          })
        } finally {
          for (const release of releases) release.resolve()
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("settles an overlapping manual summary through the existing Session owner", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Overlapping manual summary" })
        const inputMessageID = Identifier.ascending("message")
        const firstStarted = Promise.withResolvers<void>()
        const releaseFirst = Promise.withResolvers<void>()
        let physicalTurns = 0
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
              if (physicalTurns === 1) {
                firstStarted.resolve()
                await releaseFirst.promise
              }
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: assistant.sessionID,
                messageID: assistant.id,
                type: "text",
                text: physicalTurns === 1 ? "exact direct reply" : "durable overlapping summary",
              })
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          for (let index = 0; index < 6; index += 1) {
            await SessionPrompt.prompt({
              sessionID: session.id,
              messageID: Identifier.ascending("message"),
              model,
              agent: "chat",
              author: "user",
              noReply: true,
              parts: [{ type: "text", text: `compactable context ${index + 1}` }],
            })
          }
          const app = new Hono().route("/session", SessionRoutes())
          let routeError: unknown
          app.onError((error, context) => {
            routeError = error
            return serverErrorResponse(error, context)
          })
          const directResponse = app.fetch(
            new Request(`http://opencorvus.test/session/${session.id}/message`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                messageID: inputMessageID,
                model,
                agent: "chat",
                parts: [{ type: "text", text: "complete this turn before summarizing" }],
              }),
            }),
          )
          await firstStarted.promise
          const summaryResponse = app.fetch(
            new Request(`http://opencorvus.test/session/${session.id}/summarize`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ providerID: model.providerID, modelID: model.modelID }),
            }),
          )
          const controlDeadline = Date.now() + 10_000
          while (!SessionControl.pending(session.id).some((control) => control.kind === "manual_summarize")) {
            if (Date.now() >= controlDeadline) throw new Error("Manual summary control was not durably accepted")
            await Bun.sleep(10)
          }
          expect(SessionPromptState.TestHooks.promptResourceSnapshot(session.id).promptOwners).toBe(1)
          releaseFirst.resolve()
          const [direct, summary] = await Promise.all([directResponse, summaryResponse])
          if (routeError) throw routeError
          const directBody = (await direct.json()) as any
          expect({
            statuses: [direct.status, summary.status],
            directParent: directBody.info.parentID,
            summarized: await summary.json(),
            physicalTurns,
          }).toEqual({
            statuses: [200, 200],
            directParent: inputMessageID,
            summarized: true,
            physicalTurns: 2,
          })
        } finally {
          releaseFirst.resolve()
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("executes the exact reply input after an earlier context-only user Message", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Context-only predecessor" })
        const contextMessageID = Identifier.ascending("message")
        const replyMessageID = Identifier.ascending("message")
        await SessionPrompt.prompt({
          sessionID: session.id,
          messageID: contextMessageID,
          model,
          agent: "chat",
          author: "user",
          noReply: true,
          parts: [{ type: "text", text: "context only; do not execute this occurrence" }],
        })
        let physicalParent: string | undefined
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        const processor = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
          const assistant = input.assistantMessage
          return {
            message: assistant,
            partFromToolCall() {
              return undefined
            },
            async process() {
              physicalParent = assistant.parentID
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const response = await app.fetch(
            new Request(`http://opencorvus.test/session/${session.id}/message`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                messageID: replyMessageID,
                model,
                agent: "chat",
                parts: [{ type: "text", text: "execute this exact later input" }],
              }),
            }),
          )
          const body = (await response.json()) as any
          expect({ status: response.status, responseParent: body.info.parentID, physicalParent }).toEqual({
            status: 200,
            responseParent: replyMessageID,
            physicalParent: replyMessageID,
          })
        } finally {
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("runs different Sessions concurrently with one exact owner and reply per Session", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const sessions = await Promise.all([
          Session.create({ kind: "assistant", title: "Concurrent Session A" }),
          Session.create({ kind: "assistant", title: "Concurrent Session B" }),
        ])
        const started = new Map(sessions.map((session) => [session.id, Promise.withResolvers<void>()]))
        const releases = new Map(sessions.map((session) => [session.id, Promise.withResolvers<void>()]))
        const physicalParents = new Map<string, string>()
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        const processor = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
          const assistant = input.assistantMessage
          return {
            message: assistant,
            partFromToolCall() {
              return undefined
            },
            async process() {
              physicalParents.set(assistant.sessionID, assistant.parentID)
              started.get(assistant.sessionID)!.resolve()
              await releases.get(assistant.sessionID)!.promise
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const send = (sessionID: string, text: string) =>
            app.fetch(
              new Request(`http://opencorvus.test/session/${sessionID}/message`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  model,
                  agent: "chat",
                  parts: [{ type: "text", text }],
                }),
              }),
            )

          const responses = sessions.map((session, index) => send(session.id, `parallel input ${index + 1}`))
          await Promise.all(sessions.map((session) => started.get(session.id)!.promise))
          expect(
            sessions.map((session) => SessionPromptState.TestHooks.promptResourceSnapshot(session.id).promptOwners),
          ).toEqual([1, 1])
          for (const release of releases.values()) release.resolve()
          const settled = await Promise.all(responses)
          const bodies = (await Promise.all(settled.map((response) => response.json()))) as any[]
          const persistedUserIDs = await Promise.all(
            sessions.map(
              async (session) =>
                (await Session.messages({ sessionID: session.id })).find((message) => message.info.role === "user")!
                  .info.id,
            ),
          )
          expect({
            statuses: settled.map((response) => response.status),
            responseParents: bodies.map((body) => body.info.parentID),
            physicalParents: sessions.map((session) => physicalParents.get(session.id)),
          }).toEqual({
            statuses: [200, 200],
            responseParents: persistedUserIDs,
            physicalParents: persistedUserIDs,
          })
        } finally {
          for (const release of releases.values()) release.resolve()
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("resumes a persisted public prompt under its exact Session and initialized project context", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Persisted direct prompt context" })
        const messageID = Identifier.ascending("message")
        const body = {
          messageID,
          model,
          agent: "chat",
          parts: [{ type: "text", text: "resume this persisted request" }],
        }
        await SessionPrompt.prompt({
          sessionID: session.id,
          author: "user",
          noReply: true,
          ...body,
          extra: {
            publicSessionPromptIdentity: {
              version: 1,
              fingerprint: createHash("sha256").update(JSON.stringify(body)).digest("hex"),
            },
          },
        })

        let observedContext: { sessionID: string; directory: string } | undefined
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        const processor = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
          const assistant = input.assistantMessage
          return {
            message: assistant,
            partFromToolCall() {
              return undefined
            },
            async process() {
              observedContext = {
                sessionID: SessionContext.use().id,
                directory: Instance.directory,
              }
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const response = await app.fetch(
            new Request(`http://opencorvus.test/session/${session.id}/message`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(body),
            }),
          )
          expect({ status: response.status, observedContext }).toEqual({
            status: 200,
            observedContext: { sessionID: session.id, directory: project.path },
          })
        } finally {
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("summarizes under the target Session and initialized project context", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({
          kind: "assistant",
          title: "Summarize execution context",
          metadata: { configOverlay: { model: `${model.providerID}/${model.modelID}` } },
        })
        let observedContext: { sessionID: string; directory: string } | undefined
        const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        const processor = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
          const assistant = input.assistantMessage
          return {
            message: assistant,
            partFromToolCall() {
              return undefined
            },
            async process() {
              observedContext = {
                sessionID: SessionContext.use().id,
                directory: Instance.directory,
              }
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: assistant.sessionID,
                messageID: assistant.id,
                type: "text",
                text: "durable continuation summary",
              })
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          for (let index = 0; index < 6; index += 1) {
            await SessionPrompt.prompt({
              sessionID: session.id,
              author: "user",
              parts: [{ type: "text", text: `completed history turn ${index + 1}` }],
            })
          }
          await SessionPrompt.prompt({
            sessionID: session.id,
            author: "user",
            noReply: true,
            parts: [{ type: "text", text: "durable source message for summarization" }],
          })
          observedContext = undefined
          const app = new Hono().route("/session", SessionRoutes())
          let routeError: unknown
          app.onError((error, context) => {
            routeError = error
            return serverErrorResponse(error, context)
          })
          const response = await app.fetch(
            new Request(`http://opencorvus.test/session/${session.id}/summarize`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ providerID: model.providerID, modelID: model.modelID }),
            }),
          )
          if (routeError) throw routeError
          if (response.status !== 200) {
            throw new Error(`Summarize route failed: ${await response.text()}`)
          }
          expect({ status: response.status, result: await response.json(), observedContext }).toEqual({
            status: 200,
            result: true,
            observedContext: { sessionID: session.id, directory: project.path },
          })
        } finally {
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)
})
