import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import nativeProviderAudit from "../script/native-provider-audit-plugin"
import { latestAuditSnapshotFiles } from "../script/audit-snapshot"
import { requireProcessProviderAudit } from "../script/real-provider-audit"
import { assertCopiedOAuthAccess, CopiedOAuthCredentialExpiredError, CopiedOAuthRefreshForbiddenError, CredentialRedactor, RealProviderAudit, ProviderAuditProbeConfigurationError } from "../script/real-provider-audit"
import { takeProviderResponseObserver, type ProviderRequestContext } from "../src/util/provider-response-observation"
import { settlementTrackedReadableStream } from "../src/util/stream-activity"

function requestMetadata(entry: RealProviderAudit["requests"][number]) {
  const { response_reader, ...metadata } = entry
  return metadata
}

async function consumeObservedResponse(response: Response, context?: ProviderRequestContext): Promise<string> {
  const observer = takeProviderResponseObserver(response)
  if (!observer || !response.body) throw new Error("Expected exact owned response binding")
  const wrapped = settlementTrackedReadableStream({ source: response.body,
    onChunk: (chunk) => observer.onChunk(chunk.byteLength), onSettlement: observer.onSettlement })
  observer.onBind(context)
  return await new Response(wrapped).text()
}

test("exact reader binding projects genuine caller, unknown caller and credential-redacted identity states", async () => {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0,
    fetch: () => new Response("actual identity observation bytes") })
  const redactor = new CredentialRedactor()
  redactor.collect({ provider: { key: "identity-fixture-secret" } })
  const context = { sessionID: "session-owned", streamRequest: { requestID: "request-owned", agentID: "agent-owned",
    providerID: "provider-owned", modelID: "catalog-owned", apiModelID: "authorized-model" } }
  const originalContext = structuredClone(context)
  try {
    using audit = new RealProviderAudit("authorized-model", 3, undefined, undefined, undefined, { redactor })
    const request = () => fetch(server.url, { method: "POST", body: JSON.stringify({ model: "authorized-model", stream: true }) })
    const values = [await consumeObservedResponse(await request(), context)]
    context.streamRequest.agentID = "later caller edit"
    values.push(await consumeObservedResponse(await request()))
    values.push(await consumeObservedResponse(await request(), { ...originalContext, sessionID: "identity-fixture-secret" }))
    expect(values).toEqual(Array(3).fill("actual identity observation bytes"))
    expect(audit.requests.map((entry) => ({ state: entry.response_reader.state,
      identityState: entry.response_reader.identityState, terminal: entry.response_reader.terminal?.kind })))
      .toEqual([
        { state: "settled", identityState: "observed", terminal: "eof" },
        { state: "settled", identityState: "unknown", terminal: "eof" },
        { state: "settled", identityState: "redacted", terminal: "eof" },
      ])
    expect(audit.requests[0]!.response_reader.requestContext).toEqual(originalContext)
  } finally { await server.stop(true) }
})

test("throwing audit publisher preserves actual HTTP output, EOF and the exact exhausted-budget error", async () => {
  const submitted = { model: "authorized-model", stream: true, input: "owned publication qualification" }
  const accepted: unknown[] = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
    accepted.push(await request.json())
    return new Response('data: {"text":"actual local response"}\n\n', {
      status: 202, headers: { "Content-Type": "text/event-stream", "X-Owned-Receipt": "accepted" },
    })
  } })
  try {
    const publications: Array<{ state: string; exhausted: boolean }> = []
    using audit = new RealProviderAudit("authorized-model", 1, () => {
      publications.push({ state: audit.requests[0]!.response_reader.state, exhausted: audit.exhausted })
      throw new Error("owned diagnostic publication failed")
    })
    const request = () => fetch(server.url, { method: "POST", body: JSON.stringify(submitted) })
    const response = await request()
    expect({ status: response.status, receipt: response.headers.get("X-Owned-Receipt"), text: await consumeObservedResponse(response) })
      .toEqual({ status: 202, receipt: "accepted", text: 'data: {"text":"actual local response"}\n\n' })
    expect(audit.requests[0]).toMatchObject({ model: "authorized-model", streaming: true, status: 202,
      response_reader: { boundary: "provider-source-reader", state: "settled", observationError: "callback_failed",
        byteCount: new TextEncoder().encode('data: {"text":"actual local response"}\n\n').byteLength, terminal: { kind: "eof" } } })
    const budgetError = await request().catch((error: unknown) => error)
    expect(budgetError).toBeInstanceOf(Error)
    expect(budgetError).toMatchObject({ message: "E2E_REQUEST_BUDGET_EXHAUSTED" })
    expect({ exhausted: audit.exhausted, admitted: audit.requests.length, accepted }).toEqual({ exhausted: true, admitted: 1, accepted: [submitted] })
    expect(publications).toEqual([
      { state: "awaiting_response", exhausted: false },
      { state: "awaiting_binding", exhausted: false },
      { state: "settled", exhausted: false },
      { state: "settled", exhausted: true },
    ])
  } finally { await server.stop(true) }
})

