import { afterEach, beforeAll, describe, expect, test } from "bun:test"
import { access, mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { chromium } from "playwright"
import { buildArtifactBrowserMcpNodeBundle } from "../../script/build-artifact"
import { resolveBrowserNodeSidecarRuntime } from "../../src/browser/runtime/node-sidecar"

type Mode = "http" | "stdio"
type Outcome = "success" | "page-close-failure"
type LifecycleEvent = Record<string, unknown> & { mode: Mode; outcome: Outcome; phase: "ready" | "cleanup-settled" }

const roots: string[] = []
const fixture = path.join(import.meta.dir, "..", "fixture", "browser-signal-owner-child.ts")
const consoleDriverFixture = path.join(import.meta.dir, "..", "fixture", "browser-signal-console-driver.ts")
let childBundleBytes: Uint8Array
let consoleDriverBundleBytes: Uint8Array
let testBrowserExecutable: string

beforeAll(async () => {
  testBrowserExecutable = process.env.OPENCORVUS_BROWSER_TEST_EXECUTABLE ?? chromium.executablePath()
  await access(testBrowserExecutable).catch(() => {
    throw new Error(
      `Browser signal acceptance requires Chrome for Testing at ${testBrowserExecutable}. ` +
        "Install this package's Playwright Chromium, or set OPENCORVUS_BROWSER_TEST_EXECUTABLE to an installed Chrome for Testing executable.",
    )
  })
  const builtChild = await buildArtifactBrowserMcpNodeBundle({ entrypoint: fixture })
  const builtDriver = await buildArtifactBrowserMcpNodeBundle({ entrypoint: consoleDriverFixture })
  if (!builtChild.success || builtChild.outputs.length !== 1) {
    throw new Error(`Browser MCP signal fixture build failed: ${builtChild.logs.map((log) => log.message).join("; ")}`)
  }
  if (!builtDriver.success || builtDriver.outputs.length !== 1) {
    throw new Error(
      `Browser signal console driver build failed: ${builtDriver.logs.map((log) => log.message).join("; ")}`,
    )
  }
  childBundleBytes = new Uint8Array(await builtChild.outputs[0]!.arrayBuffer())
  consoleDriverBundleBytes = new Uint8Array(await builtDriver.outputs[0]!.arrayBuffer())
})

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function waitForReady(ledger: string): Promise<LifecycleEvent> {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const text = await readFile(ledger, "utf8").catch(() => "")
    const ready = text
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LifecycleEvent)
      .find((event) => event.phase === "ready")
    if (ready) return ready
    await Bun.sleep(25)
  }
  throw new Error("Browser MCP child did not publish its active-session ready receipt")
}

async function waitForExit<T>(promise: Promise<T>, terminate: () => void, timeoutMs = 30_000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Browser MCP child did not settle after its signal")), timeoutMs)
      }),
    ])
  } catch (error) {
    terminate()
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function readEvents(ledger: string): Promise<LifecycleEvent[]> {
  return (await readFile(ledger, "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LifecycleEvent)
}

function childEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries({
      ...process.env,
      BROWSER_HEADLESS: "true",
      // Chrome 136+ deliberately rejects the remote-debugging pipe for its
      // installed default identity in automation scenarios. This lifecycle
      // acceptance explicitly uses Playwright's isolated Chrome for Testing;
      // it never borrows or mutates the user's browser/profile.
      OPENCORVUS_BROWSER_EXECUTABLE: testBrowserExecutable,
      OPENCORVUS_BROWSER_MODE: "isolated",
      OPENCORVUS_BROWSER_MCP_SOURCE_PACKAGE_DIR: path.join(import.meta.dir, "..", ".."),
      SESSION_TIMEOUT_MIN: "30",
    }).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]])),
  )
}

