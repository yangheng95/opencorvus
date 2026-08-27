import { UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"
import type {
  OAuthClientMetadata,
  OAuthTokens,
  OAuthClientInformation,
  OAuthClientInformationFull,
} from "@modelcontextprotocol/sdk/shared/auth.js"
import { McpAuth } from "./auth"
import { oauthAuthorizationLogFields } from "./oauth-log"
import { Log } from "../util/log"
import z from "zod/v4"

const log = Log.create({ service: "mcp.oauth" })

const OAUTH_CALLBACK_PATH = "/mcp/oauth/callback"
const CONNECTION_AUTHORIZATION_DISABLED_REDIRECT = "opencorvus://oauth-authorization-disabled"

export interface McpOAuthConfig {
  clientId?: string
  clientSecret?: string
  scope?: string
}

export interface McpOAuthCallbacks {
  onRedirect: (url: URL) => void | Promise<void>
}

export interface McpOAuthCallbackBinding {
  redirectUrl: string
  generation: string
}

export type McpOAuthProviderMode = "connection" | "authorization"

export class McpOAuthTokenCommitUncertainError extends Error {
  constructor(authKey: string, cause: unknown) {
    super(`MCP OAuth token commit outcome is uncertain: ${authKey}`, { cause })
    this.name = "McpOAuthTokenCommitUncertainError"
  }
}

const McpOAuthCredentialIdentity = z
  .object({
    serverUrl: z.string(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
    scope: z.string().optional(),
  })
  .strict()

export class McpOAuthProvider implements OAuthClientProvider {
  private clientSnapshotRead = false
  private clientInfoSnapshot: McpAuth.ClientInfo | undefined
  private tokenClientInfoSnapshot: McpAuth.ClientInfo | undefined
  private tokenSnapshotRead = false
  private tokenSnapshot: McpAuth.Tokens | undefined
  private storedTokensDisclosed = false

  usedStoredTokens(): boolean {
    return this.storedTokensDisclosed
  }

  private captureCredentialSnapshot(entry: McpAuth.Entry | undefined): void {
    this.clientSnapshotRead = true
    this.clientInfoSnapshot = entry?.clientInfo ? McpAuth.ClientInfo.parse(entry.clientInfo) : undefined
    this.tokenClientInfoSnapshot = entry?.tokenClientInfo ? McpAuth.ClientInfo.parse(entry.tokenClientInfo) : undefined
    this.tokenSnapshot = entry?.tokens ? McpAuth.Tokens.parse(entry.tokens) : undefined
  }

  private async authorizationEntry(): Promise<McpAuth.Entry> {
    await this.assertCurrent?.()
    const entry = await McpAuth.get(this.authKey)
    const finishing = entry?.oauthFinishing
    const ownsFinishing =
      this.finishingOwnerID !== undefined &&
      this.ownedOAuthState !== undefined &&
      finishing?.ownerID === this.finishingOwnerID &&
      finishing.oauthState === this.ownedOAuthState &&
      finishing.leaseExpiresAt > Date.now()
    const ownsPending =
      this.finishingOwnerID === undefined &&
      (this.ownedOAuthState === undefined || entry?.oauthState === this.ownedOAuthState)
    if (!entry || entry.revision !== this.authRevision || (!ownsFinishing && !ownsPending)) {
      throw new Error(`MCP OAuth authorization occurrence is no longer current: ${this.authKey}`)
    }
    return entry
  }

  static credentialIdentity(serverUrl: string, config: McpOAuthConfig): string {
    return JSON.stringify({
      serverUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      scope: config.scope,
    })
  }

  static parseCredentialIdentity(identity: string): { serverUrl: string; config: McpOAuthConfig } {
    const parsed = McpOAuthCredentialIdentity.parse(JSON.parse(identity))
    return {
      serverUrl: parsed.serverUrl,
      config: {
        clientId: parsed.clientId,
        clientSecret: parsed.clientSecret,
        scope: parsed.scope,
      },
    }
  }

  private credentialIdentity() {
    return McpOAuthProvider.credentialIdentity(this.serverUrl, this.config)
  }

  constructor(
    private mcpName: string,
    private authKey: string,
    private serverUrl: string,
    private config: McpOAuthConfig,
    private mode: McpOAuthProviderMode,
    private callbackBinding: McpOAuthCallbackBinding | undefined,
    private callbacks: McpOAuthCallbacks,
    /**
     * The durable revision every production provider admission captures.
     * Connections initialize an upgrade-era or absent entry through
     * `ensureRevision`; authorization flows establish their own revision.
     */
    private authRevision: McpAuth.Revision,
    private assertCurrent?: () => Promise<void>,
    private ownedOAuthState?: string,
    private correlationID: string = crypto.randomUUID(),
    private finishingOwnerID?: string,
  ) {}

  private requireAuthorizationAuthority(): void {
    if (this.mode === "connection") {
      throw new UnauthorizedError("Interactive MCP OAuth authorization is required")
    }
  }

  private requireCallbackBinding(): McpOAuthCallbackBinding {
    if (!this.callbackBinding) throw new Error("MCP OAuth authorization callback binding is unavailable")
    return this.callbackBinding
  }

  get redirectUrl(): string {
    return this.callbackBinding?.redirectUrl ?? CONNECTION_AUTHORIZATION_DISABLED_REDIRECT
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      client_name: "OpenCorvus",
      client_uri: "https://opencorvus.ai",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: this.config.clientSecret ? "client_secret_post" : "none",
    }
  }

  async clientInformation(): Promise<OAuthClientInformation | undefined> {
    // Capture the exact store inputs this SDK attempt selected. A rejected
    // refresh is not allowed to invalidate a newer callback's client/token
    // set merely because both providers still hold the same flow revision.
    const entry =
      this.mode === "authorization"
        ? await this.authorizationEntry()
        : await McpAuth.getForUrl(this.authKey, this.serverUrl, this.credentialIdentity())
    this.captureCredentialSnapshot(entry)

    // Check config first (pre-registered client)
    if (this.config.clientId) {
      return {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }
    }

    // Check stored client info (from dynamic registration)
    // Use getForUrl to validate credentials are for the current server URL
    const useTokenClient = this.mode === "connection" && entry?.tokens
    const clientInfo = useTokenClient ? (entry.tokenClientInfo ?? entry.clientInfo) : entry?.clientInfo
    const callbackBinding = this.callbackBinding
    const clientBindingIsCurrent = useTokenClient
      ? true
      : callbackBinding !== undefined &&
        entry?.clientCallbackGeneration === callbackBinding.generation &&
        entry.clientCallbackRedirectUrl === callbackBinding.redirectUrl
    if (clientInfo && clientBindingIsCurrent) {
      // Check if client secret has expired
      if (clientInfo.clientSecretExpiresAt && clientInfo.clientSecretExpiresAt < Date.now() / 1000) {
        log.info("client secret expired, need to re-register", { mcpName: this.mcpName })
        this.requireAuthorizationAuthority()
        return undefined
      }
      return {
        client_id: clientInfo.clientId,
        client_secret: clientInfo.clientSecret,
      }
    }

    // No client info or URL changed - will trigger dynamic registration
    this.requireAuthorizationAuthority()
    return undefined
  }

  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
    this.requireAuthorizationAuthority()
    const callbackBinding = this.requireCallbackBinding()
    await this.assertCurrent?.()
    await McpAuth.updateClientInfo(
      this.authKey,
      {
        clientId: info.client_id,
        clientSecret: info.client_secret,
        clientIdIssuedAt: info.client_id_issued_at,
        clientSecretExpiresAt: info.client_secret_expires_at,
      },
      this.serverUrl,
      this.authRevision,
      this.credentialIdentity(),
      callbackBinding.generation,
      callbackBinding.redirectUrl,
    )
    log.info("saved dynamically registered client", {
      mcpName: this.mcpName,
      clientIdPresent: true,
    })
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    // Authorization owns a new callback-bound occurrence. Existing tokens and
    // their older token-bound client belong only to connection preflight; they
    // must never influence a new authorization URL or code exchange.
    if (this.mode === "authorization") return undefined
    // `clientInformation()` and `tokens()` are two SDK awaits but one refresh
    // input. If the SDK asks for tokens directly, capture the same complete
    // store snapshot here; otherwise retain the snapshot clientInformation
    // already returned instead of mixing facts from two generations.
    const current = await McpAuth.getForUrl(this.authKey, this.serverUrl, this.credentialIdentity())
    if (!this.clientSnapshotRead) {
      this.captureCredentialSnapshot(current)
    } else {
      const capturedClient = this.tokenClientInfoSnapshot ?? this.clientInfoSnapshot
      const currentClient = current?.tokens ? (current.tokenClientInfo ?? current.clientInfo) : current?.clientInfo
      if (
        current?.revision !== this.authRevision ||
        JSON.stringify(current?.tokens) !== JSON.stringify(this.tokenSnapshot) ||
        JSON.stringify(currentClient) !== JSON.stringify(capturedClient)
      ) {
        throw new UnauthorizedError("MCP OAuth credential snapshot changed; retry connection")
      }
    }
    this.tokenSnapshotRead = true
    if (!this.tokenSnapshot) return undefined
    // This is the final local fence before the SDK may disclose a refresh
    // token/client pair to the remote endpoint. The revision protects against
    // same-value credential generations; assertCurrent protects the canonical
    // Project MCP definition independently of auth-store reconciliation.
    if (current?.revision !== this.authRevision) {
      throw new UnauthorizedError("MCP OAuth credential snapshot changed; retry connection")
    }
    await this.assertCurrent?.()
    this.storedTokensDisclosed = true

    return {
      access_token: this.tokenSnapshot.accessToken,
      token_type: "Bearer",
      refresh_token: this.tokenSnapshot.refreshToken,
      expires_in: this.tokenSnapshot.expiresAt
        ? Math.max(0, Math.floor(this.tokenSnapshot.expiresAt - Date.now() / 1000))
        : undefined,
      scope: this.tokenSnapshot.scope,
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    if (this.mode === "connection" && (!this.tokenSnapshotRead || !this.tokenSnapshot)) {
      throw new UnauthorizedError("Interactive MCP OAuth authorization is required before saving tokens")
    }
    await this.assertCurrent?.()
    const committedTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_in ? Date.now() / 1000 + tokens.expires_in : undefined,
      scope: tokens.scope,
    }
    try {
      await McpAuth.updateTokens(
        this.authKey,
        committedTokens,
        this.serverUrl,
        this.authRevision,
        this.credentialIdentity(),
        this.finishingOwnerID && this.ownedOAuthState
          ? { oauthState: this.ownedOAuthState, ownerID: this.finishingOwnerID }
          : undefined,
        this.mode === "connection" && this.tokenSnapshot
          ? {
              tokens: this.tokenSnapshot,
              clientInfo: this.tokenClientInfoSnapshot ?? this.clientInfoSnapshot,
            }
          : undefined,
      )
    } catch (error) {
      if (this.finishingOwnerID && this.ownedOAuthState) {
        throw new McpOAuthTokenCommitUncertainError(this.authKey, error)
      }
      throw error
    }
    this.tokenSnapshot = committedTokens
    log.info("saved oauth tokens", { mcpName: this.mcpName })
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    this.requireAuthorizationAuthority()
    log.info(
      "redirecting to authorization",
      oauthAuthorizationLogFields({
        mcpName: this.mcpName,
        authorizationUrl,
        correlationID: this.correlationID,
      }),
    )
    await this.callbacks.onRedirect(authorizationUrl)
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    this.requireAuthorizationAuthority()
    await this.assertCurrent?.()
    await McpAuth.updateCodeVerifier(this.authKey, codeVerifier, this.authRevision)
  }

  async codeVerifier(): Promise<string> {
    this.requireAuthorizationAuthority()
    const entry = await this.authorizationEntry()
    if (!entry?.codeVerifier) {
      throw new Error(`No code verifier saved for MCP server: ${this.mcpName}`)
    }
    return entry.codeVerifier
  }

  async saveState(state: string): Promise<void> {
    this.requireAuthorizationAuthority()
    const callbackBinding = this.requireCallbackBinding()
    await this.assertCurrent?.()
    await McpAuth.updateOAuthState(
      this.authKey,
      state,
      this.authRevision,
      this.serverUrl,
      this.credentialIdentity(),
      callbackBinding.generation,
      callbackBinding.redirectUrl,
    )
  }

  async state(): Promise<string> {
    this.requireAuthorizationAuthority()
    if (this.ownedOAuthState !== undefined) {
      if (this.authRevision !== undefined && (await McpAuth.revision(this.authKey)) !== this.authRevision) {
        throw new Error(`MCP auth lease was revoked: ${this.authKey}`)
      }
      return this.ownedOAuthState
    }
    const entry = await McpAuth.get(this.authKey)
    if (!entry?.oauthState) {
      throw new Error(`No OAuth state saved for MCP server: ${this.mcpName}`)
    }
    return entry.oauthState
  }

  async invalidateCredentials(type: "all" | "client" | "tokens"): Promise<void> {
    await this.assertCurrent?.()
    if (this.finishingOwnerID && this.ownedOAuthState) {
      throw new Error("MCP OAuth authorization-code exchange cannot retry credential invalidation")
    }
    if (
      this.mode === "connection" &&
      ((type !== "client" && (!this.tokenSnapshotRead || !this.tokenSnapshot)) ||
        (type !== "tokens" && !this.clientSnapshotRead))
    ) {
      throw new UnauthorizedError("Interactive MCP OAuth authorization is required before invalidating credentials")
    }
    log.info("invalidating credentials", { mcpName: this.mcpName, type })
    await McpAuth.invalidateCredentials(
      this.authKey,
      type,
      this.authRevision,
      this.mode === "connection"
        ? {
            tokens: this.tokenSnapshot,
            clientInfo: this.clientInfoSnapshot,
            tokenClientInfo: this.tokenClientInfoSnapshot,
          }
        : undefined,
    )
  }
}

export { OAUTH_CALLBACK_PATH }
