import { appendFile } from "node:fs/promises"
import { BrowserMCP } from "../../src/mcp/browser"

const mode = process.argv[2]
const ledger = process.argv[3]

if ((mode !== "http" && mode !== "stdio") || !ledger) {
  throw new Error("usage: browser-signal-owner-child.ts <http|stdio> <ledger>")
}

async function record(event: Record<string, unknown>): Promise<void> {
  await appendFile(ledger, `${JSON.stringify({ mode, ...event })}\n`, "utf8")
}

async function requestStdioSignalAfterReady(): Promise<void> {
  const deadline = Date.now() + 10_000
  while (process.listenerCount("SIGTERM") === 0) {
    if (Date.now() >= deadline) throw new Error("stdio Browser MCP signal owner did not become ready")
    await Bun.sleep(10)
  }
  await record({ phase: "ready", signalOwners: process.listenerCount("SIGTERM") })
  process.emit("SIGTERM", "SIGTERM")
  await record({ phase: "signal-requested" })
}

if (mode === "http") {
  const server = await BrowserMCP.serveHttp(0)
  await record({ phase: "ready", port: server.port, signalOwners: process.listenerCount("SIGTERM") })
  process.emit("SIGTERM", "SIGTERM")
  await record({ phase: "signal-requested" })
  await server.close()
  await record({ phase: "cleanup-settled", exitCode: process.exitCode })
} else {
  const signal = requestStdioSignalAfterReady()
  await BrowserMCP.serveStdio()
  await signal
  await record({ phase: "cleanup-settled", exitCode: process.exitCode })
}
