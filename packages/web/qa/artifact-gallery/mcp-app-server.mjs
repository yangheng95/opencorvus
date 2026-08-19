/**
 * A real MCP server whose tool returns a real MCP App UI resource.
 *
 * `mcp-app@1` is the one renderer the publish tool cannot author — the Host only mints it after a
 * real MCP tool call hands back a `ui://` resource — so the gallery needs a real server rather than
 * a fixture. This one is small but genuine: the tool fetches the live Coinbase spot rates and the
 * resource renders them, so the App shows real prices from the moment it mounts.
 *
 * Copied into the gallery workspace by run-missions.mjs and started over stdio by the Host.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/app-bridge"

const RESOURCE_URI = "ui://spot-rates/board"
const PRODUCTS = ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "ADA-USD"]

async function spotRates() {
  const rows = await Promise.all(
    PRODUCTS.map(async (product) => {
      const response = await fetch(`https://api.exchange.coinbase.com/products/${product}/ticker`, {
        headers: { "user-agent": "opencorvus-artifact-gallery" },
      })
      if (!response.ok) throw new Error(`${product} -> HTTP ${response.status}`)
      const ticker = await response.json()
      return {
        product,
        price: Number(ticker.price),
        bid: Number(ticker.bid),
        ask: Number(ticker.ask),
        volume: Number(ticker.volume),
        time: String(ticker.time),
      }
    }),
  )
  return rows
}

const money = (value) => `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`

function boardHtml(rows) {
  const asOf = rows[0]?.time ?? new Date(0).toISOString()
  const cells = rows
    .map(
      (row) => `<tr>
        <th scope="row">${row.product}</th>
        <td class="num strong">${money(row.price)}</td>
        <td class="num">${money(row.bid)}</td>
        <td class="num">${money(row.ask)}</td>
        <td class="num muted">${row.volume.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
      </tr>`,
    )
    .join("\n")
  return `<main class="board">
  <header>
    <h1>Coinbase spot rates</h1>
    <p>Live from api.exchange.coinbase.com · as of ${asOf}</p>
  </header>
  <table>
    <thead><tr><th scope="col">Pair</th><th scope="col">Last</th><th scope="col">Bid</th><th scope="col">Ask</th><th scope="col">24h volume</th></tr></thead>
    <tbody>${cells}</tbody>
  </table>
  <style>
    :root { color-scheme: light dark; }
    .board { font: 14px/1.5 ui-sans-serif, system-ui, sans-serif; padding: 20px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    header p { margin: 0 0 16px; opacity: 0.6; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid rgba(128,128,128,0.25); }
    thead th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .strong { font-weight: 600; }
    .muted { opacity: 0.6; }
  </style>
</main>`
}

/** The resource is read after the call, so the newest rows the tool fetched are what it renders. */
let latest = []

const server = new Server(
  { name: "spot-rates", version: "1.0.0" },
  { capabilities: { tools: {}, resources: {} } },
)

const toolDefinition = {
  name: "spot_rate_board",
  title: "Spot rate board",
  description: "Fetch live Coinbase spot rates for five major pairs and render them as an MCP App.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  _meta: { ui: { resourceUri: RESOURCE_URI } },
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [toolDefinition] }))

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: RESOURCE_URI,
      name: "Spot rate board",
      mimeType: RESOURCE_MIME_TYPE,
      _meta: { ui: { preferredSize: { height: 320 } } },
    },
  ],
}))

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  if (request.params.uri !== RESOURCE_URI) throw new Error(`unknown resource ${request.params.uri}`)
  if (latest.length === 0) latest = await spotRates()
  return {
    contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: boardHtml(latest) }],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== toolDefinition.name) throw new Error(`unknown tool ${request.params.name}`)
  latest = await spotRates()
  return {
    content: [{ type: "text", text: `Fetched ${latest.length} live spot rates from Coinbase.` }],
    structuredContent: { rows: latest },
  }
})

await server.connect(new StdioServerTransport())
