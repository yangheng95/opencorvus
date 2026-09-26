import { expect, test } from "bun:test"
import { assertCopiedOAuthAccess, CopiedOAuthCredentialExpiredError, CredentialRedactor, RealProviderAudit, ProviderAuditProbeConfigurationError } from "../script/real-provider-audit"

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
    expect(audit.requests).toEqual([{ model: "authorized-model", streaming: true, status: 200 }])
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
    expect({ exhausted: audit.exhausted, requests: audit.requests }).toEqual({ exhausted: false, requests: [{ model: "authorized-model", streaming: true, status: 200 }] })
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
    expect(snapshot[0]!.input_evidence!.probes[0]!.text_sha256).toBe(
      snapshot[1]!.input_evidence!.probes[0]!.text_sha256,
    )
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
