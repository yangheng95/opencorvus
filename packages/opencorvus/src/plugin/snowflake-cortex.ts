// Upstream source: anomalyco/opencode packages/opencode/src/plugin/snowflake-cortex.ts @ 8e2d422ffe56f3b2eb52e3f7195a2f9722a9fc46.
import type { Hooks, PluginInput } from "@opencorvus-ai/plugin"
import { OAUTH_DUMMY_KEY } from "../auth"
import { Installation } from "../installation"
import { createServer } from "http"
import open from "open"
import { ManagedOAuthCallbackOwner, ManagedOAuthListenerOwner, type OAuthCallbackLease } from "./oauth-lifecycle"

const OAUTH_CLIENT_ID = "LOCAL_APPLICATION"
const OAUTH_CALLBACK_HOST = "127.0.0.1"
const OAUTH_CALLBACK_PATH = "/"
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000
const ACCESS_TOKEN_REFRESH_SKEW_MS = 120_000

interface PkceCodes {
  verifier: string
  challenge: string
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type?: string
}

const oauthServer = new ManagedOAuthListenerOwner<ReturnType<typeof createServer>>()
const pendingOAuth = new ManagedOAuthCallbackOwner<{ account: string; state: string; pkce: PkceCodes }, TokenResponse>()
let oauthServerPort: number | undefined

function normalizeAccount(input: string) {
  return input
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\.snowflakecomputing\.com\/?$/, "")
    .replace(/\/+$/, "")
}

function generateRandomString(length: number) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((b) => chars[b % chars.length])
    .join("")
}

function base64UrlEncode(buffer: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(buffer))
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function generatePKCE(): Promise<PkceCodes> {
  const verifier = generateRandomString(64)
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return {
    verifier,
    challenge: base64UrlEncode(hash),
  }
}

function callbackUrl() {
  if (!oauthServerPort) throw new Error("Snowflake OAuth callback server is not running")
  return `http://${OAUTH_CALLBACK_HOST}:${oauthServerPort}${OAUTH_CALLBACK_PATH}`
}

export function oauthScope(role: string | undefined) {
  if (!role) return "refresh_token"
  return /^[-_A-Za-z0-9]+$/.test(role)
    ? `refresh_token session:role:${role}`
    : `refresh_token session:role-encoded:${encodeURIComponent(role)}`
}

function authHeaders() {
  return {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
    "User-Agent": `opencorvus/${Installation.VERSION}`,
  }
}

function authBasicHeader() {
  return `Basic ${Buffer.from(`${OAUTH_CLIENT_ID}:${OAUTH_CLIENT_ID}`).toString("base64")}`
}

function buildAuthorizeUrl(account: string, role: string | undefined, state: string, pkce: PkceCodes) {
  const scope = oauthScope(role)
  const params = new URLSearchParams({
    client_id: OAUTH_CLIENT_ID,
    response_type: "code",
    redirect_uri: callbackUrl(),
    scope,
    state,
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
  })
  return `https://${account}.snowflakecomputing.com/oauth/authorize?${params.toString()}`
}

async function exchangeCodeForToken(account: string, code: string, pkce: PkceCodes) {
  const response = await fetch(`https://${account}.snowflakecomputing.com/oauth/token-request`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      Authorization: authBasicHeader(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(),
      client_id: OAUTH_CLIENT_ID,
      code_verifier: pkce.verifier,
    }).toString(),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Snowflake token exchange failed (${response.status})${detail ? `: ${detail}` : ""}`)
  }

  const token = (await response.json()) as TokenResponse
  if (!token.access_token) throw new Error("Snowflake token response did not include access_token")
  if (!token.refresh_token) {
    throw new Error(
      "Snowflake token response did not include refresh_token. Ensure integration issues refresh tokens and scope includes refresh_token.",
    )
  }
  return token
}

async function refreshAccessToken(account: string, refreshToken: string) {
  const response = await fetch(`https://${account}.snowflakecomputing.com/oauth/token-request`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      Authorization: authBasicHeader(),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: OAUTH_CLIENT_ID,
    }).toString(),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Snowflake token refresh failed (${response.status})${detail ? `: ${detail}` : ""}`)
  }

  const token = (await response.json()) as TokenResponse
  if (!token.access_token) throw new Error("Snowflake refresh response did not include access_token")
  return token
}

const HTML_SUCCESS = `<!doctype html>
<html>
  <head><title>OpenCode - Snowflake Authorization Successful</title></head>
  <body style="font-family: system-ui; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#111; color:#eee;">
    <div style="text-align:center; max-width:36rem; padding:2rem;">
      <h1 style="color:#7ee787;">Authorization Successful</h1>
      <p>You can close this window and return to OpenCode.</p>
    </div>
    <script>setTimeout(() => window.close(), 1500)</script>
  </body>
