import { afterAll, expect, test } from "bun:test"
import {
  STREAM_SOCKET_PATH,
  STREAM_SOCKET_METHOD_HEADER,
  STREAM_SOCKET_TARGET_HEADER,
  STREAM_SOCKET_PROTOCOL,
  STREAM_SOCKET_TICKET_PREFIX,
  STREAM_INSTANCE_QUERY_KEY,
} from "@opencorvus-ai/transport-protocol"
import { Server } from "../../src/server/server"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { createRightSidebarConversationSession } from "../../src/chat/session"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { configure } from "../../../overlay/src/services/api"
import { __setHostTransportForTest } from "../../../overlay/src/services/host-transport-runtime"
import {
  setWorkLedgerChangeHandler,
  startWorkLedgerSSE,
  stopWorkLedgerSSE,
  type WorkLedgerStreamEvent,
} from "../../../overlay/src/services/sse"

let listener: ReturnType<typeof Server.listenPrepared> | undefined
afterAll(async () => {
  setWorkLedgerChangeHandler(null)
  __setHostTransportForTest(undefined)
  await listener?.stop(true)
  await resetMemoryDatabase()
})

test("repeated global stream startup preserves current canonical session notifications", async () => {
  await using project = await memoryProject("work-ledger-stream-owner")
  const session = await Instance.provide({
    directory: project.path,
    fn: () => createRightSidebarConversationSession("chat", { title: "Original title" }),
  })
  if (!listener) listener = Server.listenPrepared({ hostname: "127.0.0.1", port: 0, randomPort: true })
  configure({ serverUrl: listener.url.toString(), username: "opencorvus", password: "", directory: "" })
  __setHostTransportForTest(undefined)
  const physical: string[] = []
  using observe = Server.TestHooks.installBeforeRequest((request) => {
    const url = new URL(request.url)
    if (url.pathname === "/work-ledger/events") physical.push(url.searchParams.get(STREAM_INSTANCE_QUERY_KEY)!)
  })
  let receive: (event: WorkLedgerStreamEvent) => void = () => {}
  setWorkLedgerChangeHandler((event) => receive(event))
  const next = () =>
    new Promise<WorkLedgerStreamEvent>((resolve) => {
      receive = resolve
    })
  try {
    const first = next()
    startWorkLedgerSSE()
    expect(await first).toEqual({ type: "work-ledger.connected", sourceType: "work-ledger.connected", sequence: 0 })
    const changed = next()
    startWorkLedgerSSE()
    await Instance.provide({
      directory: project.path,
      fn: () => Session.setTitle({ sessionID: session.id, title: "Updated through the current owner" }),
    })
    expect(await changed).toEqual(
      expect.objectContaining({ type: "work-ledger.changed", sourceType: "session.updated", sessionID: session.id }),
    )
    stopWorkLedgerSSE()
    const restarted = next()
    startWorkLedgerSSE()
    startWorkLedgerSSE()
    expect(await restarted).toEqual({ type: "work-ledger.connected", sourceType: "work-ledger.connected", sequence: 0 })
    expect(physical).toHaveLength(2)
    expect(new Set(physical).size).toBe(2)
    expect((await Session.get(session.id)).title).toBe("Updated through the current owner")
  } finally {
    setWorkLedgerChangeHandler(null)
  }
})

test("production listener forwards canonical work ledger events and retains normal HTTP reads", async () => {
  if (!listener) listener = Server.listenPrepared({ hostname: "127.0.0.1", port: 0, randomPort: true })
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
