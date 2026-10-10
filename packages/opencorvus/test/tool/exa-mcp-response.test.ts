import { expect, test } from "bun:test"
import { decodeExaMcpResponse, ExaMcpFailure } from "../../src/tool/exa-mcp"
import { fetchHttpResponseOwner, readHttpResponseBody } from "../../src/util/http-response-body"

const result = {
  content: [
    { type: "text", text: "actual first" },
    { type: "text", text: "actual second" },
  ],
  structuredContent: { count: 2 },
  _meta: { "vendor/observation": { sequence: 7 } },
  isError: false,
}

test("owned HTTP JSON and multiline SSE preserve complete current MCP results", async () => {
  const payload = { jsonrpc: "2.0", id: 1, result }
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(request) {
      if (new URL(request.url).pathname === "/json") return Response.json(payload)
      return new Response(
        "event: message\n" +
          JSON.stringify(payload, null, 2)
            .split("\n")
            .map((line) => `data:${line}`)
            .join("\n") +
          "\n\n",
        { headers: { "content-type": "text/event-stream" } },
      )
    },
  })
  try {
    for (const format of ["json", "sse"]) {
      const owner = await fetchHttpResponseOwner(
        (signal) => fetch(new URL(format, server.url), { signal }),
        new AbortController().signal,
      )
      const bytes = await readHttpResponseBody(owner)
      expect(
        decodeExaMcpResponse(
          new TextDecoder().decode(bytes),
          owner.response.headers.get("content-type")!,
          "web_search_exa",
          "Web search",
        ),
      ).toEqual({ result, text: "actual first\n\nactual second" })
    }
  } finally {
    await server.stop(true)
  }
})

test("explicit rate-limit and tool errors retain original protocol results", () => {
  for (const [result, code] of [
    [
      { content: [{ type: "text", text: "Current provider quota exhausted" }], _meta: { "ai.exa/rateLimited": true } },
      "rate_limited",
    ],
    [
      { content: [{ type: "text", text: "Invalid remote parameter" }], isError: true, _meta: { request: "remote-17" } },
      "tool_error",
    ],
  ] as const) {
    let error: unknown
    try {
      decodeExaMcpResponse(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result }),
        "application/json",
        "get_code_context_exa",
        "Code search",
      )
    } catch (caught) {
      error = caught
    }
    expect(error).toMatchObject({ name: "ExaMcpFailure", data: { code, toolName: "get_code_context_exa", result } })
    expect((error as InstanceType<typeof ExaMcpFailure>).message).toContain(result.content[0].text)
  }
})

test("JSON-RPC failures preserve their exact error contract", () => {
  const rpcError = { code: -32602, message: "Unknown current tool", data: { tool: "missing" } }
  expect(() =>
    decodeExaMcpResponse(
      JSON.stringify({ jsonrpc: "2.0", id: 1, error: rpcError }),
      "application/json",
      "web_search_exa",
      "Web search",
    ),
  ).toThrow(
    new ExaMcpFailure({
      code: "protocol_error",
      toolName: "web_search_exa",
      message: "Web search: Unknown current tool",
      rpcError,
    }),
  )
})
