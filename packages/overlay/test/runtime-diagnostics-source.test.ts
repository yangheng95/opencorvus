import { describe, expect, test } from "bun:test"
import path from "node:path"

const source = await Bun.file(path.resolve(import.meta.dir, "../src/main.tsx")).text()
describe("overlay runtime diagnostics", () => {
  test("global runtime failures are routed to AppLog and notifications", () => {
    expect(source).toContain("function reportOverlayRuntimeError")
    expect(source).toContain('AppLog.error("runtime", scope')
    expect(source).toContain("diagnosticID: `runtime:${scope}`")
    expect(source).toContain('"error"')
    expect(source).toContain('"unhandledrejection"')
  })

  test("runtime diagnostic message is the failure summary, not the event source", () => {
    expect(source).toContain("const message = runtimeErrorMessage(error)")
    expect(source).toContain(
      "const diagnosticDetails = details ? `source: ${scope}\\n\\n${details}` : `source: ${scope}`",
    )
    expect(source).toContain("diagnosticMessage: message")
    expect(source).toContain("diagnosticDetails,")
    expect(source).toContain('title: t("common.error")')
    expect(source).not.toContain("notificationMessage")
    expect(source).not.toContain("notificationDetails")
    expect(source).not.toContain("message: scope")
  })

  test("initApp failures are not console-only", () => {
    expect(source).toContain('reportOverlayRuntimeError("initApp", error)')
    expect(source).not.toContain("console.error(error)\n  } finally")
  })

  test("browser ResizeObserver delivery events do not become user-facing runtime notifications", () => {
    expect(source).toContain("BROWSER_RESIZE_OBSERVER_DELIVERY_MESSAGES")
    expect(source).toContain('"ResizeObserver loop completed with undelivered notifications."')
    expect(source).toContain('"ResizeObserver loop limit exceeded"')
    expect(source).toContain("function isBrowserResizeObserverDeliveryError")
    expect(source).toMatch(
      /if \(isBrowserResizeObserverDeliveryError\(error\)\) \{[\s\S]*?AppLog\.debug\("runtime", scope,[\s\S]*?return[\s\S]*?\}/,
    )
  })
})
