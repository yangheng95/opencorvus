import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import z from "zod"

const description = process.argv[2]
const server = new McpServer({ name: "acp-editor-report", version: "1.0.0" })
server.registerPrompt(
  "editor_report",
  { description, argsSchema: { date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) } },
  async ({ date }) => ({
    messages: [{ role: "user", content: { type: "text", text: `Read the report from ${date}.` } }],
  }),
)
await server.connect(new StdioServerTransport())
