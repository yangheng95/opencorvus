import { expect, test } from "bun:test"
import { assertCopiedOAuthAccess, CopiedOAuthCredentialExpiredError, CredentialRedactor, RealProviderAudit } from "../script/real-provider-audit"

test("copied OAuth access expires with an explicit authority error", () => {
  const expires = Date.now() - 1
  expect(() => assertCopiedOAuthAccess(expires)).toThrow(CopiedOAuthCredentialExpiredError)
  try { assertCopiedOAuthAccess(expires) } catch (error) {
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
