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
 * The durable owner of OAuth flows.
 *
 * The listener is an adapter: it receives bytes on a port and has no opinion
 * about which flows exist. Whether a state names a live flow, and what
 * finishing that flow means, are both answered here — by the same durable
 * authority that survives the restart this listener does not.
 */
interface CallbackAuthorityContract {
  /** The flow this state belongs to, or undefined when no durable flow claims it. */
  resolveState(oauthState: string): Promise<{ mcpName: string } | undefined>
  /** Complete the flow. The one finish path, shared with a waiting caller. */
  finish(input: { mcpName: string; authorizationCode: string; oauthState: string }): Promise<void>
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

  let server: ReturnType<typeof Bun.serve> | undefined
  let flowAuthority: CallbackAuthorityContract | undefined
  // The pending owner key is project-scoped for MCP auth flows
  // (`projectID:mcpName`) so two active projects can authenticate the same
  // server name without sharing callback cancellation state.
  const pendingAuths = new Map<string, PendingAuth>()
  const mcpNameToState = new Map<string, string>()

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

    // A callback whose flow no process is waiting on is not thereby forged.
    // The listener that receives it need not be the listener that started the
    // flow — a restart between the authorization redirect and the callback
    // rebinds this port to a process with an empty map, and every fact the
    // completion needs is durable. Legitimacy is the durable authority's
    // answer, never this map's emptiness.
    const durableOwner = callbackOwner ? undefined : await requireAuthority().resolveState(state)

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
      settleLocally(state, callbackOwner, (pending) => pending.reject(new Error(errorMsg)))
      return new Response(HTML_ERROR(errorMsg), {
        headers: { "Content-Type": "text/html" },
      })
    }

    if (!code) {
      const errorMsg = "No authorization code provided"
      settleLocally(state, callbackOwner, (pending) => pending.reject(new Error(errorMsg)))
      return new Response(HTML_ERROR(errorMsg), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      })
    }

    if (callbackOwner) {
      // The caller that opened this flow is still waiting in this process; it
      // finishes through the same authority the branch below calls directly.
      settleLocally(state, callbackOwner, (pending) => pending.resolve(code))
      return new Response(HTML_SUCCESS, {
        headers: { "Content-Type": "text/html" },
      })
    }

    try {
      await requireAuthority().finish({
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

  function requireAuthority(): CallbackAuthorityContract {
    if (!flowAuthority) throw new Error("OAuth callback listener was started without its flow authority")
    return flowAuthority
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

  export async function ensureRunning(authority: CallbackAuthorityContract): Promise<void> {
    flowAuthority = authority
    if (server) return

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
      flowAuthority = undefined
      log.info("oauth callback server stopped")
    }

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
