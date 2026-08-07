import { afterEach, describe, expect, test } from "bun:test"
import {
  HOST_CAPABILITIES,
  UnsupportedNativeCommandError,
  type HostTransport,
  type NativeCommand,
  type NativeCommandKind,
} from "../src/services/host-transport"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import {
  browserPreviewNativeSurfaceAvailable,
  BrowserPreviewNativeSyncError,
  browserPreviewNativeCurrentPageAvailable,
  closeBrowserPreviewNativeSurface,
  destroyBrowserPreviewNativeSurface,
  getBrowserPreviewNativeCurrentPage,
  navigateBrowserPreviewNativeUrl,
  navigateBrowserPreviewNativeSurface,
  normalizeBrowserPreviewNativeUrl,
  setBrowserPreviewNativeZoom,
  setNativeSelectionEnabled,
  syncBrowserPreviewNativeSurface,
  takeNativeSelection,
} from "../src/services/browser-preview-native"

const DEFAULT_CURRENT_PAGE = {
  url: "https://example.com/page",
  title: "Example page",
  annotationRequested: false,
  interactionReady: true,
}
const SURFACE_ID = "browser-tab-1"
const SCOPE_KEY = "task-1:preview-1"
const OWNER = { surfaceID: SURFACE_ID, scopeKey: SCOPE_KEY } as const
const SELECTION_LABELS = {
  page: "Page",
  target: "Target",
  source: "Source",
  color: "Color",
  font: "Font",
  placeholder: "Comment on this node",
  cancel: "Cancel",
  send: "Use in composer",
  label: "Comment",
  annotate: "Annotate node",
  contextHint: "Right-click to annotate node",
} as const
const SELECTION_PRESENTATION = {
  labels: SELECTION_LABELS,
  palette: {
    surface: "rgb(255, 255, 255)",
    surfaceInset: "rgb(244, 244, 245)",
    surfaceHover: "rgb(240, 240, 240)",
    text: "rgb(24, 27, 29)",
    textMuted: "rgb(89, 97, 100)",
    border: "rgba(32, 38, 40, 0.14)",
    accent: "rgb(9, 105, 218)",
    accentDim: "color-mix(in srgb, rgb(9, 105, 218) 7%, transparent)",
    accentRing: "color-mix(in srgb, rgb(9, 105, 218) 20%, transparent)",
    shadow: "0 12px 32px rgba(32, 38, 40, 0.1)",
  },
} as const

function fakeTransport(
  host: "tauri" | "browser",
  commands: NativeCommand[],
  selectionResult?: unknown,
  currentPageResult: unknown = DEFAULT_CURRENT_PAGE,
  nativeCommandCapabilities?: Partial<Record<NativeCommandKind, boolean>>,
): HostTransport {
  return {
    kind: host,
    capabilities: {
      ...HOST_CAPABILITIES[host],
      nativeCommands: {
        ...HOST_CAPABILITIES[host].nativeCommands,
        ...nativeCommandCapabilities,
      },
    },
    async request() {
      throw new Error("browser preview native test does not issue HTTP requests")
    },
    openStream() {
      throw new Error("browser preview native test does not open streams")
    },
    async native(command) {
      commands.push(command)
      if (command.kind === "browserPreview.currentPage") return currentPageResult
      if (command.kind === "browserPreview.selection.take" && selectionResult !== undefined) return selectionResult
      if (command.kind === "browserPreview.selection.take") return null
      return true
    },
  }
}

