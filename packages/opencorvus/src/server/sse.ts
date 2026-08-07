import type { Context } from "hono"
import { streamSSE as honoStreamSSE, type SSEStreamingApi } from "hono/streaming"
import { AsyncLocalStorage } from "node:async_hooks"
import { Log } from "@/util/log"
import { runOutsideInstanceContext } from "@/project/instance"
import { runWithIndependentProjectIdentity } from "@/project/independent-project-owner"
import { Database } from "@/storage/db"

export type StreamSSEBind = <Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
) => (...args: Args) => Result

export type SerializedSSEStream = Pick<SSEStreamingApi, "writeSSE">

export function createSerializedSSEWriter(
  stream: SerializedSSEStream,
  onFailure: (error: unknown) => void,
) {
  let accepting = true
  let failed = false
  let failure: unknown
  let tail = Promise.resolve()

  const fail = (error: unknown) => {
    if (failed) return
    failed = true
    failure = error
    accepting = false
    try {
      onFailure(error)
    } catch (cleanupFailure) {
      failure = new AggregateError([error, cleanupFailure], "Server-Sent Events writer failure cleanup also failed", {
        cause: error,
      })
      log.warn("Server-Sent Events writer cleanup failed", {
        error: cleanupFailure instanceof Error ? cleanupFailure.message : String(cleanupFailure),
      })
    }
  }

  return {
    write(data: string) {
      if (!accepting) return tail
      tail = tail.then(() => stream.writeSSE({ data })).catch(fail)
      return tail
    },
    stop() {
      accepting = false
    },
    idle() {
      return tail
    },
    failure() {
      return failure
    },
  }
}

type StreamSSECallback = (stream: SSEStreamingApi, bind: StreamSSEBind) => Promise<void>
type StreamSSEErrorHandler = (error: Error, stream: SSEStreamingApi) => Promise<void>
type AbortListener = () => void | Promise<void>

const log = Log.create({ service: "server.sse" })

// SSE means Server-Sent Events; this wrapper is the only server-side SSE primitive.
function attachRequestAbort(c: Context, stream: SSEStreamingApi) {
  const signal = c.req.raw.signal
  const originalOnAbort = stream.onAbort.bind(stream) as (listener: AbortListener) => void

  stream.onAbort = ((listener: AbortListener) => {
    originalOnAbort(listener)
    if (stream.aborted || signal.aborted) {
      void Promise.resolve()
        .then(listener)
        .catch((error) => {
          log.warn("SSE abort listener failed", { error: error instanceof Error ? error.message : String(error) })
        })
    }
  }) as typeof stream.onAbort

  const abort = () => {
    stream.abort()
  }

  if (signal.aborted) {
    abort()
    return () => {}
  }

  signal.addEventListener("abort", abort, { once: true })
  return () => signal.removeEventListener("abort", abort)
}

function createSSEStream(
  c: Context,
  runInScope: (run: () => Promise<void>) => Promise<void>,
  cb: StreamSSECallback,
  onError?: StreamSSEErrorHandler,
): Response {
  return honoStreamSSE(
    c,
    async (stream) => {
      const run = async () => {
        const restoreStreamContext = AsyncLocalStorage.snapshot()
        const bind: StreamSSEBind = (callback) => {
          return (...args) => restoreStreamContext(() => Database.runOutsideContext(() => callback(...args)))
        }
        const detach = attachRequestAbort(c, stream)
        try {
          await cb(stream, bind)
        } finally {
          detach()
        }
      }
      return runInScope(run)
    },
    onError,
  )
}

export function streamGlobalSSE(c: Context, cb: StreamSSECallback, onError?: StreamSSEErrorHandler): Response {
  return createSSEStream(c, (run) => Database.runOutsideContext(() => runOutsideInstanceContext(run)), cb, onError)
}

export function streamProjectSSE(
  c: Context,
  directory: string,
  cb: StreamSSECallback,
  onError?: StreamSSEErrorHandler,
): Response {
  return createSSEStream(c, (run) => runWithIndependentProjectIdentity({ directory, fn: run }), cb, onError)
}