test("concurrent real local HTTP audit entries report their exact reader bytes and EOF", async () => {
  const bodies = [': comment\n\ndata: {"tool":"Read"}\n\n', 'data: second result\n\n']
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
    const input = await request.json() as { index: number }
    return new Response(bodies[input.index], { headers: { "Content-Type": "text/event-stream" } })
  } })
  try {
    using audit = new RealProviderAudit("authorized-model", 12)
    const responses = await Promise.all(bodies.map((_, index) => fetch(server.url, {
      method: "POST", body: JSON.stringify({ model: "authorized-model", stream: true, index }),
    })))
    expect(audit.requests.map((entry) => entry.response_reader.state)).toEqual(["awaiting_binding", "awaiting_binding"])
    expect(await Promise.all(responses.map(consumeObservedResponse))).toEqual(bodies)
    for (let index = 0; index < bodies.length; index++) {
      const facts = audit.requests[index]!.response_reader
      expect(facts).toMatchObject({ boundary: "provider-source-reader", state: "settled",
        byteCount: new TextEncoder().encode(bodies[index]!).byteLength, terminal: { kind: "eof" } })
      expect(facts.chunkCount!).toBeGreaterThanOrEqual(1)
      expect(facts.boundAt!).toBeGreaterThanOrEqual(facts.receivedAt!)
      expect(facts.firstByteReadAt!).toBeGreaterThanOrEqual(facts.boundAt!)
      expect(facts.lastByteReadAt!).toBeGreaterThanOrEqual(facts.firstByteReadAt!)
      expect(facts.terminal!.at).toBeGreaterThanOrEqual(facts.lastByteReadAt!)
    }
  } finally { await server.stop(true) }
})

test("real local HTTP204 empty reader, HTTP error and unbound consumers retain actual observation states", async () => {
  const accepted: string[] = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
    const input = await request.json() as { mode: string }
    accepted.push(input.mode)
    if (input.mode === "absent") return new Response(null, { status: 204 })
    if (input.mode === "error") return new Response("actual HTTP error", { status: 503 })
    return new Response(input.mode)
  } })
  try {
    using audit = new RealProviderAudit("authorized-model", 12)
    const request = (mode: string) => fetch(server.url, { method: "POST", body: JSON.stringify({ model: "authorized-model", stream: true, mode }) })
    const absent = await request("absent")
    const error = await request("error")
    const direct = await request("direct")
    const original = await request("replacement")
    const replacement = new Response(original.body, { status: original.status, headers: original.headers })
    expect({ emptyStatus: absent.status, emptyText: await consumeObservedResponse(absent), error: await error.text(), direct: await direct.text(), replacement: await replacement.text() })
      .toEqual({ emptyStatus: 204, emptyText: "", error: "actual HTTP error", direct: "direct", replacement: "replacement" })
    expect(audit.requests[0]!.response_reader).toMatchObject({ boundary: "provider-source-reader", state: "settled",
      byteCount: 0, chunkCount: 0, firstByteReadAt: null, lastByteReadAt: null, terminal: { kind: "eof" } })
    expect(accepted).toEqual(["absent", "error", "direct", "replacement"])
    expect(audit.requests.map((entry) => ({ status: entry.status, boundary: entry.response_reader.boundary, state: entry.response_reader.state })))
      .toEqual([
        { status: 204, boundary: "provider-source-reader", state: "settled" },
        { status: 503, boundary: "provider-source-reader", state: "http_error" },
        { status: 200, boundary: "provider-source-reader", state: "awaiting_binding" },
        { status: 200, boundary: "provider-source-reader", state: "awaiting_binding" },
      ])
  } finally { await server.stop(true) }
})

