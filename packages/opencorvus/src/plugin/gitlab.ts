// OAuth exchange behavior is adapted from opencode-gitlab-auth 2.1.0 (MIT).
// Credential ownership, persistence and refresh are OpenCorvus engine concerns.
import type { Hooks, PluginInput } from "@opencorvus-ai/plugin"
import { createServer } from "node:http"
import crypto from "node:crypto"
import open from "open"
import z from "zod"
import { ManagedOAuthCallbackOwner, ManagedOAuthListenerOwner, type OAuthCallbackLease } from "./oauth-lifecycle"

const CLIENT_ID =
  process.env.GITLAB_OAUTH_CLIENT_ID ?? "1d89f9fdb23ee96d4e603201f6861dab6e143c5c3c00469a018a2d94bdc03d4e"
const DEFAULT_INSTANCE_URL = "https://gitlab.com"
const OAUTH_SCOPES = "api"
const OAUTH_CALLBACK_PATH = "/callback"
const OAUTH_EXPIRY_BUFFER_MS = 5 * 60 * 1000

const TokenResponse = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
})
type TokenResponse = z.infer<typeof TokenResponse>

type CallbackResult = { code: string; state: string }

const oauthServer = new ManagedOAuthListenerOwner<ReturnType<typeof createServer>>()
const pendingOAuth = new ManagedOAuthCallbackOwner<{ state: string }, CallbackResult>()

export const GitlabAuthTestHooks = {
  oauthPort: undefined as number | undefined,
  callbackTimeoutMs: undefined as number | undefined,
  openBrowser: undefined as ((url: string) => Promise<void>) | undefined,
  beforeListenerStop: undefined as (() => void | Promise<void>) | undefined,
  exchangeToken: undefined as
    | ((instanceUrl: string, input: Record<string, string>) => Promise<TokenResponse>)
    | undefined,
}

function normalizeInstanceUrl(value?: string): string {
  const raw = value?.trim() || process.env.GITLAB_INSTANCE_URL || DEFAULT_INSTANCE_URL
  const url = new URL(raw)
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("GitLab instance URL must use HTTP(S)")
  return `${url.protocol}//${url.host}`
}

function validateInstanceUrl(value: string): string | undefined {
  try {
    normalizeInstanceUrl(value)
    return
  } catch {
    return "Enter a valid HTTP(S) URL, for example https://gitlab.com"
  }
}

function pkce() {
  const verifier = crypto.randomBytes(32).toString("base64url")
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url")
  return { verifier, challenge }
}

function randomState(): string {
  return crypto.randomBytes(32).toString("base64url")
}

async function exchangeToken(instanceUrl: string, input: Record<string, string>) {
  if (GitlabAuthTestHooks.exchangeToken) return GitlabAuthTestHooks.exchangeToken(instanceUrl, input)
  const response = await fetch(`${instanceUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: CLIENT_ID, ...input }).toString(),
  })
  if (!response.ok) throw new Error(`GitLab token exchange failed with HTTP ${response.status}`)
  return TokenResponse.parse(await response.json())
}

function callbackUri(server: ReturnType<typeof createServer>): string {
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("GitLab OAuth callback listener has no TCP address")
  return `http://127.0.0.1:${address.port}${OAUTH_CALLBACK_PATH}`
}

async function startCallbackServer(): Promise<{ lease: object; redirectUri: string }> {
  const server = await oauthServer.start(
    () =>
      createServer((request, response) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1")
        if (request.method !== "GET" || url.pathname !== OAUTH_CALLBACK_PATH) {
          response.writeHead(404)
          response.end("Not found")
          return
        }
        const current = pendingOAuth.current
        const code = url.searchParams.get("code")
        const state = url.searchParams.get("state")
        if (!current || !code || !state || state !== current.context.state) {
          response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" })
          response.end("<!doctype html><title>Authorization failed</title><h1>Authorization failed</h1>")
          return
        }
        const owner = pendingOAuth.claim()
        if (!owner) {
          response.writeHead(409)
          response.end("Authorization callback already processing")
          return
        }
        owner.resolve({ code, state })
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        response.end("<!doctype html><title>Authorization complete</title><h1>Authorization complete</h1>")
      }),
    (server, ready) => server.listen(GitlabAuthTestHooks.oauthPort ?? 8080, "127.0.0.1", ready),
  )
  return { lease: oauthServer.acquire(), redirectUri: callbackUri(server) }
}

