import assert from "node:assert/strict"

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

/** Test-runner evidence only. Never retain prompts, headers or credentials. */
export class RealProviderAudit implements Disposable {
  readonly requests: Array<{ model: string; streaming: true; status?: number }> = []
  readonly localOrigins = new Set<string>()
  readonly nativeFetch = globalThis.fetch
  exhausted = false
  readonly #wrapped: typeof fetch

  constructor(readonly modelID: string, readonly maxRequests: number, readonly onUpdate?: () => void,
    readonly authority?: { copiedOAuthExpiresAt: number }) {
    assert(Number.isSafeInteger(maxRequests) && maxRequests >= 0, "Request budget must be a nonnegative integer")
    if (authority) assertCopiedOAuthAccess(authority.copiedOAuthExpiresAt)
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
            entry = { model: parsed.model, streaming: true }
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

  redact(text: string): string {
    for (const value of [...this.#values].sort((a, b) => b.length - a.length)) {
      for (const encoded of new Set([value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value)])) {
        text = text.replaceAll(encoded, "[REDACTED]")
      }
    }
    return text
  }
}