test("actual local HTTP preserves flat, nested and unnamed tool declaration facts", async () => {
  const redactor = new CredentialRedactor()
  redactor.collect({ access: "FakeAccessToken123" })
  const tools = [
    { type: "function", name: "Write", description: "fixture-only", parameters: { type: "object" } },
    { type: "function", function: { name: "Read", description: "fixture-only" } },
    { type: "mcp", server_url: "https://fixture.invalid", authorization: "FakeAccessToken123" },
    { type: "function", name: "Write" },
    { type: "function", name: "FakeAccessToken123" },
    { type: "FakeAccessToken123", name: "unsafe/name" },
    { type: "function", name: "flat", function: { name: "nested" } },
  ]
  const submitted = { model: "authorized-model", stream: true, tools }
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0,
    fetch: async (request) => Response.json({ accepted: await request.json() }, { status: 202 }) })
  try {
    using audit = new RealProviderAudit("authorized-model", 12, undefined, undefined, undefined, { redactor })
    const response = await fetch(server.url, { method: "POST", body: JSON.stringify(submitted) })
    expect(await response.json()).toEqual({ accepted: submitted })
    expect(audit.requests.map(requestMetadata)).toEqual([{ model: "authorized-model", streaming: true, status: 202,
      tool_declarations: { state: "array", entries: [
        { index: 0, type: "function", type_state: "present", name_state: "observed", names: [{ path: "name", state: "present", value: "Write" }] },
        { index: 1, type: "function", type_state: "present", name_state: "observed", names: [{ path: "function.name", state: "present", value: "Read" }] },
        { index: 2, type: "mcp", type_state: "present", name_state: "absent", names: [] },
        { index: 3, type: "function", type_state: "present", name_state: "observed", names: [{ path: "name", state: "present", value: "Write" }] },
        { index: 4, type: "function", type_state: "present", name_state: "observed", names: [{ path: "name", state: "redacted" }] },
        { index: 5, type_state: "redacted", name_state: "observed", names: [{ path: "name", state: "invalid" }] },
        { index: 6, type: "function", type_state: "present", name_state: "observed", names: [{ path: "name", state: "present", value: "flat" }, { path: "function.name", state: "present", value: "nested" }] },
      ] } }])
  } finally { await server.stop(true) }
})

test("actual local HTTP reports precise tools structural states with unchanged acknowledgements", async () => {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0,
    fetch: async (request) => Response.json({ accepted: await request.json() }, { status: 202 }) })
  const bodies = [{}, { tools: null }, { tools: [] }, { tools: "invalid" }, { tools: [null, { function: 42 }, { type: 42, name: 42 }] }]
  try {
    using audit = new RealProviderAudit("authorized-model", 12, undefined, undefined, undefined, { redactor: new CredentialRedactor() })
    for (const shape of bodies) {
      const submitted = { model: "authorized-model", stream: true, ...shape }
      const response = await fetch(server.url, { method: "POST", body: JSON.stringify(submitted) })
      expect(await response.json()).toEqual({ accepted: submitted })
    }
    expect(audit.requests.map((entry) => ({ status: entry.status, declaration: entry.tool_declarations }))).toEqual([
      { status: 202, declaration: { state: "absent", entries: [] } },
      { status: 202, declaration: { state: "null", entries: [] } },
      { status: 202, declaration: { state: "array", entries: [] } },
      { status: 202, declaration: { state: "invalid", entries: [] } },
      { status: 202, declaration: { state: "array", entries: [
        { index: 0, type_state: "invalid", name_state: "absent", names: [] },
        { index: 1, type_state: "absent", name_state: "observed", names: [{ path: "function.name", state: "invalid" }] },
        { index: 2, type_state: "invalid", name_state: "observed", names: [{ path: "name", state: "invalid" }] },
      ] } },
    ])
  } finally { await server.stop(true) }
})

