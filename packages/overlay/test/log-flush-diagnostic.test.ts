import { afterEach, expect, test } from "bun:test"

import { HOST_CAPABILITIES } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import { setConnectionStatus } from "../src/store/app"
import { AppLog, waitForLogDrain } from "../src/utils/log"

function logTransport(
  responder: (req: TransportRequest) => TransportResponse<unknown> | Promise<TransportResponse<unknown>>,
): HostTransport {
  return {
    kind: "browser",
    capabilities: HOST_CAPABILITIES.browser,
    request: responder,
    openStream() {
      throw new Error("not used")
    },
    async native() {
      throw new Error("not used")
    },
  }
}

afterEach(async () => {
  await waitForLogDrain(2_500)
  __setHostTransportForTest(undefined)
  AppLog.clear()
  setConnectionStatus("offline")
})

test("overlay error logs remain AppLog-only diagnostics", async () => {
  setConnectionStatus("online")
  let requests = 0
  __setHostTransportForTest(
    logTransport(() => {
      requests += 1
      return { status: 200, ok: true, headers: {}, body: { ok: true } }
    }),
  )

  AppLog.error("ui", "Failed to delete memory", { error: "database locked" })
  await waitForLogDrain(2_500)

  expect(requests).toBe(1)
  expect(AppLog.entries).toContainEqual(
    expect.objectContaining({ level: "error", service: "ui", message: "Failed to delete memory" }),
  )
})

test("overlay log upload failure creates one local diagnostic without recursive upload", async () => {
  setConnectionStatus("online")
  let requests = 0
  __setHostTransportForTest(
    logTransport(() => {
      requests += 1
      if (requests === 1) return { status: 500, ok: false, headers: {}, body: { code: "LOG_WRITE_FAILED" } }
      return { status: 200, ok: true, headers: {}, body: { ok: true } }
    }),
  )

  AppLog.error("unit", "cannot persist overlay diagnostics", { taskID: "task-log-failure" })
  await waitForLogDrain(750)

  expect(requests).toBe(2)
  const diagnostic = AppLog.entries.find((entry) => entry.message === "Overlay log upload failed")
  expect(diagnostic?.level).toBe("error")
  expect((diagnostic?.extra as Record<string, unknown>)?.diagnosticID).toBe("system:overlay-log-upload-failed")
  expect(String((diagnostic?.extra as Record<string, unknown>)?.details)).toContain("LOG_WRITE_FAILED")
})

test("log drain rejects stalled work after inactivity and succeeds after the request resumes", async () => {
  setConnectionStatus("online")
  let releaseRequest!: () => void
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  __setHostTransportForTest(
    logTransport(async () => {
      await requestReleased
      return { status: 200, ok: true, headers: {}, body: { ok: true } }
    }),
  )

  AppLog.error("unit", "stalled overlay log request")
  await expect(waitForLogDrain(750)).rejects.toThrow(
    /Overlay log drain had no activity for 750ms \(timer=false queue=0 inFlight=1 failures=0\)/,
  )

  releaseRequest()
  await waitForLogDrain(750)
})

test("log drain rejects invalid inactivity timeouts", async () => {
  await expect(waitForLogDrain(0)).rejects.toThrow("positive finite inactivity timeout")
  await expect(waitForLogDrain(Number.POSITIVE_INFINITY)).rejects.toThrow("positive finite inactivity timeout")
})

test("offline overlay logs remain local and never request the disconnected backend", async () => {
  setConnectionStatus("offline")
  let requests = 0
  __setHostTransportForTest(
    logTransport(() => {
      requests += 1
      return { status: 200, ok: true, headers: {}, body: { ok: true } }
    }),
  )

  AppLog.warn("connection", "backend is offline")
  await waitForLogDrain(750)

  expect(requests).toBe(0)
  expect(AppLog.entries).toContainEqual(
    expect.objectContaining({ level: "warn", service: "connection", message: "backend is offline" }),
  )
})