</html>`

const htmlError = (message: string) => `<!doctype html>
<html>
  <head><title>OpenCode - Snowflake Authorization Failed</title></head>
  <body style="font-family: system-ui; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#111; color:#eee;">
    <div style="text-align:center; max-width:48rem; padding:2rem;">
      <h1 style="color:#ff7b72;">Authorization Failed</h1>
      <pre style="white-space:pre-wrap; color:#ffb3ad; background:#2a1210; padding:1rem; border-radius:.5rem;">${message}</pre>
    </div>
  </body>
</html>`

async function startOAuthServer(): Promise<object> {
  if (!oauthServer.current) {
    const server = await oauthServer.start(
      () =>
        createServer((req, res) => {
          const host = req.headers.host || `${OAUTH_CALLBACK_HOST}:${oauthServerPort ?? 0}`
          const url = new URL(req.url || "/", `http://${host}`)

          if (url.pathname !== OAUTH_CALLBACK_PATH) {
            res.writeHead(404)
            res.end("Not found")
            return
          }

          const state = url.searchParams.get("state")
          const code = url.searchParams.get("code")
          const error = url.searchParams.get("error")
          const errorDescription = url.searchParams.get("error_description")

          // CSRF guard: validate state before processing any callback
          if (!pendingOAuth.current || state !== pendingOAuth.current.context.state) {
            const message = "Invalid state - potential CSRF attack"
            pendingOAuth.reject(new Error(message))
            res.writeHead(400, { "Content-Type": "text/html" })
            res.end(htmlError(message))
            return
          }

          const current = pendingOAuth.claim()
          if (!current) {
            res.writeHead(409, { "Content-Type": "text/html" })
            res.end(htmlError("OAuth callback is already being processed"))
            return
          }

          if (error) {
            const message = errorDescription || error
            current.reject(new Error(message))
            res.writeHead(200, { "Content-Type": "text/html" })
            res.end(htmlError(message))
            return
          }

          if (!code) {
            const message = "Missing authorization code"
            current.reject(new Error(message))
            res.writeHead(400, { "Content-Type": "text/html" })
            res.end(htmlError(message))
            return
          }

          exchangeCodeForToken(current.context.account, code, current.context.pkce)
            .then((tokens) => current.resolve(tokens))
            .catch((err) => current.reject(err instanceof Error ? err : new Error(String(err))))

          res.writeHead(200, { "Content-Type": "text/html" })
          res.end(HTML_SUCCESS)
        }),
      (candidate, ready) => {
        candidate.listen(0, OAUTH_CALLBACK_HOST, () => {
          const address = candidate.address()
          if (!address || typeof address === "string") {
            candidate.emit("error", new Error("Unable to resolve Snowflake OAuth callback port"))
            return
          }
          oauthServerPort = address.port
          ready()
        })
      },
    )
    const address = server.address()
    if (!address || typeof address === "string") throw new Error("Unable to resolve Snowflake OAuth callback port")
    oauthServerPort = address.port
  }
  return oauthServer.acquire()
}

async function stopOAuthServer(lease?: object) {
  await oauthServer.stop(lease)
  if (lease && oauthServer.current) return
  oauthServerPort = undefined
}

function waitForOAuthCallback(
  account: string,
  pkce: PkceCodes,
  state: string,
  lease: object,
): OAuthCallbackLease<TokenResponse> {
  return pendingOAuth.begin(
    { account, pkce, state },
    {
      timeoutMs: OAUTH_TIMEOUT_MS,
      supersededError: () => new Error("Superseded by a newer Snowflake authorize request"),
      timeoutError: () => new Error("Snowflake OAuth callback timeout - authorization took too long"),
      onTimeout: () => stopOAuthServer(lease),
    },
  )
}