test("an undeclared request ceiling retains every real local transport receipt", async () => {
  const bodies: string[] = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
    bodies.push(await request.text())
    return new Response("accepted", { status: 202 })
  } })
  try {
    using audit = new RealProviderAudit("authorized-model", null)
    const body = JSON.stringify({ model: "authorized-model", stream: true })
    for (let index = 0; index < 3; index++) expect((await fetch(server.url, { method: "POST", body })).status).toBe(202)
    expect({ ceiling: audit.maxRequests, bodies, receipts: audit.requests.map(requestMetadata) }).toEqual({
      ceiling: null, bodies: [body, body, body],
      receipts: Array.from({ length: 3 }, () => ({ model: "authorized-model", streaming: true, status: 202 })),
    })
  } finally { await server.stop(true) }
})

for (const failureStage of [undefined, "body", "cleanup"] as const) {
  test(`outer audit lifetime observes real HTTP cleanup and restores fetch after ${failureStage ?? "successful"} completion`, async () => {
    const received: string[] = []
    // Actual local transport only; these acknowledgements are not Provider/model results.
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
      const body = await request.text()
      received.push(body)
      return new Response(`acknowledged:${JSON.parse(body).phase}`, { status: 202 })
    } })
    const originalFetch = globalThis.fetch
    let audit: RealProviderAudit | undefined
    const body = (phase: string) => JSON.stringify({ model: "authorized-model", stream: true, phase })
    const send = async (phase: string) => {
      const response = await fetch(server.url, { method: "POST", body: body(phase) })
      expect({ status: response.status, text: await response.text() }).toEqual({
        status: 202, text: `acknowledged:${phase}`,
      })
    }
    const run = async () => {
      using lifetime = new DisposableStack()
      try {
        audit = lifetime.use(new RealProviderAudit("authorized-model", 2))
        await send("body")
        if (failureStage === "body") throw new Error("primary operation failed")
        return "completed"
      } finally {
        await send("cleanup")
        if (failureStage === "cleanup") throw new Error("cleanup failed after transport settlement")
      }
    }
    try {
      if (failureStage === "body") await expect(run()).rejects.toThrow("primary operation failed")
      else if (failureStage === "cleanup") await expect(run()).rejects.toThrow("cleanup failed after transport settlement")
      else expect(await run()).toBe("completed")
      expect(received).toEqual([body("body"), body("cleanup")])
      expect(audit!.requests.map(requestMetadata)).toEqual([
        { model: "authorized-model", streaming: true, status: 202 },
        { model: "authorized-model", streaming: true, status: 202 },
      ])
      expect(globalThis.fetch).toBe(originalFetch)
    } finally {
      await server.stop(true)
    }
  })
}

