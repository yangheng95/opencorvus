import { afterEach, describe, expect, test } from "bun:test"
import type { HostKind, HostTransport } from "../src/services/host-transport"
import { HOST_CAPABILITIES } from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { applyTheme } from "../src/services/theme"
import { sanitizeThemeForHost, themeOptionsForHost, themeOptionsForCurrentHost } from "../src/services/theme-registry"
import { applySettings, DEFAULT_SETTINGS, settingsStore } from "../src/store/settings"

function fakeTransport(kind: HostKind): HostTransport {
  return {
    kind,
    capabilities: HOST_CAPABILITIES[kind],
    async request() {
      throw new Error("request not used in theme host-scope tests")
    },
    openStream() {
      throw new Error("openStream not used in theme host-scope tests")
    },
    async native() {
      throw new Error("native not used in theme host-scope tests")
    },
  }
}

function installDocument(): () => void {
  const previousDocument = (globalThis as any).document
  ;(globalThis as any).document = {
    documentElement: {
      dataset: {},
      style: { setProperty() {} },
    },
    body: { dataset: {} },
  }
  return () => {
    ;(globalThis as any).document = previousDocument
  }
}

afterEach(() => {
  __setHostTransportForTest(undefined)
  applySettings({ ...DEFAULT_SETTINGS })
})

describe("host-scoped overlay themes", () => {
  test("all hosts expose the complete built-in theme set", () => {
    const expected = ["dark", "vscode-dark", "light", "system"]
    expect(themeOptionsForHost("tauri").map((theme) => theme.id)).toEqual(expected)
    expect(themeOptionsForHost("browser").map((theme) => theme.id)).toEqual(expected)
  })

  test("current-host registry follows the transport singleton", () => {
    __setHostTransportForTest(fakeTransport("tauri"))
    expect(themeOptionsForCurrentHost().map((theme) => theme.id)).toContain("vscode-dark")
    expect(themeOptionsForCurrentHost().map((theme) => theme.id)).toContain("dark")

  })

  test("persisted vscode-dark is accepted in Tauri settings", () => {
    __setHostTransportForTest(fakeTransport("tauri"))
    applySettings({ ...DEFAULT_SETTINGS, theme: "vscode-dark" })

    expect(settingsStore.theme).toBe("vscode-dark")
    expect(sanitizeThemeForHost("vscode-dark", "tauri")).toBe("vscode-dark")
  })

  test("invalid themes fail instead of selecting a default", () => {
    expect(() => sanitizeThemeForHost("garbage", "browser")).toThrow("overlay theme is invalid for the active host")
  })

  test("applyTheme can apply vscode-dark outside VS Code", () => {
    const cleanupDocument = installDocument()
    __setHostTransportForTest(fakeTransport("browser"))
    try {
      applyTheme("vscode-dark")
      expect(document.documentElement.dataset.theme).toBe("vscode-dark")
      expect(document.body.dataset.theme).toBeUndefined()
    } finally {
      cleanupDocument()
    }
  })
})
