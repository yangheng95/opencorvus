import { expect, test } from "bun:test"
import {
  ProviderResponseObserverConflictError,
  registerProviderResponseObserver,
  takeProviderResponseObserver,
  type ProviderResponseObserver,
} from "../src/util/provider-response-observation"
import { settlementTrackedReadableStream, type ReadableStreamActivitySettlement } from "../src/util/stream-activity"

test("actual reader rejection publishes fixed safe cause and preserves original error", async () => {
  const failure = Object.assign(new TypeError("private fixture detail"), { code: "ECONNRESET" })
  const causes: unknown[] = []
  const reader = settlementTrackedReadableStream({
    source: new ReadableStream<Uint8Array>({ pull(controller) { controller.error(failure) } }),
    onSettlement: (kind, cause?: unknown) => causes.push({ kind, cause }),
  }).getReader()
  expect(await reader.read().catch((error: unknown) => error)).toBe(failure)
  expect(causes).toEqual([{ kind: "error", cause: { origin: "read", type: "TypeError", code: "ECONNRESET" } }])
})

test("actual chunk callback rejection retains its operation and original object", async () => {
  const failure = new RangeError("private chunk callback detail")
  const causes: unknown[] = []
  const reader = settlementTrackedReadableStream({
    source: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([19])) } }),
    onChunk: () => { throw failure },
    onSettlement: (kind, cause?: unknown) => causes.push({ kind, cause }),
  }).getReader()
  expect(await reader.read().catch((error: unknown) => error)).toBe(failure)
  expect(causes).toEqual([{ kind: "error", cause: { origin: "on_chunk", type: "RangeError" } }])
})

test("unknown getter-bearing producer error retains original and fixed unknown cause", async () => {
  const failure: unknown = Object.create(null, { code: { get() { throw new Error("unsafe getter") } } })
  const causes: unknown[] = []
  const reader = settlementTrackedReadableStream({
    source: new ReadableStream<Uint8Array>({ pull(controller) { controller.error(failure) } }),
    onSettlement: (kind, cause?: unknown) => causes.push({ kind, cause }),
  }).getReader()
  expect(await reader.read().catch((error: unknown) => error)).toBe(failure)
  expect(causes).toEqual([{ kind: "error", cause: { origin: "read", type: "unknown" } }])
})

function observation() {
  const facts = { binds: 0, lengths: [] as number[], settlements: [] as ReadableStreamActivitySettlement[], errors: 0 }
  const observer: ProviderResponseObserver = {
    onBind: () => { facts.binds++ },
    onChunk: (length) => { facts.lengths.push(length) },
    onSettlement: (kind) => { facts.settlements.push(kind) },
    onObservationError: () => { facts.errors++ },
  }
  return { facts, observer }
}

function observedBody(response: Response, signal?: AbortSignal) {
  const observer = takeProviderResponseObserver(response)
  if (!observer || !response.body) throw new Error("Owned response observation prerequisite missing")
  const wrapped = settlementTrackedReadableStream({ source: response.body, signal,
    onChunk: (chunk) => observer.onChunk(chunk.byteLength), onSettlement: observer.onSettlement })
  observer.onBind()
  return wrapped
}

test("exact Response registration retains its actual owner through a typed conflict", () => {
  const response = new Response("owned")
  const owner = observation()
  registerProviderResponseObserver(response, owner.observer)
  let conflict: unknown
  try { registerProviderResponseObserver(response, observation().observer) } catch (error) { conflict = error }
  expect(conflict).toBeInstanceOf(ProviderResponseObserverConflictError)
  expect(conflict).toMatchObject({ name: "ProviderResponseObserverConflictError", code: "PROVIDER_RESPONSE_OBSERVER_CONFLICT" })
  const first = takeProviderResponseObserver(response)
  first!.onBind()
  first!.onChunk(5)
  first!.onSettlement("eof")
  expect(owner.facts).toEqual({ binds: 1, lengths: [5], settlements: ["eof"], errors: 0 })
})

test("controlled split and empty chunks preserve exact bytes and joined EOF scalars", async () => {
  const chunks = [new Uint8Array([58, 32]), new Uint8Array(), new Uint8Array([10, 10]), new TextEncoder().encode('data: {"tool":"Read"}\n\n')]
  let index = 0
  const response = new Response(new ReadableStream<Uint8Array>({ pull(controller) {
    if (index < chunks.length) controller.enqueue(chunks[index++]!)
    else controller.close()
  } }))
  const owner = observation()
  registerProviderResponseObserver(response, owner.observer)
  const bytes = new Uint8Array(await new Response(observedBody(response)).arrayBuffer())
  expect([...bytes]).toEqual(chunks.flatMap((chunk) => [...chunk]))
  expect(owner.facts).toEqual({ binds: 1, lengths: chunks.map((chunk) => chunk.byteLength), settlements: ["eof"], errors: 0 })
})