test("native plugin reuses the process audit and publishes one actual transport observation", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "provider-audit-singleton-"))
  const keys = ["OPENCORVUS_NATIVE_REAL_PROVIDER", "OPENCORVUS_NATIVE_AUDIT_ROOT", "OPENCORVUS_NATIVE_AUDIT_MODEL", "OPENCORVUS_NATIVE_AUDIT_MAX_REQUESTS", "OPENCORVUS_NATIVE_AUDIT_COPIED_OAUTH_EXPIRES"]
  const previous = keys.map((key) => process.env[key])
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("local transport", { status: 202 }) })
  try {
    Object.assign(process.env, { OPENCORVUS_NATIVE_REAL_PROVIDER: "1", OPENCORVUS_NATIVE_AUDIT_ROOT: root,
      OPENCORVUS_NATIVE_AUDIT_MODEL: "authorized-model", OPENCORVUS_NATIVE_AUDIT_MAX_REQUESTS: "null" })
    delete process.env.OPENCORVUS_NATIVE_AUDIT_COPIED_OAUTH_EXPIRES
    await nativeProviderAudit({ serverUrl: new URL("http://127.0.0.1:1") })
    const first = requireProcessProviderAudit()
    await nativeProviderAudit({ serverUrl: new URL("http://127.0.0.1:1") })
    expect(requireProcessProviderAudit().audit).toBe(first.audit)
    const response = await fetch(server.url, { method: "POST", body: JSON.stringify({ model: "authorized-model", stream: true }) })
    expect(response.status).toBe(202)
    expect(await consumeObservedResponse(response)).toBe("local transport")
    const files = await latestAuditSnapshotFiles(root, "provider")
    expect(files.length).toBe(1)
    expect(JSON.parse(await readFile(files[0]!, "utf8"))).toMatchObject({
      pid: process.pid, model: "authorized-model", requests: [{ model: "authorized-model", streaming: true, status: 202,
        response_reader: { boundary: "provider-source-reader", state: "settled", byteCount: 15, terminal: { kind: "eof" } } }],
    })
  } finally {
    requireProcessProviderAudit().audit[Symbol.dispose]()
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index] })
    await server.stop(true)
    await rm(root, { recursive: true, force: true })
  }
})

test("copied OAuth refresh grants return a precise authority error while access is current", async () => {
  using audit = new RealProviderAudit("authorized-model", null, undefined, { copiedOAuthExpiresAt: Date.now() + 60_000 })
  for (const body of ["grant_type=refresh_token&refresh_token=diagnostic-only", JSON.stringify({ grant_type: "refresh_token", refresh_token: "diagnostic-only" })]) {
    await expect(fetch("https://provider.invalid/oauth/token", { method: "POST", body })).rejects.toThrow(CopiedOAuthRefreshForbiddenError)
  }
})

test("copied OAuth access expires with an explicit authority error", () => {
  const expires = Date.now() - 1
  expect(() => assertCopiedOAuthAccess(expires)).toThrow(CopiedOAuthCredentialExpiredError)
  try { assertCopiedOAuthAccess(expires) } catch (error) {
    if (!(error instanceof CopiedOAuthCredentialExpiredError)) throw error
    expect({ name: error.name, code: error.code, expiresAt: error.expiresAt }).toEqual({
      name: "CopiedOAuthCredentialExpiredError", code: "COPIED_OAUTH_CREDENTIAL_EXPIRED", expiresAt: expires,
    })
  }
})

test("copied authority permits valid streaming and retains local observation after expiry", async () => {
  const original = globalThis.fetch
  globalThis.fetch = Object.assign(async () => new Response("ok"), original) as typeof fetch
  try {
    const authority = { copiedOAuthExpiresAt: Date.now() + 60_000 }
    using audit = new RealProviderAudit("authorized-model", 2, undefined, authority)
    const request = () => fetch("https://provider.invalid/responses", { method: "POST", body: JSON.stringify({ model: "authorized-model", stream: true }) })
    expect((await request()).status).toBe(200)
    expect(audit.requests.map(requestMetadata)).toEqual([{ model: "authorized-model", streaming: true, status: 200 }])
    authority.copiedOAuthExpiresAt = Date.now() - 1
    await expect(fetch("https://provider.invalid/oauth/token", { method: "POST", body: "grant_type=refresh_token" }))
      .rejects.toThrow(CopiedOAuthCredentialExpiredError)
    audit.localOrigins.add("http://127.0.0.1:1234")
    expect(await (await fetch("http://127.0.0.1:1234/task/status")).text()).toBe("ok")
  } finally { globalThis.fetch = original }
})

