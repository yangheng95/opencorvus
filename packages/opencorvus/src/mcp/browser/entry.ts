import { BrowserMCP } from "./index"

const transport = process.argv[2]

if (transport === "stdio") {
  await BrowserMCP.serveStdio()
} else if (transport === "http") {
  await BrowserMCP.serveHttp()
} else {
  throw new Error(`Browser MCP transport must be "stdio" or "http"; received ${JSON.stringify(transport)}`)
}
