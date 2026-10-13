import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"
const root = path.join(import.meta.dir, "live-attempt-01")
const require = createRequire(path.join(import.meta.dir, "../packages/opencorvus/package.json"))
const { McpServer } = await import(require.resolve("@modelcontextprotocol/sdk/server/mcp.js"))
const { WebStandardStreamableHTTPServerTransport } = await import(require.resolve("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"))
const { z } = await import(require.resolve("zod"))
const results = JSON.parse(await fs.readFile(path.join(root, "public-results.json"), "utf8"))
const descriptions = {
  "public-summary": "Read the public daily summary containing review_code and total. Read-only.",
  "empty-note": "Read the public empty-resource check report, including its original text line and note. Read-only.",
  "report-archive": "Read the complete public archive with archive_review_code and record_count at its beginning, followed by all 2400 records. Read-only.",
}
const occurrence = randomUUID()
const startedAt = Date.now()
const deadlineAt = startedAt + 600000
const servers = new Set<any>()
let complete!: () => void
const done = new Promise<void>((resolve) => complete = resolve)
let closing = false
const close = async (reason: string) => {
  if (closing) return
  closing = true
  clearTimeout(timer)
  const outcomes = await Promise.allSettled([...servers].map((server) => server.close()))
  await http.stop(true)
  const rejected = outcomes.filter((outcome) => outcome.status === "rejected")
  await fs.writeFile(path.join(root, "mcp-closed.json"), JSON.stringify({ occurrence, pid: process.pid, reason, closedAt: new Date().toISOString(), servers: outcomes.length, rejected: rejected.map((item: any) => String(item.reason)) }, null, 2), { flag: "wx" })
  if (rejected.length) process.exitCode = 1
  complete()
}
const http = Bun.serve({ hostname: "127.0.0.1", port: 18507, async fetch(request) {
  const url = new URL(request.url)
  if (request.method === "POST" && url.pathname === "/__shutdown") {
    setTimeout(() => void close("owned-shutdown"), 50)
    return Response.json({ occurrence, accepted: true })
  }
  if (url.pathname === "/health") return Response.json({ occurrence, pid: process.pid, deadlineAt })
  if (closing || url.pathname !== "/mcp") return new Response("Not available", { status: 404 })
  const server = new McpServer({ name: "public-structured-reports-388", version: "1.0.0" })
  servers.add(server)
  for (const [name, description] of Object.entries(descriptions)) server.registerTool(name, {
    description, inputSchema: {}, outputSchema: z.object({}).catchall(z.unknown()),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  }, async () => {
    await fs.appendFile(path.join(root, "mcp-calls.jsonl"), JSON.stringify({ occurrence, pid: process.pid, name, at: new Date().toISOString(), outputBytes: Buffer.byteLength(JSON.stringify(results[name])) }) + "\n")
    return results[name]
  })
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  await server.connect(transport)
  return transport.handleRequest(request)
} })
assert.equal(http.port, 18507)
const timer = setTimeout(() => void close("fixed-deadline"), Math.max(0, deadlineAt - Date.now()))
await fs.writeFile(path.join(root, "mcp-owner.json"), JSON.stringify({ occurrence, pid: process.pid, parentPID: process.ppid, startedAt, deadlineAt, port: http.port, shutdown: "POST http://127.0.0.1:18507/__shutdown", lifetimeMilliseconds: 600000 }, null, 2), { flag: "wx" })
console.log(JSON.stringify({ occurrence, pid: process.pid, port: http.port, deadlineAt }))
await done
console.log("Owned MCP server closed and joined.")
