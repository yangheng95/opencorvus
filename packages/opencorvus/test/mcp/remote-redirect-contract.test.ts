import { afterEach, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { MCP } from "../../src/mcp"

const servers: Array<ReturnType<typeof Bun.serve>> = []
const clients: Client[] = []

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()))
  await Promise.all(servers.splice(0).map((server) => server.stop(true)))
})

function listen(fetch: (request: Request) => Response | Promise<Response>) {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch })
  servers.push(server)
  return server.url
}

function client() {
  const value = new Client({ name: "redirect-contract", version: "1.0.0" })
  clients.push(value)
  return value
}

test("remote HTTP initialization keeps its body and configured header through a same-origin redirect", async () => {
  const received: Array<{ method: string; operation: string; header: string | null }> = []
  const origin = listen(async (request) => {
    const url = new URL(request.url)
    if (url.pathname === "/start") return Response.redirect(new URL("/mcp", url), 307)
    if (request.method === "GET") return new Response("POST required", { status: 405 })
    const body = (await request.json()) as {
      id?: string | number
      method: string
      params?: { protocolVersion: string }
    }
    received.push({ method: request.method, operation: body.method, header: request.headers.get("X-Contract-Scope") })
    if (body.method === "initialize") {
      return Response.json({
        jsonrpc: "2.0",
        id: body.id,
        result: {
          protocolVersion: body.params!.protocolVersion,
          capabilities: {},
          serverInfo: { name: "same-origin-contract", version: "1.0.0" },
        },
      })
    }
    return new Response(null, { status: 202 })
  })
  const { transport } = MCP.createRemoteTransport({
    type: "remote",
    transport: "streamable-http",
    url: new URL("/start", origin).href,
    oauth: false,
    headers: { "X-Contract-Scope": "local-contract" },
  })
  const connection = client()
  await connection.connect(transport)
  expect(connection.getServerVersion()).toEqual({ name: "same-origin-contract", version: "1.0.0" })
  expect(received).toEqual([
    { method: "POST", operation: "initialize", header: "local-contract" },
    { method: "POST", operation: "notifications/initialized", header: "local-contract" },
  ])
})

test("remote HTTP cross-origin redirect returns the SDK's explicit 307 transport error", async () => {
  const destination = listen(() => Response.json({ result: "different-origin" }))
  const origin = listen(() => Response.redirect(destination, 307))
  const { transport } = MCP.createRemoteTransport({
    type: "remote",
    transport: "streamable-http",
    url: origin.href,
    oauth: false,
    headers: { "X-Contract-Scope": "original-origin" },
  })
  const failure = await client()
    .connect(transport)
    .catch((error: unknown) => error)
  expect(failure).toBeInstanceOf(StreamableHTTPError)
  expect(failure).toMatchObject({ code: 307 })
  expect((failure as Error).message).toContain("redirectPolicy: 'same-origin'")
})

test("remote SSE cross-origin redirect returns the SDK's explicit 307 event-source error", async () => {
  const destination = listen(() => new Response("different-origin"))
  const origin = listen(() => Response.redirect(destination, 307))
  const { transport } = MCP.createRemoteTransport({
    type: "remote",
    transport: "sse",
    url: origin.href,
    oauth: false,
    headers: { "X-Contract-Scope": "original-origin" },
  })
  const failure = await client()
    .connect(transport)
    .catch((error: unknown) => error)
  expect(failure).toMatchObject({ code: 307 })
  expect((failure as Error).message).toContain("redirectPolicy: 'same-origin'")
})
