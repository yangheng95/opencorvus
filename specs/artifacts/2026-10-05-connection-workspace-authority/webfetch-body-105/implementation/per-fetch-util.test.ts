import { expect, test } from "bun:test"
import http from "node:http"
import { once } from "node:events"
import {
  readHttpResponseBody,
  disposeHttpResponseBody,
  fetchHttpResponseOwner,
} from "../../src/util/http-response-body"

async function localHTTP<T>(handler: http.RequestListener, run: (url: string) => Promise<T>) {
  const sockets = new Set<import("node:net").Socket>()
  const closed: Promise<void>[] = []
  const server = http.createServer(handler)
  server.on("connection", (socket) => {
    sockets.add(socket)
    closed.push(
      new Promise((resolve) =>
        socket.once("close", () => {
          sockets.delete(socket)
          resolve()
        }),
      ),
    )
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("Owned HTTP bind failed")
  try {
    return await run(`http://127.0.0.1:${address.port}`)
  } finally {
    const stopped = new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
    server.closeAllConnections()
    for (const socket of sockets) socket.destroy()
    await Promise.all([stopped, ...closed])
  }
}
async function rejected(operation: Promise<unknown>) {
  try {
    await operation
    throw new Error("Expected actual body failure")
  } catch (error) {
    return error
  }
}

test("real HTTP split UTF8/BOM bytes and exact byte boundary return complete EOF", async () => {
  const expected = new TextEncoder().encode("\uFEFF🙂界 exact bytes")
  await localHTTP(
    (_request, response) => {
      response.writeHead(200, { "content-type": "text/plain", "transfer-encoding": "chunked" })
      response.write(expected.subarray(0, 5))
      response.end(expected.subarray(5))
    },
    async (url) => {
      const owner = await fetchHttpResponseOwner((signal) => fetch(url, { signal }), new AbortController().signal)
      const response = owner.response
      const bytes = await readHttpResponseBody(owner, {
        maxBytes: expected.byteLength,
        error: () => new Error("Exact boundary overflow"),
      })
      expect(Array.from(bytes)).toEqual(Array.from(expected))
      expect({ locked: response.body?.locked, text: new TextDecoder().decode(bytes) }).toEqual({
        locked: false,
        text: "🙂界 exact bytes",
      })
    },
  )
})
test("real empty HTTP body returns exact empty bytes", async () => {
  await localHTTP(
    (_request, response) => {
      response.writeHead(204)
      response.end()
    },
    async (url) => {
      expect(
        Array.from(
          await readHttpResponseBody(
            await fetchHttpResponseOwner((signal) => fetch(url, { signal }), new AbortController().signal),
          ),
        ),
      ).toEqual([])
    },
  )
})
test("actual fetch parent abort preserves exact original read/cancel error", async () => {
  const controller = new AbortController()
  const reason = new DOMException("Owned parent abort", "AbortError")
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await localHTTP(
      (_request, response) => {
        response.writeHead(200, { "transfer-encoding": "chunked" })
        response.write("first")
        timer = setTimeout(() => {
          if (!response.destroyed) response.end("finite")
        }, 250)
      },
      async (url) => {
        const owner = await fetchHttpResponseOwner((signal) => fetch(url, { signal }), controller.signal)
        const response = owner.response
        const abort = setTimeout(() => controller.abort(reason), 70)
        try {
          expect(await rejected(readHttpResponseBody(owner))).toBe(reason)
          expect({ locked: response.body?.locked, aborted: controller.signal.aborted }).toEqual({
            locked: false,
            aborted: true,
          })
        } finally {
          clearTimeout(abort)
        }
      },
    )
  } finally {
    if (timer) clearTimeout(timer)
  }
})
test("real body limit cancels an unknown length body with original limit error", async () => {
  const limitError = new Error("Owned eight-byte limit")
  let timer: ReturnType<typeof setTimeout> | undefined
  let close!: () => void
  const wireClosed = new Promise<void>((resolve) => {
    close = resolve
  })
  try {
    await localHTTP(
      (_request, response) => {
        response.on("close", close)
        response.socket?.once("close", close)
        response.writeHead(200, { "transfer-encoding": "chunked" })
        response.write("123456789")
        timer = setTimeout(() => {
          if (!response.destroyed) response.end("finite")
        }, 250)
      },
      async (url) => {
        const owner = await fetchHttpResponseOwner((signal) => fetch(url, { signal }), new AbortController().signal)
        const response = owner.response
        expect(await rejected(readHttpResponseBody(owner, { maxBytes: 8, error: () => limitError }))).toBe(limitError)
        await wireClosed
        expect({ locked: response.body?.locked, limit: 8 }).toEqual({ locked: false, limit: 8 })
      },
    )
  } finally {
    if (timer) clearTimeout(timer)
  }
})
test("distinct real local stream cleanup error retains primary and cancellation cause", async () => {
  const primary = new Error("Local limit")
  const cleanup = new Error("Local cancellation fault")
  let observedReason: unknown
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]))
      },
      cancel(reason) {
        observedReason = reason
        throw cleanup
      },
    }),
  )
  const owner = await fetchHttpResponseOwner(async () => response, new AbortController().signal)
  const error = await rejected(readHttpResponseBody(owner, { maxBytes: 1, error: () => primary }))
  expect(error instanceof AggregateError ? error.errors : error).toEqual([primary, cleanup])
  expect(observedReason).toBe(primary)
  expect({ locked: response.body?.locked }).toEqual({ locked: false })
})
test("unconsumed body disposal settles its actual reader owner and preserves cleanup provenance", async () => {
  const primary = new Error("Rejected HTTP status")
  const cleanup = new Error("Cancellation fault")
  let cancelledWith: unknown
  const response = new Response(
    new ReadableStream({
      cancel(reason) {
        cancelledWith = reason
        throw cleanup
      },
    }),
  )
  const owner = await fetchHttpResponseOwner(async () => response, new AbortController().signal)
  const error = await rejected(disposeHttpResponseBody(owner, primary))
  expect(error instanceof AggregateError ? error.errors : error).toEqual([primary, cleanup])
  expect(cancelledWith).toBe(primary)
})
test("admitted mutable source chunks are copied before the next read mutates them", async () => {
  const shared = new Uint8Array([1, 2])
  let step = 0
  const response = new Response(
    new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          if (step++ === 0) controller.enqueue(shared)
          else {
            shared.set([3, 4])
            controller.enqueue(shared)
            controller.close()
          }
        },
      },
      { highWaterMark: 0 },
    ),
  )
  const owner = await fetchHttpResponseOwner(async () => response, new AbortController().signal)
  expect(Array.from(await readHttpResponseBody(owner))).toEqual([1, 2, 3, 4])
})

test("native local cancellation completion precedes disposal completion", async () => {
  const events: string[] = []
  let release!: () => void
  const completion = new Promise<void>((resolve) => {
    release = resolve
  })
  const response = new Response(
    new ReadableStream({
      cancel() {
        events.push("cancel_enter")
        return completion
      },
    }),
  )
  const owner = await fetchHttpResponseOwner(async () => response, new AbortController().signal)
  const operation = disposeHttpResponseBody(owner).then(() => {
    events.push("dispose_settled")
  })
  const timer = setTimeout(() => {
    events.push("cancel_release")
    release()
  }, 20)
  try {
    await Promise.all([operation, completion])
    expect(events).toEqual(["cancel_enter", "cancel_release", "dispose_settled"])
  } finally {
    clearTimeout(timer)
    release()
    await operation
  }
})
