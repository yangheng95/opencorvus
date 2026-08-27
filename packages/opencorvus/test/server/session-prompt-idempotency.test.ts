import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { createHash } from "node:crypto"
import { Database, eq } from "../../src/storage/db"
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
import { SessionLoop } from "../../src/session/loop"
import { MessageTable } from "../../src/session/session.sql"
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
  test("rebuilds the exact durable accepted batch for a failed middle-input retry", () => {
    const messageIDs = [
      Identifier.ascending("message"),
      Identifier.ascending("message"),
    ]
    const failedReply = {
      info: {
        id: Identifier.ascending("message"),
        sessionID: Identifier.ascending("session"),
        role: "assistant",
        parentID: messageIDs[1],
        acceptedInputMessageIDs: messageIDs,
        summary: false,
        finish: "error",
        error: { name: "ProviderError", data: { message: "failed accepted batch" } },
        time: { created: Date.now(), completed: Date.now() },
      },
      parts: [],
    } as any
    expect(
      SessionLoop.TestHooks.failedAcceptedInputBatch(
        [failedReply],
        new Set([messageIDs[0]]),
        messageIDs[1]!,
      ),
    ).toEqual(messageIDs)
  })

  test("accepts a queued input while preserving its complete stored authored payload", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Atomic queued input acceptance" })
        const inputMessageID = Identifier.ascending("message")
        await Session.updateMessage({
          id: inputMessageID,
          sessionID: session.id,
          role: "user",
          author: "user",
          agent: "chat",
          model,
          pendingDelivery: true,
          time: { created: Date.now() },
        })
        Database.use((db) => {
          const row = db.select({ data: MessageTable.data }).from(MessageTable).where(eq(MessageTable.id, inputMessageID)).get()!
          db.update(MessageTable)
            .set({ data: { ...row.data, historicalExtension: { authority: "retained" } } as any })
            .where(eq(MessageTable.id, inputMessageID))
            .run()
        })

        const assistant = await Session.beginAssistantReply({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "assistant",
          author: "chat",
          parentID: inputMessageID,
          acceptedInputMessageIDs: [inputMessageID],
          agent: "chat",
          modelID: model.modelID,
          providerID: model.providerID,
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          time: { created: Date.now() },
        })
        const stored = Database.use((db) =>
          db.select({ data: MessageTable.data }).from(MessageTable).where(eq(MessageTable.id, inputMessageID)).get(),
        )

        expect({
          accepted: assistant.acceptedInputMessageIDs,
          pendingDelivery: stored?.data.pendingDelivery,
          historicalExtension: (stored?.data as any)?.historicalExtension,
        }).toEqual({
          accepted: [inputMessageID],
          pendingDelivery: undefined,
          historicalExtension: { authority: "retained" },
        })
      },
    })
  })

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

  test("settles every overlapping caller from one durable delivered-batch reply", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Overlapping distinct direct prompts" })
        const started = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
        const releases = [Promise.withResolvers<void>(), Promise.withResolvers<void>()]
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
              started[turnIndex]?.resolve()
              await releases[turnIndex]?.promise
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
          const messageIDs = [
            Identifier.ascending("message"),
            Identifier.ascending("message"),
            Identifier.ascending("message"),
          ]
          const send = (messageID: string, text: string) =>
            app.fetch(
              new Request(`http://opencorvus.test/session/${session.id}/message`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  messageID,
                  model,
                  agent: "chat",
                  parts: [{ type: "text", text }],
                }),
              }),
            )

          const firstResponse = send(messageIDs[0], "first overlapping input")
          await started[0].promise
          const secondResponse = send(messageIDs[1], "second overlapping input")
          const thirdResponse = send(messageIDs[2], "third overlapping input")
          const persistDeadline = Date.now() + 10_000
          while (
            (await Session.messages({ sessionID: session.id })).filter((item) => item.info.role === "user").length < 3
          ) {
            if (Date.now() >= persistDeadline) throw new Error("Overlapping inputs were not persisted")
            await Bun.sleep(10)
          }
          // The write-side contract: every caller-identified input is durable
          // under its exact caller-minted identity before its Turn runs, each
          // carries its identity binding, and the ones that arrived mid-Turn
          // are stamped as queued for delivery — all while one owner serves.
          const persistedDuringTurn = await Session.messages({ sessionID: session.id })
          const users = persistedDuringTurn.filter((item) => item.info.role === "user")
          expect({
            userIDs: users.map((item) => item.info.id),
            identityBound: users.map((item) => Boolean((item.info.extra as any)?.publicSessionPromptIdentity)),
            queued: users.map((item) => (item.info as any).pendingDelivery === true),
            promptOwners: SessionPromptState.TestHooks.promptResourceSnapshot(session.id).promptOwners,
          }).toEqual({
            userIDs: messageIDs,
            identityBound: [true, true, true],
            queued: [false, true, true],
            promptOwners: 1,
          })

          releases[0].resolve()
          const first = await firstResponse
          const firstBody = (await first.json()) as any

          // The Turn boundary accepts the complete queue. The physical reply
          // remains parented to the delivered tail, while both accepted
          // callers resolve from that same durable assistant occurrence.
          await started[1].promise
          const acceptedDuringTurn = await Session.messages({ sessionID: session.id })
          const acceptedUsers = acceptedDuringTurn.filter((item) => item.info.role === "user")
          const activeAssistant = acceptedDuringTurn.findLast((item) => item.info.role === "assistant")
          expect({
            queued: acceptedUsers.map((item) => item.info.pendingDelivery === true),
            parent: activeAssistant?.info.role === "assistant" ? activeAssistant.info.parentID : undefined,
            accepted:
              activeAssistant?.info.role === "assistant" ? activeAssistant.info.acceptedInputMessageIDs : undefined,
            completed: activeAssistant?.info.role === "assistant" ? activeAssistant.info.time.completed : undefined,
          }).toEqual({
            queued: [false, false, false],
            parent: messageIDs[2],
            accepted: [messageIDs[1], messageIDs[2]],
            completed: undefined,
          })
          releases[1].resolve()
          const [second, third] = await Promise.all([secondResponse, thirdResponse])
          const secondBody = (await second.json()) as any
          const thirdBody = (await third.json()) as any
          expect({
            statuses: [first.status, second.status, third.status],
            firstParent: firstBody.info.parentID,
            firstAccepted: firstBody.info.acceptedInputMessageIDs,
            secondReplyID: secondBody.info.id,
            secondParent: secondBody.info.parentID,
            secondAccepted: secondBody.info.acceptedInputMessageIDs,
            thirdReplyID: thirdBody.info.id,
            thirdParent: thirdBody.info.parentID,
            thirdAccepted: thirdBody.info.acceptedInputMessageIDs,
            physicalParents,
          }).toEqual({
            statuses: [200, 200, 200],
            firstParent: messageIDs[0],
            firstAccepted: [messageIDs[0]],
            secondReplyID: thirdBody.info.id,
            secondParent: messageIDs[2],
            secondAccepted: [messageIDs[1], messageIDs[2]],
            thirdReplyID: thirdBody.info.id,
            thirdParent: messageIDs[2],
            thirdAccepted: [messageIDs[1], messageIDs[2]],
            physicalParents: [messageIDs[0], messageIDs[2]],
          })

          // The in-process occurrence has settled and released. Replaying the
          // middle identity now converges through the durable accepted-input
          // relation and cannot start a third physical model Turn.
          const replayedSecond = await send(messageIDs[1], "second overlapping input")
          const replayedSecondBody = (await replayedSecond.json()) as any
          expect({
            status: replayedSecond.status,
            replyID: replayedSecondBody.info.id,
            accepted: replayedSecondBody.info.acceptedInputMessageIDs,
            physicalParents,
          }).toEqual({
            status: 200,
            replyID: thirdBody.info.id,
            accepted: [messageIDs[1], messageIDs[2]],
            physicalParents: [messageIDs[0], messageIDs[2]],
          })
        } finally {
          for (const release of releases) release.resolve()
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("refuses a failed batch replay that races with a newer accepted user Turn", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Advanced failed batch replay" })
        const firstStarted = Promise.withResolvers<void>()
        const releaseFirst = Promise.withResolvers<void>()
        const newerStarted = Promise.withResolvers<void>()
        const releaseNewer = Promise.withResolvers<void>()
        const replayReachedLoop = Promise.withResolvers<void>()
        const releaseReplayLoop = Promise.withResolvers<void>()
        const physicalParents: string[] = []
        let promptLoop: { mockRestore(): void } | undefined
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
              if (turnIndex === 0) {
                firstStarted.resolve()
                await releaseFirst.promise
              }
              if (turnIndex === 2) {
                newerStarted.resolve()
                await releaseNewer.promise
              }
              assistant.finish = turnIndex === 1 ? "error" : "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const messageIDs = [
            Identifier.ascending("message"),
            Identifier.ascending("message"),
            Identifier.ascending("message"),
            Identifier.ascending("message"),
          ]
          const texts = ["occupy the first Turn", "failed batch head", "failed batch tail", "newer settled Turn"]
          const realLoop = SessionPrompt.loop
          promptLoop = spyOn(SessionPrompt, "loop").mockImplementation(async (input) => {
            if (input.retry_failed_reply === true && input.reply_to_message_id === messageIDs[1]) {
              replayReachedLoop.resolve()
              await releaseReplayLoop.promise
            }
            return realLoop(input)
          })
          const send = (index: number) =>
            app.fetch(
              new Request(`http://opencorvus.test/session/${session.id}/message`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  messageID: messageIDs[index],
                  model,
                  agent: "chat",
                  parts: [{ type: "text", text: texts[index] }],
                }),
              }),
            )

          const occupyingResponse = send(0)
          await firstStarted.promise
          const failedHeadResponse = send(1)
          const failedTailResponse = send(2)
          const persistDeadline = Date.now() + 10_000
          while (
            (await Session.messages({ sessionID: session.id })).filter((item) => item.info.role === "user").length < 3
          ) {
            if (Date.now() >= persistDeadline) throw new Error("Failed batch inputs were not persisted")
            await Bun.sleep(10)
          }
          releaseFirst.resolve()
          const [occupying, failedHead, failedTail] = await Promise.all([
            occupyingResponse,
            failedHeadResponse,
            failedTailResponse,
          ])
          const failedHeadBody = (await failedHead.json()) as any
          const failedTailBody = (await failedTail.json()) as any
          // Hold the replay immediately before owner admission. A newer public
          // request then becomes the real Session owner and atomically accepts
          // its input. Releasing the replay forces it to attach to that owner;
          // the owner-side revalidation must reject the stale failed identity.
          const replayResponse = send(1)
          await replayReachedLoop.promise
          const newerResponse = send(3)
          await newerStarted.promise
          releaseReplayLoop.resolve()
          const replay = await replayResponse
          releaseNewer.resolve()
          const newer = await newerResponse
          const newerBody = (await newer.json()) as any
          const replayBody = (await replay.json()) as any
          expect({
            initialStatuses: [occupying.status, failedHead.status, failedTail.status, newer.status],
            sharedFailedReply: failedHeadBody.info.id === failedTailBody.info.id,
            failedAccepted: failedHeadBody.info.acceptedInputMessageIDs,
            newerFinish: newerBody.info.finish,
            replayStatus: replay.status,
            replayBody,
            physicalParents,
          }).toEqual({
            initialStatuses: [200, 200, 200, 200],
            sharedFailedReply: true,
            failedAccepted: [messageIDs[1], messageIDs[2]],
            newerFinish: "stop",
            replayStatus: 409,
            replayBody: {
              name: "PublicSessionPromptIdentityConflictError",
              data: {
                sessionID: session.id,
                messageID: messageIDs[1],
                message: expect.stringContaining("has accepted a newer user Turn"),
              },
            },
            physicalParents: [messageIDs[0], messageIDs[2], messageIDs[3]],
          })
        } finally {
          releaseFirst.resolve()
          releaseNewer.resolve()
          releaseReplayLoop.resolve()
          promptLoop?.mockRestore()
          processor.mockRestore()
          provider.mockRestore()
        }
      },
    })
  }, 60_000)

  test("keeps newer request settlement when a stale failed replay wins Session ownership", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Stale replay owner handoff" })
        const firstStarted = Promise.withResolvers<void>()
        const releaseFirst = Promise.withResolvers<void>()
        const newerLoopReached = Promise.withResolvers<void>()
        const releaseNewerLoop = Promise.withResolvers<void>()
        const newerProcessorStarted = Promise.withResolvers<void>()
        const releaseNewerProcessor = Promise.withResolvers<void>()
        const physicalParents: string[] = []
        let loopSpy: { mockRestore(): void } | undefined
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
              if (turnIndex === 0) {
                firstStarted.resolve()
                await releaseFirst.promise
              }
              if (turnIndex === 2) {
                newerProcessorStarted.resolve()
                await releaseNewerProcessor.promise
              }
              assistant.finish = turnIndex === 1 ? "error" : "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })
        try {
          const app = new Hono().route("/session", SessionRoutes())
          app.onError(serverErrorResponse)
          const messageIDs = [
            Identifier.ascending("message"),
            Identifier.ascending("message"),
            Identifier.ascending("message"),
            Identifier.ascending("message"),
          ]
          const texts = ["occupy owner", "stale failed head", "stale failed tail", "newer accepted request"]
          const send = (index: number) =>
            app.fetch(
              new Request(`http://opencorvus.test/session/${session.id}/message`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  messageID: messageIDs[index],
                  model,
                  agent: "chat",
                  parts: [{ type: "text", text: texts[index] }],
                }),
              }),
            )

          const occupyingResponse = send(0)
          await firstStarted.promise
          const failedHeadResponse = send(1)
          const failedTailResponse = send(2)
          const persistDeadline = Date.now() + 10_000
          while (
            (await Session.messages({ sessionID: session.id })).filter((item) => item.info.role === "user").length < 3
          ) {
            if (Date.now() >= persistDeadline) throw new Error("Failed batch inputs were not persisted")
            await Bun.sleep(10)
          }
          releaseFirst.resolve()
          const [occupying, failedHead, failedTail] = await Promise.all([
            occupyingResponse,
            failedHeadResponse,
            failedTailResponse,
          ])
          const failedHeadBody = (await failedHead.json()) as any
          const failedTailBody = (await failedTail.json()) as any

          const realLoop = SessionLoop.loop
          loopSpy = spyOn(SessionLoop, "loop").mockImplementation(async (input) => {
            if (input.reply_to_message_id === messageIDs[3] && input.retry_failed_reply !== true) {
              newerLoopReached.resolve()
              await releaseNewerLoop.promise
            }
            return realLoop(input)
          })
          // N commits as a normal non-pending input, then pauses before owner
          // admission. The stale A replay starts the owner, rejects only A,
          // and must retain that owner to process N. N subsequently attaches
          // to the same owner and receives its normal successful reply.
          const newerResponse = send(3)
          await newerLoopReached.promise
          const replayResponse = send(1)
          await newerProcessorStarted.promise
          releaseNewerLoop.resolve()
          const attachDeadline = Date.now() + 10_000
          while (!SessionPromptState.attachedReplyTargets(session.id, project.path).includes(messageIDs[3]!)) {
            if (Date.now() >= attachDeadline) throw new Error("Newer request did not attach to the stale replay owner")
            await Bun.sleep(10)
          }
          releaseNewerProcessor.resolve()
          const [replay, newer] = await Promise.all([replayResponse, newerResponse])
          const replayBody = (await replay.json()) as any
          const newerBody = (await newer.json()) as any
          expect({
            setupStatuses: [occupying.status, failedHead.status, failedTail.status],
            sharedFailedReply: failedHeadBody.info.id === failedTailBody.info.id,
            replayStatus: replay.status,
            replayBody,
            newerStatus: newer.status,
            newerParent: newerBody.info.parentID,
            newerFinish: newerBody.info.finish,
            physicalParents,
          }).toEqual({
            setupStatuses: [200, 200, 200],
            sharedFailedReply: true,
            replayStatus: 409,
            replayBody: {
              name: "PublicSessionPromptIdentityConflictError",
              data: {
                sessionID: session.id,
                messageID: messageIDs[1],
                message: expect.stringContaining("has accepted a newer user Turn"),
              },
            },
            newerStatus: 200,
            newerParent: messageIDs[3],
            newerFinish: "stop",
            physicalParents: [messageIDs[0], messageIDs[2], messageIDs[3]],
          })
        } finally {
          releaseFirst.resolve()
          releaseNewerLoop.resolve()
          releaseNewerProcessor.resolve()
          loopSpy?.mockRestore()
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
              await input.beforeAssistantCompletion?.(assistant)
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
                  messageID: Identifier.ascending("message"),
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
              await input.beforeAssistantCompletion?.(assistant)
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
              includeMcpTools: false,
              parts: [{ type: "text", text: `completed history turn ${index + 1}` }],
            })
          }
          await SessionPrompt.prompt({
            sessionID: session.id,
            author: "user",
            noReply: true,
            includeMcpTools: false,
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
