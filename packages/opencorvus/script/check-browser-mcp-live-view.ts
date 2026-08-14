import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { createServer } from "node:http"
import path from "node:path"
import readline from "node:readline"
import { Readable } from "node:stream"

const bundle = process.argv[2]
if (!bundle) {
  throw new Error(
    "Usage: bun script/check-browser-mcp-live-view.ts <browser-mcp-stdio-bundle> [click|popup|tabs|exit ...]",
  )
}

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
    OPENCORVUS_BROWSER_MODE: process.env.OPENCORVUS_BROWSER_MODE ?? "isolated",
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
  if (process.env.OPENCORVUS_BROWSER_MCP_CHECK_PROFILE_RECOVERY === "1") {
    const rejected = await client.callTool({
      name: "session_create",
      arguments: { viewport: { width: -1, height: 720 } },
    })
    if (!rejected.isError) {
      throw new Error(`invalid viewport unexpectedly created a session: ${JSON.stringify(rejected)}`)
    }
    process.stdout.write(`${JSON.stringify({ status: "profile_recovered_after_setup_failure" })}\n`)
  }
  const created = await client.callTool({ name: "session_create", arguments: { viewport: { width: 1100, height: 720 } } })
  const output = created.structuredContent as
    | {
        sessionId?: unknown
        profileId?: unknown
        liveViewUrl?: unknown
        browserMode?: unknown
        browserProduct?: unknown
      }
    | undefined
  if (
    typeof output?.sessionId !== "string" ||
    typeof output.liveViewUrl !== "string" ||
    !["cdp", "isolated"].includes(String(output.browserMode)) ||
    typeof output.browserProduct !== "string"
  ) {
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
    `${JSON.stringify({
      status: "ready",
      sessionId,
      liveViewUrl,
      pageUrl: `http://127.0.0.1:${address.port}/`,
      browserMode: output.browserMode,
      browserProduct: output.browserProduct,
    })}\n`,
  )
  process.stdout.write('Enter "click" or "popup" to drive an MCP action, or "exit" to finish.\n')

  const scriptedCommands = process.argv.slice(3)
  const input =
    scriptedCommands.length > 0
      ? Readable.from(scriptedCommands)
      : readline.createInterface({ input: process.stdin, terminal: false })
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
        | { sessionId?: unknown; liveViewUrl?: unknown; profileId?: unknown }
        | undefined
      if (
        typeof openedPage?.sessionId !== "string" ||
        typeof openedPage.liveViewUrl !== "string" ||
        openedPage.profileId !== output.profileId
      ) {
        throw new Error(`popup did not publish its session-selected Live View URL: ${JSON.stringify(opened)}`)
      }
      if (
        process.env.OPENCORVUS_BROWSER_MCP_CHECK_EXTERNAL_OWNERSHIP === "1" &&
        process.env.OPENCORVUS_BROWSER_CDP_ENDPOINT
      ) {
        const externalURL = "data:text/html,<title>External ownership sentinel</title>"
        await fetch(`${process.env.OPENCORVUS_BROWSER_CDP_ENDPOINT}/json/new?${encodeURIComponent(externalURL)}`, {
          method: "PUT",
        })
        const listed = await client.callTool({ name: "tabs", arguments: { sessionId, action: "list" } })
        const ownedTabs = (
          listed.structuredContent as
            | { tabs?: Array<{ index?: unknown; sessionId?: unknown; title?: unknown }> }
            | undefined
        )?.tabs
        if (
          JSON.stringify(listed.structuredContent).includes("External ownership sentinel") ||
          ownedTabs?.length !== 2 ||
          ownedTabs[0]?.index !== 0 ||
          ownedTabs[0]?.sessionId !== sessionId ||
          ownedTabs[1]?.index !== 1 ||
          ownedTabs[1]?.sessionId !== openedPage.sessionId
        ) {
          throw new Error(`CDP external page was incorrectly adopted: ${JSON.stringify(listed)}`)
        }
        const selectedPrimary = await client.callTool({
          name: "tabs",
          arguments: { sessionId, action: "select", index: 0 },
        })
        const selectedPopup = await client.callTool({
          name: "tabs",
          arguments: { sessionId, action: "select", index: 1 },
        })
        if (
          (selectedPrimary.structuredContent as { selectedSessionId?: unknown } | undefined)?.selectedSessionId !==
            sessionId ||
          (selectedPopup.structuredContent as { selectedSessionId?: unknown } | undefined)?.selectedSessionId !==
            openedPage.sessionId
        ) {
          throw new Error(
            `CDP external page affected MCP-owned tab selection: ${JSON.stringify({ selectedPrimary, selectedPopup })}`,
          )
        }
        const storageExport = await client.callTool({
          name: "storage_state_export",
          arguments: { sessionId },
        })
        if (!storageExport.isError || !JSON.stringify(storageExport.content).includes("STORAGE_STATE_EXPORT_UNAVAILABLE")) {
          throw new Error(`CDP storage export did not return its safe typed error: ${JSON.stringify(storageExport)}`)
        }
        process.stdout.write(`${JSON.stringify({ status: "external_page_not_adopted" })}\n`)
      }
      process.stdout.write(`${JSON.stringify({ status: "popup", openedPage })}\n`)
      continue
    }
    if (command === "tabs") {
      const initial = await client.callTool({ name: "tabs", arguments: { sessionId, action: "list" } })
      const initialTabs = (initial.structuredContent as { tabs?: Array<{ index?: unknown; sessionId?: unknown }> } | undefined)
        ?.tabs
      if (initialTabs?.length !== 1 || initialTabs[0]?.index !== 0 || initialTabs[0]?.sessionId !== sessionId) {
        throw new Error(`tabs list did not expose one continuous MCP-owned index: ${JSON.stringify(initial)}`)
      }
      const createdTab = await client.callTool({ name: "tabs", arguments: { sessionId, action: "new" } })
      const newTab = (createdTab.structuredContent as { tab?: { index?: unknown; sessionId?: unknown } } | undefined)?.tab
      if (newTab?.index !== 1 || typeof newTab.sessionId !== "string") {
        throw new Error(`tabs new did not append an MCP-owned index: ${JSON.stringify(createdTab)}`)
      }
      const selected = await client.callTool({ name: "tabs", arguments: { sessionId, action: "select", index: 0 } })
      if ((selected.structuredContent as { selectedSessionId?: unknown } | undefined)?.selectedSessionId !== sessionId) {
        throw new Error(`tabs select did not resolve the listed MCP-owned index: ${JSON.stringify(selected)}`)
      }
      const closed = await client.callTool({ name: "tabs", arguments: { sessionId, action: "close", index: 1 } })
      const remaining = (closed.structuredContent as { tabs?: Array<{ index?: unknown; sessionId?: unknown }> } | undefined)
        ?.tabs
      if (remaining?.length !== 1 || remaining[0]?.index !== 0 || remaining[0]?.sessionId !== sessionId) {
        throw new Error(`tabs close did not preserve continuous MCP-owned indexes: ${JSON.stringify(closed)}`)
      }
      process.stdout.write(`${JSON.stringify({ status: "owned_tabs_indexed", count: remaining.length })}\n`)
      continue
    }
    if (command === "exit") break
  }
} finally {
  await close()
}
