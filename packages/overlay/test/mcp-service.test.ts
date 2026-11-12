import { afterEach, describe, expect, test } from "bun:test"
import { ApiError, captureApiAuthority, configure, renewApiAuthority } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import type { HostTransport, TransportRequest, TransportResponse } from "../src/services/host-transport"
import {
  addMcpServer,
  buildMcpAddRequest,
  connectMcp,
  deleteAllMcp,
  disconnectMcp,
  InvalidMcpAddReceiptError,
  InvalidMcpConnectionReceiptError,
  InvalidMcpRemovalReceiptError,
  McpArgumentQuoteError,
  parseMcpArguments,
  removeMcpAuth,
} from "../src/services/mcp"
import { appStore, setMcp } from "../src/store/app"
import { loadMcpStatus, loadProjectMcpStatus } from "../src/services/extensions"

const PROJECT_DIR = "C:/Users/example/project"

function fakeTransport(capture: (req: TransportRequest) => void, body: unknown = {}): HostTransport {
  return {
    kind: "tauri",
    async request<T>(req: TransportRequest): Promise<TransportResponse<T>> {
      capture(req)
      return { status: 200, ok: true, headers: {}, body: body as T }
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

  test("publishes each MCP status map with its actual read scope", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest({
      ...fakeTransport((request) => requests.push(request)),
      async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
        requests.push(request)
        const body = request.path === "mcp/project"
          ? { files: { status: "connected" } }
          : { files: { status: "disabled" }, browser: { status: "disconnected" } }
        return { status: 200, ok: true, headers: {}, body: body as T }
      },
    })
    const authority = captureApiAuthority()
    const project = await loadProjectMcpStatus({ directory: PROJECT_DIR, authority })
    expect(appStore.mcp).toEqual(project)
    expect(appStore.mcpReadScope).toEqual({ kind: "project", directory: PROJECT_DIR, authority })

    const effective = await loadMcpStatus({ directory: PROJECT_DIR, authority })
    expect(appStore.mcp).toEqual(effective)
    expect(appStore.mcpReadScope).toEqual({ kind: "effective", directory: PROJECT_DIR, authority })
    expect(requests.map((request) => [request.path, request.query?.directory, request.authority])).toEqual([
      ["mcp/project", PROJECT_DIR, authority],
      ["mcp", PROJECT_DIR, authority],
    ])
  })

  test("publishes project statuses with their actual diagnostics", async () => {
    const body = {
      active: { status: "connected" },
      paused: { status: "disabled", reason: "manual_disconnect" },
      configuredOff: { status: "disabled" },
      browser: { status: "disabled", scope: "execution" },
      computer: { status: "disconnected", scope: "execution" },
      idle: { status: "disconnected" },
      starting: { status: "connecting" },
      signIn: { status: "needs_auth" },
      broken: { status: "failed", error: "the protocol process exited" },
      setup: { status: "needs_client_registration", error: "registration is required" },
    }
    __setHostTransportForTest(fakeTransport(() => {}, body))
    const authority = captureApiAuthority()

    expect(await loadProjectMcpStatus({ directory: PROJECT_DIR, authority })).toEqual(body)
    expect(appStore.mcp).toEqual(body)
    expect(appStore.mcpReadScope).toEqual({ kind: "project", directory: PROJECT_DIR, authority })
  })

  test("reports the exact project entry with an invalid status receipt", async () => {
    __setHostTransportForTest(fakeTransport(() => {}, { "bad result": { status: "failed" } }))
    const authority = captureApiAuthority()

    await expect(loadProjectMcpStatus({ directory: PROJECT_DIR, authority })).rejects.toThrow(
      'mcp/project returned an invalid status for "bad result"',
    )
  })

  test.each([
    ["connected", { status: "connected" }],
    ["failed", { status: "failed", error: "The connection could not be established." }],
    ["needs_auth", { status: "needs_auth" }],
  ] as const)("acknowledges a saved remote MCP server with status %s", async (_status, entry) => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest(fakeTransport((req) => requests.push(req), { docs: entry }))
    const authority = captureApiAuthority()

    const request = buildMcpAddRequest({
      name: " docs ",
      type: "remote",
      transport: "streamable-http",
      url: "https://mcp.example.com/api",
    })
    await addMcpServer(request, { directory: PROJECT_DIR, authority })

    expect(requests).toEqual([
      {
        authority,
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

  test.each([
    ["an unrelated target", { other: { status: "connected" } }, "missing_target"],
    ["the target's incomplete failed status", { docs: { status: "failed" } }, "invalid_status"],
  ] as const)("a complete add reply with %s reports the exact receipt error", async (_label, body, reason) => {
    __setHostTransportForTest(fakeTransport(() => {}, body))
    const authority = captureApiAuthority()
    const request = buildMcpAddRequest({ name: "docs", type: "local", command: "node" })
    const error = await addMcpServer(request, { directory: PROJECT_DIR, authority }).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(InvalidMcpAddReceiptError)
    expect(error).toMatchObject({ serverName: "docs", reason })
  })

  test("reports a retired connection before dispatching a project MCP add", async () => {
    __setHostTransportForTest(fakeTransport(() => {}))
    const authority = captureApiAuthority()
    renewApiAuthority()

    const request = buildMcpAddRequest({ name: "files", type: "local", command: "node" })
    await expect(addMcpServer(request, { directory: PROJECT_DIR, authority })).rejects.toMatchObject({
      name: "ApiAuthorityChangedError",
      outcome: { phase: "before_dispatch" },
      expectedRevision: authority.revision,
      currentRevision: captureApiAuthority().revision,
    })
  })

  test.each(["'", '"'] as const)("reports the unclosed %s quote in a command argument", (quote) => {
    let failure: unknown
    try {
      buildMcpAddRequest({ name: "files", type: "local", command: "node", args: quote + "unclosed" })
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(McpArgumentQuoteError)
    expect(failure).toMatchObject({ quote, message: "MCP arguments contain an unterminated quote" })
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

  test("preserves explicit empty arguments and adjoining quoted fragments", () => {
    expect(parseMcpArguments(`"" middle '' ""`)).toEqual(["", "middle", "", ""])
    expect(parseMcpArguments(`pre""fix ""suffix "  " C:\\work\\path`))
      .toEqual(["prefix", "suffix", "  ", "C:\\work\\path"])
    expect(buildMcpAddRequest({
      name: "filesystem",
      type: "local",
      command: "node",
      args: '"server path.js" ""',
    })).toEqual({
      name: "filesystem",
      config: { type: "local", command: ["node", "server path.js", ""] },
    })
  })

  test("uses canonical project-scoped connection, auth, and removal routes", async () => {
    const requests: TransportRequest[] = []
    __setHostTransportForTest({
      ...fakeTransport(() => {}),
      async request<T>(request: TransportRequest): Promise<TransportResponse<T>> {
        requests.push(request)
        const body = request.path === "mcp" ? { mcp: {} } : true
        return { status: 200, ok: true, headers: {}, body: body as T }
      },
    })
    setMcp({ docs: { status: "connected" }, filesystem: { status: "connected" } })
    const authority = captureApiAuthority()

    await connectMcp("docs", { directory: PROJECT_DIR, authority })
    await disconnectMcp("docs", { directory: PROJECT_DIR, authority })
    await removeMcpAuth("docs", { directory: PROJECT_DIR })
    await deleteAllMcp({ directory: PROJECT_DIR, authority, names: ["docs", " filesystem ", ""] })

    expect(requests.map((request) => [request.method, request.path, request.query?.directory])).toEqual([
      ["POST", "mcp/docs/connect", PROJECT_DIR],
      ["POST", "mcp/docs/disconnect", PROJECT_DIR],
      ["DELETE", "mcp/docs/auth", PROJECT_DIR],
      ["DELETE", "mcp", PROJECT_DIR],
    ])
    expect(requests[3].body).toEqual({
      kind: "json",
      value: { names: ["docs", " filesystem ", ""] },
    })
    expect(requests.map((request) => request.authority)).toEqual([authority, authority, authority, authority])
  })

  test.each([
    { username: "project-review" },
    { mcp: { filesystem: { enabled: false }, other: { type: "local", command: ["node", "probe.js"] } } },
  ])("acknowledges a project configuration with the selected names removed: %j", async (config) => {
    __setHostTransportForTest(fakeTransport(() => {}, config))
    const authority = captureApiAuthority()

    await expect(deleteAllMcp({ directory: PROJECT_DIR, authority, names: [" filesystem ", ""] })).resolves.toBeUndefined()
  })

  test.each([
    { response: true, reason: "invalid_config", remainingNames: [] },
    { response: { mcp: [] }, reason: "invalid_mcp", remainingNames: [] },
    { response: { mcp: null }, reason: "invalid_mcp", remainingNames: [] },
    {
      response: { mcp: { " filesystem ": { enabled: false }, "": { enabled: false }, other: { enabled: false } } },
      reason: "targets_still_configured",
      remainingNames: [" filesystem ", ""],
    },
  ])("reports the precise removal receipt error $reason", async ({ response, reason, remainingNames }) => {
    __setHostTransportForTest(fakeTransport(() => {}, response))
    const authority = captureApiAuthority()
    const result = await deleteAllMcp({
      directory: PROJECT_DIR,
      authority,
      names: ["docs", " filesystem ", ""],
    }).catch((cause: unknown) => cause)

    expect(result).toBeInstanceOf(InvalidMcpRemovalReceiptError)
    expect(result).toMatchObject({ reason, remainingNames })
  })

  test("a complete connection error retains its HTTP status and request identity", async () => {
    const body = { name: "UnknownError", data: { message: "The server did not connect." } }
    const requestID = "connect-diagnostic-receipt"
    __setHostTransportForTest({
      ...fakeTransport(() => {}),
      async request<T>(): Promise<TransportResponse<T>> {
        return { status: 500, ok: false, headers: { "x-opencorvus-request-id": requestID }, body: body as T }
      },
    })
    const authority = captureApiAuthority()
    const error = await connectMcp("docs", { directory: PROJECT_DIR, authority }).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500, requestID, body, method: "POST" })
  })

  test.each([["connect", connectMcp], ["disconnect", disconnectMcp]] as const)(
    "a %s response without an affirmative acknowledgment reports the exact receipt error",
    async (action, change) => {
      const requests: TransportRequest[] = []
      __setHostTransportForTest(fakeTransport((request) => requests.push(request), false))
      const authority = captureApiAuthority()
      const error = await change("files", { directory: PROJECT_DIR, authority }).catch((cause: unknown) => cause)
      expect(error).toBeInstanceOf(InvalidMcpConnectionReceiptError)
      expect(error).toMatchObject({ action, serverName: "files" })
      expect(requests[0]).toMatchObject({ method: "POST", path: `mcp/files/${action}`, query: { directory: PROJECT_DIR }, authority })
    },
  )
})
