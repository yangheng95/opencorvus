import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { createServer } from "node:http"
import path from "node:path"
import readline from "node:readline"

const bundle = process.argv[2]
if (!bundle) throw new Error("Usage: bun script/check-browser-mcp-live-view.ts <browser-mcp-stdio-bundle>")

const pageServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
  res.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Browser MCP Live View acceptance</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f3efe6; font: 18px system-ui; }
      main { width: min(720px, 82vw); padding: 52px; border: 2px solid #17211b; background: white; box-shadow: 16px 16px 0 #bbd1bd; }
      h1 { margin-top: 0; font-size: 42px; }
      button { padding: 14px 20px; border: 0; background: #17211b; color: white; font: inherit; cursor: pointer; }
      #status { margin-top: 28px; padding: 18px; background: #eee8dc; font-weight: 700; }
      #status.complete { background: #bbd1bd; }
    </style>
  </head>
  <body>
    <main>
      <p>Same Playwright page · user-visible acceptance</p>
      <h1>Browser MCP Live View</h1>
      <button id="advance" onclick="document.querySelector('#status').className='complete'; document.querySelector('#status').textContent='MCP click observed live'">Run MCP action</button>
      <button id="popup" onclick="window.open('/popup', '_blank')">Open popup</button>
      <div id="status">Waiting for MCP click</div>
    </main>
  </body>
</html>`)
})

await new Promise<void>((resolve, reject) => {
  pageServer.once("error", reject)
  pageServer.listen(0, "127.0.0.1", resolve)
})
const address = pageServer.address()
if (!address || typeof address === "string") throw new Error("Acceptance page did not publish a TCP port")

const transport = new StdioClientTransport({
  command: process.env.OPENCORVUS_BROWSER_MCP_NODE ?? "node",
  args: [path.resolve(bundle), "stdio"],
  cwd: process.cwd(),
  env: {
    ...process.env,
    BROWSER_HEADLESS: "false",
    OPENCORVUS_BROWSER_MCP_SOURCE_PACKAGE_DIR: path.resolve("packages/opencorvus"),
  } as Record<string, string>,
  stderr: "inherit",
})
const client = new Client({ name: "browser-mcp-live-view-check", version: "1.0.0" })

const close = async () => {
  await client.close().catch(() => undefined)
  await new Promise<void>((resolve) => pageServer.close(() => resolve()))
}

try {
  await client.connect(transport)
  const created = await client.callTool({ name: "session_create", arguments: { viewport: { width: 1100, height: 720 } } })
  const output = created.structuredContent as { sessionId?: unknown; liveViewUrl?: unknown } | undefined
  if (typeof output?.sessionId !== "string" || typeof output.liveViewUrl !== "string") {
    throw new Error(`session_create did not publish the Live View contract: ${JSON.stringify(created)}`)
  }
  const sessionId = output.sessionId
  const liveViewUrl = output.liveViewUrl
  await client.callTool({
    name: "navigate",
    arguments: { sessionId, url: `http://127.0.0.1:${address.port}/`, waitUntil: "load" },
  })
  const liveViewResponse = await fetch(liveViewUrl)
  const liveViewHtml = await liveViewResponse.text()
  if (!liveViewResponse.ok || !liveViewHtml.includes(sessionId) || !liveViewHtml.includes("browser-mcp")) {
    throw new Error(`Live View did not render session ${sessionId}: HTTP ${liveViewResponse.status}`)
  }

  process.stdout.write(
    `${JSON.stringify({ status: "ready", sessionId, liveViewUrl, pageUrl: `http://127.0.0.1:${address.port}/` })}\n`,
  )
  process.stdout.write('Enter "click" or "popup" to drive an MCP action, or "exit" to finish.\n')

  const input = readline.createInterface({ input: process.stdin, terminal: false })
  for await (const line of input) {
    const command = line.trim().toLowerCase()
    if (command === "click") {
      await client.callTool({ name: "click", arguments: { sessionId, selector: "#advance" } })
      const observed = await client.callTool({
        name: "get_text",
        arguments: { sessionId, selector: "#status" },
      })
      process.stdout.write(`${JSON.stringify({ status: "clicked", observed: observed.structuredContent })}\n`)
      continue
    }
    if (command === "popup") {
      const opened = await client.callTool({ name: "click", arguments: { sessionId, selector: "#popup" } })
      const openedPage = (opened.structuredContent as { openedPage?: unknown } | undefined)?.openedPage as
        | { sessionId?: unknown; liveViewUrl?: unknown }
        | undefined
      if (typeof openedPage?.sessionId !== "string" || typeof openedPage.liveViewUrl !== "string") {
        throw new Error(`popup did not publish its session-selected Live View URL: ${JSON.stringify(opened)}`)
      }
      process.stdout.write(`${JSON.stringify({ status: "popup", openedPage })}\n`)
      continue
    }
    if (command === "exit") break
  }
} finally {
  await close()
}
