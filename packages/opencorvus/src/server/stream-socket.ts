import {
  STREAM_SOCKET_METHOD_HEADER,
  STREAM_SOCKET_OPEN_TIMEOUT_MS,
  STREAM_SOCKET_PATH,
  STREAM_SOCKET_PROTOCOL,
  STREAM_SOCKET_TARGET_HEADER,
  STREAM_SOCKET_TICKET_PREFIX,
  type StreamSocketControl,
} from "@opencorvus-ai/transport-protocol"
import { isAllowedRequestOrigin } from "./cors"

interface SocketChannel {
  send(data: string | Uint8Array): number
  close(code?: number, reason?: string): void
}

interface Ticket {
  request: Request
  origin: string | null
  controller: AbortController
  timer: ReturnType<typeof setTimeout>
  expiresAt: number
}

export interface StreamSocketOwner {
  open(socket: SocketChannel): void
  close(): void
  drain(): void
}

function failure(status: number, code: string, message: string) {
  return Response.json({ name: "StreamTransportError", data: { code, message } }, { status })
}

/** One listener's temporary admissions and response readers, never a business event source. */
export function createStreamSocketTransport(dispatch: (request: Request) => Promise<Response> | Response) {
  const tickets = new Map<string, Ticket>()
  const owners = new Set<StreamSocketOwner>()

  async function prepare(request: Request): Promise<Response> {
    const method = request.headers.get(STREAM_SOCKET_METHOD_HEADER)
    const path = request.headers.get(STREAM_SOCKET_TARGET_HEADER)
    const base = new URL(request.url)
    if (!path?.startsWith("/") || path.startsWith("//") || (method !== "GET" && method !== "POST"))
      return failure(400, "invalid-target", "A relative stream target and GET or POST method are required")
    const target = new URL(path, base)
    if (target.origin !== base.origin || target.hash || target.pathname === STREAM_SOCKET_PATH)
      return failure(400, "invalid-target", "The stream target must belong to this server")
    const body = await request.arrayBuffer()
    if (method === "GET" && body.byteLength)
      return failure(400, "invalid-body", "GET streams require an empty request body")
    const headers = new Headers(request.headers)
    for (const name of [STREAM_SOCKET_METHOD_HEADER, STREAM_SOCKET_TARGET_HEADER, "content-length", "connection"])
      headers.delete(name)
    // The bridge sends the canonical uncompressed SSE bytes; browsers decode WS frames directly.
    headers.set("accept-encoding", "identity")
    headers.set("accept", "text/event-stream")
    const controller = new AbortController()
    const token = crypto.randomUUID()
    const timer = setTimeout(() => {
      tickets.delete(token)
      controller.abort()
    }, STREAM_SOCKET_OPEN_TIMEOUT_MS)
    timer.unref?.()
    tickets.set(token, {
      request: new Request(target, {
        method,
        headers,
        body: method === "POST" ? body : undefined,
        signal: controller.signal,
      }),
      origin: request.headers.get("origin"),
      controller,
      timer,
      expiresAt: Date.now() + STREAM_SOCKET_OPEN_TIMEOUT_MS,
    })
    return Response.json({ ticket: token }, { headers: { "Cache-Control": "no-store" } })
  }

  function upgrade(
    request: Request,
    server: {
      upgrade(request: Request, options: { data: StreamSocketOwner; headers: Record<string, string> }): boolean
    },
  ): Response | undefined {
    const origin = request.headers.get("origin")
    if (!isAllowedRequestOrigin(origin ?? undefined, request.headers.get("host") ?? undefined))
      return failure(403, "origin-forbidden", "The WebSocket Origin is not allowed")
    const protocols =
      request.headers
        .get("sec-websocket-protocol")
        ?.split(",")
        .map((item) => item.trim()) ?? []
    const token = protocols
      .find((item) => item.startsWith(STREAM_SOCKET_TICKET_PREFIX))
      ?.slice(STREAM_SOCKET_TICKET_PREFIX.length)
    const ticket = token ? tickets.get(token) : undefined
    if (
      !protocols.includes(STREAM_SOCKET_PROTOCOL) ||
      !ticket ||
      ticket.origin !== origin ||
      Date.now() >= ticket.expiresAt
    )
      return failure(401, "ticket-required", "A current stream ticket from the same Origin is required")
    tickets.delete(token!)
    clearTimeout(ticket.timer)
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    let socket: SocketChannel | undefined
    let closed = false
    let drained: (() => void) | undefined
    const close = () => {
      if (closed) return
      closed = true
      owners.delete(owner)
      ticket.controller.abort()
      void reader?.cancel().catch(() => undefined)
      drained?.()
      drained = undefined
      socket?.close(1000, "stream-done")
    }
    const send = async (data: string | Uint8Array) => {
      if (closed) return
      const count = socket!.send(data)
      if (count === 0) throw new Error("Stream socket closed while sending")
      if (count === -1)
        await new Promise<void>((resolve) => {
          drained = resolve
        })
    }
    const control = (value: StreamSocketControl) => send(JSON.stringify(value))
    const owner: StreamSocketOwner = {
      open(channel) {
        socket = channel
        if (closed) {
          channel.close(1001, "Listener stopped")
          return
        }
        void (async () => {
          try {
            const response = await dispatch(ticket.request)
            if (closed) {
              await response.body?.cancel()
              return
            }
            const streaming =
              response.ok && !!response.body && !!response.headers.get("content-type")?.startsWith("text/event-stream")
            await control({ type: "response", status: response.status, statusText: response.statusText, streaming })
            if (!streaming) {
              await control({ type: "error", message: (await response.text()) || `Stream response ${response.status}` })
              return
            }
            reader = response.body!.getReader()
            while (!closed) {
              const { done, value } = await reader.read()
              if (done) break
              await send(value)
            }
            if (!closed) await control({ type: "end" })
          } catch (error) {
            if (!closed) {
              try {
                await control({ type: "error", message: error instanceof Error ? error.message : String(error) })
              } catch {}
            }
          } finally {
            close()
            try {
              await reader?.cancel()
            } catch {}
            reader?.releaseLock()
          }
        })()
      },
      close,
      drain() {
        drained?.()
        drained = undefined
      },
    }
    owners.add(owner)
    try {
      if (server.upgrade(request, { data: owner, headers: { "Sec-WebSocket-Protocol": STREAM_SOCKET_PROTOCOL } }))
        return
    } catch {
      close()
      return failure(400, "upgrade-required", "The WebSocket upgrade could not be established")
    }
    close()
    return failure(400, "upgrade-required", "A WebSocket upgrade request is required")
  }

  return {
    prepare,
    upgrade,
    dispose() {
      for (const ticket of tickets.values()) {
        clearTimeout(ticket.timer)
        ticket.controller.abort()
      }
      tickets.clear()
      for (const owner of [...owners]) owner.close()
    },
  }
}

export type StreamSocketTransport = ReturnType<typeof createStreamSocketTransport>

/** Native listener glue; all request, response and reader ownership lives above. */
export const streamSocketWebSocketHandler = {
  open(socket) {
    socket.data.open(socket)
  },
  message(socket) {
    socket.close(1008, "Response-only stream")
  },
  close(socket) {
    socket.data.close()
  },
  drain(socket) {
    socket.data.drain()
  },
} satisfies Bun.WebSocketHandler<StreamSocketOwner>
