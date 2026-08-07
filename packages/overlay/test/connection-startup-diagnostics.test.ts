import { afterEach, beforeEach, describe, expect, test } from "bun:test"

import { configure } from "../src/services/api"
import {
  HOST_CAPABILITIES,
  type HostTransport,
  type NativeCommand,
  type TransportRequest,
  type TransportResponse,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { appStore, setAppStore, setConnectionStatus } from "../src/store/app"
import { DEFAULT_SETTINGS, applySettings } from "../src/store/settings"
import { AppLog } from "../src/utils/log"
import { installRealOverlayI18n } from "./fixtures/i18n"

installRealOverlayI18n()

function installTransport(input: {
  native?: (command: NativeCommand) => Promise<unknown> | unknown
  request?: (request: TransportRequest) => Promise<unknown> | unknown
}): void {
  const transport: HostTransport = {
    kind: "tauri",
    capabilities: HOST_CAPABILITIES.tauri,
    async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
      if (input.request) {
        const body = await input.request(request)
        return { status: 200, ok: true, headers: {}, body: body as T }
      }
      throw new Error("request not configured")
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native(command) {
      if (input.native) return input.native(command)
      throw new Error(`native ${command.kind} not configured`)
    },
  }
  __setHostTransportForTest(transport)
}

beforeEach(() => {
  AppLog.clear()
  setConnectionStatus("offline")
  applySettings({ ...DEFAULT_SETTINGS, autoServer: true, serverUrl: "http://127.0.0.1:7878" })
  configure({ serverUrl: "http://127.0.0.1:7878", directory: "" })
})

afterEach(() => {
  AppLog.clear()
  setConnectionStatus("offline")
  __setHostTransportForTest(undefined)
  applySettings({ ...DEFAULT_SETTINGS })
  configure({ serverUrl: DEFAULT_SETTINGS.serverUrl, directory: "" })
})

describe("managed server startup diagnostics", () => {
  test("localServerInfo records native startup failure in AppLog", async () => {
    const { localServerInfo } = await import("../src/services/connection")
    installTransport({
      native(command) {
        if (command.kind === "server.info") {
          throw new Error("failed to spawn bundled opencorvus server\nsidecar log: C:\\logs\\sidecar.log")
        }
        return undefined
      },
    })

    const info = await localServerInfo()

    expect(info).toBeNull()
    const diagnostic = AppLog.entries.find(
      (entry) => (entry.extra as Record<string, unknown>)?.diagnosticID === "system:managed-server",
    )
    expect(diagnostic?.level).toBe("error")
    expect(String((diagnostic?.extra as Record<string, unknown>)?.details)).toContain(
      "failed to spawn bundled opencorvus server",
    )
    expect(String((diagnostic?.extra as Record<string, unknown>)?.details)).toContain("C:\\logs\\sidecar.log")
  })

  test("repeated managed-server failures remain independently observable", async () => {
    const { localServerInfo } = await import("../src/services/connection")
    let attempt = 0
    installTransport({
      native(command) {
        if (command.kind === "server.info") {
          attempt += 1
          throw new Error(`spawn attempt ${attempt}`)
        }
        return undefined
      },
    })

    await localServerInfo()
    await localServerInfo()

    const diagnostics = AppLog.entries.filter(
      (entry) => (entry.extra as Record<string, unknown>)?.diagnosticID === "system:managed-server",
    )
    expect(diagnostics).toHaveLength(2)
    expect(String((diagnostics[1]?.extra as Record<string, unknown>)?.details)).toContain("spawn attempt 2")
  })

  test("checkConnection includes managed sidecar log path when the health probe fails", async () => {
    const { checkConnection } = await import("../src/services/connection")
    installTransport({
      native(command) {
        if (command.kind === "server.info") {
          return {
            url: "http://127.0.0.1:7878",
            pid: 456,
            sidecarLogPath: "C:\\logs\\sidecar-health.log",
          }
        }
        return undefined
      },
      request() {
        throw new Error("health refused")
      },
    })

    const ok = await checkConnection()

    expect(ok).toBe(false)
    const diagnostic = AppLog.entries.find(
      (entry) => (entry.extra as Record<string, unknown>)?.diagnosticID === "system:managed-server",
    )
    const details = String((diagnostic?.extra as Record<string, unknown>)?.details)
    expect(details).toContain("server pid: 456")
    expect(details).toContain("C:\\logs\\sidecar-health.log")
    expect(details).toContain("health refused")
  }, 0)

  test("background health probe preserves online presentation until it settles", async () => {
    const { checkConnection } = await import("../src/services/connection")
    let releaseHealth!: () => void
    const healthPending = new Promise<void>((resolve) => {
      releaseHealth = resolve
    })
    installTransport({
      native(command) {
        if (command.kind === "server.info") {
          return { url: "http://127.0.0.1:7878", pid: 456 }
        }
        return undefined
      },
      async request() {
        await healthPending
        return { paths: { database: "db", data: "data", home: "home" } }
      },
    })
    setConnectionStatus("online")

    const probe = checkConnection({ background: true })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(appStore.connectionStatus).toBe("online")
    releaseHealth()
    expect(await probe).toBe(true)
    expect(appStore.connectionStatus).toBe("online")
  })

  test("failed background health probe still transitions online state to offline", async () => {
    const { checkConnection } = await import("../src/services/connection")
    applySettings({ ...DEFAULT_SETTINGS, autoServer: false, serverUrl: "http://api.invalid" })
    configure({ serverUrl: "http://api.invalid", directory: "" })
    installTransport({
      request() {
        throw new Error("background health refused")
      },
    })
    setConnectionStatus("online")

    expect(await checkConnection({ background: true })).toBe(false)
    expect(appStore.connectionStatus).toBe("offline")
  })

  test("durable database-unavailable health retains runtime paths and transitions offline", async () => {
    const { checkConnection } = await import("../src/services/connection")
    applySettings({ ...DEFAULT_SETTINGS, autoServer: false, serverUrl: "http://api.invalid" })
    configure({ serverUrl: "http://api.invalid", directory: "" })
    setAppStore("enginePaths", null)
    installTransport({
      request() {
        return {
          healthy: false,
          version: "database-unavailable",
          paths: {
            database: "/data/opencorvus.db",
            data: "/data",
            home: "/home/operator",
          },
          databaseUnavailable: {
            message: "disk I/O error",
            path: "/data/opencorvus.db",
            operation: "Database.use",
            code: "SQLITE_IOERR_VNODE",
            errno: 6922,
            byteOffset: -1,
          },
        }
      },
    })
    setConnectionStatus("online")

    expect(await checkConnection({ background: true })).toBe(false)
    expect(appStore.connectionStatus).toBe("offline")
    expect(appStore.enginePaths).toEqual({
      database: "/data/opencorvus.db",
      data: "/data",
      home: "/home/operator",
    })
  })
})
