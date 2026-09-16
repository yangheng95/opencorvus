import { afterEach, expect, spyOn, test } from "bun:test"
import { Bus } from "../../src/bus"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import type { Provider as ProviderType } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { SessionProcessor } from "../../src/session/processor"
import { SessionStatus } from "../../src/session/status"
import { SessionPromptState } from "../../src/session/prompt/state"
import { SessionLoop } from "../../src/session/loop"
import { Message } from "../../src/session/message"
import { MessageStore } from "../../src/session/message-store"
import { timelineMessageOrderKey } from "../../src/timeline/order"
import { ProjectGitLock } from "../../src/worktree/git-lock"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import { CatalogOccurrenceBinding } from "../../src/capability/catalog-binding"
import { resetDatabase } from "../fixture/db"
import { tmpdir } from "../fixture/fixture"

const model = { providerID: "test", modelID: "session-loop-occurrence" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Session Loop Occurrence Test",
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
    api: { id: model.modelID, url: "https://session-loop.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-09",
  } as ProviderType.Model
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetDatabase()
})

test("Session standby wakes for queued input older than the prior Turn final assistant", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: "Mid-Turn queued wake" })
    const other = await Session.create({ kind: "assistant", title: "Independent queued wake" })
    const now = Date.now()
    const queue = async (sessionID: string, time: number) => {
      const id = Identifier.ascending("message")
      await Session.persistMessage({ info: { id, sessionID, role: "user", author: "user",
        time: { created: time }, pendingDelivery: true, agent: "chat", model }, parts: [] })
      return id
    }
    await queue(other.id, now)
    expect([MessageStore.hasPendingInput(session.id), MessageStore.hasPendingInput(other.id)]).toEqual([false, true])
    const queuedID = await queue(session.id, now + 1)
    const final: Message.Assistant = { id: Identifier.ascending("message"), sessionID: session.id,
      role: "assistant", author: "chat", parentID: Identifier.ascending("message"),
      time: { created: now + 2, completed: now + 3 }, agent: "chat", providerID: model.providerID,
      modelID: model.modelID, path: { cwd: project.path, root: project.path }, cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } }, finish: "stop" }
    await Session.persistMessage({ info: final, parts: [] })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2_000)
    try {
      await SessionLoop.TestHooks.waitForUserMessage(session.id, controller.signal, timelineMessageOrderKey({ info: final }))
      expect({ awakened: !controller.signal.aborted, pending: MessageStore.hasPendingInput(session.id) })
        .toEqual({ awakened: true, pending: true })
      const stored = await MessageStore.get({ sessionID: session.id, messageID: queuedID })
      expect(stored.info).toMatchObject({ id: queuedID, pendingDelivery: true })
    } finally { clearTimeout(timeout); controller.abort() }
  } })
})