export async function SnowflakeCortexAuthPlugin(_input: PluginInput): Promise<Hooks> {
  const prompts = [
    {
      type: "text" as const,
      key: "account",
      message: "Snowflake Account Identifier",
      placeholder: "myorg-myaccount",
      validate: (value: string) => (value && value.trim().length > 0 ? undefined : "Required"),
    },
    {
      type: "text" as const,
      key: "role",
      message: "Snowflake Role (optional)",
      placeholder: "PUBLIC",
    },
  ]

  return {
    auth: {
      provider: "snowflake-cortex",
      async loader(getAuth, _provider) {
        const auth = await getAuth()
        if (auth.type !== "oauth") return {}

        let refreshPromise:
          | Promise<{
              access: string
              refresh: string
              expires: number
            }>
          | undefined

        const oauth = auth as typeof auth & { refresh: string; access: string; expires: number; accountId?: string }

        if (oauth.accountId && oauth.refresh && oauth.expires && oauth.expires <= Date.now()) {
          await _input.credentials.refresh({
            providerID: "snowflake-cortex",
            current: oauth,
            exchange: async () => {
              const tokens = await refreshAccessToken(oauth.accountId!, oauth.refresh)
              return {
                type: "oauth",
                access: tokens.access_token,
                refresh: tokens.refresh_token || oauth.refresh,
                expires: Date.now() + (tokens.expires_in ?? 600) * 1000,
                accountId: oauth.accountId,
              }
            },
          })
        }

        return {
          apiKey: OAUTH_DUMMY_KEY,
          async fetch(requestInput: RequestInfo | URL, init?: RequestInit) {
            let currentAuth = await getAuth()
            if (currentAuth.type !== "oauth") throw new Error("Snowflake OAuth credential was removed during a request")
            let currentOauth = currentAuth as typeof currentAuth & {
              refresh: string
              access: string
              expires: number
              accountId?: string
            }

            if (!currentOauth.accountId) throw new Error("Snowflake OAuth auth is missing accountId")
            const accountId = currentOauth.accountId

            const refresh = async () => {
              if (!refreshPromise) {
                const refreshToken = currentOauth.refresh
                refreshPromise = _input.credentials
                  .refresh({
                    providerID: "snowflake-cortex",
                    current: currentOauth,
                    exchange: async () => {
                      const tokens = await refreshAccessToken(accountId, refreshToken)
                      return {
                        type: "oauth",
                        access: tokens.access_token,
                        refresh: tokens.refresh_token || refreshToken,
                        expires: Date.now() + (tokens.expires_in ?? 600) * 1000,
                        ...(accountId && { accountId }),
                      }
                    },
                  })
                  .then(async (credential) => {
                    return {
                      access: credential.access,
                      refresh: credential.refresh,
                      expires: credential.expires,
                    }
                  })
                  .finally(() => {
                    refreshPromise = undefined
                  })
              }

              const refreshed = await refreshPromise
              currentOauth = { ...currentOauth, ...refreshed }
            }

            const prepareRequest = () => {
              const headers = new Headers(requestInput instanceof Request ? requestInput.headers : undefined)
              if (init?.headers) {
                const entries =
                  init.headers instanceof Headers
                    ? init.headers.entries()
                    : Array.isArray(init.headers)
                      ? init.headers
                      : Object.entries(init.headers as Record<string, string | undefined>)
                for (const [key, value] of entries) {
                  if (value !== undefined) headers.set(key, String(value))
                }
              }
              headers.set("authorization", `Bearer ${currentOauth.access}`)
              headers.set("User-Agent", `opencorvus/${Installation.VERSION}`)

              let body = init?.body
              if (body && typeof body === "string") {
                const parsed = JSON.parse(body)
                if ("max_tokens" in parsed) {
                  parsed.max_completion_tokens = parsed.max_tokens
                  delete parsed.max_tokens
                  body = JSON.stringify(parsed)
                }
              }

              return { ...init, headers, body }
            }

            const transformResponse = async (response: Response) => {
              if (response.body && response.headers.get("content-type")?.includes("text/event-stream")) {
                const reader = response.body.getReader()
                const encoder = new TextEncoder()
                const decoder = new TextDecoder()
                const stream = new ReadableStream({
                  async pull(ctrl) {
                    const { done, value } = await reader.read()
                    if (done) {
                      ctrl.close()
                      return
                    }
                    const text = decoder.decode(value, { stream: true })
                    ctrl.enqueue(encoder.encode(text.replace(/"role"\s*:\s*""/g, '"role":"assistant"')))
                  },
                  cancel() {
                    reader.cancel()
                  },
                })
                return new Response(stream, { headers: response.headers, status: response.status })
              }

              return response
            }

            const expiresSoon =
              !currentOauth.expires ||
              !currentOauth.access ||
              currentOauth.expires - Date.now() <= ACCESS_TOKEN_REFRESH_SKEW_MS

            if (expiresSoon) await refresh()

            const response = await fetch(requestInput, prepareRequest())

            return transformResponse(response)
          },
        }
      },
      methods: [
        {
          type: "oauth",
          label: "Login with Snowflake (External Browser)",
          prompts,
          async authorize(inputs = {}) {
            const account = normalizeAccount(inputs.account || "")
            if (!account) throw new Error("Snowflake account is required")

            const lease = await startOAuthServer()
            const pkce = await generatePKCE()
            const state = generateRandomString(64)
            const role = (inputs.role || "").trim() || undefined
            const url = buildAuthorizeUrl(account, role, state, pkce)
            const callback = waitForOAuthCallback(account, pkce, state, lease)
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
                "Complete Snowflake sign-in in your browser. OpenCode will capture the OAuth callback and store the bearer token automatically.",
              method: "auto" as const,
              async dispose() {
                callback.reject(new Error("Snowflake OAuth authorization occurrence ended"))
                await callback.promise.catch(() => undefined)
                await stopOAuthServer(lease)
              },
              async callback() {
                try {
                  const tokens = await callback.promise
                  return {
                    type: "success" as const,
                    refresh: tokens.refresh_token!,
                    access: tokens.access_token,
                    expires: Date.now() + (tokens.expires_in ?? 600) * 1000,
                    accountId: account,
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
          label: "Paste PAT or bearer token manually",
          prompts: prompts.filter((item) => item.key === "account"),
        },
      ],
    },
  }
}
