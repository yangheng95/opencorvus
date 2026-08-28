import path from "node:path"
import { createHmac, timingSafeEqual } from "node:crypto"
import z from "zod"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { CROSS_PROCESS_LOCK_RETRY, withProcessLock } from "../util/process-lock"
import { Log } from "../util/log"
import { OAUTH_CALLBACK_PATH, type McpOAuthCallbackBinding } from "./oauth-provider"
import { McpAuth } from "./auth"
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
    outcome: "provider_rejected" | "missing_code"
  }): Promise<
    | { outcome: "abandoned" }
    | { outcome: "joined"; status: MCP.Status }
    | { outcome: "terminal"; terminal: McpAuth.OAuthCallbackTerminal }
  >
}

export interface CallbackResolution {
  mcpName: string
  phase: "pending" | "finishing"
  revision: McpAuth.Revision
}

interface PendingAuth {
  resolve: (status: MCP.Status) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
  terminalPoll: ReturnType<typeof setInterval>
  pollingTerminal: boolean
  terminalReadFailures: number
  mcpName?: string
  correlationID: string
  phase: "waiting" | "finishing"
}

type DurableCallbackOwner =
  | {
      authority: CallbackAuthorityContract
      resolution: CallbackResolution
      mcpName: string
      phase: "pending" | "finishing"
    }
  | { terminal: McpAuth.OAuthCallbackTerminal }

export namespace McpOAuthCallback {
  export type CallbackAuthority = CallbackAuthorityContract

  const BROKER_PROTOCOL = 1
  const INITIAL_CALLBACK_PORT = 19876
  const BROKER_PROOF_PATH = "/mcp/oauth/broker-proof"
  const BROKER_MONITOR_INTERVAL_MS = 500
  const BrokerIdentityFields = {
    protocol: z.literal(BROKER_PROTOCOL),
    generation: z.string().min(1),
    secret: z.string().regex(/^[0-9a-f]{64}$/),
  }
  const BrokerIdentity = z.object({
    ...BrokerIdentityFields,
    port: z.number().int().positive().max(65_535),
  })
  const BrokerBindingRequest = z.object({
    ...BrokerIdentityFields,
    port: z.number().int().nonnegative().max(65_535),
  })
  type BrokerIdentity = z.infer<typeof BrokerIdentity>
  type BrokerBindingRequest = z.infer<typeof BrokerBindingRequest>
  type BrokerRuntime = {
    identity: BrokerIdentity
    server?: ReturnType<typeof Bun.serve>
    monitor?: ReturnType<typeof setInterval>
    takeover?: Promise<void>
    retired?: boolean
  }
  const brokers = new Map<string, BrokerRuntime>()
  const brokerStarts = new Map<string, Promise<McpOAuthCallbackBinding>>()
  let brokerStopEpoch = 0
  let brokersStopping = false
  let brokerStop: Promise<void> | undefined
  // The pending owner key is project-scoped for MCP auth flows
  // (`projectID:mcpName`) so two active projects can authenticate the same
  // server name without sharing callback cancellation state.
  const pendingAuths = new Map<string, PendingAuth>()
  const mcpNameToState = new Map<string, string>()
  let afterOwnerResolutionForTest: (() => Promise<void>) | undefined
  let beforeBrokerProbeForTest: (() => Promise<void>) | undefined
  let afterUnreachableTakeoverRefusalForTest: (() => Promise<void>) | undefined

  const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

  function pendingAuthKey(state: string, root = Global.Path.root): string {
    return JSON.stringify([root, state])
  }

  function pendingMcpKey(authKey: string, root = Global.Path.root): string {
    return JSON.stringify([root, authKey])
  }

