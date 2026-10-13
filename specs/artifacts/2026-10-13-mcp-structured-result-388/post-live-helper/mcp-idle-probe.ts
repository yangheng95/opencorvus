import assert from "node:assert/strict"
import path from "node:path"
import fs from "node:fs/promises"
import { createRequire } from "node:module"
const root = path.join(import.meta.dir, "live-attempt-01")
const require = createRequire(path.join(import.meta.dir, "../packages/opencorvus/package.json"))
const { McpServer } = await import(require.resolve("@modelcontextprotocol/sdk/server/mcp.js"))
const { WebStandardStreamableHTTPServerTransport } = await import(require.resolve("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"))
const receipts = []
for (const idleTimeout of [10, 0]) {
  const owners = new Set<any>()
  const admitted: string[] = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout, async fetch(request) {
    admitted.push(request.method)
    const mcp = new McpServer({ name: "public-idle-probe", version: "1.0.0" })
    owners.add(mcp)
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await mcp.connect(transport)
    return transport.handleRequest(request)
  } })
  const controller = new AbortController()
  let state: { kind: string; status?: number; error?: string } = { kind: "pending" }
  const startedAt = Date.now()
  const pending = fetch(server.url, { headers: { accept: "text/event-stream" }, signal: controller.signal })
    .then(async (response) => {
      state = { kind: "streaming", status: response.status }
      await response.text()
      state = { kind: "eof", status: response.status }
    }).catch((error) => { state = { kind: "error", error: error.name + ": " + error.message } })
  try {
    await new Promise((resolve) => setTimeout(resolve, 12500))
    const beforeClose = { ...state }
    assert.deepEqual(admitted, ["GET"])
    if (idleTimeout === 10) assert.equal(beforeClose.kind, "error")
    else assert(["pending", "streaming"].includes(beforeClose.kind))
    const closed = await Promise.allSettled([...owners].map((owner) => owner.close()))
    assert(closed.every((result) => result.status === "fulfilled"))
    await server.stop(true)
    await pending
    receipts.push({ idleTimeout, port: server.port, elapsedMs: Date.now() - startedAt, admitted, beforeClose, afterClose: state, sdkOwners: closed.length, ownerClose: "fulfilled", httpStop: "fulfilled" })
  } finally {
    controller.abort()
    await Promise.allSettled([...owners].map((owner) => owner.close()))
    await server.stop(true)
    await pending
  }
}
await fs.writeFile(path.join(root, "mcp-idle-probe.json"), JSON.stringify({ observedAt: new Date().toISOString(), pid: process.pid, receipts, boundary: "Post-live auxiliary SDK GET stream probe; no model, credential, task or product changes" }, null, 2), { flag: "wx" })
console.log(JSON.stringify(receipts, null, 2))