describe("browser preview native service", () => {
  afterEach(() => {
    __setHostTransportForTest(undefined)
  })

  test("routes sync, navigation, and close through HostTransport native commands", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("tauri", commands))

    expect(browserPreviewNativeSurfaceAvailable()).toBe(true)
    await syncBrowserPreviewNativeSurface({
      surfaceID: SURFACE_ID,
      scopeKey: "task-1:preview-1",
      mountUrl: "http://127.0.0.1:4173/preview",
      bounds: { x: 11, y: 22, width: 640, height: 480 },
    })
    await navigateBrowserPreviewNativeUrl(OWNER, "example.com/preview")
    await navigateBrowserPreviewNativeSurface(OWNER, "back")
    await navigateBrowserPreviewNativeSurface(OWNER, "forward")
    await navigateBrowserPreviewNativeSurface(OWNER, "reload")
    await closeBrowserPreviewNativeSurface(OWNER)
    await destroyBrowserPreviewNativeSurface(SURFACE_ID)

    expect(commands).toEqual([
      {
        kind: "browserPreview.sync",
        surfaceID: SURFACE_ID,
        scopeKey: "task-1:preview-1",
        mountUrl: "http://127.0.0.1:4173/preview",
        bounds: { x: 11, y: 22, width: 640, height: 480 },
      },
      { kind: "browserPreview.navigateUrl", ...OWNER, url: "https://example.com/preview" },
      { kind: "browserPreview.navigate", ...OWNER, action: "back" },
      { kind: "browserPreview.navigate", ...OWNER, action: "forward" },
      { kind: "browserPreview.navigate", ...OWNER, action: "reload" },
      { kind: "browserPreview.close", ...OWNER },
      { kind: "browserPreview.destroy", surfaceID: SURFACE_ID },
    ])
  })

  test("preserves the Rust sync cleanup outcome as a structured native error", async () => {
    const commands: NativeCommand[] = []
    const transport = fakeTransport("tauri", commands)
    transport.native = async (command) => {
      commands.push(command)
      throw { message: "set_position failed; hide failed", surfaceHidden: false }
    }
    __setHostTransportForTest(transport)

    const outcome = syncBrowserPreviewNativeSurface({
      surfaceID: SURFACE_ID,
      scopeKey: SCOPE_KEY,
      mountUrl: "https://example.com/",
      bounds: { x: 1, y: 2, width: 300, height: 200 },
    }).catch((error) => error)
    const error = await outcome
    expect(error).toBeInstanceOf(BrowserPreviewNativeSyncError)
    expect(error.message).toBe("set_position failed; hide failed")
    expect(error.surfaceHidden).toBe(false)
    expect(commands).toHaveLength(1)
  })

  test("reports the exact unsupported command for every partial Browser Preview capability", async () => {
    const cases: Array<{ command: NativeCommand; invoke: () => Promise<unknown> }> = [
      {
        command: {
          kind: "browserPreview.sync",
          surfaceID: SURFACE_ID,
          scopeKey: SCOPE_KEY,
          mountUrl: "https://example.com/",
          bounds: { x: 0, y: 0, width: 640, height: 480 },
        },
        invoke: () =>
          syncBrowserPreviewNativeSurface({
            surfaceID: SURFACE_ID,
            scopeKey: SCOPE_KEY,
            mountUrl: "https://example.com/",
            bounds: { x: 0, y: 0, width: 640, height: 480 },
          }),
      },
      {
        command: { kind: "browserPreview.navigateUrl", ...OWNER, url: "https://example.com/" },
        invoke: () => navigateBrowserPreviewNativeUrl(OWNER, "https://example.com/"),
      },
      {
        command: { kind: "browserPreview.navigate", ...OWNER, action: "back" },
        invoke: () => navigateBrowserPreviewNativeSurface(OWNER, "back"),
      },
      {
        command: { kind: "browserPreview.close", ...OWNER },
        invoke: () => closeBrowserPreviewNativeSurface(OWNER),
      },
      {
        command: { kind: "browserPreview.destroy", surfaceID: SURFACE_ID },
        invoke: () => destroyBrowserPreviewNativeSurface(SURFACE_ID),
      },
      {
        command: {
          kind: "browserPreview.selection.setEnabled",
          surfaceID: SURFACE_ID,
          scopeKey: SCOPE_KEY,
          enabled: true,
          presentation: SELECTION_PRESENTATION,
        },
        invoke: () => setNativeSelectionEnabled(OWNER, true, SELECTION_PRESENTATION),
      },
      {
        command: { kind: "browserPreview.selection.take", ...OWNER },
        invoke: () => takeNativeSelection(OWNER),
      },
      {
        command: { kind: "browserPreview.currentPage", ...OWNER },
        invoke: () => getBrowserPreviewNativeCurrentPage(OWNER),
      },
      {
        command: { kind: "browserPreview.setZoom", ...OWNER, factor: 1.25 },
        invoke: () => setBrowserPreviewNativeZoom(OWNER, 1.25),
      },
    ]

    for (const testCase of cases) {
      const commands: NativeCommand[] = []
      __setHostTransportForTest(
        fakeTransport("tauri", commands, undefined, DEFAULT_CURRENT_PAGE, {
          [testCase.command.kind]: false,
        }),
      )
      expect(browserPreviewNativeSurfaceAvailable()).toBe(testCase.command.kind !== "browserPreview.sync")
      let failure: unknown
      try {
        await testCase.invoke()
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(UnsupportedNativeCommandError)
      expect((failure as UnsupportedNativeCommandError).command).toEqual(testCase.command)
    }
  })

  test("maps blank native scope keys to the boundary error", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("tauri", commands))
    await expect(closeBrowserPreviewNativeSurface({ surfaceID: SURFACE_ID, scopeKey: "   " })).rejects.toThrow(
      "browser preview native scope key is required",
    )
  })

  test("normalizes operator addresses and maps non-HTTP schemes to the boundary error", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("tauri", commands))

    expect(normalizeBrowserPreviewNativeUrl("localhost:5173/app")).toBe("http://localhost:5173/app")
    expect(normalizeBrowserPreviewNativeUrl("example.com/docs")).toBe("https://example.com/docs")
    await expect(navigateBrowserPreviewNativeUrl(OWNER, "file:///tmp/index.html")).rejects.toThrow(
      "must use HTTP or HTTPS",
    )
  })

  test("reads the live page URL and document title through HostTransport", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("tauri", commands))

    expect(browserPreviewNativeCurrentPageAvailable()).toBe(true)
    expect(await getBrowserPreviewNativeCurrentPage(OWNER)).toEqual({
      url: "https://example.com/page",
      title: "Example page",
      annotationRequested: false,
      interactionReady: true,
    })
    expect(commands).toEqual([{ kind: "browserPreview.currentPage", ...OWNER }])
  })

  test("canonicalizes current-page strings at the HostTransport boundary", async () => {
    __setHostTransportForTest(
      fakeTransport("tauri", [], undefined, {
        url: " https://example.com/page ",
        title: " Page ",
        annotationRequested: false,
        interactionReady: true,
      }),
    )
    expect(await getBrowserPreviewNativeCurrentPage(OWNER)).toEqual({
      url: "https://example.com/page",
      title: "Page",
      annotationRequested: false,
      interactionReady: true,
    })
  })

  test("distinguishes a pending current-page callback from a malformed native result", async () => {
    const pendingCommands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("tauri", pendingCommands, undefined, null))
    expect(await getBrowserPreviewNativeCurrentPage(OWNER)).toBeNull()

    for (const malformed of [
      false,
      { url: "", title: "Page" },
      { url: "https://example.com", title: 42 },
      { url: "https://example.com", title: "Page", unknown: true },
    ]) {
      __setHostTransportForTest(fakeTransport("tauri", [], undefined, malformed))
      await expect(getBrowserPreviewNativeCurrentPage(OWNER)).rejects.toThrow(
        "browser preview current page result is invalid",
      )
    }
  })

  test("rejects current-page reads on hosts without the capability", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("browser", commands))

    await expect(getBrowserPreviewNativeCurrentPage(OWNER)).rejects.toBeInstanceOf(UnsupportedNativeCommandError)

  })

  test("routes native selection commands through HostTransport", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("tauri", commands))

    await setNativeSelectionEnabled(OWNER, true, SELECTION_PRESENTATION)
    await setNativeSelectionEnabled(OWNER, false, SELECTION_PRESENTATION)
    await setNativeSelectionEnabled(OWNER, false)
    const result = await takeNativeSelection(OWNER)

    expect(result).toEqual({ kind: "waiting" })
    expect(commands).toEqual([
      {
        kind: "browserPreview.selection.setEnabled",
        surfaceID: SURFACE_ID,
        scopeKey: SCOPE_KEY,
        enabled: true,
        presentation: SELECTION_PRESENTATION,
      },
      {
        kind: "browserPreview.selection.setEnabled",
        ...OWNER,
        enabled: false,
        presentation: SELECTION_PRESENTATION,
      },
      { kind: "browserPreview.selection.setEnabled", ...OWNER, enabled: false },
      { kind: "browserPreview.selection.take", ...OWNER },
    ])
  })

  test("maps an incomplete selection presentation to the typed service error", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("tauri", commands))
    await expect(setNativeSelectionEnabled(OWNER, true)).rejects.toThrow(
      "browser preview selection presentation is required when selection is enabled",
    )
  })

  test("preserves submitted comments and cancellations as the only completed selection results", async () => {
    const selection = {
      x: 12,
      y: 24,
      width: 320,
      height: 96,
      label: "main#content",
      selector: "#content",
      pageUrl: "https://example.com/page",
    }
    const commentCommands: NativeCommand[] = []
    __setHostTransportForTest(
      fakeTransport("tauri", commentCommands, {
        kind: "comment",
        selection,
        comment: "Align this content region.",
      }),
    )

    expect(await takeNativeSelection(OWNER)).toEqual({
      kind: "comment",
      selection,
      comment: "Align this content region.",
    })
    expect(commentCommands).toEqual([{ kind: "browserPreview.selection.take", ...OWNER }])

    const canceledCommands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("tauri", canceledCommands, { kind: "canceled" }))

    expect(await takeNativeSelection(OWNER)).toEqual({ kind: "canceled" })
    expect(canceledCommands).toEqual([{ kind: "browserPreview.selection.take", ...OWNER }])
  })

  test("rejects malformed selection results instead of treating protocol damage as waiting", async () => {
    __setHostTransportForTest(fakeTransport("tauri", [], false))
    await expect(takeNativeSelection(OWNER)).rejects.toThrow("browser preview selection result kind is invalid")

    __setHostTransportForTest(fakeTransport("tauri", [], { kind: "captured", selection: {} }))
    await expect(takeNativeSelection(OWNER)).rejects.toThrow("browser preview selection result kind is invalid")

    __setHostTransportForTest(fakeTransport("tauri", [], { kind: "canceled", unknown: true }))
    await expect(takeNativeSelection(OWNER)).rejects.toThrow("browser preview selection result kind is invalid")

    __setHostTransportForTest(fakeTransport("tauri", [], { kind: "comment", selection: {}, comment: "Review this" }))
    await expect(takeNativeSelection(OWNER)).rejects.toThrow("browser preview selection comment result is invalid")

    for (const selection of [
      { x: Number.NaN, y: 0, width: 10, height: 10, label: "node" },
      { x: 0, y: 0, width: 0, height: 10, label: "node" },
      { x: 0, y: 0, width: 10, height: 10, label: "   " },
      { x: 0, y: 0, width: 10, height: 10, label: "node", capturedAt: Number.POSITIVE_INFINITY },
      { x: 0, y: 0, width: 10, height: 10, label: "node", unknown: "value" },
      { x: 0, y: 0, width: 10, height: 10, label: "node", selector: null },
    ]) {
      __setHostTransportForTest(fakeTransport("tauri", [], { kind: "comment", selection, comment: "Review this" }))
      await expect(takeNativeSelection(OWNER)).rejects.toThrow("browser preview selection comment result is invalid")
    }
  })

  test("canonicalizes selection text by Unicode code point at the Rust host limits", async () => {
    const selection = {
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      label: `  ${"😀".repeat(201)}  `,
      sourceHint: `  ${"界".repeat(501)}  `,
    }
    __setHostTransportForTest(
      fakeTransport("tauri", [], { kind: "comment", selection, comment: `  ${"评".repeat(2001)}  ` }),
    )
    const result = await takeNativeSelection(OWNER)
    expect(result.kind).toBe("comment")
    if (result.kind !== "comment") throw new Error("comment selection expected")
    expect(Array.from(result.selection.label)).toHaveLength(200)
    expect(Array.from(result.selection.sourceHint || "")).toHaveLength(500)
    expect(Array.from(result.comment)).toHaveLength(2000)
    expect(result.selection.label.endsWith("\ud83d")).toBe(false)
  })

  test("rejects selection commands on hosts without those native capabilities", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("browser", commands))

    await expect(setNativeSelectionEnabled(OWNER, true, SELECTION_PRESENTATION)).rejects.toBeInstanceOf(
      UnsupportedNativeCommandError,
    )
    await expect(takeNativeSelection(OWNER)).rejects.toBeInstanceOf(UnsupportedNativeCommandError)
  })

  test("routes valid native zoom and rejects invalid or out-of-range factors", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("tauri", commands))

    await setBrowserPreviewNativeZoom(OWNER, 1.25)
    for (const invalid of [0, 0.24, 5.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      await expect(setBrowserPreviewNativeZoom(OWNER, invalid)).rejects.toBeInstanceOf(RangeError)
    }

    expect(commands).toEqual([{ kind: "browserPreview.setZoom", ...OWNER, factor: 1.25 }])
  })

  test("rejects native zoom on hosts without the capability", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("browser", commands))

    await expect(setBrowserPreviewNativeZoom(OWNER, 1.5)).rejects.toBeInstanceOf(UnsupportedNativeCommandError)

  })

  test("rejects hosts without native webview commands", async () => {
    const commands: NativeCommand[] = []
    __setHostTransportForTest(fakeTransport("browser", commands))

    expect(browserPreviewNativeSurfaceAvailable()).toBe(false)
    await expect(
      syncBrowserPreviewNativeSurface({
        surfaceID: SURFACE_ID,
        scopeKey: "task-1:preview-1",
        mountUrl: "http://127.0.0.1:4173/preview",
        bounds: { x: 0, y: 0, width: 640, height: 480 },
      }),
    ).rejects.toBeInstanceOf(UnsupportedNativeCommandError)
  })
})
