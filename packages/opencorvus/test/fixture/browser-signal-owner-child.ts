import { appendFile } from "node:fs/promises"
import { setTimeout as delay } from "node:timers/promises"
import { BrowserMCP } from "../../src/mcp/browser"
import { createSession, getSession, getSessionStats } from "../../src/mcp/browser/sessions"

const mode = process.argv[2]
const outcome = process.argv[3]
const ledger = process.argv[4]

if ((mode !== "http" && mode !== "stdio") || (outcome !== "success" && outcome !== "page-close-failure") || !ledger) {
  throw new Error("usage: browser-signal-owner-child.ts <http|stdio> <success|page-close-failure> <ledger>")
}

async function record(event: Record<string, unknown>): Promise<void> {
  await appendFile(ledger, `${JSON.stringify({ mode, outcome, ...event })}\n`, "utf8")
}

async function waitForSignalOwners(): Promise<void> {
  const deadline = Date.now() + 15_000
  while (process.listenerCount("SIGINT") === 0 || process.listenerCount("SIGTERM") === 0) {
    if (Date.now() >= deadline) throw new Error("Browser MCP signal owners did not become ready")
    await delay(10)
  }
}

async function waitForSignalSettlement(): Promise<void> {
  const deadline = Date.now() + 30_000
  while (process.exitCode === undefined) {
    if (Date.now() >= deadline) throw new Error("Browser MCP signal cleanup did not settle")
    await delay(10)
  }
}

let injectedCloseCalls = 0

async function createActiveSession(): Promise<Awaited<ReturnType<typeof createSession>>> {
  const created = await createSession({ viewport: { width: 960, height: 640 }, virtualCursor: false })
  if (outcome === "page-close-failure") {
    const page = getSession(created.sessionId).page
    const close = page.close.bind(page)
    page.close = async (options) => {
      injectedCloseCalls += 1
      await close(options)
      throw new Error("injected-page-close-failure")
    }
  }
  return created
}

async function recordReady(created: Awaited<ReturnType<typeof createSession>>, port?: number): Promise<void> {
  const stats = getSessionStats()
  await record({
    phase: "ready",
    sessionId: created.sessionId,
    browserMode: created.browserMode,
    active: stats.active,
    profiles: stats.profiles,
    signalOwners: {
      SIGINT: process.listenerCount("SIGINT"),
      SIGTERM: process.listenerCount("SIGTERM"),
    },
    ...(port === undefined ? {} : { port }),
  })
}

async function recordSettlement(error?: unknown): Promise<void> {
  const stats = getSessionStats()
  await record({
    phase: "cleanup-settled",
    active: stats.active,
    profiles: stats.profiles,
    injectedCloseCalls,
    exitCode: process.exitCode,
    ...(error === undefined ? {} : { error: error instanceof Error ? error.message : String(error) }),
  })
}

if (mode === "http") {
  const server = await BrowserMCP.serveHttp(0)
  const created = await createActiveSession()
  await recordReady(created, server.port)
  await waitForSignalSettlement()
  let closeError: unknown
  try {
    await server.close()
  } catch (error) {
    closeError = error
  }
  await recordSettlement(closeError)
} else {
  const serving = BrowserMCP.serveStdio()
  await waitForSignalOwners()
  const created = await createActiveSession()
  await recordReady(created)
  let serveError: unknown
  try {
    await serving
  } catch (error) {
    serveError = error
  }
  await recordSettlement(serveError)
}
