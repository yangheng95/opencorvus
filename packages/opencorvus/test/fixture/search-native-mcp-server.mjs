import fs from "node:fs"
import readline from "node:readline"

const statePath = process.argv[2]
const callLogPath = process.argv[3]
if (!statePath || !callLogPath) throw new Error("search-native MCP fixture requires state and call-log paths")

const readState = () => JSON.parse(fs.readFileSync(statePath, "utf8"))
const send = (value) => process.stdout.write(`${JSON.stringify(value)}\n`)
const schema = (version) =>
  version === 1
    ? {
        type: "object",
        properties: { value: { type: "string" }, delay_ms: { type: "number" } },
        required: ["value"],
        additionalProperties: false,
      }
    : {
        type: "object",
        properties: { replacement: { type: "string" } },
        required: ["replacement"],
        additionalProperties: false,
      }

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  const request = JSON.parse(line)
  if (request.method === "initialize") {
    return send({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: {}, prompts: {}, resources: {} },
        serverInfo: { name: "search-native-mcp-fixture", version: "1" },
      },
    })
  }
  if (request.method === "tools/list") {
    const state = readState()
    fs.appendFileSync(callLogPath, `${JSON.stringify({ event: "tools_list", version: state.version })}\n`)
    return send({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: [
          {
            name: "echo",
            description: `Search-native echo v${state.version}`,
            inputSchema: schema(state.version),
            _meta: { ui: { resourceUri: "ui://echo" } },
          },
        ],
      },
    })
  }
  if (request.method === "prompts/list") {
    return send({
      jsonrpc: "2.0",
      id: request.id,
      result: { prompts: [{ name: "summarize", description: "Summarize a selected source" }] },
    })
  }
  if (request.method === "resources/list") {
    return send({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        resources: [{ name: "guide", description: "Fixture usage guide", uri: "fixture://guide" }],
      },
    })
  }
  if (request.method === "resources/read") {
    return send({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        contents: [
          {
            uri: "ui://echo",
            mimeType: "text/html;profile=mcp-app",
            text: "<!doctype html><title>Search-native echo</title><main>Echo lifecycle</main>",
          },
        ],
      },
    })
  }
  if (request.method === "tools/call") {
    const state = readState()
    fs.appendFileSync(
      callLogPath,
      `${JSON.stringify({ event: "tools_call", version: state.version, params: request.params })}\n`,
    )
    const delay = Number(request.params?.arguments?.delay_ms ?? 0)
    return setTimeout(
      () =>
        send({
          jsonrpc: "2.0",
          id: request.id,
          result: { content: [{ type: "text", text: `executed-v${state.version}` }] },
        }),
      Math.max(0, delay),
    )
  }
})