test("the last authorized streaming request completes before the next is refused", async () => {
  const original = globalThis.fetch
  globalThis.fetch = Object.assign(async () => new Response("ok", { status: 200 }), original) as typeof fetch
  try {
    const observed: number[] = []
    using audit = new RealProviderAudit("authorized-model", 1, () => observed.push(1))
    const request = () => fetch("https://provider.invalid/responses", { method: "POST", body: JSON.stringify({ model: "authorized-model", stream: true }) })
    expect((await request()).status).toBe(200)
    expect({ exhausted: audit.exhausted, requests: audit.requests.map(requestMetadata) }).toEqual({ exhausted: false, requests: [{ model: "authorized-model", streaming: true, status: 200 }] })
    await expect(request()).rejects.toThrow("E2E_REQUEST_BUDGET_EXHAUSTED")
    expect({ exhausted: audit.exhausted, count: audit.requests.length }).toEqual({ exhausted: true, count: 1 })
    expect(observed).toEqual([1, 1, 1])
  } finally { globalThis.fetch = original }
})

test("the audit reports exact model and streaming contract errors", async () => {
  const original = globalThis.fetch
  globalThis.fetch = Object.assign(async () => new Response("ok"), original) as typeof fetch
  try {
    using audit = new RealProviderAudit("authorized-model", 2)
    await expect(fetch("https://provider.invalid/responses", { method: "POST", body: JSON.stringify({ model: "different-model", stream: true }) }))
      .rejects.toThrow("Actual outgoing request model differs from authorized model")
    await expect(fetch("https://provider.invalid/responses", { method: "POST", body: JSON.stringify({ model: "authorized-model", stream: false }) }))
      .rejects.toThrow("Every real Provider request must stream")
    audit.localOrigins.add("http://127.0.0.1:1234")
    expect((await fetch("http://127.0.0.1:1234/task", { method: "POST", body: JSON.stringify({ model: "provider/authorized-model" }) })).status).toBe(200)
  } finally { globalThis.fetch = original }
})


test("an exhausted cumulative balance returns the budget error", async () => {
  using audit = new RealProviderAudit("authorized-model", 0)
  await expect(fetch("https://provider.invalid/responses", { method: "POST", body: JSON.stringify({ model: "authorized-model", stream: true }) }))
    .rejects.toThrow("E2E_REQUEST_BUDGET_EXHAUSTED")
  expect(audit.exhausted).toBe(true)
})

test("known original and refreshed credentials produce redacted diagnostics", () => {
  const redactor = new CredentialRedactor()
  redactor.collect({ provider: { key: "test-secret/abc" } })
  redactor.collect({ provider: { refresh: 'refreshed"secret' } })
  expect(redactor.redact('failure test-secret/abc test-secret%2Fabc refreshed\\"secret'))
    .toBe("failure [REDACTED] [REDACTED] [REDACTED]")
})

