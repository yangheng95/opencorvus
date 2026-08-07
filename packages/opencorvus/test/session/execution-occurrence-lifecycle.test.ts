import { afterEach, expect, test } from "bun:test"
import { Bus } from "../../src/bus"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { SessionStatus } from "../../src/session/status"
import { resetDatabase } from "../fixture/db"
import { tmpdir } from "../fixture/fixture"
import { Identifier } from "../../src/id/id"

afterEach(async () => {
  await Instance.disposeAll()
  await resetDatabase()
})

test("one reusable Session publishes independent lifecycle histories for consecutive input messages", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "reusable execution owner" })
      const firstOwner = new AbortController()
      const secondOwner = new AbortController()
      const lifecycle: Array<{ inputMessageID: string; orderKey: string; status: SessionStatus.Info }> = []
      const firstInput = await Session.updateMessage({
        id: Identifier.ascending("message"),
        role: "user",
        sessionID: session.id,
        author: "user",
        time: { created: Date.now() },
        agent: "assistant",
        model: { providerID: "test", modelID: "test" },
      })
      const secondInput = await Session.updateMessage({
        id: Identifier.ascending("message"),
        role: "user",
        sessionID: session.id,
        author: "user",
        time: { created: Date.now() + 1 },
        agent: "assistant",
        model: { providerID: "test", modelID: "test" },
      })
      const unsubscribe = Bus.subscribe(SessionStatus.Event.Status, (event) => {
        if (event.properties.sessionID !== session.id) return
        lifecycle.push({
          inputMessageID: event.properties.inputMessageID,
          orderKey: event.properties.orderKey,
          status: event.properties.status,
        })
      })

      try {
        SessionStatus.beginExecutionOccurrence(session.id, firstInput.id, firstOwner.signal)
        await SessionStatus.set(session.id, { type: "streaming" }, { inputMessageID: firstInput.id })
        await SessionStatus.set(
          session.id,
          { type: "terminal", reason: "coordinated" },
          { inputMessageID: firstInput.id },
        )

        SessionStatus.beginExecutionOccurrence(session.id, secondInput.id, secondOwner.signal)
        await SessionStatus.set(session.id, { type: "streaming" }, { inputMessageID: secondInput.id })
        await SessionStatus.set(
          session.id,
          { type: "terminal", reason: "completed" },
          { inputMessageID: secondInput.id },
        )

        expect(lifecycle.map(({ inputMessageID, status }) => ({ inputMessageID, status }))).toEqual([
          { inputMessageID: firstInput.id, status: { type: "streaming" } },
          {
            inputMessageID: firstInput.id,
            status: { type: "terminal", reason: "coordinated" },
          },
          { inputMessageID: secondInput.id, status: { type: "streaming" } },
          {
            inputMessageID: secondInput.id,
            status: { type: "terminal", reason: "completed" },
          },
        ])
        expect([...new Set(lifecycle.map((event) => event.orderKey))]).toEqual([
          lifecycle[0]!.orderKey,
          lifecycle[2]!.orderKey,
        ])
        expect(lifecycle[0]!.orderKey < lifecycle[2]!.orderKey).toBe(true)
        expect(SessionStatus.get(session.id)).toEqual({ type: "terminal", reason: "completed" })
      } finally {
        unsubscribe()
      }
    },
  })
})

test("a failed terminal publication releases its occurrence latch for the successful publication", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "terminal publication retry owner" })
      const input = await Session.updateMessage({
        id: Identifier.ascending("message"),
        role: "user",
        sessionID: session.id,
        author: "user",
        time: { created: Date.now() },
        agent: "assistant",
        model: { providerID: "test", modelID: "test" },
      })
      const owner = new AbortController()
      SessionStatus.beginExecutionOccurrence(session.id, input.id, owner.signal)
      await SessionStatus.set(session.id, { type: "streaming" }, { publish: false, inputMessageID: input.id })

      const stopFailure = Bus.subscribe(SessionStatus.Event.Status, () => {
        throw new Error("lifecycle persistence unavailable")
      })
      await SessionStatus.set(
        session.id,
        { type: "terminal", reason: "completed" },
        { inputMessageID: input.id },
      ).catch(() => undefined)
      stopFailure()

      const delivered: SessionStatus.Info[] = []
      const stopCapture = Bus.subscribe(SessionStatus.Event.Status, (event) => {
        delivered.push(event.properties.status)
      })
      try {
        await SessionStatus.set(session.id, { type: "terminal", reason: "completed" }, { inputMessageID: input.id })
        expect(delivered).toEqual([{ type: "terminal", reason: "completed" }])
        expect(SessionStatus.getExecution(session.id, input.id)).toEqual({ type: "terminal", reason: "completed" })
      } finally {
        stopCapture()
      }
    },
  })
})
