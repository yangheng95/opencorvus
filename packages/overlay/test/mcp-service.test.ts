import { afterEach, describe, expect, test } from "bun:test"
import { configure } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import {
  addMcpServer,
  buildMcpAddRequest,
  connectMcp,
  deleteAllMcp,
  disconnectMcp,
  parseMcpArguments,
  removeMcpAuth,
} from "../src/services/mcp"
import { setMcp } from "../src/store/app"

const PROJECT_DIR = "C:/Users/example/project"

function fakeTransport(capture: (req: TransportRequest) => void): HostTransport {
  return {
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      capture(req)
      return { status: 200, ok: true, headers: {}, body: {} as T }
    },
    openStream() {
      throw new Error("openStream not used")
    },
    async native() {
      throw new Error("native not used")
    },
  }
}

describe("MCP overlay service", () => {
  afterEach(() => {
    __setHostTransportForTest(undefined)
    configure({ directory: "" })
    setMcp({})
  })

  test("adds a project-scoped remote MCP server through the canonical route", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(fakeTransport((req) => requests.push(req)))

    await addMcpServer(
      {
        name: "docs",
        type: "remote",
        transport: "streamable-http",
        url: "https://mcp.example.com/api",
      },
      { directory: PROJECT_DIR },
    )

    expect(requests).toEqual([
      {
        method: "POST",
        path: "mcp",
        query: { directory: PROJECT_DIR },
        headers: { "Content-Type": "application/json" },
        body: {
          kind: "json",
          value: {
            name: "docs",
            config: {
              type: "remote",
              transport: "streamable-http",
              url: "https://mcp.example.com/api",
            },
          },
        },
        responseKind: "json",
        signal: undefined,
        timeoutMilliseconds: undefined,
      },
    ])
  })

  test("builds the user-owned query credential request", () => {
    const request = buildMcpAddRequest({
      name: "zapier",
      type: "remote",
      transport: "streamable-http",
      url: "https://mcp.zapier.com/api/v1/connect",
      credentialType: "query",
      credentialName: "token",
      credentialSecret: "software-secret",
    })

    expect(request).toEqual({
      name: "zapier",
      config: {
        type: "remote",
        transport: "streamable-http",
        url: "https://mcp.zapier.com/api/v1/connect",
        oauth: false,
        credential: { type: "query", name: "token" },
      },
      credentialSecret: "software-secret",
    })
  })

  test("builds bearer and custom-header credential descriptors", () => {
    expect(
      buildMcpAddRequest({
        name: "bearer",
        type: "remote",
        transport: "streamable-http",
        url: "https://mcp.example.com/api",
        credentialType: "bearer",
        credentialSecret: "bearer-secret",
      }),
    ).toEqual({
      name: "bearer",
      config: {
        type: "remote",
        transport: "streamable-http",
        url: "https://mcp.example.com/api",
        oauth: false,
        credential: { type: "bearer" },
      },
      credentialSecret: "bearer-secret",
    })
    expect(
      buildMcpAddRequest({
        name: "header",
        type: "remote",
        transport: "sse",
        url: "https://mcp.example.com/events",
        credentialType: "header",
        credentialName: "X-API-Key",
        credentialSecret: "header-secret",
      }),
    ).toEqual({
      name: "header",
      config: {
        type: "remote",
        transport: "sse",
        url: "https://mcp.example.com/events",
        oauth: false,
        credential: { type: "header", name: "X-API-Key" },
      },
      credentialSecret: "header-secret",
    })
  })

  test("builds local MCP config with quoted command arguments", () => {
    expect(
      buildMcpAddRequest({
        name: "filesystem",
        type: "local",
        command: "npx",
        args: '-y @modelcontextprotocol/server-filesystem "C:\\repo with spaces"',
      }),
    ).toEqual({
      name: "filesystem",
      config: {
        type: "local",
        command: ["npx", "-y", "@modelcontextprotocol/server-filesystem", "C:\\repo with spaces"],
      },
    })
    expect(parseMcpArguments('one "two words" three')).toEqual(["one", "two words", "three"])
  })

  test("uses canonical project-scoped connection, auth, and removal routes", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(fakeTransport((req) => requests.push(req)))
    setMcp({ browser: { status: "connected" }, filesystem: { status: "connected" } })

    await connectMcp("browser", { directory: PROJECT_DIR })
    await disconnectMcp("browser", { directory: PROJECT_DIR })
    await removeMcpAuth("browser", { directory: PROJECT_DIR })
    await deleteAllMcp({ directory: PROJECT_DIR, names: ["browser", "filesystem"] })

    expect(requests.map((request) => [request.method, request.path, request.query?.directory])).toEqual([
      ["POST", "mcp/browser/connect", PROJECT_DIR],
      ["POST", "mcp/browser/disconnect", PROJECT_DIR],
      ["DELETE", "mcp/browser/auth", PROJECT_DIR],
      ["DELETE", "mcp", PROJECT_DIR],
    ])
    expect(requests[3].body).toEqual({
      kind: "json",
      value: { names: ["browser", "filesystem"] },
    })
  })
})
