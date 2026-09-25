import assert from "node:assert/strict"
import { createHash } from "node:crypto"

export class ProviderAuditProbeConfigurationError extends Error {
  override readonly name = "ProviderAuditProbeConfigurationError"
}

export type ProviderInputProbe = { id: string; text: string }
export type ProviderInputEvidence = {
  body_utf8_bytes: number
  body_sha256: string
  probes: Array<{
    id: string
    text_utf8_bytes: number
    text_sha256: string
    matches: Array<{
      json_pointer: string
      pointer_redacted: boolean
      message_role: string | null
      role_json_pointer: string | null
      decoded_value_utf8_start: number
      value_sha256: string
    }>
  }>
}

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")

/** Exact known-text evidence only; offsets are in decoded string values, not serialized JSON. */
function registerInputObservation(input: { probes: unknown; redactor: CredentialRedactor }) {
  if (!Array.isArray(input.probes) || input.probes.length === 0)
    throw new ProviderAuditProbeConfigurationError("Provider input observation requires a non-empty probe array")
  const ids = new Set<string>()
  const probes: ProviderInputProbe[] = input.probes.map((probe: unknown) => {
    if (
      !probe ||
      typeof probe !== "object" ||
      Array.isArray(probe) ||
      Object.keys(probe).sort().join(",") !== "id,text" ||
      !("id" in probe) ||
      typeof probe.id !== "string" ||
      !/^[a-z][a-z0-9_.-]*$/.test(probe.id) ||
      !("text" in probe) ||
      typeof probe.text !== "string" ||
      probe.text.length === 0 ||
      Buffer.from(probe.text, "utf8").toString("utf8") !== probe.text ||
      ids.has(probe.id)
    )
      throw new ProviderAuditProbeConfigurationError(
        "Each input probe requires one unique ID and non-empty, well-formed text",
      )
    if (input.redactor.containsCredential(probe.id) || input.redactor.containsCredential(probe.text))
      throw new ProviderAuditProbeConfigurationError("Registered input evidence contains a known credential")
    ids.add(probe.id)
    // Copy the declaration once. Later caller edits cannot redefine the observed object.
    return { id: probe.id, text: probe.text }
  })
  return (body: string, parsed: unknown): ProviderInputEvidence => {
    const evidence: ProviderInputEvidence = {
      body_utf8_bytes: Buffer.byteLength(body, "utf8"),
      body_sha256: sha256(body),
      probes: probes.map((probe) => ({
        id: probe.id,
        text_utf8_bytes: Buffer.byteLength(probe.text, "utf8"),
        text_sha256: sha256(probe.text),
        matches: [],
      })),
    }
    const pending: Array<{
      value: unknown
      pointer: string
      pointerRedacted: boolean
      role?: { value: string; pointer: string }
    }> = [{ value: parsed, pointer: "", pointerRedacted: false }]
    while (pending.length) {
      const { value, pointer, pointerRedacted, role } = pending.pop()!
      if (typeof value === "string") {
        let valueSHA: string | undefined
        for (const [index, probe] of probes.entries()) {
          let from = 0
          let previousIndex = 0
          let decodedByteOffset = 0
          for (;;) {
            const at = value.indexOf(probe.text, from)
            if (at < 0) break
            decodedByteOffset += Buffer.byteLength(value.slice(previousIndex, at), "utf8")
            previousIndex = at
            const safePointer = input.redactor.redact(pointer)
            evidence.probes[index]!.matches.push({
              json_pointer: safePointer,
              pointer_redacted: pointerRedacted || safePointer !== pointer,
              message_role: role ? input.redactor.redact(role.value) : null,
              role_json_pointer: role ? input.redactor.redact(role.pointer) : null,
              decoded_value_utf8_start: decodedByteOffset,
              value_sha256: (valueSHA ??= sha256(value)),
            })
            from = at + 1
          }
        }
      } else if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index--)
          pending.push({ value: value[index], pointer: `${pointer}/${index}`, pointerRedacted, role })
      } else if (value && typeof value === "object") {
        const declaredRole = "role" in value ? value.role : undefined
        const contextRole =
          typeof declaredRole === "string" &&
          ["system", "developer", "user", "assistant", "tool"].includes(declaredRole)
            ? { value: declaredRole, pointer: `${pointer}/role` }
            : role
        for (const [key, item] of Object.entries(value).reverse()) {
          const redactedKey = input.redactor.redact(key)
          const safeKey = redactedKey.replaceAll("~", "~0").replaceAll("/", "~1")
          pending.push({
            value: item,
            pointer: `${pointer}/${safeKey}`,
            pointerRedacted: pointerRedacted || redactedKey !== key,
            role: contextRole,
          })
        }
      }
    }
    return evidence
  }
}

export class CopiedOAuthCredentialExpiredError extends Error {
  override readonly name = "CopiedOAuthCredentialExpiredError"
  readonly code = "COPIED_OAUTH_CREDENTIAL_EXPIRED"
  constructor(readonly expiresAt: number) {
    super("Copied OAuth access has expired; reconnect or refresh through the original Provider authority")
  }
}

export function assertCopiedOAuthAccess(expiresAt: number) {
  assert(Number.isFinite(expiresAt) && expiresAt > 0, "Copied OAuth access requires a finite positive expiry")
  if (Date.now() >= expiresAt) throw new CopiedOAuthCredentialExpiredError(expiresAt)
}