async function runWindowsConsoleSignal(
  executable: string,
  bundle: string,
  driverBundle: string,
  mode: Mode,
  outcome: Outcome,
  ledger: string,
  root: string,
) {
  const resultFile = path.join(root, "console-driver-result.json")
  const driver = Bun.spawn(
    [
      executable,
      driverBundle,
      executable,
      bundle,
      mode,
      outcome,
      ledger,
      resultFile,
      path.join(import.meta.dir, "..", ".."),
    ],
    {
      cwd: path.join(import.meta.dir, "..", ".."),
      env: childEnvironment(),
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  const stdout = new Response(driver.stdout).text()
  const stderr = new Response(driver.stderr).text()
  const exitCode = await waitForExit(driver.exited, () => driver.kill("SIGKILL"), 90_000)
  const driverOutput = `${await stdout}\n${await stderr}`
  const resultText = await readFile(resultFile, "utf8").catch(() => "")
  if (!resultText)
    throw new Error(`console driver exited ${exitCode} without a receipt\nDriver output:\n${driverOutput}`)
  const result = JSON.parse(resultText) as {
    error?: string
    exitCode?: number
    output: string
  }
  if (exitCode !== 0 || result.error || result.exitCode === undefined) {
    const ledgerOutput = await readFile(ledger, "utf8").catch(() => "<no lifecycle receipt>")
    throw new Error(
      `${result.error ?? `console driver exited ${exitCode}`}\nLifecycle ledger:\n${ledgerOutput}\nChild output:\n${result.output}\nDriver output:\n${driverOutput}`,
    )
  }
  return {
    events: await readEvents(ledger),
    exitCode: result.exitCode,
    output: `${result.output}\n${driverOutput}`,
    ready: await waitForReady(ledger),
    signal: "SIGINT" as const,
  }
}

async function runPosixSignal(executable: string, bundle: string, mode: Mode, outcome: Outcome, ledger: string) {
  const child = Bun.spawn([executable, bundle, mode, outcome, ledger], {
    cwd: path.join(import.meta.dir, "..", ".."),
    env: childEnvironment(),
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })
  const stdout = new Response(child.stdout).text()
  const stderr = new Response(child.stderr).text()
  try {
    const ready = await waitForReady(ledger)
    child.kill("SIGTERM")
    const exitCode = await waitForExit(child.exited, () => child.kill("SIGKILL"))
    return {
      events: await readEvents(ledger),
      exitCode,
      output: `${await stdout}\n${await stderr}`,
      ready,
      signal: "SIGTERM" as const,
    }
  } catch (error) {
    child.kill("SIGKILL")
    await child.exited.catch(() => undefined)
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nChild output:\n${await stdout}\n${await stderr}`,
    )
  }
}

async function runSignalLifecycle(mode: Mode, outcome: Outcome) {
  const root = await mkdtemp(path.join(os.tmpdir(), `opencorvus-browser-${mode}-${outcome}-`))
  roots.push(root)
  const ledger = path.join(root, "lifecycle.ndjson")
  const bundle = path.join(root, "browser-signal-owner-child.mjs")
  await Bun.write(bundle, childBundleBytes)
  const driverBundle = path.join(root, "browser-signal-console-driver.mjs")
  await Bun.write(driverBundle, consoleDriverBundleBytes)
  const runtime = await resolveBrowserNodeSidecarRuntime()
  const executable = path.isAbsolute(runtime.nodeExecutable)
    ? runtime.nodeExecutable
    : Bun.which(runtime.nodeExecutable)
  if (!executable) throw new Error(`Browser MCP Node executable is unavailable: ${runtime.nodeExecutable}`)
  return process.platform === "win32"
    ? runWindowsConsoleSignal(executable, bundle, driverBundle, mode, outcome, ledger, root)
    : runPosixSignal(executable, bundle, mode, outcome, ledger)
}

describe("Browser composition roots settle active isolated Sessions after a real process signal", () => {
  for (const mode of ["http", "stdio"] as const) {
    for (const outcome of ["success", "page-close-failure"] as const) {
      test(`${mode} publishes the ${outcome} cleanup receipt before process exit`, { timeout: 120_000 }, async () => {
        const result = await runSignalLifecycle(mode, outcome)
        const expectedSignalExit = result.signal === "SIGINT" ? 130 : 143
        expect(result.ready).toEqual(
          expect.objectContaining({
            active: 1,
            browserMode: "isolated",
            mode,
            outcome,
            phase: "ready",
            profiles: 1,
            sessionId: expect.stringMatching(/^sess_/),
            signalOwners: { SIGINT: 1, SIGTERM: 1 },
          }),
        )
        expect(result.events).toHaveLength(2)
        expect(result.events[1]).toEqual(
          expect.objectContaining({
            active: 0,
            exitCode: outcome === "success" ? expectedSignalExit : 1,
            injectedCloseCalls: outcome === "success" ? 0 : 1,
            mode,
            outcome,
            phase: "cleanup-settled",
            profiles: 0,
            ...(outcome === "page-close-failure" ? { error: "injected-page-close-failure" } : {}),
          }),
        )
        expect(result.exitCode).toBe(outcome === "success" ? expectedSignalExit : 1)
        expect(result.output).toContain(
          mode === "http" ? "[browser-mcp] HTTP server listening on" : "[browser-mcp] Live View available at",
        )
      })
    }
  }
})