test("SessionLoop binds each accepted user message to its streaming execution occurrence", async () => {
  await using project = await tmpdir({ git: true })
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "SessionLoop occurrence owner" })
        const lifecycle: Array<{ inputMessageID: string; status: SessionStatus.Info }> = []
        const observedInsideProcessor: Array<{ inputMessageID: string; status: SessionStatus.Info }> = []
        let awaitedIdleInputMessageID: string | undefined
        let resolveFinalIdle!: () => void
        const finalIdle = new Promise<void>((resolve) => (resolveFinalIdle = resolve))
        const stopLifecycle = Bus.subscribe(SessionStatus.Event.Status, (event) => {
          if (event.properties.sessionID !== session.id) return
          lifecycle.push({
            inputMessageID: event.properties.inputMessageID,
            status: event.properties.status,
          })
          if (
            event.properties.inputMessageID === awaitedIdleInputMessageID &&
            event.properties.status.type === "idle"
          ) {
            resolveFinalIdle()
          }
        })
        const providerSpy = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
        const processorSpy = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
          const assistant = input.assistantMessage
          return {
            message: assistant,
            partFromToolCall() {
              return undefined
            },
            async process() {
              const occurrence = SessionStatus.executionOccurrence(session.id)
              expect(occurrence?.owner).toBe(input.abort)
              expect(occurrence?.inputMessageID).toBe(assistant.parentID)
              observedInsideProcessor.push({
                inputMessageID: occurrence!.inputMessageID,
                status: SessionStatus.get(session.id),
              })
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: session.id,
                messageID: assistant.id,
                type: "text",
                text: `completed ${observedInsideProcessor.length}`,
              })
              assistant.finish = "stop"
              assistant.time.completed = Date.now()
              await Session.updateMessage(assistant)
              return "stop"
            },
          } as any
        })

        try {
          const first = await SessionPrompt.prompt({
            sessionID: session.id,
            author: "user",
            agent: "chat",
            model,
            parts: [{ type: "text", text: "first accepted input" }],
          })
          await SessionPrompt.waitForFinish(session.id, project.path)
          expect(SessionPrompt.promptOwner(session.id)).toBeUndefined()
          expect(SessionPrompt.hasGeneration(session.id)).toBe(false)
          const lock = await ProjectGitLock.acquire(
            ProjectRuntimePaths.projectGitLock(Instance.project.worktree),
            Instance.project.id,
          )
          let second: Awaited<ReturnType<typeof SessionPrompt.prompt>>
          let third: Awaited<ReturnType<typeof SessionPrompt.prompt>>
          try {
            second = await SessionPrompt.prompt({
              sessionID: session.id,
              author: "user",
              agent: "chat",
              model,
              parts: [{ type: "text", text: "second accepted input" }],
            })
            while (!SessionPromptState.TestHooks.isPromptTerminating(session.id, project.path)) {
              await Bun.sleep(10)
            }
            expect(SessionPromptState.TestHooks.isPromptTerminating(session.id, project.path)).toBe(true)
            const thirdPrompt = SessionPrompt.prompt({
              sessionID: session.id,
              author: "user",
              agent: "chat",
              model,
              parts: [{ type: "text", text: "third accepted input during prior cleanup" }],
            })
            await lock.release()
            third = await thirdPrompt
          } finally {
            await lock.release()
          }
          await SessionPrompt.waitForFinish(session.id, project.path)
          expect(SessionPrompt.promptOwner(session.id)).toBeUndefined()
          expect(SessionPrompt.hasGeneration(session.id)).toBe(false)
          awaitedIdleInputMessageID = third.info.parentID
          if (
            lifecycle.some(
              (event) => event.inputMessageID === awaitedIdleInputMessageID && event.status.type === "idle",
            )
          ) {
            resolveFinalIdle()
          }
          await Promise.race([
            finalIdle,
            Bun.sleep(2_000).then(() => {
              throw new Error(`Session ${session.id} final idle lifecycle did not arrive`)
            }),
          ])

          expect(observedInsideProcessor).toEqual([
            { inputMessageID: first.info.parentID, status: { type: "streaming" } },
            { inputMessageID: second.info.parentID, status: { type: "streaming" } },
            { inputMessageID: third.info.parentID, status: { type: "streaming" } },
          ])
          expect(lifecycle).toEqual([
            { inputMessageID: first.info.parentID!, status: { type: "streaming" } },
            { inputMessageID: first.info.parentID!, status: { type: "idle" } },
            { inputMessageID: second.info.parentID!, status: { type: "streaming" } },
            { inputMessageID: second.info.parentID!, status: { type: "idle" } },
            { inputMessageID: third.info.parentID!, status: { type: "streaming" } },
            { inputMessageID: third.info.parentID!, status: { type: "idle" } },
          ])
          expect(first.info.parentID).not.toBe(second.info.parentID)
          expect(second.info.parentID).not.toBe(third.info.parentID)
          expect(SessionStatus.executionOccurrence(session.id)?.inputMessageID).toBe(third.info.parentID)
          const boundPayloads = await Promise.all(
            [first, second, third].map((reply) =>
              CatalogOccurrenceBinding.readAssistant({
                projectID: Instance.project.id,
                sessionID: session.id,
                assistantMessageID: reply.info.id,
              }),
            ),
          )
          expect(boundPayloads.map((payload) => payload.schema_version)).toEqual([3, 3, 3])
          expect(boundPayloads.map((payload) => payload.context.caller)).toEqual([
            "conversation",
            "conversation",
            "conversation",
          ])
          expect(boundPayloads.every((payload) => payload.descriptors.length > 0)).toBe(true)
        } finally {
          processorSpy.mockRestore()
          providerSpy.mockRestore()
          stopLifecycle()
        }
      },
    })
  } finally {
    // SessionLoop initializes directory-scoped services that retain Windows
    // handles until the Instance is disposed. Release them before tmpdir's
    // async-dispose removes the fixture directory.
    await Instance.disposeAll()
  }
}, 90_000)

