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
    let received: { method?: string; path?: string } | undefined
    const server = createServer(async (request, response) => {
      received = { method: request.method, path: request.url }
      await new Promise(resolve => setTimeout(resolve, 17_000))
      response.setHeader("Content-Type", "application/json")
      response.end(JSON.stringify([receipt]))
    })
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("TCP listener receipt required")
    try {
      configure({ serverUrl: `http://127.0.0.1:${address.port}`, directory: "", password: "" })
      __setHostTransportForTest(createTauriTransport(kind))
      const runs = await runAutomationNow("atm_long")
      expect(received).toEqual({ method: "POST", path: "/global/automations/atm_long/run" })
      expect(runs).toEqual([receipt])
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(17_000)
    } finally {
      __setHostTransportForTest(undefined)
      configure({ serverUrl: "http://127.0.0.1:7878", directory: "", password: "" })
      await new Promise<void>((resolve, reject) => {
        server.close(error => error ? reject(error) : resolve())
        server.closeAllConnections()
      })
    }
  })
}
