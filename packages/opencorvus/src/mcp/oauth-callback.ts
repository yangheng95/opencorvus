import { Log } from "../util/log"
import { OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_PATH } from "./oauth-provider"
import {
  oauthCallbackInvalidStateLogFields,
  oauthCallbackMissingStateLogFields,
  oauthCallbackReceivedLogFields,
} from "./oauth-log"

const log = Log.create({ service: "mcp.oauth-callback" })

// HTML is HyperText Markup Language; this escapes provider-controlled text before template insertion.
function escapeHTMLText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

const HTML_SUCCESS = `<!DOCTYPE html>
<html>
<head>
  <title>OpenCorvus - Authorization Successful</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .container { text-align: center; padding: 2rem; }
    h1 { color: #4ade80; margin-bottom: 1rem; }
    p { color: #aaa; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authorization Successful</h1>
    <p>You can close this window and return to OpenCorvus.</p>
  </div>
  <script>setTimeout(() => window.close(), 2000);</script>
</body>
</html>`

const HTML_ERROR = (error: string) => `<!DOCTYPE html>
<html>
<head>
  <title>OpenCorvus - Authorization Failed</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
    .container { text-align: center; padding: 2rem; }
    h1 { color: #f87171; margin-bottom: 1rem; }
    p { color: #aaa; }
    .error { color: #fca5a5; font-family: monospace; margin-top: 1rem; padding: 1rem; background: rgba(248,113,113,0.1); border-radius: 0.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authorization Failed</h1>
    <p>An error occurred during authorization.</p>
    <div class="error">${escapeHTMLText(error)}</div>
  </div>
</body>
</html>`

/**
 * A project's durable owner of OAuth flows.
 *
 * The listener is an adapter over a port: it has no opinion about which flows
 * exist. Whether a state names a live flow, and what finishing one means, are
 * answered here — by the same durable credential store that outlives the
 * in-process waiter this listener registers.
 */
interface CallbackAuthorityContract {
  /** The flow this state belongs to in this project, or undefined. */
  resolveState(oauthState: string): Promise<{ mcpName: string } | undefined>
  /** Complete the flow. Admission is single-use inside the credential store. */
  finish(input: { mcpName: string; authorizationCode: string; oauthState: string }): Promise<void>
  /** Terminalize a rejected flow through the same single-use admission. */
  abandon(input: { mcpName: string; oauthState: string; reason: string }): Promise<void>
}

interface PendingAuth {
  resolve: (code: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
  mcpName?: string
  correlationID: string
}

export namespace McpOAuthCallback {
  export type CallbackAuthority = CallbackAuthorityContract
  export type CallbackAuthorityRegistration = { isCurrent(): boolean; unregister(): void }

  let server: ReturnType<typeof Bun.serve> | undefined
  // The pending owner key is project-scoped for MCP auth flows
  // (`projectID:mcpName`) so two active projects can authenticate the same
  // server name without sharing callback cancellation state.
  const pendingAuths = new Map<string, PendingAuth>()
  const mcpNameToState = new Map<string, string>()
  // Flow authorities are project-scoped for the same reason the pending map
  // is. One shared slot would be last-writer-wins: a legitimate callback for
  // the first project would be resolved under the second project's identity
  // and refused. Each registered project answers only for its own flows.
  const flowAuthorities = new Map<string, { generation: symbol; authority: CallbackAuthorityContract }>()

  const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

  export async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url)

    if (url.pathname !== OAUTH_CALLBACK_PATH) {
      return new Response("Not found", { status: 404 })
    }

    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const error = url.searchParams.get("error")
    const errorDescription = url.searchParams.get("error_description")
    const callbackOwner = state ? pendingAuths.get(state) : undefined
    const correlationID = callbackOwner?.correlationID ?? crypto.randomUUID()

    log.info("received oauth callback", oauthCallbackReceivedLogFields({ code, error, correlationID }))

