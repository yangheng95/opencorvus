import { afterAll, expect, test } from "bun:test"
import {
  STREAM_SOCKET_PATH,
  STREAM_SOCKET_METHOD_HEADER,
  STREAM_SOCKET_TARGET_HEADER,
  STREAM_SOCKET_PROTOCOL,
  STREAM_SOCKET_TICKET_PREFIX,
} from "@opencorvus-ai/transport-protocol"
import { Server } from "../../src/server/server"

let listener: ReturnType<typeof Server.listenPrepared> | undefined
afterAll(async () => {
  await listener?.stop(true)
})

test("production listener forwards canonical work ledger events and retains normal HTTP reads", async () => {
  listener = Server.listenPrepared({ hostname: "127.0.0.1", port: 0, randomPort: true })
  const handles: WebSocket[] = []
  try {
    const events = await Promise.all(
      Array.from({ length: 8 }, async () => {
        const admitted = await fetch(new URL(STREAM_SOCKET_PATH, listener!.url), {
          method: "POST",
          headers: { [STREAM_SOCKET_METHOD_HEADER]: "GET", [STREAM_SOCKET_TARGET_HEADER]: "/work-ledger/events" },
        })
        expect(admitted.status).toBe(200)
        const { ticket } = (await admitted.json()) as { ticket: string }
        const endpoint = new URL(STREAM_SOCKET_PATH, listener!.url)
        endpoint.protocol = "ws:"
        return new Promise<string>((resolve, reject) => {
          const socket = new WebSocket(endpoint, [STREAM_SOCKET_PROTOCOL, STREAM_SOCKET_TICKET_PREFIX + ticket])
          handles.push(socket)
          socket.binaryType = "arraybuffer"
          socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) resolve(new TextDecoder().decode(event.data))
            else {
              const control = JSON.parse(event.data)
              if (control.type === "error") reject(new Error(control.message))
            }
          }
          socket.onerror = () => reject(new Error("Production stream socket failed"))
        })
      }),
    )
    for (const event of events)
      expect(JSON.parse(event.slice(6).trim())).toEqual({
        type: "work-ledger.connected",
        sourceType: "work-ledger.connected",
        sequence: 0,
      })
    const health = await fetch(new URL("/global/health", listener.url))
    expect(health.status).toBe(200)
    expect((await health.json()).healthy).toBe(true)
  } finally {
    for (const socket of handles) socket.close()
  }
})
