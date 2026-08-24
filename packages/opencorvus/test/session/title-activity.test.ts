import { afterEach, describe, expect, spyOn, test } from "bun:test"
import * as AgentModel from "@/agent/model"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { EffectiveConfig } from "@/config/effective"
import { LLM } from "@/session/llm"
import { Message } from "@/session/message"
import { Session } from "@/session"
import { ensureTitle } from "@/session/prompt/title"

const restore: Array<() => void> = []

function track<T extends { mockRestore(): void }>(mock: T): T {
  restore.push(() => mock.mockRestore())
  return mock
}

afterEach(() => {
  for (const cleanup of restore.splice(0).reverse()) cleanup()
})

function titleFixture() {
  const session = {
    id: "session-title-activity",
    title: "New session - 2026-08-25T00:00:00.000Z",
  } as Session.Info
  const history = [
    {
      info: {
        id: "message-title-user",
        sessionID: session.id,
        role: "user",
        author: "user",
        agent: "assistant",
        model: { providerID: "test", modelID: "title-model" },
        time: { created: 1 },
      },
      parts: [],
    },
  ] as Message.WithParts[]
  const model = { providerID: "test", id: "title-model" } as never

  track(spyOn(EffectiveConfig, "effective").mockResolvedValue({} as never))
  track(spyOn(HelperAgentRegistry, "get").mockResolvedValue({ name: "title", options: {} } as never))
  track(spyOn(AgentModel, "resolveAgentModel").mockResolvedValue(model))
  track(spyOn(Message, "toModelMessages").mockResolvedValue([]))
  return { session, history }
}

describe("Session title LLM activity", () => {
  test("streams a generated title and persists the normalized first line", async () => {
    const { session, history } = titleFixture()
    const streamSpy = track(
      spyOn(LLM, "stream").mockResolvedValue({
        fullStream: (async function* () {
          yield { type: "start" as const }
          yield { type: "text-delta" as const, id: "text-1", text: "  Bounded title  \nignored" }
          yield { type: "finish" as const }
        })(),
      } as never),
    )
    const setTitleSpy = track(spyOn(Session, "setTitle").mockResolvedValue(session))

    await ensureTitle({ session, history, abort: new AbortController().signal })

    expect(streamSpy.mock.calls[0]![0]).toMatchObject({
      sessionID: session.id,
      model: { providerID: "test", id: "title-model" },
      retries: 0,
    })
    expect(setTitleSpy.mock.calls).toEqual([[{ sessionID: session.id, title: "Bounded title" }]])
  })

  test("composes the execution occurrence abort into the title activity signal", async () => {
    const { session, history } = titleFixture()
    const occurrence = new AbortController()
    const reason = new DOMException("occurrence cancelled", "AbortError")
    let activitySignal!: AbortSignal
    let started!: () => void
    const streamStarted = new Promise<void>((resolve) => (started = resolve))
    track(
      spyOn(LLM, "stream").mockImplementation(async (input) => {
        activitySignal = input.abort
        started()
        return {
          fullStream: (async function* () {
            await new Promise((_, reject) => {
              if (activitySignal.aborted) reject(activitySignal.reason)
              else activitySignal.addEventListener("abort", () => reject(activitySignal.reason), { once: true })
            })
          })(),
        } as never
      }),
    )

    const generation = ensureTitle({ session, history, abort: occurrence.signal })
    await streamStarted
    occurrence.abort(reason)
    await generation

    expect({ aborted: activitySignal.aborted, reason: activitySignal.reason }).toEqual({ aborted: true, reason })
  })
})