for (const terminal of ["cancelled", "aborted"] as const) {
  test(`${terminal} waits for actual upstream cleanup before publishing physical settlement`, async () => {
    const requested = Promise.withResolvers<void>()
    const cleanup = Promise.withResolvers<void>()
    const settled = Promise.withResolvers<void>()
    const events: string[] = []
    const reason = new DOMException("owned reader stop", "AbortError")
    let actualReason: unknown
    const response = new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new Uint8Array([7])) },
      cancel(value) { actualReason = value; events.push("cleanup-requested"); requested.resolve(); return cleanup.promise },
    }))
    const owner = observation()
    registerProviderResponseObserver(response, { ...owner.observer, onSettlement(kind) {
      owner.observer.onSettlement(kind); events.push(`settled:${kind}`); settled.resolve()
    } })
    const controller = new AbortController()
    const reader = observedBody(response, controller.signal).getReader()
    expect(await reader.read()).toEqual({ done: false, value: new Uint8Array([7]) })
    const completion = terminal === "cancelled" ? reader.cancel(reason) : (controller.abort(reason), Promise.resolve())
    await requested.promise
    expect({ events, actualReason }).toEqual({ events: ["cleanup-requested"], actualReason: reason })
    events.push("cleanup-completed"); cleanup.resolve()
    await completion; await settled.promise
    expect(events).toEqual(["cleanup-requested", "cleanup-completed", `settled:${terminal}`])
    expect(owner.facts).toEqual({ binds: 1, lengths: [1], settlements: [terminal], errors: 0 })
    if (terminal === "aborted") expect(await reader.read().catch((error) => error)).toBe(reason)
  })
}

test("actual read error retains its producer error and error settlement", async () => {
  const failure = new Error("owned upstream read failed")
  const response = new Response(new ReadableStream<Uint8Array>({ pull(controller) { controller.error(failure) } }))
  const owner = observation(); registerProviderResponseObserver(response, owner.observer)
  expect(await observedBody(response).getReader().read().catch((error) => error)).toBe(failure)
  expect(owner.facts).toEqual({ binds: 1, lengths: [], settlements: ["error"], errors: 0 })
})

test("an already-aborted owner retains its exact abort reason and joins upstream cleanup", async () => {
  const ownerAbort = new AbortController()
  const reason = new DOMException("owner ended before reader construction", "AbortError")
  ownerAbort.abort(reason)
  const cleanup = Promise.withResolvers<void>()
  const settled = Promise.withResolvers<void>()
  const events: string[] = []
  let actualReason: unknown
  const response = new Response(new ReadableStream<Uint8Array>({
    cancel(value) { actualReason = value; events.push("cleanup-requested"); return cleanup.promise },
  }))
  const owner = observation()
  registerProviderResponseObserver(response, { ...owner.observer, onSettlement(kind) {
    owner.observer.onSettlement(kind); events.push(`settled:${kind}`); settled.resolve()
  } })
  const reader = observedBody(response, ownerAbort.signal).getReader()
  expect(await reader.read().catch((error: unknown) => error)).toBe(reason)
  expect({ actualReason, events, binds: owner.facts.binds }).toEqual({ actualReason: reason, events: ["cleanup-requested"], binds: 1 })
  events.push("cleanup-completed"); cleanup.resolve()
  await settled.promise
  expect(events).toEqual(["cleanup-requested", "cleanup-completed", "settled:aborted"])
  expect(owner.facts).toEqual({ binds: 1, lengths: [], settlements: ["aborted"], errors: 0 })
})

test("diagnostic callback failures preserve the actual response output and EOF", async () => {
  const response = new Response("actual output")
  const errors: string[] = []
  registerProviderResponseObserver(response, {
    onBind() { throw new Error("diagnostic bind failure") },
    onChunk() { throw new Error("diagnostic chunk failure") },
    onSettlement() { throw new Error("diagnostic settlement failure") },
    onObservationError() { errors.push("callback_failed") },
  })
  expect(await new Response(observedBody(response)).text()).toBe("actual output")
  expect(errors).toEqual(["callback_failed", "callback_failed", "callback_failed"])
})

test("two concurrent real HTTP responses retain exact object ownership and actual SSE bytes", async () => {
  const bodies = [': keepalive\n\ndata: {"tool":"Read"}\n\n', 'data: second\n\n']
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    const index = Number(new URL(request.url).pathname.slice(1))
    return new Response(bodies[index], { headers: { "Content-Type": "text/event-stream", "X-Owned-Response": String(index) } })
  } })
  try {
    const responses = await Promise.all([fetch(new URL("0", server.url)), fetch(new URL("1", server.url))])
    const owners = responses.map((response) => { const owner = observation(); registerProviderResponseObserver(response, owner.observer); return owner })
    const values = await Promise.all(responses.map((response) => new Response(observedBody(response)).text()))
    expect(values).toEqual(bodies)
    for (let index = 0; index < owners.length; index++) {
      expect({ binds: owners[index]!.facts.binds, bytes: owners[index]!.facts.lengths.reduce((sum, length) => sum + length, 0),
        settlements: owners[index]!.facts.settlements, status: responses[index]!.status, header: responses[index]!.headers.get("X-Owned-Response") })
        .toEqual({ binds: 1, bytes: new TextEncoder().encode(bodies[index]!).byteLength, settlements: ["eof"], status: 200, header: String(index) })
      expect(owners[index]!.facts.lengths.length).toBeGreaterThanOrEqual(1)
    }
  } finally { await server.stop(true) }
})
