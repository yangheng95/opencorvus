export namespace Rpc {
  type Definition = {
    [method: string]: (input: any) => unknown
  }

  type Failure = {
    name: string
    message: string
    stack?: string
  }

  type RequestPacket = {
    type: "rpc.request"
    method: string
    input: unknown
    id: number
  }

  type ResultPacket = {
    type: "rpc.result"
    result: unknown
    id: number
  }

  type ErrorPacket = {
    type: "rpc.error"
    error: Failure
    id: number
  }

  type EventPacket = {
    type: "rpc.event"
    event: string
    data: unknown
  }

  function parse(input: unknown) {
    if (typeof input !== "string") return null
    try {
      return JSON.parse(input)
    } catch {
      return null
    }
  }

  function packet(input: unknown): RequestPacket | null {
    if (!input || typeof input !== "object") return null
    const item = input as Record<string, unknown>
    if (item.type !== "rpc.request") return null
    if (typeof item.method !== "string") return null
    if (typeof item.id !== "number") return null
    return {
      type: "rpc.request",
      method: item.method,
      input: item.input,
      id: item.id,
    }
  }

  function resultPacket(input: unknown): ResultPacket | null {
    if (!input || typeof input !== "object") return null
    const item = input as Record<string, unknown>
    if (item.type !== "rpc.result") return null
    if (typeof item.id !== "number") return null
    return {
      type: "rpc.result",
      id: item.id,
      result: item.result,
    }
  }

  function errorPacket(input: unknown): ErrorPacket | null {
    if (!input || typeof input !== "object") return null
    const item = input as Record<string, unknown>
    if (item.type !== "rpc.error") return null
    if (typeof item.id !== "number") return null
    return {
      type: "rpc.error",
      id: item.id,
      error: parsedFailure(item.error),
    }
  }

  function eventPacket(input: unknown): EventPacket | null {
    if (!input || typeof input !== "object") return null
    const item = input as Record<string, unknown>
    if (item.type !== "rpc.event") return null
    if (typeof item.event !== "string") return null
    return {
      type: "rpc.event",
      event: item.event,
      data: item.data,
    }
  }

  function failure(error: unknown): Failure {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }
    return {
      name: "Error",
      message: String(error),
    }
  }

  function parsedFailure(input: unknown): Failure {
    if (!input || typeof input !== "object") {
      return failure(input)
    }
    const item = input as Record<string, unknown>
    const name = typeof item.name === "string" && item.name.trim() ? item.name : "Error"
    const message = typeof item.message === "string" && item.message.trim() ? item.message : "Unknown RPC error"
    const stack = typeof item.stack === "string" ? item.stack : undefined
    return { name, message, stack }
  }

  export class RemoteError extends Error {
    details: Failure
    constructor(input: Failure) {
      super(input.message)
      this.name = input.name || "RemoteError"
      this.details = input
    }
  }

  export class TimeoutError extends Error {
    constructor(method: string, timeoutMs: number) {
      super(`RPC call timed out: ${method} (${timeoutMs}ms)`)
      this.name = "RpcTimeoutError"
    }
  }

  export function listen(rpc: Definition) {
    onmessage = async (evt) => {
      const parsed = packet(parse(evt.data))
      if (!parsed) return
      const method = rpc[parsed.method]
      try {
        if (typeof method !== "function") {
          throw new Error(`rpc method not found: ${parsed.method}`)
        }
        const result = await method(parsed.input)
        const output: ResultPacket = { type: "rpc.result", result, id: parsed.id }
        postMessage(JSON.stringify(output))
      } catch (error) {
        const output: ErrorPacket = { type: "rpc.error", error: failure(error), id: parsed.id }
        postMessage(JSON.stringify(output))
      }
    }
  }

  export function emit(event: string, data: unknown) {
    postMessage(JSON.stringify({ type: "rpc.event", event, data }))
  }

  export function client<T extends Definition>(target: {
    postMessage: (data: string) => void | null
    onmessage: ((this: Worker, ev: MessageEvent<any>) => any) | null
  }) {
    const pending = new Map<
      number,
      {
        resolve: (result: unknown) => void
        reject: (error: Error) => void
        timeout: ReturnType<typeof setTimeout>
      }
    >()
    const listeners = new Map<string, Set<(data: unknown) => void>>()
    let id = 0
    target.onmessage = async (evt) => {
      const parsed = parse(evt.data)
      const result = resultPacket(parsed)
      if (result) {
        const match = pending.get(result.id)
        if (match) {
          clearTimeout(match.timeout)
          match.resolve(result.result)
          pending.delete(result.id)
        }
        return
      }
      const error = errorPacket(parsed)
      if (error) {
        const match = pending.get(error.id)
        if (match) {
          clearTimeout(match.timeout)
          match.reject(new RemoteError(error.error))
          pending.delete(error.id)
        }
        return
      }
      const event = eventPacket(parsed)
      if (event) {
        const handlers = listeners.get(event.event)
        if (handlers) {
          for (const handler of handlers) {
            handler(event.data)
          }
        }
      }
    }
    return {
      call<Method extends keyof T>(
        method: Method,
        input: Parameters<T[Method]>[0],
        options?: { timeoutMs?: number },
      ): Promise<Awaited<ReturnType<T[Method]>>> {
        const requestId = id++
        const timeoutMs =
          typeof options?.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs >= 1
            ? Math.floor(options.timeoutMs)
            : 60_000
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            pending.delete(requestId)
            reject(new TimeoutError(String(method), timeoutMs))
          }, timeoutMs)
          pending.set(requestId, {
            resolve: (result) => resolve(result as Awaited<ReturnType<T[Method]>>),
            reject,
            timeout,
          })
          target.postMessage(JSON.stringify({ type: "rpc.request", method, input, id: requestId }))
        })
      },
      on<Data>(event: string, handler: (data: Data) => void) {
        let handlers = listeners.get(event)
        if (!handlers) {
          handlers = new Set()
          listeners.set(event, handlers)
        }
        const listener = (data: unknown) => handler(data as Data)
        handlers.add(listener)
        return () => {
          handlers!.delete(listener)
        }
      },
    }
  }
}
