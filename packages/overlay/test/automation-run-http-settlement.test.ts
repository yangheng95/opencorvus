import { expect, test } from "bun:test"
import { once } from "node:events"
import { createServer } from "node:http"
import { configure } from "../src/services/api"
import { runAutomationNow, type AutomationRunView } from "../src/services/automations"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { createTauriTransport } from "../src/services/tauri-transport"

// Network/service contract only; page behavior is qualified manually.
for (const kind of ["browser", "tauri"] as const) {
  test(`${kind} manual automation receives the server receipt after fifteen seconds`, async () => {
    const startedAt = Date.now()
    const receipt: AutomationRunView = {
      id: "atr_completed",
      automationId: "atm_long",
      fireId: "atm_fire",
      targetScope: "global",
      targetProjectId: "prj_result",
      session: {
        id: "ses_result",
        title: "Scheduled result",
        directory: "/owned/result",
        kind: "assistant",
        experience: "chat",
        productPillar: null,
      },
      outcome: "succeeded",
      disposition: null,
      closureEventID: null,
      startedAt,
      completedAt: startedAt + 17_000,
      error: null,
    }
    let received: { method?: string; path?: string; requestID: string; pendingIDs: string[] } | undefined
    const storage = new Map<string, string>()
    const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window")
    const server = createServer(async (request, response) => {
      const chunks = []
      for await (const chunk of request) chunks.push(chunk)
      const { requestID } = JSON.parse(Buffer.concat(chunks).toString()) as { requestID: string }
      received = { method: request.method, path: request.url, requestID, pendingIDs: [...storage.values()] }
      await new Promise(resolve => setTimeout(resolve, 17_000))
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify([receipt]))
    })
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("TCP listener receipt required")
    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: {
          sessionStorage: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
            removeItem: (key: string) => storage.delete(key),
          },
        },
      })
      configure({ serverUrl: `http://127.0.0.1:${address.port}`, directory: "", password: "" })
      __setHostTransportForTest(createTauriTransport(kind))
      const runs = await runAutomationNow("atm_long")
      expect(received).toMatchObject({ method: "POST", path: "/global/automations/atm_long/run" })
      expect(received?.requestID).toMatch(/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i)
      expect(received?.pendingIDs).toEqual([received?.requestID])
      expect(runs).toEqual([receipt])
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(17_000)
    } finally {
      if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow)
      else Reflect.deleteProperty(globalThis, "window")
      __setHostTransportForTest(undefined)
      configure({ serverUrl: "http://127.0.0.1:7878", directory: "", password: "" })
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve())
        server.closeAllConnections()
      })
    }
  })
}
