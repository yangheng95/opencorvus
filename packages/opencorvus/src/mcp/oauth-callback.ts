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

interface PendingAuth {
  resolve: (code: string) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
  mcpName?: string
}

export namespace McpOAuthCallback {
  let server: ReturnType<typeof Bun.serve> | undefined
  // The pending owner key is project-scoped for MCP auth flows
  // (`projectID:mcpName`) so two active projects can authenticate the same
  // server name without sharing callback cancellation state.
  const pendingAuths = new Map<string, PendingAuth>()
  const mcpNameToState = new Map<string, string>()

  const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

  export async function ensureRunning(): Promise<void> {
    if (server) return

    try {
      server = Bun.serve({
        port: OAUTH_CALLBACK_PORT,
        fetch(req) {
          const url = new URL(req.url)

          if (url.pathname !== OAUTH_CALLBACK_PATH) {
            return new Response("Not found", { status: 404 })
          }

          const code = url.searchParams.get("code")
          const state = url.searchParams.get("state")
          const error = url.searchParams.get("error")
          const errorDescription = url.searchParams.get("error_description")

          log.info("received oauth callback", oauthCallbackReceivedLogFields({ code, error }))

          // Enforce state parameter presence
          if (!state) {
            const errorMsg = "Missing required state parameter - potential CSRF attack"
            log.error(
              "oauth callback missing state parameter",
              oauthCallbackMissingStateLogFields({ path: url.pathname }),
            )
            return new Response(HTML_ERROR(errorMsg), {
              status: 400,
              headers: { "Content-Type": "text/html" },
            })
          }

          if (error) {
            const errorMsg = errorDescription || error
            if (pendingAuths.has(state)) {
              const pending = pendingAuths.get(state)!
              clearTimeout(pending.timeout)
              pendingAuths.delete(state)
              if (pending.mcpName) mcpNameToState.delete(pending.mcpName)
              pending.reject(new Error(errorMsg))
            }
            return new Response(HTML_ERROR(errorMsg), {
              headers: { "Content-Type": "text/html" },
            })
          }

          if (!code) {
            return new Response(HTML_ERROR("No authorization code provided"), {
              status: 400,
              headers: { "Content-Type": "text/html" },
            })
          }

          // Validate state parameter
          if (!pendingAuths.has(state)) {
            const errorMsg = "Invalid or expired state parameter - potential CSRF attack"
            log.error(
              "oauth callback with invalid state",
              oauthCallbackInvalidStateLogFields({ pendingCount: pendingAuths.size }),
            )
            return new Response(HTML_ERROR(errorMsg), {
              status: 400,
              headers: { "Content-Type": "text/html" },
            })
          }

          const pending = pendingAuths.get(state)!

          clearTimeout(pending.timeout)
          pendingAuths.delete(state)
          if (pending.mcpName) mcpNameToState.delete(pending.mcpName)
          pending.resolve(code)

          return new Response(HTML_SUCCESS, {
            headers: { "Content-Type": "text/html" },
          })
        },
      })
    } catch {
      throw new Error(
        `OAuth callback port ${OAUTH_CALLBACK_PORT} is already in use by another process; cannot receive process-local OAuth callbacks.`,
      )
    }

    log.info("oauth callback server started", { port: OAUTH_CALLBACK_PORT })
  }

  export function waitForCallback(oauthState: string, mcpName?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (pendingAuths.has(oauthState)) {
          pendingAuths.delete(oauthState)
          if (mcpName) mcpNameToState.delete(mcpName)
          reject(new Error("OAuth callback timeout - authorization took too long"))
        }
      }, CALLBACK_TIMEOUT_MS)

      pendingAuths.set(oauthState, { resolve, reject, timeout, mcpName })
      if (mcpName) mcpNameToState.set(mcpName, oauthState)
    })
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