    if (!state) {
      const errorMsg = "Missing required state parameter - potential CSRF attack"
      log.error(
        "oauth callback missing state parameter",
        oauthCallbackMissingStateLogFields({ path: url.pathname, correlationID }),
      )
      return new Response(HTML_ERROR(errorMsg), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      })
    }

    // A callback no caller in this process is waiting on is not thereby
    // forged: the waiter may have timed out, its flow may have been cancelled
    // and re-minted, or the listener may have outlived the call that started
    // it. Legitimacy is the durable store's answer, never this map's
    // emptiness. With no project registered, no authority claims the state and
    // the refusal below is reached exactly as before.
    // Rejected callbacks also resolve the durable owner even when a local
    // waiter exists, so the state is spent before this request responds. The
    // caller's later cleanup is not the crash-safety boundary.
    let durableOwner: { authority: CallbackAuthorityContract; mcpName: string } | undefined
    if (!callbackOwner || error || !code) {
      try {
        durableOwner = await resolveDurableOwner(state)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        log.error("oauth callback could not resolve its flow", { correlationID, error: errorMsg })
        return new Response(HTML_ERROR(errorMsg), {
          status: 500,
          headers: { "Content-Type": "text/html" },
        })
      }
    }

    if (!callbackOwner && !durableOwner) {
      const errorMsg = "Invalid or expired state parameter - potential CSRF attack"
      log.error(
        "oauth callback with invalid state",
        oauthCallbackInvalidStateLogFields({ pendingCount: pendingAuths.size, correlationID }),
      )
      return new Response(HTML_ERROR(errorMsg), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      })
    }

    if (error) {
      const errorMsg = errorDescription || error
      const abandonmentFailure = await abandonDurableOwner(durableOwner, state, errorMsg, correlationID)
      if (abandonmentFailure) return abandonmentFailure
      settleLocally(state, callbackOwner, (pending) => pending.reject(new Error(errorMsg)))
      return new Response(HTML_ERROR(errorMsg), {
        status: callbackOwner ? 200 : 400,
        headers: { "Content-Type": "text/html" },
      })
    }

    if (!code) {
      const errorMsg = "No authorization code provided"
      const abandonmentFailure = await abandonDurableOwner(durableOwner, state, errorMsg, correlationID)
      if (abandonmentFailure) return abandonmentFailure
      settleLocally(state, callbackOwner, (pending) => pending.reject(new Error(errorMsg)))
      return new Response(HTML_ERROR(errorMsg), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      })
    }

    if (callbackOwner) {
      // The caller that opened this flow is waiting in this process and
      // finishes it itself. This branch answers the browser on handoff rather
      // than on the exchange's outcome — the contract it has always had.
      settleLocally(state, callbackOwner, (pending) => pending.resolve(code))
      return new Response(HTML_SUCCESS, {
        headers: { "Content-Type": "text/html" },
      })
    }

    try {
      await durableOwner!.authority.finish({
        mcpName: durableOwner!.mcpName,
        authorizationCode: code,
        oauthState: state,
      })
    } catch (finishError) {
      const errorMsg = finishError instanceof Error ? finishError.message : String(finishError)
      log.error("oauth callback failed to finish an unattended flow", { correlationID, error: errorMsg })
      return new Response(HTML_ERROR(errorMsg), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      })
    }

    return new Response(HTML_SUCCESS, {
      headers: { "Content-Type": "text/html" },
    })
  }

  /** Ask each registered project whether this state names one of its flows. */
  async function resolveDurableOwner(
    oauthState: string,
  ): Promise<{ authority: CallbackAuthorityContract; mcpName: string } | undefined> {
    const failures: unknown[] = []
    for (const { authority } of flowAuthorities.values()) {
      try {
        const owner = await authority.resolveState(oauthState)
        if (owner) return { authority, mcpName: owner.mcpName }
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, "No registered project could resolve the OAuth flow")
    return undefined
  }

  async function abandonDurableOwner(
    owner: { authority: CallbackAuthorityContract; mcpName: string } | undefined,
    oauthState: string,
    reason: string,
    correlationID: string,
  ): Promise<Response | undefined> {
    if (!owner) return undefined
    try {
      await owner.authority.abandon({ mcpName: owner.mcpName, oauthState, reason })
      return undefined
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      log.error("oauth callback could not terminalize its rejected flow", { correlationID, error: errorMsg })
      return new Response(HTML_ERROR(errorMsg), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      })
    }
  }

  function settleLocally(
    state: string,
    pending: PendingAuth | undefined,
    settle: (pending: PendingAuth) => void,
  ): void {
    if (!pending) return
    clearTimeout(pending.timeout)
    pendingAuths.delete(state)
    if (pending.mcpName) mcpNameToState.delete(pending.mcpName)
    settle(pending)
  }

  export async function ensureRunning(input?: {
    projectID: string
    authority: CallbackAuthorityContract
  }): Promise<CallbackAuthorityRegistration | undefined> {
    if (!server) {
      try {
        server = Bun.serve({
          port: OAUTH_CALLBACK_PORT,
          fetch: handleRequest,
        })
      } catch {
        throw new Error(
          `OAuth callback port ${OAUTH_CALLBACK_PORT} is already in use by another process; cannot receive process-local OAuth callbacks.`,
        )
      }
      log.info("oauth callback server started", { port: OAUTH_CALLBACK_PORT })
    }
    if (!input) return undefined
    const generation = Symbol(input.projectID)
    flowAuthorities.set(input.projectID, { generation, authority: input.authority })
    let registered = true
    return {
      isCurrent() {
        return registered && flowAuthorities.get(input.projectID)?.generation === generation
      },
      unregister() {
        if (!registered) return
        registered = false
        if (flowAuthorities.get(input.projectID)?.generation === generation) flowAuthorities.delete(input.projectID)
      },
    }
  }

  function waitForCallback(oauthState: string, mcpName: string | undefined, correlationID: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (pendingAuths.has(oauthState)) {
          pendingAuths.delete(oauthState)
          if (mcpName) mcpNameToState.delete(mcpName)
          reject(new Error("OAuth callback timeout - authorization took too long"))
        }
      }, CALLBACK_TIMEOUT_MS)

      pendingAuths.set(oauthState, { resolve, reject, timeout, mcpName, correlationID })
      if (mcpName) mcpNameToState.set(mcpName, oauthState)
    })
  }

  export function waitForCallbackSettlement(
    oauthState: string,
    mcpName: string | undefined,
    correlationID: string,
  ): Promise<{ status: "fulfilled"; code: string } | { status: "rejected"; error: Error }> {
    return waitForCallback(oauthState, mcpName, correlationID).then(
      (code) => ({ status: "fulfilled", code }),
      (error) => ({ status: "rejected", error: error instanceof Error ? error : new Error(String(error)) }),
    )
  }

  export function cancelPending(mcpName: string): void {
    const oauthState = mcpNameToState.get(mcpName)
    if (!oauthState) return
    const pending = pendingAuths.get(oauthState)
    if (pending) {
      clearTimeout(pending.timeout)
      pendingAuths.delete(oauthState)
      mcpNameToState.delete(mcpName)
      pending.reject(new Error("Authorization cancelled"))
    } else {
      // Index pointed at a state that's no longer pending (already
      // resolved / timed out). Clean up the orphan index entry.
      mcpNameToState.delete(mcpName)
    }
  }

  export async function stop(): Promise<void> {
    if (server) {
      server.stop()
      server = undefined
      log.info("oauth callback server stopped")
    }
    flowAuthorities.clear()

    for (const [, pending] of pendingAuths) {
      clearTimeout(pending.timeout)
      pending.reject(new Error("OAuth callback server stopped"))
    }
    pendingAuths.clear()
    mcpNameToState.clear()
  }

  export function isRunning(): boolean {
    return server !== undefined
  }
}
