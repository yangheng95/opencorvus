import {
  HOST_CAPABILITIES,
  type HostTransport,
  type StreamHandlers,
  type StreamOpenRequest,
  type TransportRequest,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { startSSE, startTaskListSSE, stopSSE, stopTaskListSSE } from "../src/services/sse"
import { submitMessage } from "../src/services/task"
import { setConnectionStatus } from "../src/store/app"
import { setBoardStore } from "../src/store/board"
import { setSettingsStore } from "../src/store/settings"
import { AppLog, waitForLogDrain } from "../src/utils/log"
import { installRealOverlayI18n } from "./fixtures/i18n"

installRealOverlayI18n()

function transportWithHandlers(handlersRef: { current?: StreamHandlers }): HostTransport {
  return {
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(req: TransportRequest) {
      if (req.path === "log") return { status: 200, ok: true, headers: {}, body: { ok: true } as T }
      if (req.path === "global/tasks") return { status: 200, ok: true, headers: {}, body: { tasks: [] } as T }
      throw new Error(`unexpected request: ${req.path}`)
    },
    openStream(_input: StreamOpenRequest, handlers: StreamHandlers) {
      handlersRef.current = handlers
      return { close() {} }
    },
    async native() {
      throw new Error("native not used")
    },
  }
}

function transportBody(req: TransportRequest): Record<string, unknown> {
  const body = req.body as { kind?: string; value?: unknown } | undefined
  if (body?.kind === "json" && body.value && typeof body.value === "object") {
    return body.value as Record<string, unknown>
  }
  throw new Error("expected JSON transport body")
}

function hasDiagnostic(id: string): boolean {
  return AppLog.entries.some((entry) => (entry.extra as Record<string, unknown>)?.diagnosticID === id)
}

afterEach(async () => {
  stopSSE()
  stopTaskListSSE()
  await waitForLogDrain(2_500)
  __setHostTransportForTest(undefined)
  AppLog.clear()
  setConnectionStatus("offline")
  setBoardStore("selectedSource", null)
  setSettingsStore("directory", "")
})

test("selected-task SSE malformed JSON is logged and surfaced", () => {
  const handlers: { current?: StreamHandlers } = {}
  __setHostTransportForTest(transportWithHandlers(handlers))

  startSSE({ kind: "task", id: "tsk_parse" }, 0, { directory: "D:/parse" })
  handlers.current?.onEvent("{not json")

  expect(AppLog.entries.some((entry) => entry.message === "malformed selected-task SSE payload")).toBe(true)
  expect(hasDiagnostic("sse:parse-error:selected-task:tsk_parse")).toBe(true)
})

test("selected-task SSE dispatch error uploads bounded structured diagnostics", async () => {
  setConnectionStatus("online")
  const handlers: { current?: StreamHandlers } = {}
  const logBodies: Array<Record<string, unknown>> = []
  __setHostTransportForTest({
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(req: TransportRequest) {
      if (req.path === "log") {
        logBodies.push(transportBody(req))
        return { status: 200, ok: true, headers: {}, body: { ok: true } as T }
      }
      if (req.path === "global/tasks") return { status: 200, ok: true, headers: {}, body: { tasks: [] } as T }
      throw new Error(`unexpected request: ${req.path}`)
    },
    openStream(_input: StreamOpenRequest, nextHandlers: StreamHandlers) {
      handlers.current = nextHandlers
      return { close() {} }
    },
    async native() {
      throw new Error("native not used")
    },
  })

  startSSE({ kind: "task", id: "tsk_dispatch" }, 0, { directory: "D:/dispatch" })
  const largePayload = Object.fromEntries(
    Array.from({ length: 160 }, (_, index) => [`key_${String(index).padStart(3, "0")}`, index]),
  )
  handlers.current?.onEvent(
    JSON.stringify({
      type: "session.status",
      event_id: "evt_dispatch_large",
      task_id: "tsk_dispatch",
      orderKey: "v1:0001779100000000:0000000000000040:0000000000000000:event:evt_dispatch_large",
      payload: {
        ...largePayload,
        sessionID: "ses_dispatch_large",
        status: {
          type: "unknown",
          huge: "y".repeat(50_000),
        },
        huge: "x".repeat(50_000),
      },
    }),
  )

  await waitForLogDrain(2_500)

  const body = logBodies.find((entry) => entry.message === "dispatch error for event session.status")
  const extra = body?.extra as Record<string, any> | undefined
  expect(extra?.event?.eventID).toBe("evt_dispatch_large")
  expect(extra?.event?.type).toBe("session.status")
  expect(extra?.event?.payloadKeys?.total).toBeGreaterThan(160)
  expect(extra?.event?.payloadKeys?.keys.length).toBeLessThanOrEqual(80)
  expect(extra?.event?.payloadKeys?.truncated).toBeGreaterThan(0)
  expect(String(extra?.error || "").length).toBeLessThan(4_500)
  expect(String(extra?.event?.eventSample || "").length).toBeLessThan(12_500)
  expect(String(extra?.notificationDetails || "").length).toBeLessThan(16_500)
  expect(JSON.stringify(body)).not.toContain("x".repeat(20_000))
  expect(JSON.stringify(body)).not.toContain("y".repeat(20_000))
  expect(hasDiagnostic("sse:dispatch-error:tsk_dispatch")).toBe(true)
})

test("selected-task SSE dispatch log timeout does not recursively upload the flush failure", async () => {
  setConnectionStatus("online")
  const handlers: { current?: StreamHandlers } = {}
  const logBodies: Array<Record<string, unknown>> = []
  __setHostTransportForTest({
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(req: TransportRequest) {
      if (req.path === "log") {
        logBodies.push(transportBody(req))
        throw new DOMException("signal timed out", "TimeoutError")
      }
      if (req.path === "global/tasks") return { status: 200, ok: true, headers: {}, body: { tasks: [] } as T }
      throw new Error(`unexpected request: ${req.path}`)
    },
    openStream(_input: StreamOpenRequest, nextHandlers: StreamHandlers) {
      handlers.current = nextHandlers
      return { close() {} }
    },
    async native() {
      throw new Error("native not used")
    },
  })

  startSSE({ kind: "task", id: "tsk_dispatch_timeout" }, 0, { directory: "D:/dispatch-timeout" })
  handlers.current?.onEvent(
    JSON.stringify({
      type: "session.status",
      event_id: "evt_dispatch_timeout",
      task_id: "tsk_dispatch_timeout",
      orderKey: "v1:0001779100000000:0000000000000040:0000000000000000:event:evt_dispatch_timeout",
      payload: {
        sessionID: "ses_dispatch_timeout",
        status: { type: "unknown", huge: "z".repeat(50_000) },
      },
    }),
  )

  await waitForLogDrain(3_500)

  expect(logBodies.length).toBeGreaterThan(0)
  expect(logBodies.every((entry) => entry.message === "dispatch error for event session.status")).toBe(true)
  expect(
    logBodies.some(
      (entry) => entry.service === "overlay:system" || entry.message === "Overlay log upload failed",
    ),
  ).toBe(false)
  expect(hasDiagnostic("sse:dispatch-error:tsk_dispatch_timeout")).toBe(true)
  expect(hasDiagnostic("system:overlay-log-upload-failed")).toBe(true)
})

test("task-list SSE malformed JSON is logged and surfaced", () => {
  const handlers: { current?: StreamHandlers } = {}
  __setHostTransportForTest(transportWithHandlers(handlers))
  setSettingsStore("directory", "D:/parse")

  startTaskListSSE()
  handlers.current?.onEvent("{not json")

  expect(AppLog.entries.some((entry) => entry.message === "malformed task-list SSE payload")).toBe(true)
  expect(hasDiagnostic("sse:parse-error:task-list:D:/parse")).toBe(true)
})

test("task-list SSE dispatch error uploads bounded structured diagnostics", async () => {
  setConnectionStatus("online")
  const handlers: { current?: StreamHandlers } = {}
  const logBodies: Array<Record<string, unknown>> = []
  __setHostTransportForTest({
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(req: TransportRequest) {
      if (req.path === "log") {
        logBodies.push(transportBody(req))
        return { status: 200, ok: true, headers: {}, body: { ok: true } as T }
      }
      if (req.path === "global/tasks") return { status: 200, ok: true, headers: {}, body: { tasks: [] } as T }
      throw new Error(`unexpected request: ${req.path}`)
    },
    openStream(_input: StreamOpenRequest, nextHandlers: StreamHandlers) {
      handlers.current = nextHandlers
      return { close() {} }
    },
    async native() {
      throw new Error("native not used")
    },
  })
  setSettingsStore("directory", "D:/task-list-dispatch")
  setBoardStore("selectedSource", {
    kind: "task",
    get id() {
      throw new Error(`task-list selected source lookup failed ${"q".repeat(50_000)}`)
    },
  } as any)

  startTaskListSSE()
  const largePayload = Object.fromEntries(
    Array.from({ length: 160 }, (_, index) => [`task_key_${String(index).padStart(3, "0")}`, index]),
  )
  handlers.current?.onEvent(
    JSON.stringify({
      type: "task.failed",
      event_id: "evt_task_list_dispatch_large",
      taskID: "tsk_task_list_dispatch",
      sequence: 7,
      notify: { tier: 1 },
      payload: {
        ...largePayload,
        huge: "t".repeat(50_000),
      },
    }),
  )

  await waitForLogDrain(2_500)

  const body = logBodies.find((entry) => entry.message === "task-list dispatch error for event task.failed")
  const extra = body?.extra as Record<string, any> | undefined
  expect(extra?.event?.eventID).toBe("evt_task_list_dispatch_large")
  expect(extra?.event?.type).toBe("task.failed")
  expect(extra?.event?.payloadKeys?.total).toBeGreaterThan(160)
  expect(extra?.event?.payloadKeys?.keys.length).toBeLessThanOrEqual(80)
  expect(String(extra?.error || "").length).toBeLessThan(4_500)
  expect(String(extra?.event?.eventSample || "").length).toBeLessThan(12_500)
  expect(String(extra?.notificationDetails || "").length).toBeLessThan(16_500)
  expect(JSON.stringify(body)).not.toContain("q".repeat(20_000))
  expect(JSON.stringify(body)).not.toContain("t".repeat(20_000))
  expect(hasDiagnostic("task-list-sse:dispatch-error")).toBe(true)
})

test("panel message stream malformed JSON rejects the request and surfaces the parse error", async () => {
  const previousWindow = (globalThis as typeof globalThis & { window?: unknown }).window
  ;(globalThis as typeof globalThis & { window?: unknown }).window = globalThis
  const handlers: { current?: StreamHandlers } = {}
  __setHostTransportForTest(transportWithHandlers(handlers))

  try {
    const request = submitMessage("hello", [], { requestID: "req_parse" })
    handlers.current?.onOpen?.()
    handlers.current?.onEvent("{not json")

    await expect(request).rejects.toThrow(/Malformed panel message stream event/)
    expect(AppLog.entries.some((entry) => entry.message === "malformed panel message stream event")).toBe(true)
    expect(hasDiagnostic("task:panel-message-stream-parse-error:req_parse")).toBe(true)
  } finally {
    if (previousWindow === undefined) {
      delete (globalThis as typeof globalThis & { window?: unknown }).window
    } else {
      ;(globalThis as typeof globalThis & { window?: unknown }).window = previousWindow
    }
  }
})