  export async function handleRequest(req: Request, binding?: BrokerIdentity): Promise<Response> {
    const url = new URL(req.url)

    const currentBinding = binding ?? (await readBrokerIdentity(Global.Path.root))
    if (url.pathname === BROKER_PROOF_PATH) {
      const challenge = url.searchParams.get("challenge")
      if (!challenge || !currentBinding) return new Response("Invalid broker proof request", { status: 400 })
      return Response.json(
        {
          generation: currentBinding.generation,
          proof: brokerProof(currentBinding, challenge),
        },
        { headers: { Connection: "close" } },
      )
    }

    if (url.pathname !== OAUTH_CALLBACK_PATH) {
      return new Response("Not found", { status: 404 })
    }

    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")
    const error = url.searchParams.get("error")
    const callbackOwner = state ? pendingAuths.get(pendingAuthKey(state)) : undefined
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
    let durableOwner: DurableCallbackOwner | undefined
    try {
      durableOwner = currentBinding ? await resolveDurableOwner(state, currentBinding.generation) : undefined
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

    if ("terminal" in durableOwner) {
      if (durableOwner.terminal.outcome === "connected") {
        const status = { status: "connected" as const }
        settleLocally(state, callbackOwner, (pending) => pending.resolve(status))
        return new Response(HTML_SUCCESS, { headers: { "Content-Type": "text/html" } })
      }
      const terminalError = McpAuth.oauthCallbackTerminalMessage(durableOwner.terminal.outcome)
      settleLocally(state, callbackOwner, (pending) => pending.reject(new Error(terminalError)))
      return new Response(HTML_ERROR(terminalError), {
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
      const abandonment = await abandonDurableOwner(durableOwner, state, "provider_rejected", correlationID)
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
      if (abandonment.outcome === "terminal") {
        return projectTerminalResponse(state, callbackOwner, abandonment.terminal)
      }
      const terminalError = McpAuth.oauthCallbackTerminalMessage("provider_rejected")
      settleLocally(state, callbackOwner, (pending) => pending.reject(new Error(terminalError)))
      return new Response(HTML_ERROR(terminalError), {
        status: 400,
        headers: { "Content-Type": "text/html" },
      })
    }

    if (!code) {
      const abandonment = await abandonDurableOwner(durableOwner, state, "missing_code", correlationID)
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
      if (abandonment.outcome === "terminal") {
        return projectTerminalResponse(state, callbackOwner, abandonment.terminal)
      }
      const terminalError = McpAuth.oauthCallbackTerminalMessage("missing_code")
      settleLocally(state, callbackOwner, (pending) => pending.reject(new Error(terminalError)))
      return new Response(HTML_ERROR(terminalError), {
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
      log.error("oauth callback failed to finish its flow", { correlationID })
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

  /** Resolve the exact project owner from the one durable MCP auth store. */
  async function resolveDurableOwner(
    oauthState: string,
    callbackGeneration: string,
  ): Promise<DurableCallbackOwner | undefined> {
    const { MCP } = await import("./index")
    return MCP.resolveOAuthCallbackOwner(oauthState, callbackGeneration)
  }

  function brokerPaths(root: string) {
    return Global.provideRoot(root, () => ({
      identity: path.join(Global.Path.data, "mcp-oauth-callback-broker.json"),
      lock: path.join(Global.Path.data, "mcp-oauth-callback-broker-owner"),
    }))
  }

  async function readBrokerIdentity(root: string): Promise<BrokerIdentity | undefined> {
    try {
      return BrokerIdentity.parse(await Filesystem.readJson<unknown>(brokerPaths(root).identity))
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : ""
      if (code === "ENOENT" || code === "ENOTDIR") return undefined
      throw error
    }
  }

  function brokerProof(identity: BrokerIdentity, challenge: string): string {
    return createHmac("sha256", Buffer.from(identity.secret, "hex"))
      .update(`${BROKER_PROTOCOL}:${identity.generation}:${challenge}`)
      .digest("hex")
  }

  function sameIdentity(left: BrokerIdentity | undefined, right: BrokerIdentity | undefined): boolean {
    return (
      !!left &&
      !!right &&
      left.port === right.port &&
      left.generation === right.generation &&
      left.secret === right.secret
    )
  }

  function publicBinding(identity: BrokerIdentity): McpOAuthCallbackBinding {
    return {
      redirectUrl: `http://127.0.0.1:${identity.port}${OAUTH_CALLBACK_PATH}`,
      generation: identity.generation,
    }
  }

  async function probeBroker(identity: BrokerIdentity): Promise<"verified" | "foreign" | "unreachable"> {
    await beforeBrokerProbeForTest?.()
    const challenge = crypto.randomUUID()
    let response: Response
    try {
      response = await fetch(
        `http://127.0.0.1:${identity.port}${BROKER_PROOF_PATH}?challenge=${encodeURIComponent(challenge)}`,
        { headers: { Connection: "close" }, signal: AbortSignal.timeout(750) },
      )
    } catch {
      return "unreachable"
    }
    if (!response.ok) return "foreign"
    let payload: string
    try {
      payload = await response.text()
    } catch {
      return "unreachable"
    }
    let body: { generation?: unknown; proof?: unknown }
    try {
      body = JSON.parse(payload) as { generation?: unknown; proof?: unknown }
    } catch {
      return "foreign"
    }
    if (body.generation !== identity.generation || typeof body.proof !== "string") return "foreign"
    const expected = Buffer.from(brokerProof(identity, challenge), "hex")
    const received = Buffer.from(body.proof, "hex")
    return expected.length === received.length && timingSafeEqual(expected, received) ? "verified" : "foreign"
  }

  function newBrokerIdentity(port: number): BrokerBindingRequest {
    return BrokerBindingRequest.parse({
      protocol: BROKER_PROTOCOL,
      port,
      generation: crypto.randomUUID(),
      secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex"),
    })
  }

  function bindBroker(root: string, identity: BrokerBindingRequest): BrokerRuntime | undefined {
    let currentIdentity: BrokerIdentity | undefined
    try {
      const server = Bun.serve({
        hostname: "127.0.0.1",
        port: identity.port,
        reusePort: false,
        fetch: (request) =>
          currentIdentity
            ? Global.provideRoot(root, () => handleRequest(request, currentIdentity!))
            : new Response("MCP OAuth callback broker is starting", { status: 503 }),
      })
      server.unref()
      currentIdentity = BrokerIdentity.parse({ ...identity, port: server.port })
      return { identity: currentIdentity, server }
    } catch {
      return undefined
    }
  }

  function bindFreshBroker(root: string, preferredPort: number): BrokerRuntime {
    const preferred = bindBroker(root, newBrokerIdentity(preferredPort))
    if (preferred) return preferred
    const dynamic = bindBroker(root, newBrokerIdentity(0))
    if (!dynamic) throw new Error("Cannot allocate a loopback port for the MCP OAuth callback broker")
    return dynamic
  }

  async function monitorPeerBroker(root: string, identity: BrokerIdentity): Promise<BrokerRuntime> {
    const existing = brokers.get(root)
    if (existing?.monitor && !existing.retired && sameIdentity(existing.identity, identity)) return existing
    if (existing) await retireBrokerRuntime(existing)
    const runtime: BrokerRuntime = { identity }
    runtime.monitor = setInterval(() => {
      if (runtime.retired || runtime.takeover) return
      runtime.takeover = (async () => {
        const persisted = await readBrokerIdentity(root).catch(() => undefined)
        if (runtime.retired) return
        if (!sameIdentity(persisted, runtime.identity) || (await probeBroker(runtime.identity)) !== "verified") {
          await ensureRunningForRoot(root).catch((error) => {
            log.warn("oauth callback broker takeover did not settle", {
              error: error instanceof Error ? error.message : String(error),
            })
          })
        }
      })().finally(() => {
        runtime.takeover = undefined
      })
    }, BROKER_MONITOR_INTERVAL_MS)
    ;(runtime.monitor as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.()
    brokers.set(root, runtime)
    return runtime
  }

  async function startBrokerForRoot(root: string): Promise<McpOAuthCallbackBinding> {
    const paths = brokerPaths(root)
    await Filesystem.writeAtomicIfAbsent(paths.lock, "mcp oauth callback broker owner\n", 0o600)
    return withProcessLock(paths.lock, { realpath: false, retries: CROSS_PROCESS_LOCK_RETRY }, async () => {
      const persisted = await readBrokerIdentity(root)
      const local = brokers.get(root)
      if (local?.server && !local.retired && sameIdentity(local.identity, persisted)) {
        await Global.provideRoot(root, () => McpAuth.settleCallbackGeneration(local.identity.generation))
        return publicBinding(local.identity)
      }

      const proof = persisted ? await probeBroker(persisted) : undefined
      if (persisted && proof === "verified") {
        await Global.provideRoot(root, () => McpAuth.settleCallbackGeneration(persisted.generation))
        return publicBinding((await monitorPeerBroker(root, persisted)).identity)
      }

      let replacement: BrokerRuntime
      if (!persisted) {
        replacement = bindFreshBroker(root, INITIAL_CALLBACK_PORT)
      } else {
        const takeover = bindBroker(root, persisted)
        if (takeover) {
          replacement = takeover
        } else if (proof === "foreign") {
          replacement = bindFreshBroker(root, 0)
        } else {
          await afterUnreachableTakeoverRefusalForTest?.()
          throw new Error(
            `MCP OAuth callback broker on port ${persisted.port} is temporarily unreachable but still owns the port; refusing destructive identity rotation`,
          )
        }
      }
      try {
        await Filesystem.writeAtomic(paths.identity, JSON.stringify(replacement.identity, null, 2), 0o600)
      } catch (error) {
        if (!sameIdentity(await readBrokerIdentity(root).catch(() => undefined), replacement.identity)) {
          await replacement.server?.stop(true)
          throw error
        }
      }
      try {
        await Global.provideRoot(root, () => McpAuth.settleCallbackGeneration(replacement.identity.generation))
      } catch (error) {
        await replacement.server?.stop(true)
        throw error
      }
      if (local) {
        await retireBrokerRuntime(local)
      }
      brokers.set(root, replacement)
      log.info("oauth callback broker active", {
        port: replacement.identity.port,
      })
      return publicBinding(replacement.identity)
    })
  }

  async function retireBrokerRuntime(runtime: BrokerRuntime): Promise<void> {
    runtime.retired = true
    if (runtime.monitor) {
      clearInterval(runtime.monitor)
      runtime.monitor = undefined
    }
    if (runtime.server) {
      const server = runtime.server
      runtime.server = undefined
      await server.stop(true)
    }
  }

  async function retireBrokerRoot(root: string): Promise<void> {
    const runtime = brokers.get(root)
    if (!runtime) return
    brokers.delete(root)
    await retireBrokerRuntime(runtime)
  }

  function ensureRunningForRoot(root: string): Promise<McpOAuthCallbackBinding> {
    if (brokersStopping) return Promise.reject(new Error("MCP OAuth callback brokers are stopping"))
    const current = brokerStarts.get(root)
    if (current) return current
    const epoch = brokerStopEpoch
    const start = startBrokerForRoot(root)
      .then(async (binding) => {
        if (brokersStopping || brokerStopEpoch !== epoch) {
          await retireBrokerRoot(root)
          throw new Error("MCP OAuth callback broker startup was retired by stop")
        }
        return binding
      })
      .finally(() => {
        if (brokerStarts.get(root) === start) brokerStarts.delete(root)
      })
    brokerStarts.set(root, start)
    return start
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
    outcome: "provider_rejected" | "missing_code",
    correlationID: string,
  ): Promise<
    | { outcome: "abandoned" }
    | { outcome: "joined"; status: MCP.Status }
    | { outcome: "terminal"; terminal: McpAuth.OAuthCallbackTerminal }
    | Error
  > {
    if (!owner) return new Error("OAuth flow owner is unavailable")
    try {
      return await owner.authority.abandon({ resolution: owner.resolution, oauthState, outcome })
    } catch (error) {
      const abandonmentError = error instanceof Error ? error : new Error(String(error))
      log.error("oauth callback could not terminalize its rejected flow", {
        correlationID,
      })
      return abandonmentError
    }
  }

  function projectTerminalResponse(
    state: string,
    pending: PendingAuth | undefined,
    terminal: McpAuth.OAuthCallbackTerminal,
  ): Response {
    if (terminal.outcome === "connected") {
      const status = { status: "connected" as const }
      settleLocally(state, pending, (current) => current.resolve(status))
      return new Response(HTML_SUCCESS, { headers: { "Content-Type": "text/html" } })
    }
    const message = McpAuth.oauthCallbackTerminalMessage(terminal.outcome)
    settleLocally(state, pending, (current) => current.reject(new Error(message)))
    return new Response(HTML_ERROR(message), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    })
  }

  function settleLocally(
    state: string,
    pending: PendingAuth | undefined,
    settle: (pending: PendingAuth) => void,
    root = Global.Path.root,
  ): void {
    const stateKey = pendingAuthKey(state, root)
    if (!pending || pendingAuths.get(stateKey) !== pending) return
    clearTimeout(pending.timeout)
    clearInterval(pending.terminalPoll)
    pendingAuths.delete(stateKey)
    const mcpKey = pending.mcpName ? pendingMcpKey(pending.mcpName, root) : undefined
    if (mcpKey && mcpNameToState.get(mcpKey) === state) mcpNameToState.delete(mcpKey)
    settle(pending)
  }

  function beginLocalSettlement(state: string, pending: PendingAuth | undefined): void {
    if (!pending || pendingAuths.get(pendingAuthKey(state)) !== pending) return
    pending.phase = "finishing"
    clearTimeout(pending.timeout)
    clearInterval(pending.terminalPoll)
    const mcpKey = pending.mcpName ? pendingMcpKey(pending.mcpName) : undefined
    if (mcpKey && mcpNameToState.get(mcpKey) === state) mcpNameToState.delete(mcpKey)
  }

  export async function ensureRunning(): Promise<McpOAuthCallbackBinding> {
    return ensureRunningForRoot(Global.Path.root)
  }

  export async function assertCurrent(binding: McpOAuthCallbackBinding): Promise<void> {
    const current = await readBrokerIdentity(Global.Path.root)
    if (!current) throw new Error("MCP OAuth callback broker identity is unavailable")
    const actual = publicBinding(current)
    if (actual.generation !== binding.generation || actual.redirectUrl !== binding.redirectUrl) {
      throw new Error("MCP OAuth callback broker identity changed while the authorization flow was active")
    }
  }

  function waitForCallback(
    oauthState: string,
    authKey: string | undefined,
    correlationID: string,
  ): Promise<MCP.Status> {
    const root = Global.Path.root
    const stateKey = pendingAuthKey(oauthState, root)
    const mcpKey = authKey ? pendingMcpKey(authKey, root) : undefined
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const pending = pendingAuths.get(stateKey)
        if (pending?.timeout === timeout && pending.phase === "waiting") {
          clearInterval(pending.terminalPoll)
          pendingAuths.delete(stateKey)
          if (mcpKey && mcpNameToState.get(mcpKey) === oauthState) mcpNameToState.delete(mcpKey)
          reject(new Error("OAuth callback timeout - authorization took too long"))
        }
      }, CALLBACK_TIMEOUT_MS)

      const observeTerminal = async () => {
        const pending = pendingAuths.get(stateKey)
        if (!pending || pending.phase !== "waiting" || pending.pollingTerminal || !authKey) return
        pending.pollingTerminal = true
        try {
          let terminal = await McpAuth.getOAuthCallbackTerminal(authKey, oauthState)
          if (!terminal) {
            const entry = await McpAuth.get(authKey)
            if (
              entry?.revision &&
              entry.oauthFinishing?.oauthState === oauthState &&
              entry.oauthFinishing.leaseExpiresAt <= Date.now()
            ) {
              terminal = await McpAuth.settleExpiredOAuthFinishing(authKey, oauthState, entry.revision)
            }
          }
          pending.terminalReadFailures = 0
          if (!terminal) return
          if (terminal.outcome === "connected") {
            settleLocally(oauthState, pending, (current) => current.resolve({ status: "connected" }), root)
            return
          }
          const failureOutcome = terminal.outcome
          settleLocally(
            oauthState,
            pending,
            (current) => current.reject(new Error(McpAuth.oauthCallbackTerminalMessage(failureOutcome))),
            root,
          )
        } catch {
          pending.terminalReadFailures++
          if (pending.terminalReadFailures >= 3) {
            settleLocally(
              oauthState,
              pending,
              (current) => current.reject(new Error("MCP OAuth callback terminal could not be read durably")),
              root,
            )
          }
        } finally {
          const current = pendingAuths.get(stateKey)
          if (current === pending) current.pollingTerminal = false
        }
      }
      const terminalPoll = setInterval(() => void observeTerminal(), 100)
      ;(terminalPoll as ReturnType<typeof setInterval> & { unref?: () => void }).unref?.()
      pendingAuths.set(stateKey, {
        resolve,
        reject,
        timeout,
        terminalPoll,
        pollingTerminal: false,
        terminalReadFailures: 0,
        mcpName: authKey,
        correlationID,
        phase: "waiting",
      })
      if (mcpKey) mcpNameToState.set(mcpKey, oauthState)
      void observeTerminal()
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
    const mcpKey = pendingMcpKey(mcpName)
    const oauthState = mcpNameToState.get(mcpKey)
    if (!oauthState) return
    const stateKey = pendingAuthKey(oauthState)
    const pending = pendingAuths.get(stateKey)
    if (pending?.phase === "waiting") {
      clearTimeout(pending.timeout)
      clearInterval(pending.terminalPoll)
      pendingAuths.delete(stateKey)
      mcpNameToState.delete(mcpKey)
      pending.reject(new Error("Authorization cancelled"))
    } else {
      // Index pointed at a state that's no longer pending (already
      // resolved / timed out). Clean up the orphan index entry.
      mcpNameToState.delete(mcpKey)
    }
  }

  export function stop(): Promise<void> {
    if (brokerStop) return brokerStop
    brokersStopping = true
    brokerStopEpoch++
    brokerStop = (async () => {
      try {
        const runtimes = [...brokers.values()]
        await Promise.all([...brokers.keys()].map((root) => retireBrokerRoot(root)))
        await Promise.allSettled([
          ...brokerStarts.values(),
          ...runtimes.flatMap((runtime) => (runtime.takeover ? [runtime.takeover] : [])),
        ])
        await Promise.all([...brokers.keys()].map((root) => retireBrokerRoot(root)))
        log.info("oauth callback brokers stopped")

        for (const [state, pending] of pendingAuths) {
          clearTimeout(pending.timeout)
          clearInterval(pending.terminalPoll)
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
        beforeBrokerProbeForTest = undefined
        afterUnreachableTakeoverRefusalForTest = undefined
      } finally {
        await Promise.all([...brokers.keys()].map((root) => retireBrokerRoot(root)))
        brokersStopping = false
        brokerStop = undefined
      }
    })()
    return brokerStop
  }

  /** Settle an interactive waiter from the canonical finish owner. This is
   * also called by the SDK callback path, so a same-process SDK winner and the
   * browser listener publish one outcome instead of racing two answers. */
  export function resolvePendingFinish(oauthState: string, status: MCP.Status): void {
    const pending = pendingAuths.get(pendingAuthKey(oauthState))
    settleLocally(oauthState, pending, (current) => current.resolve(status))
  }

  export function rejectPendingFinish(oauthState: string, error: Error): void {
    const pending = pendingAuths.get(pendingAuthKey(oauthState))
    settleLocally(oauthState, pending, (current) => current.reject(error))
  }

  export function isRunning(): boolean {
    return [...brokers.values()].some((runtime) => runtime.server !== undefined)
  }

  export namespace TestHooks {
    export function setAfterOwnerResolution(hook: (() => Promise<void>) | undefined): void {
      afterOwnerResolutionForTest = hook
    }

    export function setBeforeBrokerProbe(hook: (() => Promise<void>) | undefined): void {
      beforeBrokerProbeForTest = hook
    }

    export function setAfterUnreachableTakeoverRefusal(hook: (() => Promise<void>) | undefined): void {
      afterUnreachableTakeoverRefusalForTest = hook
    }
  }
}
