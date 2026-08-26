import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { browserMcpLiveViewUrl } from "../../src/mcp/browser/tools"
import {
  BROWSER_MCP_ATTACHED_PROFILE_ID,
  browserMcpIsolatedLaunchArgs,
  browserMcpProductFromExecutable,
  cancelAndDrainBrowserMcpOperations,
  closeBrowserMcpPages,
  createBrowserMcpOperationGate,
  resolveBrowserMcpConnectionConfig,
  resolveBrowserMcpHeadless,
  runBrowserMcpShutdownSequence,
  trackPendingBrowserMcpPageWithGate,
  withBrowserMcpOperation,
} from "../../src/mcp/browser/sessions"
import { browserMcpMonitorSelectionJson } from "../../src/mcp/browser/monitor"
import { BrowserRuntime } from "../../src/browser/runtime"
import { BrowserMCPNodeLauncher } from "../../src/mcp/browser/node-launcher"

describe("Browser MCP Live View contract", () => {
  const temporaryDirectories: string[] = []
  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true })))
  })
  test("publishes a session-selected loopback Live View URL", () => {
    expect(browserMcpLiveViewUrl("http://127.0.0.1:43127", "session a/b")).toBe(
      "http://127.0.0.1:43127/monitor?session=session+a%2Fb",
    )
  })

  test("launches isolated Browser MCP without inheriting host proxy settings", () => {
    const args = browserMcpIsolatedLaunchArgs()
    expect(args).toEqual(["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--disable-remote-fonts"])
  })

  test("freezes tool admission and drains in-flight work before browser shutdown", async () => {
    const gate = createBrowserMcpOperationGate()
    const release = gate.enter()
    const order: string[] = []
    gate.stop()
    const shutdownWait = gate.wait().then(() => order.push("shutdown"))
    let admissionError = ""
    try {
      gate.enter()
    } catch (error) {
      admissionError = error instanceof Error ? error.message : String(error)
    }
    expect(admissionError).toBe("BROWSER_MCP_SHUTTING_DOWN: Browser MCP is shutting down")
    order.push("operation")
    release()
    await shutdownWait
    expect(order).toEqual(["operation", "shutdown"])
  })

  test("cancels a nonsettling browser operation before draining shutdown", async () => {
    const gate = createBrowserMcpOperationGate()
    const order: string[] = []
    let cancelOperation!: () => void
    const operationCancelled = new Promise<void>((resolve) => {
      cancelOperation = resolve
    })
    const release = gate.enter()
    const operation = (async () => {
      await operationCancelled
      order.push("operation-settled")
      release()
    })()
    await Promise.resolve()
    await cancelAndDrainBrowserMcpOperations(async () => {
      order.push("pages-closed")
      cancelOperation()
    }, gate)
    await operation
    order.push("shutdown-drained")
    expect(order).toEqual(["pages-closed", "operation-settled", "shutdown-drained"])
  })

  test("hands a post-admission page to the terminal late-page owner", async () => {
    const gate = createBrowserMcpOperationGate()
    gate.stop()
    const latePages = new Set<{ close: () => Promise<void> }>()
    let closed = false
    const page = {
      close: async () => {
        closed = true
      },
    }
    trackPendingBrowserMcpPageWithGate(page, gate, latePages)
    await closeBrowserMcpPages(latePages)
    expect({ closed, latePages: latePages.size }).toEqual({ closed: true, latePages: 1 })
  })

  test("closes late registered sessions before detaching from Chrome", async () => {
    const order: string[] = []
    await runBrowserMcpShutdownSequence({
      stop: () => order.push("admission-stopped"),
      closeCurrentPages: async () => {
        order.push("current-pages-closed")
      },
      waitForOperations: async () => {
        order.push("late-session-registered")
      },
      closeLatePages: async () => {
        order.push("late-pages-closed")
      },
      closeProfiles: async () => {
        order.push("profiles-closed")
      },
      disconnect: async () => {
        order.push("cdp-detached")
      },
    })
    expect(order).toEqual([
      "admission-stopped",
      "current-pages-closed",
      "late-session-registered",
      "late-pages-closed",
      "profiles-closed",
      "cdp-detached",
    ])
  })

  test("settles every ordered shutdown stage before publishing its aggregate failure", async () => {
    const order: string[] = []
    const pageFailure = new Error("current-page-close-failed")
    const profileFailure = new Error("profile-close-failed")
    let receipt: unknown
    try {
      await runBrowserMcpShutdownSequence({
        stop: () => order.push("admission-stopped"),
        closeCurrentPages: async () => {
          order.push("current-pages-attempted")
          throw pageFailure
        },
        waitForOperations: async () => {
          order.push("operations-drained")
        },
        closeLatePages: async () => {
          order.push("late-pages-attempted")
        },
        closeProfiles: async () => {
          order.push("profiles-attempted")
          throw profileFailure
        },
        disconnect: async () => {
          order.push("browser-disconnected")
        },
      })
    } catch (error) {
      receipt = error
    }
    expect(order).toEqual([
      "admission-stopped",
      "current-pages-attempted",
      "operations-drained",
      "late-pages-attempted",
      "profiles-attempted",
      "browser-disconnected",
    ])
    expect(receipt).toBeInstanceOf(AggregateError)
    expect((receipt as AggregateError).errors).toEqual([pageFailure, profileFailure])
  })

  test("attempts every page close and publishes the exact failed close receipt", async () => {
    const order: string[] = []
    const failure = new Error("page-close-failed")
    let receipt: unknown
    try {
      await closeBrowserMcpPages([
        {
          close: () => {
            order.push("first-page")
            throw failure
          },
        },
        {
          close: async () => {
            order.push("second-page")
          },
        },
      ])
    } catch (error) {
      receipt = error
    }
    expect({ order, receipt }).toEqual({ order: ["first-page", "second-page"], receipt: failure })
  })

  test("rejects an admitted create operation at its post-launch shutdown checkpoint", () => {
    const gate = createBrowserMcpOperationGate()
    const release = gate.enter()
    gate.stop()
    let checkpointError = ""
    try {
      gate.assertAccepting()
    } catch (error) {
      checkpointError = error instanceof Error ? error.message : String(error)
    } finally {
      release()
    }
    expect(checkpointError).toBe("BROWSER_MCP_SHUTTING_DOWN: Browser MCP is shutting down")
  })

  test("lets the Browser MCP sidecar clean up after host stdin closes", async () => {
    const order: string[] = []
    let exitChild!: (code: number) => void
    const exited = new Promise<number>((resolve) => {
      exitChild = resolve
    })
    await BrowserMCPNodeLauncher.closeChildAfterHostStdin({
      endStdin: () => {
        order.push("stdin-ended")
        exitChild(0)
      },
      exited,
      terminate: async () => {
        order.push("terminated")
      },
    })
    order.push("closed")
    expect(order).toEqual(["stdin-ended", "closed"])
  })

  test("allows sidecar cleanup to outlive the former two-second kill window", async () => {
    const order: string[] = []
    let exitChild!: (code: number) => void
    const exited = new Promise<number>((resolve) => {
      exitChild = resolve
    })
    const close = BrowserMCPNodeLauncher.closeChildAfterHostStdin({
      endStdin: () => {
        order.push("stdin-ended")
        setTimeout(() => exitChild(0), 2_100)
      },
      exited,
      terminate: async () => {
        order.push("terminated")
      },
      timeoutMs: 3_000,
    })
    await close
    order.push("closed")
    expect(order).toEqual(["stdin-ended", "closed"])
    expect(BrowserMCPNodeLauncher.STDIN_GRACEFUL_SHUTDOWN_TIMEOUT_MS).toBe(310_000)
  })

  test("embeds the selected session as script-safe JSON", () => {
    expect(browserMcpMonitorSelectionJson("session</script>&\u2028next")).toBe(
      '"session\\u003c/script\\u003e\\u0026\\u2028next"',
    )
  })

  test("opens a visible isolated browser on desktop platforms", () => {
    expect(resolveBrowserMcpHeadless({}, "win32")).toBe(false)
    expect(resolveBrowserMcpHeadless({}, "darwin")).toBe(false)
  })

  test("uses headless mode for displayless Linux and explicit deployments", () => {
    expect(resolveBrowserMcpHeadless({}, "linux")).toBe(true)
    expect(resolveBrowserMcpHeadless({ DISPLAY: ":1" }, "linux")).toBe(false)
    expect(resolveBrowserMcpHeadless({ BROWSER_HEADLESS: "true" }, "win32")).toBe(true)
    expect(resolveBrowserMcpHeadless({ BROWSER_HEADLESS: "false" }, "linux")).toBe(false)
  })

  test("selects current Chrome by default and an explicit isolated browser on request", () => {
    expect(
      resolveBrowserMcpConnectionConfig({ OPENCORVUS_BROWSER_CDP_ENDPOINT: " http://127.0.0.1:9222 " }, "win32"),
    ).toEqual({ mode: "cdp", endpointURL: "http://127.0.0.1:9222" })
    expect(resolveBrowserMcpConnectionConfig({}, "win32")).toEqual({ mode: "cdp", channel: "chrome" })
    expect(resolveBrowserMcpConnectionConfig({ OPENCORVUS_BROWSER_MODE: "isolated" }, "linux")).toEqual({
      mode: "isolated",
      headless: true,
    })
    expect(
      resolveBrowserMcpConnectionConfig({ OPENCORVUS_BROWSER_MODE: "isolated", BROWSER_HEADLESS: "false" }, "linux"),
    ).toEqual({
      mode: "isolated",
      headless: false,
    })
    expect(() => resolveBrowserMcpConnectionConfig({ OPENCORVUS_BROWSER_MODE: "unknown" }, "linux")).toThrow(
      "Invalid OPENCORVUS_BROWSER_MODE: unknown. Expected chrome, chrome_or_isolated or isolated.",
    )
    expect(BROWSER_MCP_ATTACHED_PROFILE_ID).toBe("prof_cdp_attached")
  })

  test("returns a stable actionable CDP connection failure contract", () => {
    expect(BrowserRuntime.cdpConnectionDiagnostic()).toEqual({
      code: "browser_connect_failed",
      message: "BrowserRuntime could not connect to the configured CDP endpoint.",
      checkedCandidates: [],
      recoveryCommand:
        "Start Chrome with a remote debugging endpoint and a non-default --user-data-dir, then set OPENCORVUS_BROWSER_CDP_ENDPOINT.",
    })
    const chromeDiagnostic = BrowserRuntime.cdpConnectionDiagnostic("chrome")
    expect(chromeDiagnostic).toEqual({
      code: "browser_connect_failed",
      message: "BrowserRuntime could not connect to the running Google Chrome instance.",
      checkedCandidates: [],
      recoveryCommand:
        "Install Chrome/Edge so OpenCorvus can start its own remote-debugging Chrome in a dedicated profile, or set OPENCORVUS_BROWSER_MODE=isolated for a separate signed-out browser.",
    })
    expect(new BrowserRuntime.RuntimeError(chromeDiagnostic).message).toBe(
      "browser_connect_failed: BrowserRuntime could not connect to the running Google Chrome instance. Recovery: Install Chrome/Edge so OpenCorvus can start its own remote-debugging Chrome in a dedicated profile, or set OPENCORVUS_BROWSER_MODE=isolated for a separate signed-out browser.",
    )
  })

  test("resolves the default Chrome profile path deterministically", () => {
    expect(
      BrowserRuntime.resolveChromeUserDataDir({
        platform: "win32",
        env: { LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local" },
        homeDir: "C:\\Users\\me",
      }),
    ).toBe("C:\\Users\\me\\AppData\\Local\\Google\\Chrome\\User Data")
    expect(BrowserRuntime.resolveChromeUserDataDir({ platform: "linux", env: {}, homeDir: "/home/me" })).toBe(
      "/home/me/.config/google-chrome",
    )
  })

  test("keeps the managed CDP profile off the directory Chrome refuses to debug", () => {
    expect(BrowserRuntime.resolveManagedChromeUserDataDir({ platform: "darwin", env: {}, homeDir: "/Users/me" })).toBe(
      "/Users/me/Library/Application Support/opencorvus/data/chrome-cdp-profile",
    )
    expect(BrowserRuntime.resolveManagedChromeUserDataDir({ platform: "linux", env: {}, homeDir: "/home/me" })).toBe(
      "/home/me/.local/share/opencorvus/data/chrome-cdp-profile",
    )
    expect(
      BrowserRuntime.resolveManagedChromeUserDataDir({
        platform: "linux",
        env: { OPENCORVUS_BROWSER_CHROME_USER_DATA_DIR: "/home/me/chrome-debug/" },
        homeDir: "/home/me",
      }),
    ).toBe("/home/me/chrome-debug")
    expect(() =>
      BrowserRuntime.resolveManagedChromeUserDataDir({
        platform: "linux",
        env: { OPENCORVUS_BROWSER_CHROME_USER_DATA_DIR: "/home/me/.config/google-chrome" },
        homeDir: "/home/me",
      }),
    ).toThrow(
      "browser_launch_failed: Chrome refuses remote debugging on its own default profile directory (/home/me/.config/google-chrome). DevTools remote debugging requires a non-default data directory. Recovery: Point OPENCORVUS_BROWSER_CHROME_USER_DATA_DIR at a writable non-default profile directory and close any browser already using it, or set OPENCORVUS_BROWSER_MODE=isolated for a separate signed-out browser.",
    )
  })

  test("starts the managed Chrome with remote debugging on the managed profile", () => {
    expect(BrowserRuntime.managedChromeLaunchArgs("/home/me/chrome-debug")).toEqual([
      "--user-data-dir=/home/me/chrome-debug",
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
    ])
    expect(BrowserRuntime.resolveChromeCdpStartupTimeoutMs(undefined, {})).toBe(30_000)
    expect(
      BrowserRuntime.resolveChromeCdpStartupTimeoutMs(undefined, {
        OPENCORVUS_BROWSER_CDP_STARTUP_TIMEOUT_MS: "5000",
      }),
    ).toBe(5_000)
    expect(BrowserRuntime.resolveChromeCdpStartupTimeoutMs(1_500, {})).toBe(1_500)
  })

  test("resolves the exact Chrome browser websocket rendezvous", async () => {
    const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-chrome-cdp-contract-"))
    temporaryDirectories.push(userDataDir)
    await fs.writeFile(
      path.join(userDataDir, "DevToolsActivePort"),
      "43127\n/devtools/browser/78bb9584-253f-47cf-b950-70dd0180488a\n",
    )
    expect(await BrowserRuntime.resolveChromeCdpEndpoint({ userDataDir })).toBe(
      "ws://127.0.0.1:43127/devtools/browser/78bb9584-253f-47cf-b950-70dd0180488a",
    )
    expect(await BrowserRuntime.tryResolveChromeCdpEndpoint(userDataDir)).toBe(
      "ws://127.0.0.1:43127/devtools/browser/78bb9584-253f-47cf-b950-70dd0180488a",
    )
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-chrome-cdp-empty-"))
    temporaryDirectories.push(emptyDir)
    expect(await BrowserRuntime.tryResolveChromeCdpEndpoint(emptyDir)).toBeUndefined()
  })

  test("identifies branded system browser executables", () => {
    expect(browserMcpProductFromExecutable("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")).toBe(
      "Google Chrome",
    )
    expect(browserMcpProductFromExecutable("C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe")).toBe(
      "Microsoft Edge",
    )
    expect(browserMcpProductFromExecutable("/usr/bin/chromium")).toBe("Chromium")
  })

  test("orders Google Chrome before other browser candidates without host dependencies", () => {
    const candidates = BrowserRuntime.resolveBrowserExecutableCandidates({
      platform: "win32",
      envPath: "",
      homeDir: "",
      defaultCandidates: [
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
        "C:/tools/chromium.exe",
      ],
      browserCommands: [],
    })
    expect(candidates).toEqual([
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
      "C:/tools/chromium.exe",
    ])
    expect(browserMcpProductFromExecutable(candidates[0]!)).toBe("Google Chrome")
  })
})
