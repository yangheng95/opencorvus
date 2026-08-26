import { Log } from "../util/log"
import { OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_PATH } from "./oauth-provider"
import type { MCP } from "./index"
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
  resolveState(oauthState: string): Promise<CallbackResolution | undefined>
  /** Complete the flow and return the canonical status produced by that one finish. */
  finish(input: { resolution: CallbackResolution; authorizationCode: string; oauthState: string }): Promise<MCP.Status>
  /** Join a finish that has already spent this state. */
  joinFinish(input: { resolution: CallbackResolution; oauthState: string }): Promise<MCP.Status>
  /**
   * Terminalize a rejected flow through the same single-use admission, or
   * join the canonical finish when it won that admission concurrently.
   */
  abandon(input: {
    resolution: CallbackResolution
    oauthState: string
    reason: string
  }): Promise<{ outcome: "abandoned" } | { outcome: "joined"; status: MCP.Status }>
}

export interface CallbackResolution {
  mcpName: string
  phase: "pending" | "finishing"
}

interface PendingAuth {
  resolve: (status: MCP.Status) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
  mcpName?: string
  correlationID: string
  phase: "waiting" | "finishing"
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
  let afterOwnerResolutionForTest: (() => Promise<void>) | undefined

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

    // Arrival of the exact callback commits this local waiter to the listener's
    // outcome. Stop its independent timeout/cancel paths before resolving the
    // durable owner: once finish begins, a second local settlement could report
    // cancellation while the irreversible exchange succeeds.
    beginLocalSettlement(state, callbackOwner)

    // A callback no caller in this process is waiting on is not thereby
    // forged: the waiter may have timed out, its flow may have been cancelled
    // and re-minted, or the listener may have outlived the call that started
    // it. Legitimacy is the durable store's answer, never this map's
    // emptiness. With no project registered, no authority claims the state and
    // the refusal below is reached exactly as before.
    // Rejected callbacks also resolve the durable owner even when a local
    // waiter exists, so the state is spent before this request responds. The
    // caller's later cleanup is not the crash-safety boundary.
    let durableOwner:
      | {
          authority: CallbackAuthorityContract
          resolution: CallbackResolution
          mcpName: string
          phase: "pending" | "finishing"
        }
      | undefined
    try {
      durableOwner = await resolveDurableOwner(state)
    } catch (error) {
      const ownerError = error instanceof Error ? error : new Error(String(error))
      log.error("oauth callback could not resolve its flow", { correlationID, error: ownerError.message })
      settleLocally(state, callbackOwner, (pending) => pending.reject(ownerError))
      return new Response(HTML_ERROR(ownerError.message), {
        status: 500,
        headers: { "Content-Type": "text/html" },
      })
    }

