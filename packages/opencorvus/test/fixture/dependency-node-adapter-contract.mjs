import { createRequire } from "node:module"
import { once } from "node:events"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const require = createRequire(import.meta.url)
const sdk = createRequire(require.resolve("@modelcontextprotocol/sdk/server/streamableHttp.js"))
const { Hono } = sdk("hono")
const { serve } = sdk("@hono/node-server")
const { serveStatic } = sdk("@hono/node-server/serve-static")
const directory = await fs.mkdtemp(path.join(os.tmpdir(), "dependency-node-adapter-"))
let server
try {
  await fs.writeFile(path.join(directory, "contract.txt"), "adapter:中文\n")
  const app = new Hono()
  app.use("/public/*", async (context, next) => {
    context.header("X-Contract", "guarded")
    await next()
  })
  app.get("/public/*", serveStatic({ root: directory, rewriteRequestPath: (value) => value.slice("/public".length) }))
  server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 })
  await once(server, "listening")
  const response = await fetch(`http://127.0.0.1:${server.address().port}/public/contract.txt`)
  console.log(JSON.stringify({ status: response.status, middleware: response.headers.get("X-Contract"), body: await response.text() }))
} finally {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  await fs.rm(directory, { recursive: true, force: true })
}
