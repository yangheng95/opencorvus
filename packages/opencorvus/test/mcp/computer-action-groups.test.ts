import { describe, expect, test } from "bun:test"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { PNG } from "pngjs"
import type { ComputerBackend, ComputerBackendAction } from "../../src/mcp/computer/backend"
import { ComputerError } from "../../src/mcp/computer/errors"
import { ComputerHostRuntimeAuthority } from "../../src/mcp/computer/host-runtime"
import { HostComputerBackend } from "../../src/mcp/computer/host-client"
import { createComputerMcpServer } from "../../src/mcp/computer/tools"
import { createMcpServer } from "../../src/mcp/browser/tools"
import { builtinGuidance } from "../../src/skill/builtin-guidance"

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

class Device implements ComputerBackend {
  events: string[] = []
  action?: (action: ComputerBackendAction) => Promise<void>
  constructor(readonly id = "device") {}
  async create() {
    return { computerId: this.id, displayId: "display", driverVersion: "contract" }
  }
  async observe() {
    this.events.push("observe")
    return {
      computerId: this.id,
      displayId: "display",
      pngBase64: PNG.sync.write(new PNG({ width: 20, height: 20 })).toString("base64"),
    }
  }
  async act(action: ComputerBackendAction) {
    this.events.push(action.kind)
    await this.action?.(action)
    return { accepted: true as const, backendActionId: `${this.id}:${this.events.length}` }
  }
  async destroy() {
    this.events.push("destroy")
    return { destroyed: true as const }
  }
  async close() {
    this.events.push("close")
  }
}

async function connect(server: ReturnType<typeof createMcpServer>) {
  const client = new Client({ name: "guidance-contract", version: "1" })
  const [left, right] = InMemoryTransport.createLinkedPair()
  await server.connect(right)
  await client.connect(left)
  return client
}

async function setup(device: Device) {
  const authority = new ComputerHostRuntimeAuthority({ entries: new Map(), authorizations: new Map() }, () => device)
  const adapter = authority.adapter({ runtimeScope: `session:${device.id}:computer` })
  const backend = new HostComputerBackend(adapter.endpoint, adapter.authorization, adapter.runtimeScope)
  const { server, controller } = createComputerMcpServer({ backend })
  const client = await connect(server)
  const created = await client.callTool({ name: "session_create", arguments: {} })
  const identity = { computer_id: device.id, display_id: "display" }
  const observed = await client.callTool({ name: "observe", arguments: identity })
  const binding = observed.structuredContent as Record<string, unknown>
  return {
    authority,
    adapter,
    backend,
    client,
    created,
    identity,
    binding: { ...identity, observation_id: binding.observation_id, observation_digest: binding.observation_digest },
    async [Symbol.asyncDispose]() {
      await client.close()
      await server.close()
      await controller.close()
      await authority.close()
    },
  }
}

