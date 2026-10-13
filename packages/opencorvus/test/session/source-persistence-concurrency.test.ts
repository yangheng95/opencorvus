import { afterAll, describe, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { Bus } from "../../src/bus"
import { Instance } from "../../src/project/instance"
import type { Provider } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { MessageStore } from "../../src/session/message-store"
import { Message } from "../../src/session/message"
import { SessionProcessor } from "../../src/session/processor"
import { persistMessageSources } from "../../src/session/source-persistence"
import { Database, NotFoundError } from "../../src/storage/db"
import { HostProcessingFaultError } from "../../src/llm/host-fault"
import { urlSource } from "../../src/tool/source"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

const model = {
  id: "source-contract", providerID: "test", name: "Source contract",
  api: { id: "source-contract", npm: "@ai-sdk/anthropic" }, options: {},
  limit: { context: 100000, input: 90000, output: 4096 },
  cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
  capabilities: {
    toolcall: true, attachment: false, reasoning: false, temperature: true,
    input: { text: true, image: false, audio: false, video: false },
    output: { text: true, image: false, audio: false, video: false },
  },
} as Provider.Model

async function assistant(directory: string) {
  const session = await Session.create({ kind: "assistant", title: "Source commit contract" })
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"), sessionID: session.id, role: "user",
    author: "build", agent: "build", time: { created: Date.now() },
    model: { providerID: model.providerID, modelID: model.id },
  })
  const message = await Session.updateMessage({
    id: Identifier.ascending("message"), sessionID: session.id, parentID: user.id,
    role: "assistant", author: "build", agent: "build", time: { created: Date.now() },
    modelID: model.id, providerID: model.providerID, path: { cwd: directory, root: directory },
    cost: 0, tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  })
  if (message.role !== "assistant") throw new Error("Expected assistant fixture")
  return { session, message, sessionID: session.id, messageID: message.id }
}

const source = (name: string) => urlSource({ url: `https://example.com/${name}`, title: name, provider: "contract" })

describe("source commit identity", () => {
  test("overlapping batches commit one ordered fact per source identity", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const scope = await assistant(project.path)
      const a = source("a"), b = source("b"), c = source("c")
      const batches = await Promise.all([
        persistMessageSources({ ...scope, sources: [a, b, a] }),
        persistMessageSources({ ...scope, sources: [a, c, b] }),
      ])
      const parts = await MessageStore.parts(scope.messageID)
      expect(parts.map((part) => ({ type: part.type, title: "title" in part ? part.title : undefined })))
        .toEqual([a, b, c].map((part) => ({ type: part.type, title: part.title })))
      expect(batches.flat().map((part) => part.id)).toEqual(parts.map((part) => part.id))
      expect(parts.map((part) => part.orderKey)).toEqual(parts.map(() => expect.any(String)))
    } })
  })

  test("different recovered tool calls share the same message source facts", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const scope = await assistant(project.path)
      const processor = SessionProcessor.create({
        assistantMessage: scope.message, sessionID: scope.sessionID, model, abort: new AbortController().signal,
      })
      await processor.ensureToolPart("source_a", "webfetch", { url: "https://example.com/shared" })
      await processor.ensureToolPart("source_b", "webfetch", { url: "https://example.com/shared" })
      await Promise.all(["source_a", "source_b"].map((call) => processor.completeRecoveredToolPart({
        toolCallID: call,
        toolInput: { url: "https://example.com/shared" },
        output: { output: "actual local result", title: call, metadata: {}, sources: [source("shared")] },
      })))
      const reloaded = await MessageStore.get({ sessionID: scope.sessionID, messageID: scope.messageID })
      expect(reloaded.parts.map((part) => part.type === "tool"
        ? { type: part.type, callID: part.callID, status: part.state.status }
        : { type: part.type, title: "title" in part ? part.title : undefined }))
        .toEqual([
          { type: "tool", callID: "source_a", status: "completed" },
          { type: "tool", callID: "source_b", status: "completed" },
          { type: "source-url", title: "shared" },
        ])
    } })
  })

  test("completed-message replay retains the original canonical identities", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const scope = await assistant(project.path)
      const input = { ...scope, sources: [source("durable")] }
      const committed = await persistMessageSources(input)
      await Session.updateMessage({ ...scope.message, finish: "stop", time: { ...scope.message.time, completed: Date.now() } })
      await persistMessageSources(input)
      expect(await MessageStore.parts(scope.messageID)).toEqual(committed)
    } })
  })

  test("each published source event observes the complete committed batch", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const scope = await assistant(project.path)
      const observed: { id: string; titles: (string | undefined)[] }[] = []
      const stop = Bus.subscribe(Message.Event.PartUpdated, ({ properties }) => {
        if (properties.part.messageID !== scope.messageID) return
        observed.push({
          id: properties.part.id,
          titles: Database.immediateTransaction((db) => MessageStore.sourcePartsInTransaction(db, scope).map((part) => part.title)),
        })
      })
      try {
        const committed = await persistMessageSources({ ...scope, sources: [source("one"), source("two")] })
        await Database.awaitEffectIdle(10_000)
        expect(observed).toEqual(committed.map((part) => ({ id: part.id, titles: ["one", "two"] })))
      } finally { stop() }
    } })
  })

  test("new source after assistant completion returns the canonical terminal error", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const scope = await assistant(project.path)
      const existing = source("accepted")
      const committed = await persistMessageSources({ ...scope, sources: [existing] })
      await Session.updateMessage({ ...scope.message, finish: "stop", time: { ...scope.message.time, completed: Date.now() } })
      await expect(persistMessageSources({ ...scope, sources: [existing, source("late")] }))
        .rejects.toBeInstanceOf(HostProcessingFaultError)
      expect(await MessageStore.parts(scope.messageID)).toEqual(committed)
    } })
  })

  test("source identity belongs to the exact session and message pair", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const first = await assistant(project.path), second = await assistant(project.path)
      const sources = [source("same")]
      const committed = await persistMessageSources({ ...first, sources })
      await expect(persistMessageSources({ sessionID: second.sessionID, messageID: first.messageID, sources }))
        .rejects.toBeInstanceOf(NotFoundError)
      const independent = await persistMessageSources({ ...second, sources })
      expect((await MessageStore.parts(first.messageID)).map((part) => part.id)).toEqual(committed.map((part) => part.id))
      expect((await MessageStore.parts(second.messageID)).map((part) => part.id)).toEqual(independent.map((part) => part.id))
      expect(new Set([...committed, ...independent].map((part) => part.id)).size).toBe(2)
    } })
  })

  test("separate projects retain independently scoped source identities", async () => {
    await using firstProject = await memoryProject("sources-first-project")
    await using secondProject = await memoryProject("sources-second-project")
    const sources = [source("shared-between-projects")]
    const first = await Instance.provide({ directory: firstProject.path, fn: async () => {
      const scope = await assistant(firstProject.path)
      return { scope, committed: await persistMessageSources({ ...scope, sources }) }
    } })
    const second = await Instance.provide({ directory: secondProject.path, fn: async () => {
      const scope = await assistant(secondProject.path)
      return { scope, committed: await persistMessageSources({ ...scope, sources }) }
    } })
    for (const [directory, state] of [[firstProject.path, first], [secondProject.path, second]] as const) {
      await Instance.provide({ directory, fn: async () => {
        await persistMessageSources({ ...state.scope, sources })
        expect(await MessageStore.parts(state.scope.messageID)).toEqual(state.committed)
      } })
    }
    expect(new Set([...first.committed, ...second.committed].map((part) => part.id)).size).toBe(2)
  })
})
