// Upstream source: anomalyco/opencode packages/opencode/src/plugin/digitalocean.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.
import type { Hooks, PluginInput } from "@opencorvus-ai/plugin"
import type { Model } from "@opencorvus-ai/sdk"
import { Installation } from "../installation"
import { createServer } from "http"
import open from "open"
import { ManagedOAuthCallbackOwner, ManagedOAuthListenerOwner, type OAuthCallbackLease } from "./oauth-lifecycle"

const DO_OAUTH_CLIENT_ID = "b1a6c5158156caac821fd1b30253ca8acb52454a48fa744420e41889cb589f82"
const DO_AUTHORIZE_URL = "https://cloud.digitalocean.com/v1/oauth/authorize"
const DO_API_BASE = "https://api.digitalocean.com"
const DO_GENAI_API = `${DO_API_BASE}/v2/gen-ai`
const DO_INFERENCE_BASE = "https://inference.do-ai.run/v1"
const OAUTH_PORT = 1456
const OAUTH_REDIRECT_PATH = "/auth/callback"
const OAUTH_TOKEN_PATH = "/auth/token"
const ROUTER_REFRESH_INTERVAL_MS = 5 * 60 * 1000
const OAUTH_SCOPES = "genai:read inference:query"

interface ImplicitTokenPayload {
  access_token: string
  expires_in: number
  state: string
}

interface RouterEntry {
  name: string
  uuid?: string
  description?: string
}

const oauthServer = new ManagedOAuthListenerOwner<ReturnType<typeof createServer>>()
const pendingOAuth = new ManagedOAuthCallbackOwner<{ state: string }, ImplicitTokenPayload>()

function generateState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function redirectUri(): string {
  return `http://localhost:${OAUTH_PORT}${OAUTH_REDIRECT_PATH}`
}

function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "token",
    client_id: DO_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri(),
    scope: OAUTH_SCOPES,
    state,
  })
  return `${DO_AUTHORIZE_URL}?${params.toString()}`
}