describe("Computer ordered-group protocol", () => {
  test("loads canonical guidance and returns an ordered group receipt with the next usable observation", async () => {
    const device = new Device()
    await using runtime = await setup(device)
    const help = await runtime.client.callTool({ name: "help", arguments: {} })
    expect(help.structuredContent).toEqual({ skill: "computer-use", instructions: builtinGuidance("computer-use") })
    expect(runtime.created.structuredContent).toMatchObject({ instructions: builtinGuidance("computer-use") })
    const result = await runtime.client.callTool({
      name: "act",
      arguments: {
        ...runtime.binding,
        actions: [
          { kind: "click", x: 2, y: 3 },
          { kind: "type_text", text: "query" },
          { kind: "keypress", keys: ["ENTER"] },
        ],
      },
    })
    const receipt = result.structuredContent as any
    expect(receipt).toMatchObject({
      ok: true,
      completed_actions: [
        { index: 0, kind: "click" },
        { index: 1, kind: "type_text" },
        { index: 2, kind: "keypress" },
      ],
      observation: { width: 20, height: 20 },
    })
    expect(device.events).toEqual(["observe", "click", "type_text", "keypress", "observe"])
    expect(result.content.map((item: any) => item.type)).toEqual(["image", "text"])
    const continued = await runtime.client.callTool({
      name: "act",
      arguments: {
        ...runtime.identity,
        observation_id: receipt.observation.observation_id,
        observation_digest: receipt.observation.observation_digest,
        actions: [{ kind: "scroll", x: 2, y: 3, direction: "down", amount: 2 }],
      },
    })
    expect(continued.structuredContent).toMatchObject({ ok: true, completed_actions: [{ index: 0, kind: "scroll" }] })
  })

  test("publishes an exact completed prefix, uncertain action and fresh observation after native failure", async () => {
    const device = new Device()
    device.action = async (action) => {
      if (action.kind === "type_text") throw new ComputerError("COMPUTER_OUTCOME_UNKNOWN", "native response lost")
    }
    await using runtime = await setup(device)
    const result = await runtime.client.callTool({
      name: "act",
      arguments: {
        ...runtime.binding,
        actions: [
          { kind: "click", x: 2, y: 3 },
          { kind: "type_text", text: "query" },
          { kind: "keypress", keys: ["ENTER"] },
        ],
      },
    })
    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        ok: false,
        completed_actions: [{ index: 0, kind: "click" }],
        failed_action: { index: 1, error: { code: "COMPUTER_OUTCOME_UNKNOWN" } },
        observation: { width: 20, height: 20 },
      },
    })
    expect(device.events).toEqual(["observe", "click", "type_text", "observe"])
  })

  test("validates every point before consuming the binding, then accepts a corrected group", async () => {
    await using runtime = await setup(new Device())
    const rejected = await runtime.client.callTool({
      name: "act",
      arguments: {
        ...runtime.binding,
        actions: [
          { kind: "type_text", text: "query" },
          { kind: "click", x: 20, y: 3 },
        ],
      },
    })
    expect(rejected).toMatchObject({
      isError: true,
      structuredContent: { error: { code: "COMPUTER_INPUT_OUT_OF_BOUNDS" } },
    })
    const corrected = await runtime.client.callTool({
      name: "act",
      arguments: { ...runtime.binding, actions: [{ kind: "click", x: 19, y: 3 }] },
    })
    expect(corrected.structuredContent).toMatchObject({ ok: true, completed_actions: [{ index: 0, kind: "click" }] })
    const stale = await runtime.client.callTool({
      name: "act",
      arguments: { ...runtime.binding, actions: [{ kind: "click", x: 19, y: 3 }] },
    })
    expect(stale).toMatchObject({ isError: true, structuredContent: { error: { code: "STALE_OBSERVATION" } } })
  })

  test("settles the entered action and reports the revoked suffix before publishing human ownership", async () => {
    const started = deferred(),
      release = deferred()
    const device = new Device()
    device.action = async () => {
      started.resolve()
      await release.promise
    }
    await using runtime = await setup(device)
    const input = runtime.client.callTool({
      name: "act",
      arguments: {
        ...runtime.binding,
        actions: [
          { kind: "click", x: 2, y: 3 },
          { kind: "type_text", text: "query" },
        ],
      },
    })
    await started.promise
    const takeover = runtime.authority.takeover({
      runtimeScope: runtime.adapter.runtimeScope,
      computerId: device.id,
      displayId: "display",
    })
    release.resolve()
    expect(await input).toMatchObject({
      isError: true,
      structuredContent: {
        completed_actions: [{ index: 0, kind: "click" }],
        failed_action: { index: 1, error: { code: "COMPUTER_RUN_REVOKED" } },
        observation_error: { code: "COMPUTER_RUN_REVOKED" },
      },
    })
    expect(await takeover).toMatchObject({ ownership: "human", desktopPreserved: true })
    expect(device.events).toEqual(["observe", "click"])
  })

  test("serializes groups and observations across separate host authorities", async () => {
    const started = deferred(),
      release = deferred()
    const first = new Device("first"),
      second = new Device("second")
    const events: string[] = []
    first.action = async (action) => {
      events.push(`first:${action.kind}`)
      if (action.kind === "click") {
        started.resolve()
        await release.promise
      }
    }
    const observeSecond = second.observe.bind(second)
    second.observe = async () => {
      events.push("second:observe")
      return observeSecond()
    }
    await using a = await setup(first)
    await using b = await setup(second)
    events.length = 0
    const group = a.backend.act({
      computerId: first.id,
      displayId: "display",
      actions: [
        { kind: "click", x: 1, y: 1, button: "left" },
        { kind: "type_text", text: "query" },
      ],
    })
    await started.promise
    const observation = b.backend.observe({ computerId: second.id, displayId: "display" })
    release.resolve()
    expect(await group).toMatchObject({
      completedActions: [
        { index: 0, kind: "click" },
        { index: 1, kind: "type_text" },
      ],
    })
    expect(await observation).toMatchObject({ computerId: "second" })
    expect(events).toEqual(["first:click", "first:type_text", "second:observe"])
  })

  test("reports a revoked request whose body finished parsing after takeover", async () => {
    const parsed = deferred(),
      release = deferred()
    await using runtime = await setup(new Device())
    const request = new Request(runtime.adapter.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${runtime.adapter.authorization}` },
      body: "{}",
    })
    request.json = async () => {
      parsed.resolve()
      await release.promise
      return { operation: "observe", params: runtime.identity }
    }
    const response = runtime.authority.fetch(request)
    await parsed.promise
    const takeover = runtime.authority.takeover({
      runtimeScope: runtime.adapter.runtimeScope,
      computerId: "device",
      displayId: "display",
    })
    release.resolve()
    expect(await (await response).json()).toMatchObject({ ok: false, error: { code: "COMPUTER_RUN_REVOKED" } })
    expect(await takeover).toMatchObject({ ownership: "human", desktopPreserved: true })
  })

  test("retains completed input receipts when final native capture is malformed", async () => {
    const device = new Device()
    await using runtime = await setup(device)
    device.observe = async () => ({ computerId: "device", displayId: "display", pngBase64: "invalid-png" })
    const result = await runtime.client.callTool({
      name: "act",
      arguments: { ...runtime.binding, actions: [{ kind: "type_text", text: "query" }] },
    })
    expect(result).toMatchObject({
      isError: true,
      structuredContent: {
        completed_actions: [{ index: 0, kind: "type_text" }],
        observation_error: { code: "COMPUTER_BACKEND_ERROR" },
      },
    })
  })
})

test("Browser MCP help reads its bundled Skill without a browser session", async () => {
  const server = createMcpServer({ liveViewOrigin: "http://127.0.0.1:1" })
  const client = await connect(server)
  try {
    const help = await client.callTool({ name: "help", arguments: {} })
    expect(help.structuredContent).toEqual({ skill: "browser-use", instructions: builtinGuidance("browser-use") })
  } finally {
    await client.close()
    await server.close()
  }
})