function waitForCallback(state: string, lease: object): OAuthCallbackLease<CallbackResult> {
  return pendingOAuth.begin(
    { state },
    {
      timeoutMs: GitlabAuthTestHooks.callbackTimeoutMs ?? 2 * 60 * 1000,
      supersededError: () => new Error("Superseded by a newer GitLab authorization"),
      timeoutError: () => new Error("GitLab OAuth callback timed out"),
      onTimeout: () => oauthServer.stop(lease),
    },
  )
}

async function openBrowser(url: string): Promise<void> {
  if (GitlabAuthTestHooks.openBrowser) return GitlabAuthTestHooks.openBrowser(url)
  await open(url).then(() => undefined)
}

export async function GitlabAuthPlugin(input: PluginInput): Promise<Hooks> {
  return {
    auth: {
      provider: "gitlab",
      async loader(getAuth) {
        const current = await getAuth()
        if (!current) return {}
        if (current.type === "oauth") {
          const instanceUrl = normalizeInstanceUrl(current.enterpriseUrl)
          const credential =
            current.expires > Date.now() + OAUTH_EXPIRY_BUFFER_MS
              ? current
              : await input.credentials.refresh({
                  providerID: "gitlab",
                  current,
                  exchange: async () => {
                    const tokens = await exchangeToken(instanceUrl, {
                      refresh_token: current.refresh,
                      grant_type: "refresh_token",
                    })
                    return {
                      type: "oauth",
                      access: tokens.access_token,
                      refresh: tokens.refresh_token,
                      expires: Date.now() + tokens.expires_in * 1000,
                      enterpriseUrl: instanceUrl,
                    }
                  },
                })
          return { apiKey: credential.access, instanceUrl, clientId: CLIENT_ID }
        }
        if (current.type !== "api") return {}
        const instanceUrl = normalizeInstanceUrl(current.metadata?.instanceUrl)
        return { apiKey: current.key, instanceUrl }
      },
      methods: [
        {
          type: "oauth",
          label: "GitLab OAuth",
          prompts: [
            {
              type: "text",
              key: "instanceUrl",
              message: "GitLab instance URL",
              placeholder: process.env.GITLAB_INSTANCE_URL || DEFAULT_INSTANCE_URL,
              validate: validateInstanceUrl,
            },
          ],
          async authorize(inputs = {}) {
            const instanceUrl = normalizeInstanceUrl(inputs.instanceUrl)
            const codes = pkce()
            const state = randomState()
            const { lease, redirectUri } = await startCallbackServer()
            const callback = waitForCallback(state, lease)
            const url = `${instanceUrl}/oauth/authorize?${new URLSearchParams({
              client_id: CLIENT_ID,
              redirect_uri: redirectUri,
              response_type: "code",
              state,
              scope: OAUTH_SCOPES,
              code_challenge: codes.challenge,
              code_challenge_method: "S256",
            }).toString()}`
            await openBrowser(url).catch(() => undefined)
            return {
              method: "auto" as const,
              url,
              instructions: "Complete authorization in your browser.",
              dispose: async () => {
                callback.reject(new Error("GitLab OAuth authorization disposed"))
                await callback.promise.catch(() => undefined)
                await GitlabAuthTestHooks.beforeListenerStop?.()
                await oauthServer.stop(lease)
              },
              async callback() {
                const result = await callback.promise
                const tokens = await exchangeToken(instanceUrl, {
                  code: result.code,
                  grant_type: "authorization_code",
                  redirect_uri: redirectUri,
                  code_verifier: codes.verifier,
                })
                return {
                  type: "success" as const,
                  access: tokens.access_token,
                  refresh: tokens.refresh_token,
                  expires: Date.now() + tokens.expires_in * 1000,
                  enterpriseUrl: instanceUrl,
                }
              },
            }
          },
        },
        {
          type: "api",
          label: "GitLab Personal Access Token",
          prompts: [
            {
              type: "text",
              key: "instanceUrl",
              message: "GitLab instance URL",
              placeholder: process.env.GITLAB_INSTANCE_URL || DEFAULT_INSTANCE_URL,
              validate: validateInstanceUrl,
            },
          ],
          async authorize(inputs = {}) {
            const key = inputs.key
            if (!key) return { type: "failed" as const }
            const instanceUrl = normalizeInstanceUrl(inputs.instanceUrl)
            const response = await fetch(`${instanceUrl}/api/v4/user`, {
              headers: { Authorization: `Bearer ${key}` },
            })
            if (!response.ok) return { type: "failed" as const }
            return { type: "success" as const, key, metadata: { instanceUrl } }
          },
        },
      ],
    },
  }
}
