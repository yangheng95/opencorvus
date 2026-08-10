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
import { resetDatabase } from "../fixture/db"
import { tmpdir } from "../fixture/fixture"

const model = { providerID: "test", modelID: "session-loop-occurrence" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Session Loop Occurrence Test",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
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

test("SessionLoop binds each accepted user message to its streaming execution occurrence", async () => {
  await using project = await tmpdir({ git: true })
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "SessionLoop occurrence owner" })
        const lifecycle: Array<{ inputMessageID: string; status: SessionStatus.Info }> = []
        const observedInsideProcessor: Array<{ inputMessageID: string; status: SessionStatus.Info }> = []
        const stopLifecycle = Bus.subscribe(SessionStatus.Event.Status, (event) => {
          if (event.properties.sessionID !== session.id) return
          lifecycle.push({
            inputMessageID: event.properties.inputMessageID,
            status: event.properties.status,
          })
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
          const second = await SessionPrompt.prompt({
            sessionID: session.id,
            author: "user",
            agent: "chat",
            model,
            parts: [{ type: "text", text: "second accepted input" }],
          })
          await SessionPrompt.waitForFinish(session.id, project.path)

          expect(observedInsideProcessor).toEqual([
            { inputMessageID: first.info.parentID, status: { type: "streaming" } },
            { inputMessageID: second.info.parentID, status: { type: "streaming" } },
          ])
          expect(lifecycle).toEqual([
            { inputMessageID: first.info.parentID!, status: { type: "streaming" } },
            { inputMessageID: second.info.parentID!, status: { type: "streaming" } },
          ])
          expect(first.info.parentID).not.toBe(second.info.parentID)
          expect(SessionStatus.executionOccurrence(session.id)?.inputMessageID).toBe(second.info.parentID)
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