/** Test-runner evidence only. Retain identities/positions, never prompt bodies, headers or credentials. */
export class RealProviderAudit implements Disposable {
  readonly requests: Array<{ model: string; streaming: true; status?: number; input_evidence?: ProviderInputEvidence }> = []
  readonly localOrigins = new Set<string>()
  readonly nativeFetch = globalThis.fetch
  exhausted = false
  readonly #wrapped: typeof fetch

  constructor(readonly modelID: string, readonly maxRequests: number, readonly onUpdate?: () => void,
    readonly authority?: { copiedOAuthExpiresAt: number },
    observation?: { probes: unknown; redactor: CredentialRedactor }) {
    assert(Number.isSafeInteger(maxRequests) && maxRequests >= 0, "Request budget must be a nonnegative integer")
    if (authority) assertCopiedOAuthAccess(authority.copiedOAuthExpiresAt)
    const observeInput = observation ? registerInputObservation(observation) : undefined
    this.#wrapped = Object.assign(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input)
      let entry: (typeof this.requests)[number] | undefined
      if (!this.localOrigins.has(new URL(url).origin)) {
        // A copy has access authority only. Refreshing it would fork the source's
        // rotating credential generation into an independent, disposable store.
        if (authority) assertCopiedOAuthAccess(authority.copiedOAuthExpiresAt)
        const body = typeof init?.body === "string" ? init.body : input instanceof Request ? await input.clone().text() : undefined
        if (body) {
          let parsed: any
          try { parsed = JSON.parse(body) } catch {}
          if (parsed?.model) {
            assert.equal(parsed.model, modelID, "Actual outgoing request model differs from authorized model")
            assert.equal(parsed.stream, true, "Every real Provider request must stream")
            if (this.requests.length >= maxRequests) {
              this.exhausted = true
              this.onUpdate?.()
              throw new Error("E2E_REQUEST_BUDGET_EXHAUSTED")
            }
            entry = { model: parsed.model, streaming: true,
              ...(observeInput ? { input_evidence: observeInput(body, parsed) } : {}) }
            this.requests.push(entry)
            this.onUpdate?.()
          }
        }
      }
      const response = await this.nativeFetch(input, init)
      if (entry) { entry.status = response.status; this.onUpdate?.() }
      return response
    }, this.nativeFetch) as typeof fetch
    globalThis.fetch = this.#wrapped
  }

  [Symbol.dispose]() {
    if (globalThis.fetch === this.#wrapped) globalThis.fetch = this.nativeFetch
  }

  async preflight(input: {
    serverURL: URL
    model: string
    inactivityMs: number
    activity: (sessionID: string) => unknown
  }) {
    this.localOrigins.add(input.serverURL.origin)
    const request = async (route: string, body?: unknown, directory?: string) => {
      const url = new URL(route, input.serverURL)
      if (directory) url.searchParams.set("directory", directory)
      const response = await this.nativeFetch(url, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(15_000),
      })
      assert(response.ok, `Provider preflight ${route}: HTTP ${response.status}`)
      return await response.json() as any
    }
    const firstRequest = this.requests.length
    const chat = await request("/global/chat/start", { requestID: crypto.randomUUID(), text: "Reply with OK.", model: input.model })
    let signature = ""
    let lastActivity = Date.now()
    for (;;) {
      const messages = await request(`/session/${chat.session.id}/message`, undefined, chat.session.directory)
      const assistant = messages.find((entry: any) => entry.info.role === "assistant" && entry.info.parentID === chat.messageID)
      const next = JSON.stringify({ messages, activity: input.activity(chat.session.id) })
      if (next !== signature) { signature = next; lastActivity = Date.now() }
      if (this.exhausted) throw new Error("E2E_REQUEST_BUDGET_EXHAUSTED")
      if (assistant?.info.error) throw new Error(`PROVIDER_PREFLIGHT: ${JSON.stringify(assistant.info.error)}`)
      if (assistant?.info.time.completed) {
        assert(assistant.parts.some((part: any) => part.type === "text" && part.text.trim()), "Credential preflight must receive a persisted streamed reply")
        assert(this.requests.slice(firstRequest).some((entry) => entry.status === 200), "Actual outgoing model request must be observed")
        return { sessionID: chat.session.id as string, credential: "usable", catalog: "projected", actualModel: this.modelID, streaming: true }
      }
      if (Date.now() - lastActivity > input.inactivityMs) throw new Error("PROVIDER_PREFLIGHT_INACTIVITY")
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
}

/** Known credential values stay in memory; only redacted diagnostics leave the checker. */
export class CredentialRedactor {
  readonly #values = new Set<string>()

  collect(value: unknown): void {
    if (!value || typeof value !== "object") return
    for (const [key, item] of Object.entries(value)) {
      if (/key|token|access|refresh|secret|password/i.test(key) && typeof item === "string" && item.length > 0) {
        this.#values.add(item)
      } else if (item && typeof item === "object") this.collect(item)
    }
  }

  private encodings(): string[] {
    const encodings = new Set<string>()
    for (const value of [...this.#values].sort((a, b) => b.length - a.length)) {
      for (const encoded of new Set([value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value)])) {
        encodings.add(encoded)
      }
    }
    return [...encodings]
  }

  containsCredential(text: string): boolean {
    return this.encodings().some((value) => text.includes(value))
  }

  redact(text: string): string {
    for (const value of this.encodings()) text = text.replaceAll(value, "[REDACTED]")
    return text
  }
}