const HTML_CALLBACK = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>OpenCode - DigitalOcean Authorization</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0b1220; color: #e8eef9; }
      .container { text-align: center; padding: 2rem; max-width: 32rem; }
      h1 { color: #e8eef9; margin-bottom: 1rem; }
      p { color: #9aa9c0; }
      .error { color: #ff917b; font-family: monospace; margin-top: 1rem; padding: 1rem; background: #3c140d; border-radius: 0.5rem; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1 id="title">Finishing sign-in...</h1>
      <p id="msg">You can close this window once it says you're signed in.</p>
    </div>
    <script>
      (async function() {
        const params = new URLSearchParams((window.location.hash || "").slice(1))
        const search = new URLSearchParams(window.location.search)
        const error = params.get("error") || search.get("error")
        const errorDescription = params.get("error_description") || search.get("error_description")
        const titleEl = document.getElementById("title")
        const msgEl = document.getElementById("msg")
        const tokenUrl = new URL(${JSON.stringify(OAUTH_TOKEN_PATH)}, window.location.origin).href
        try {
          const body = error
            ? { error, error_description: errorDescription || "" }
            : { access_token: params.get("access_token") || "", expires_in: params.get("expires_in") || "0", state: params.get("state") || "" }
          const res = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
          if (!res.ok) {
            const detail = await res.text().catch(function () { return "" })
            throw new Error(detail || ("callback failed (" + res.status + ")"))
          }
          if (error) {
            titleEl.textContent = "Authorization Failed"
            msgEl.textContent = errorDescription || error
            msgEl.className = "error"
            return
          }
          titleEl.textContent = "Authorization Successful"
          msgEl.textContent = "You can close this window and return to OpenCode."
          setTimeout(function () { window.close() }, 2000)
        } catch (e) {
          titleEl.textContent = "Authorization Failed"
          msgEl.textContent = String(e && e.message ? e.message : e)
          msgEl.className = "error"
        }
      })()
    </script>
  </body>
</html>`

async function startOAuthServer(): Promise<object> {
  if (!oauthServer.current) {
    await oauthServer.start(
      () =>
        createServer((req, res) => {
          const url = new URL(req.url || "/", `http://localhost:${OAUTH_PORT}`)

          if (req.method === "GET" && url.pathname === OAUTH_REDIRECT_PATH) {
            res.writeHead(200, { "Content-Type": "text/html" })
            res.end(HTML_CALLBACK)
            return
          }

          if (req.method === "POST" && url.pathname === OAUTH_TOKEN_PATH) {
            const chunks: Buffer[] = []
            req.on("data", (chunk: Buffer) => chunks.push(chunk))
            req.on("end", () => {
              const raw = Buffer.concat(chunks).toString("utf8")
              let body: Record<string, string>
              try {
                body = JSON.parse(raw)
              } catch (error) {
                pendingOAuth.reject(error instanceof Error ? error : new Error(String(error)))
                res.writeHead(400, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ error: "invalid_callback_json" }))
                return
              }
              if (!pendingOAuth.current) {
                res.writeHead(409, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ error: "no_pending_oauth" }))
                return
              }
              if (body.error) {
                const message = body.error_description || body.error || "OAuth error"
                pendingOAuth.reject(new Error(String(message)))
                res.writeHead(200, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ ok: true }))
                return
              }
              if (!body.access_token) {
                pendingOAuth.reject(new Error("Missing access_token in callback"))
                res.writeHead(400, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ error: "missing_access_token" }))
                return
              }
              if (body.state !== pendingOAuth.current.context.state) {
                pendingOAuth.reject(new Error("Invalid state - potential CSRF attack"))
                res.writeHead(400, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ error: "invalid_state" }))
                return
              }
              const expires = parseInt(body.expires_in || "0", 10)
              const current = pendingOAuth.claim()
              if (!current) {
                res.writeHead(409, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ error: "oauth_callback_already_processing" }))
                return
              }
              current.resolve({
                access_token: body.access_token,
                expires_in: Number.isFinite(expires) && expires > 0 ? expires : 60 * 60 * 24 * 30,
                state: body.state,
              })
              res.writeHead(200, { "Content-Type": "application/json" })
              res.end(JSON.stringify({ ok: true }))
            })
            return
          }

          res.writeHead(404)
          res.end("Not found")
        }),
      (server, ready) => server.listen(OAUTH_PORT, ready),
    )
  }
  return oauthServer.acquire()
}

async function stopOAuthServer(lease?: object) {
  await oauthServer.stop(lease)
}

function waitForOAuthCallback(state: string, lease: object): OAuthCallbackLease<ImplicitTokenPayload> {
  return pendingOAuth.begin(
    { state },
    {
      timeoutMs: 5 * 60 * 1000,
      supersededError: () => new Error("Superseded by a newer DigitalOcean authorize request"),
      timeoutError: () => new Error("OAuth callback timeout - authorization took too long"),
      onTimeout: () => void stopOAuthServer(lease),
    },
  )
}

