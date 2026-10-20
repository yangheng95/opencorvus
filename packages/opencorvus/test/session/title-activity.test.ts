import { APICallError } from "ai"
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
        stream: (async function* () {
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
      activity: { id: expect.any(String), attempt: 0 },
    })
    expect(setTitleSpy.mock.calls).toEqual([[{ sessionID: session.id, title: "Bounded title", expectedTitle: session.title }]])
  })

  test("binds the title collector retry to one actual activity and persists its result", async () => {
    const { session, history } = titleFixture()
    const inputs: Parameters<typeof LLM.stream>[0][] = []
    const original = new APICallError({ message: "local fixture service unavailable", url: "https://example.invalid/responses", requestBodyValues: {}, statusCode: 503, isRetryable: true })
    track(spyOn(LLM, "stream").mockImplementation(async (input) => {
      inputs.push(input)
      const first = inputs.length === 1
      return { stream: (async function* () {
        if (first) yield { type: "error" as const, error: original }
        else yield { type: "text-delta" as const, id: "title", text: "Retry title" }
      })() } as never
    }))
    const writer = track(spyOn(Session, "setTitle").mockResolvedValue(session))
    await ensureTitle({ session, history, abort: new AbortController().signal })
    console.info(JSON.stringify({ contract: "title activity retry", calls: inputs.map((input) => ({ activity: input.activity, sessionID: input.sessionID, userID: input.user?.id, agentID: input.agentID })) }))
    expect(inputs.map((input) => input.activity?.attempt)).toEqual([0, 1])
    expect(new Set(inputs.map((input) => input.activity?.id)).size).toBe(1)
    expect(inputs[0]?.activity?.id).toEqual(expect.any(String))
    expect(inputs.map((input) => ({ sessionID: input.sessionID, userID: input.user?.id }))).toEqual([
      { sessionID: session.id, userID: history[0]!.info.id }, { sessionID: session.id, userID: history[0]!.info.id },
    ])
    expect(writer.mock.calls).toEqual([[{ sessionID: session.id, title: "Retry title", expectedTitle: session.title }]])
  })
  test("streams from the first human identity with a real host prefix and multiple human inputs", async () => {
    const { session, history } = titleFixture()
    const firstHuman = history[0]!
    const host = { ...firstHuman, info: { ...firstHuman.info, id: "controller-prefix", author: "goal-controller" } }
    const secondHuman = { ...firstHuman, info: { ...firstHuman.info, id: "second-human" } }
    const calls: Parameters<typeof LLM.stream>[0][] = []
    track(spyOn(LLM, "stream").mockImplementation(async input => {
      calls.push(input)
      return { stream: (async function* () {
        yield { type: "text-delta" as const, id: "title", text: "Actual human outcome" }
      })() } as never
    }))
    const writer = track(spyOn(Session, "setTitle").mockResolvedValue(session))
    await ensureTitle({ session, history: [host, firstHuman, secondHuman] as Message.WithParts[], abort: new AbortController().signal })
    expect(calls.map(input => ({ id: input.user?.id, author: input.user?.author }))).toEqual([{ id: firstHuman.info.id, author: "user" }])
    expect(writer.mock.calls).toEqual([[{ sessionID: session.id, title: "Actual human outcome", expectedTitle: session.title }]])
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
          stream: (async function* () {
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