    if (!durableOwner) {
      const errorMsg = "Invalid or expired state parameter - potential CSRF attack"
      log.error(
        "oauth callback with invalid state",
        oauthCallbackInvalidStateLogFields({ pendingCount: pendingAuths.size, correlationID }),
      )
      settleLocally(state, callbackOwner, (pending) => pending.reject(new Error(errorMsg)))
      return new Response(HTML_ERROR(errorMsg), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      })
    }

    await afterOwnerResolutionForTest?.()

    // Once another callback has spent the state, its canonical finish is the
    // only remaining outcome. A late duplicate cannot reinterpret provider
    // error or a missing code as permission to abandon that in-flight finish.
    if (durableOwner.phase === "finishing") {
      try {
        const status = await durableOwner.authority.joinFinish({
          resolution: durableOwner.resolution,
          oauthState: state,
        })
        settleLocally(state, callbackOwner, (pending) => pending.resolve(status))
        return new Response(HTML_SUCCESS, { headers: { "Content-Type": "text/html" } })
      } catch (finishError) {
        const error = finishError instanceof Error ? finishError : new Error(String(finishError))
        settleLocally(state, callbackOwner, (pending) => pending.reject(error))
        return new Response(HTML_ERROR(error.message), {
          status: 400,
          headers: { "Content-Type": "text/html" },
        })
      }
    }

    if (error) {
      const errorMsg = errorDescription || error
      const abandonment = await abandonDurableOwner(durableOwner, state, errorMsg, correlationID)
      if (abandonment instanceof Error) {
        settleLocally(state, callbackOwner, (pending) => pending.reject(abandonment))
        return new Response(HTML_ERROR(abandonment.message), {
          status: 500,
          headers: { "Content-Type": "text/html" },
        })
      }
      if (abandonment.outcome === "joined") {
        settleLocally(state, callbackOwner, (pending) => pending.resolve(abandonment.status))
        return new Response(HTML_SUCCESS, { headers: { "Content-Type": "text/html" } })
      }
      settleLocally(state, callbackOwner, (pending) => pending.reject(new Error(errorMsg)))
      return new Response(HTML_ERROR(errorMsg), {
        status: callbackOwner ? 200 : 400,
        headers: { "Content-Type": "text/html" },
      })
    }

    if (!code) {
      const errorMsg = "No authorization code provided"
      const abandonment = await abandonDurableOwner(durableOwner, state, errorMsg, correlationID)
      if (abandonment instanceof Error) {
        settleLocally(state, callbackOwner, (pending) => pending.reject(abandonment))
        return new Response(HTML_ERROR(abandonment.message), {
          status: 500,
          headers: { "Content-Type": "text/html" },
        })
      }
      if (abandonment.outcome === "joined") {
        settleLocally(state, callbackOwner, (pending) => pending.resolve(abandonment.status))
        return new Response(HTML_SUCCESS, { headers: { "Content-Type": "text/html" } })
      }
      settleLocally(state, callbackOwner, (pending) => pending.reject(new Error(errorMsg)))
      return new Response(HTML_ERROR(errorMsg), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      })
    }

    try {
      const status = await durableOwner.authority.finish({
        resolution: durableOwner.resolution,
        authorizationCode: code,
        oauthState: state,
      })
      settleLocally(state, callbackOwner, (pending) => pending.resolve(status))
    } catch (finishError) {
      const errorMsg = finishError instanceof Error ? finishError.message : String(finishError)
      log.error("oauth callback failed to finish its flow", { correlationID, error: errorMsg })
      settleLocally(state, callbackOwner, (pending) =>
        pending.reject(finishError instanceof Error ? finishError : new Error(errorMsg)),
      )
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
  async function resolveDurableOwner(oauthState: string): Promise<
    | {
        authority: CallbackAuthorityContract
        resolution: CallbackResolution
        mcpName: string
        phase: "pending" | "finishing"
      }
    | undefined
  > {
    const failures: unknown[] = []
    // Invoke every current authority before awaiting any one of them. Default
    // authorities register their callback-owned terminal receipt synchronously
    // at invocation, so a slow non-owner project cannot delay the true owner's
    // admission until after its canonical finish has already retired.
    const attempts = [...flowAuthorities.values()].map(({ authority }) => ({
      authority,
      outcome: authority.resolveState(oauthState).then(
        (resolution) => ({ status: "fulfilled" as const, resolution }),
        (reason) => ({ status: "rejected" as const, reason }),
      ),
    }))
    for (const { authority, outcome } of attempts) {
      const settled = await outcome
      if (settled.status === "fulfilled") {
        const owner = settled.resolution
        if (owner) return { authority, resolution: owner, mcpName: owner.mcpName, phase: owner.phase }
      } else {
        failures.push(settled.reason)
      }
    }
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, "No registered project could resolve the OAuth flow")
    return undefined
  }

  async function abandonDurableOwner(
    owner:
      | {
          authority: CallbackAuthorityContract
          resolution: CallbackResolution
          mcpName: string
          phase: "pending" | "finishing"
        }
      | undefined,
    oauthState: string,
    reason: string,
    correlationID: string,
  ): Promise<{ outcome: "abandoned" } | { outcome: "joined"; status: MCP.Status } | Error> {
    if (!owner) return new Error("OAuth flow owner is unavailable")
    try {
      return await owner.authority.abandon({ resolution: owner.resolution, oauthState, reason })
    } catch (error) {
      const abandonmentError = error instanceof Error ? error : new Error(String(error))
      log.error("oauth callback could not terminalize its rejected flow", {
        correlationID,
        error: abandonmentError.message,
      })
      return abandonmentError
    }
  }

  function settleLocally(
    state: string,
    pending: PendingAuth | undefined,
    settle: (pending: PendingAuth) => void,
  ): void {
    if (!pending || pendingAuths.get(state) !== pending) return
    clearTimeout(pending.timeout)
    pendingAuths.delete(state)
    if (pending.mcpName && mcpNameToState.get(pending.mcpName) === state) mcpNameToState.delete(pending.mcpName)
    settle(pending)
  }

  function beginLocalSettlement(state: string, pending: PendingAuth | undefined): void {
    if (!pending || pendingAuths.get(state) !== pending) return
    pending.phase = "finishing"
    clearTimeout(pending.timeout)
    if (pending.mcpName && mcpNameToState.get(pending.mcpName) === state) mcpNameToState.delete(pending.mcpName)
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

  function waitForCallback(
    oauthState: string,
    mcpName: string | undefined,
    correlationID: string,
  ): Promise<MCP.Status> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = pendingAuths.get(oauthState)
        if (pending?.timeout === timeout && pending.phase === "waiting") {
          pendingAuths.delete(oauthState)
          if (mcpName && mcpNameToState.get(mcpName) === oauthState) mcpNameToState.delete(mcpName)
          reject(new Error("OAuth callback timeout - authorization took too long"))
        }
      }, CALLBACK_TIMEOUT_MS)

      pendingAuths.set(oauthState, { resolve, reject, timeout, mcpName, correlationID, phase: "waiting" })
      if (mcpName) mcpNameToState.set(mcpName, oauthState)
    })
  }

  export function waitForCallbackSettlement(
    oauthState: string,
    mcpName: string | undefined,
    correlationID: string,
  ): Promise<{ status: "fulfilled"; result: MCP.Status } | { status: "rejected"; error: Error }> {
    return waitForCallback(oauthState, mcpName, correlationID).then(
      (result) => ({ status: "fulfilled", result }),
      (error) => ({ status: "rejected", error: error instanceof Error ? error : new Error(String(error)) }),
    )
  }

  export function cancelPending(mcpName: string): void {
    const oauthState = mcpNameToState.get(mcpName)
    if (!oauthState) return
    const pending = pendingAuths.get(oauthState)
    if (pending?.phase === "waiting") {
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

    for (const [state, pending] of pendingAuths) {
      clearTimeout(pending.timeout)
      // An accepted callback owns the only remaining outcome. Stopping the
      // listener prevents new requests but must not report failure to a waiter
      // whose already-running durable finish may still succeed.
      if (pending.phase === "waiting") {
        pendingAuths.delete(state)
        pending.reject(new Error("OAuth callback server stopped"))
      }
    }
    mcpNameToState.clear()
    afterOwnerResolutionForTest = undefined
  }

  /** Settle an interactive waiter from the canonical finish owner. This is
   * also called by the SDK callback path, so a same-process SDK winner and the
   * browser listener publish one outcome instead of racing two answers. */
  export function resolvePendingFinish(oauthState: string, status: MCP.Status): void {
    const pending = pendingAuths.get(oauthState)
    settleLocally(oauthState, pending, (current) => current.resolve(status))
  }

  export function rejectPendingFinish(oauthState: string, error: Error): void {
    const pending = pendingAuths.get(oauthState)
    settleLocally(oauthState, pending, (current) => current.reject(error))
  }

  export function isRunning(): boolean {
    return server !== undefined
  }

  export namespace TestHooks {
    export function setAfterOwnerResolution(hook: (() => Promise<void>) | undefined): void {
      afterOwnerResolutionForTest = hook
    }
  }
}