async function listRouters(bearer: string): Promise<RouterEntry[]> {
  const res = await fetch(`${DO_GENAI_API}/models/routers`, {
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/json",
      "User-Agent": `opencorvus/${Installation.VERSION}`,
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`DigitalOcean router discovery failed: ${res.status} ${await res.text()}`)
  const body = (await res.json()) as { model_routers: RouterEntry[] }
  if (!Array.isArray(body.model_routers)) throw new Error("DigitalOcean router response is missing model_routers")
  return body.model_routers
}

function routerModel(router: RouterEntry, providerID: string): Model {
  const id = `router:${router.name}`
  return {
    id,
    providerID,
    name: router.name,
    family: "digitalocean-inference-routers",
    api: { id, url: DO_INFERENCE_BASE, npm: "@ai-sdk/openai-compatible" },
    status: "active",
    headers: {},
    options: {},
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context: 128_000, output: 8_192 },
    capabilities: {
      temperature: true,
      reasoning: false,
      attachment: false,
      toolcall: true,
      input: { text: true, audio: false, image: false, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
      interleaved: false,
    },
    release_date: "",
    variants: {},
  }
}

function parseRoutersJSON(raw: string | undefined): RouterEntry[] {
  if (!raw) return []
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error("DigitalOcean cached routers must be an array")
  return parsed.map((router) => {
    if (!router || typeof router.name !== "string") throw new Error("DigitalOcean cached router is missing name")
    return { name: router.name, uuid: router.uuid, description: router.description }
  })
}

export async function DigitalOceanAuthPlugin(input: PluginInput): Promise<Hooks> {
  return {
    provider: {
      id: "digitalocean",
      async models(provider, ctx) {
        const baseModels = provider.models
        if (ctx.auth?.type !== "api") return baseModels

        const metadata = (ctx.auth as typeof ctx.auth & { metadata?: Record<string, string> }).metadata ?? {}
        const oauthAccess = metadata["oauth_access"]
        const oauthExpires = parseInt(metadata["oauth_expires"] || "0", 10)
        const fetchedAt = parseInt(metadata["routers_fetched_at"] || "0", 10)
        const cached = parseRoutersJSON(metadata["routers"])

        let routers = cached
        const stale = Date.now() - fetchedAt > ROUTER_REFRESH_INTERVAL_MS
        const bearerValid = oauthAccess && oauthExpires > Date.now()

        if (bearerValid && stale) {
          routers = await listRouters(oauthAccess)
          const updated: Record<string, string> = {
            ...metadata,
            routers: JSON.stringify(routers.map((r) => ({ name: r.name, uuid: r.uuid, description: r.description }))),
            routers_fetched_at: String(Date.now()),
          }
          await input.client.auth.set({
            providerID: "digitalocean",
            auth: { type: "api", key: ctx.auth.key, metadata: updated },
          })
        }

        const merged: Record<string, Model> = { ...baseModels }
        for (const router of routers) {
          const id = `router:${router.name}`
          if (merged[id]) continue
          merged[id] = routerModel(router, "digitalocean")
        }
        return merged
      },
    },
    auth: {
      provider: "digitalocean",
      methods: [
        {
          type: "oauth",
          label: "Login with DigitalOcean",
          async authorize() {
            const lease = await startOAuthServer()
            const state = generateState()
            const callback = waitForOAuthCallback(state, lease)
            const url = buildAuthorizeUrl(state)
            try {
              await open(url)
            } catch (error) {
              const failure = error instanceof Error ? error : new Error(String(error))
              callback.reject(failure)
              await callback.promise.catch(() => undefined)
              await stopOAuthServer(lease)
              throw failure
            }
            return {
              url,
              instructions:
                "Sign in to DigitalOcean in your browser. OpenCode will use your DigitalOcean API token directly for inference and load your Inference Routers. Re-run /connect to refresh routers later.",
              method: "auto" as const,
              async callback() {
                try {
                  const tokens = await callback.promise
                  const routers = await listRouters(tokens.access_token)
                  return {
                    type: "success" as const,
                    provider: "digitalocean",
                    key: tokens.access_token,
                    metadata: {
                      oauth_access: tokens.access_token,
                      oauth_expires: String(Date.now() + tokens.expires_in * 1000),
                      oauth_scopes: OAUTH_SCOPES,
                      routers: JSON.stringify(
                        routers.map((r) => ({ name: r.name, uuid: r.uuid, description: r.description })),
                      ),
                      routers_fetched_at: String(Date.now()),
                    },
                  }
                } finally {
                  await stopOAuthServer(lease)
                }
              },
            }
          },
        },
        {
          type: "api",
          label: "Paste Model Access Key",
        },
      ],
    },
  }
}