test("registered input evidence records exact decoded positions while a real local HTTP receiver gets the original bytes", async () => {
  const received: string[] = []
  // Transport fixture, not a Provider or simulated model response.
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => {
      received.push(await request.text())
      return new Response("local transport acknowledgement", { status: 202 })
    },
  })
  try {
    const probes = [{ id: "source", text: "依据🙂" }]
    using audit = new RealProviderAudit("authorized-model", 2, undefined, undefined, {
      probes,
      redactor: new CredentialRedactor(),
    })
    probes[0]!.text = "caller edited its declaration later"
    const chatBody = JSON.stringify({
      model: "authorized-model",
      stream: true,
      messages: [{ role: "developer", content: "首:依据🙂|依据🙂" }],
    })
    const responsesBody = JSON.stringify({
      model: "authorized-model",
      stream: true,
      instructions: "依据🙂",
      input: [{ role: "user", content: [{ type: "input_text", text: "依据🙂" }] }],
    })
    expect((await fetch(server.url, { method: "POST", body: chatBody })).status).toBe(202)
    expect((await fetch(new Request(server.url, { method: "POST", body: responsesBody }))).status).toBe(202)
    expect(received).toEqual([chatBody, responsesBody])
    const snapshot = structuredClone(audit.requests)
    expect(
      snapshot.map((request) => ({ model: request.model, streaming: request.streaming, status: request.status })),
    ).toEqual([
      { model: "authorized-model", streaming: true, status: 202 },
      { model: "authorized-model", streaming: true, status: 202 },
    ])
    expect(
      snapshot.map((request) =>
        request.input_evidence!.probes.map((probe) => ({
          id: probe.id,
          bytes: probe.text_utf8_bytes,
          locations: probe.matches.map(
            ({ json_pointer, decoded_value_utf8_start, pointer_redacted, message_role, role_json_pointer }) => ({
              json_pointer,
              decoded_value_utf8_start,
              pointer_redacted,
              message_role,
              role_json_pointer,
            }),
          ),
        })),
      ),
    ).toEqual([
      [
        {
          id: "source",
          bytes: 10,
          locations: [
            {
              json_pointer: "/messages/0/content",
              decoded_value_utf8_start: 4,
              pointer_redacted: false,
              message_role: "developer",
              role_json_pointer: "/messages/0/role",
            },
            {
              json_pointer: "/messages/0/content",
              decoded_value_utf8_start: 15,
              pointer_redacted: false,
              message_role: "developer",
              role_json_pointer: "/messages/0/role",
            },
          ],
        },
      ],
      [
        {
          id: "source",
          bytes: 10,
          locations: [
            {
              json_pointer: "/instructions",
              decoded_value_utf8_start: 0,
              pointer_redacted: false,
              message_role: null,
              role_json_pointer: null,
            },
            {
              json_pointer: "/input/0/content/0/text",
              decoded_value_utf8_start: 0,
              pointer_redacted: false,
              message_role: "user",
              role_json_pointer: "/input/0/role",
            },
          ],
        },
      ],
    ])
    expect(snapshot.map((request) => Object.keys(request.input_evidence!).sort())).toEqual([
      ["body_sha256", "body_utf8_bytes", "probes"],
      ["body_sha256", "body_utf8_bytes", "probes"],
    ])
  } finally {
    await server.stop(true)
  }
})

test("probe declarations return precise configuration errors for ambiguous identities and known credentials", () => {
  const redactor = new CredentialRedactor()
  redactor.collect({ key: "known-secret" })
  for (const probes of [
    [],
    [{ id: "source", text: "" }],
    [{ id: "source", text: "\ud800" }],
    [
      { id: "x", text: "one" },
      { id: "x", text: "two" },
    ],
    [{ id: "known-secret", text: "source" }],
    [{ id: "source", text: "read known-secret" }],
  ]) {
    expect(() => new RealProviderAudit("authorized-model", 2, undefined, undefined, { probes, redactor })).toThrow(
      ProviderAuditProbeConfigurationError,
    )
  }
})

test("sensitive JSON path components have explicit redacted location evidence", async () => {
  const original = globalThis.fetch
  globalThis.fetch = Object.assign(async () => new Response("transport fixture"), original) as typeof fetch
  try {
    const redactor = new CredentialRedactor()
    redactor.collect({ token: "known-secret/abc" })
    using audit = new RealProviderAudit("authorized-model", 1, undefined, undefined, {
      probes: [{ id: "source", text: "test evidence" }],
      redactor,
    })
    await fetch("https://provider.invalid/responses", {
      method: "POST",
      body: JSON.stringify({
        model: "authorized-model",
        stream: true,
        metadata: { "known-secret/abc": "test evidence", "ordinary/~key": "test evidence" },
      }),
    })
    expect(
      audit.requests[0]!.input_evidence!.probes[0]!.matches.map(
        ({ json_pointer, pointer_redacted, decoded_value_utf8_start }) => ({
          json_pointer,
          pointer_redacted,
          decoded_value_utf8_start,
        }),
      ),
    ).toEqual([
      { json_pointer: "/metadata/[REDACTED]", pointer_redacted: true, decoded_value_utf8_start: 0 },
      { json_pointer: "/metadata/ordinary~1~0key", pointer_redacted: false, decoded_value_utf8_start: 0 },
    ])
  } finally {
    globalThis.fetch = original
  }
})
