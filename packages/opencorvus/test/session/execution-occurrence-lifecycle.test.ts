import { afterEach, expect, test } from "bun:test"
import { Bus } from "../../src/bus"
import { GlobalBus } from "../../src/bus/global"
import { Instance, runAsInstanceActivity } from "../../src/project/instance"
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

test("one exact generation settlement releases a waiter while its reusable prompt owner remains live", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "reusable standby owner" })
      const input = await Session.updateMessage({
        id: Identifier.ascending("message"),
        role: "user",
        sessionID: session.id,
        author: "orchestrator",
        time: { created: Date.now() },
        agent: "orchestrator",
        model: { providerID: "test", modelID: "test" },
      })
      const owner = new AbortController()
      SessionStatus.beginExecutionOccurrence(session.id, input.id, owner.signal)
      await SessionStatus.set(session.id, { type: "streaming" }, { inputMessageID: input.id })

      let released = false
      const settlement = SessionStatus.waitForExecutionSettlement({
        sessionID: session.id,
        inputMessageID: input.id,
        owner: owner.signal,
      }).then(() => {
        released = true
      })
      await Promise.resolve()
      expect(released).toBe(false)

      await SessionStatus.set(session.id, { type: "idle" }, { inputMessageID: input.id })
      await settlement
      expect({ released, status: SessionStatus.getExecution(session.id, input.id), ownerAborted: owner.signal.aborted }).toEqual({
        released: true,
        status: { type: "idle" },
        ownerAborted: false,
      })
    },
  })
})

test("an accepted prompt Turn publishes its exact occurrence idle before the reusable owner returns to standby", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "accepted parked turn" })
      const input = await Session.updateMessage({
        id: Identifier.ascending("message"),
        role: "user",
        sessionID: session.id,
        author: "orchestrator",
        time: { created: Date.now() },
        agent: "orchestrator",
        model: { providerID: "test", modelID: "test" },
      })
      const owner = new AbortController()
      SessionStatus.beginPromptGeneration(session.id, owner.signal)
      SessionStatus.beginExecutionOccurrence(session.id, input.id, owner.signal)
      await SessionStatus.set(session.id, { type: "streaming" }, { promptGenerationOwner: owner.signal })

      const settlement = SessionStatus.waitForExecutionSettlement({
        sessionID: session.id,
        inputMessageID: input.id,
        owner: owner.signal,
      })
      await SessionStatus.settleAcceptedExecutionOccurrence(session.id, owner.signal)
      await settlement

      expect({
        status: SessionStatus.getExecution(session.id, input.id),
        ownerAborted: owner.signal.aborted,
      }).toEqual({
        status: { type: "idle" },
        ownerAborted: false,
      })
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
      await SessionStatus.set(session.id, { type: "streaming" }, { inputMessageID: input.id })

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

test("an unawaited lifecycle publication retains subscriber authority until the exact global envelope settles", async () => {
  await using project = await tmpdir({ git: true })
  let unsubscribeStatus = () => {}
  const globalEvents: Array<{ directory?: string; payload: unknown }> = []
  const onGlobalEvent = (event: { directory?: string; payload: unknown }) => globalEvents.push(event)
  GlobalBus.on("event", onGlobalEvent)
  let sessionID = ""
  let inputMessageID = ""
  const subscriberReads: string[] = []
  try {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "tracked lifecycle publication" })
        const input = await Session.updateMessage({
          id: Identifier.ascending("message"),
          role: "user",
          sessionID: session.id,
          author: "user",
          time: { created: Date.now() },
          agent: "assistant",
          model: { providerID: "test", modelID: "test" },
        })
        sessionID = session.id
        inputMessageID = input.id
        unsubscribeStatus = Bus.subscribe(SessionStatus.Event.Status, async (event) => {
          if (event.properties.sessionID !== session.id) return
          await new Promise((resolve) => setTimeout(resolve, 25))
          subscriberReads.push((await Session.get(session.id)).id)
        })

        const owner = new AbortController()
        SessionStatus.beginExecutionOccurrence(session.id, input.id, owner.signal)
        void SessionStatus.set(session.id, { type: "idle" }, { inputMessageID: input.id })
      },
    })

    expect(subscriberReads).toEqual([sessionID])
    expect(
      globalEvents
        .filter(
          (event) =>
            (event.payload as { type?: string }).type === SessionStatus.Event.Status.type &&
            (event.payload as { properties?: { sessionID?: string } }).properties?.sessionID === sessionID,
        )
        .map((event) => ({
          directory: event.directory,
          inputMessageID: (event.payload as { properties: { inputMessageID: string } }).properties.inputMessageID,
          status: (event.payload as { properties: { status: SessionStatus.Info } }).properties.status,
        })),
    ).toEqual([{ directory: project.path, inputMessageID, status: { type: "idle" } }])
  } finally {
    unsubscribeStatus()
    GlobalBus.off("event", onGlobalEvent)
  }
})

test("a synchronous activity factory error is an owned rejected Promise and the lease remains usable", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const failed = runAsInstanceActivity(() => {
        throw new Error("activity factory rejected before its first await")
      })
      await expect(failed).rejects.toThrow("activity factory rejected before its first await")
      await expect(
        runAsInstanceActivity(async () => {
          await Promise.resolve()
          return Instance.project.id
        }),
      ).resolves.toBe(Instance.project.id)
    },
  })
})

test("a synchronous lifecycle subscriber can re-enter the same publication without a Promise cycle", async () => {
  await using project = await tmpdir({ git: true })
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "assistant", title: "lifecycle re-entry" })
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
      const observed: SessionStatus.Info[] = []
      const unsubscribe = Bus.subscribe(SessionStatus.Event.Status, (event) => {
        if (event.properties.sessionID !== session.id) return
        observed.push(event.properties.status)
        return SessionStatus.set(session.id, event.properties.status, { inputMessageID: input.id })
      })
      try {
        await SessionStatus.set(session.id, { type: "streaming" }, { inputMessageID: input.id })
        expect(observed).toEqual([{ type: "streaming" }])
      } finally {
        unsubscribe()
      }
    },
  })
})