test("Session standby wakes from a later durable Message whose deterministic ID sorts below the prior assistant", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "Deterministic wake ordering" })
      const before = Date.now()
      const assistant: Message.Assistant = {
        id: Identifier.ascending("message"),
        sessionID: session.id,
        role: "assistant",
        author: "chat",
        parentID: Identifier.ascending("message"),
        time: { created: before, completed: before + 1 },
        agent: "chat",
        providerID: model.providerID,
        modelID: model.modelID,
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        finish: "stop",
      }
      await Session.persistMessage({ info: assistant, parts: [] })
      const afterOrderKey = timelineMessageOrderKey({ info: assistant })
      const waiting = SessionLoop.TestHooks.waitForUserMessage(session.id, new AbortController().signal, afterOrderKey)
      const deterministicMessageID = "msg_automation_00000000000000000000000000000000"
      await Session.persistMessage({
        info: {
          id: deterministicMessageID,
          sessionID: session.id,
          role: "user",
          author: "orchestrator",
          time: { created: before + 2 },
          agent: "chat",
          model,
        },
        parts: [
          {
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: deterministicMessageID,
            type: "text",
            text: "wake the standby owner by persisted timeline order",
          },
        ],
      })
      await waiting
      expect({
        deterministicIDSortsBeforePriorAssistant: deterministicMessageID < assistant.id,
        laterTimelineOrder:
          timelineMessageOrderKey({ info: { id: deterministicMessageID, time: { created: before + 2 } } }) >
          afterOrderKey,
      }).toEqual({ deterministicIDSortsBeforePriorAssistant: true, laterTimelineOrder: true })
    },
  })
})

test("a queued mid-Turn input receives its own reply after the prior multi-step Turn settles", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: "Queued Turn boundary" })
    const queuedID = Identifier.ascending("message")
    let queuedReply: Promise<Message.WithParts> | undefined
    const parents: string[] = []
    const provider = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
    const processor = spyOn(SessionProcessor, "create").mockImplementation((input: any) => ({
      message: input.assistantMessage,
      partFromToolCall() { return undefined },
      async process() {
        const assistant = input.assistantMessage
        parents.push(assistant.parentID)
        if (parents.length === 1) {
          queuedReply = SessionPrompt.prompt({ sessionID: session.id, messageID: queuedID,
            author: "user", agent: "chat", model, parts: [{ type: "text", text: "queued while prior tools execute" }] })
          void queuedReply.catch(() => undefined)
          const deadline = Date.now() + 5_000
          while (!MessageStore.hasPendingInput(session.id)) {
            if (Date.now() >= deadline) throw new Error("Queued input did not persist")
            await Bun.sleep(10)
          }
        }
        await Session.updatePart({ id: Identifier.ascending("part"), sessionID: session.id,
          messageID: assistant.id, type: "text", text: `accepted ${assistant.parentID}` })
        assistant.finish = parents.length === 1 ? "tool-calls" : "stop"
        assistant.time.completed = Date.now()
        await Session.updateMessage(assistant)
        return parents.length < 3 ? "continue" : "stop"
      },
    }) as any)
    try {
      const first = await SessionPrompt.prompt({ sessionID: session.id, author: "user", agent: "chat", model,
        parts: [{ type: "text", text: "complete the initial multi-step Turn" }] })
      const second = await Promise.race([queuedReply!, Bun.sleep(5_000).then(() => { throw new Error("Queued Turn was stranded") })])
      expect(parents).toEqual([first.info.parentID!, first.info.parentID!, queuedID])
      expect(second.info).toMatchObject({ role: "assistant", parentID: queuedID, acceptedInputMessageIDs: [queuedID], finish: "stop" })
      await SessionPrompt.waitForFinish(session.id, project.path)
    } finally { processor.mockRestore(); provider.mockRestore(); await SessionPromptState.release(session.id, project.path) }
  } })
}, 30_000)
