import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"
import type {
  OAuthClientMetadata,
  OAuthTokens,
  OAuthClientInformation,
  OAuthClientInformationFull,
} from "@modelcontextprotocol/sdk/shared/auth.js"
import { McpAuth } from "./auth"
import { oauthAuthorizationLogFields } from "./oauth-log"
import { Log } from "../util/log"

const log = Log.create({ service: "mcp.oauth" })

const OAUTH_CALLBACK_PORT = 19876
const OAUTH_CALLBACK_PATH = "/mcp/oauth/callback"

export interface McpOAuthConfig {
  clientId?: string
  clientSecret?: string
  scope?: string
}

export interface McpOAuthCallbacks {
  onRedirect: (url: URL) => void | Promise<void>
}

export class McpOAuthProvider implements OAuthClientProvider {
  static credentialIdentity(serverUrl: string, config: McpOAuthConfig): string {
    return JSON.stringify({
      serverUrl,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      scope: config.scope,
    })
  }

  private credentialIdentity() {
    return McpOAuthProvider.credentialIdentity(this.serverUrl, this.config)
  }

  constructor(
    private mcpName: string,
    private authKey: string,
    private serverUrl: string,
    private config: McpOAuthConfig,
    private callbacks: McpOAuthCallbacks,
    /**
     * The lease this provider writes under. `undefined` for a connection over
     * a credential no flow has ever leased — its refresh writes are unfenced,
     * exactly as they were before leases existed, because a connection must
     * not revoke a flow to read.
     */
    private authRevision: McpAuth.Revision | undefined,
    private assertCurrent?: () => Promise<void>,
    private ownedOAuthState?: string,
    private correlationID: string = crypto.randomUUID(),
  ) {}

  get redirectUrl(): string {
    return `http://127.0.0.1:${OAUTH_CALLBACK_PORT}${OAUTH_CALLBACK_PATH}`
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
    // Check config first (pre-registered client)
    if (this.config.clientId) {
      return {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }
    }

    // Check stored client info (from dynamic registration)
    // Use getForUrl to validate credentials are for the current server URL
    const entry = await McpAuth.getForUrl(this.authKey, this.serverUrl, this.credentialIdentity())
    if (entry?.clientInfo) {
      // Check if client secret has expired
      if (entry.clientInfo.clientSecretExpiresAt && entry.clientInfo.clientSecretExpiresAt < Date.now() / 1000) {
        log.info("client secret expired, need to re-register", { mcpName: this.mcpName })
        return undefined
      }
      return {
        client_id: entry.clientInfo.clientId,
        client_secret: entry.clientInfo.clientSecret,
      }
    }

    // No client info or URL changed - will trigger dynamic registration
    return undefined
  }

  async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
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
    )
    log.info("saved dynamically registered client", {
      mcpName: this.mcpName,
      clientId: info.client_id,
    })
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    // Use getForUrl to validate tokens are for the current server URL
    const entry = await McpAuth.getForUrl(this.authKey, this.serverUrl, this.credentialIdentity())
    if (!entry?.tokens) return undefined

    return {
      access_token: entry.tokens.accessToken,
      token_type: "Bearer",
      refresh_token: entry.tokens.refreshToken,
      expires_in: entry.tokens.expiresAt
        ? Math.max(0, Math.floor(entry.tokens.expiresAt - Date.now() / 1000))
        : undefined,
      scope: entry.tokens.scope,
    }
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.assertCurrent?.()
    await McpAuth.updateTokens(
      this.authKey,
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_in ? Date.now() / 1000 + tokens.expires_in : undefined,
        scope: tokens.scope,
      },
      this.serverUrl,
      this.authRevision,
      this.credentialIdentity(),
    )
    log.info("saved oauth tokens", { mcpName: this.mcpName })
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    log.info("redirecting to authorization", oauthAuthorizationLogFields({
      mcpName: this.mcpName,
      authorizationUrl,
      correlationID: this.correlationID,
    }))
    await this.callbacks.onRedirect(authorizationUrl)
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.assertCurrent?.()
    await McpAuth.updateCodeVerifier(this.authKey, codeVerifier, this.authRevision)
  }

  async codeVerifier(): Promise<string> {
    const entry = await McpAuth.get(this.authKey)
    if (!entry?.codeVerifier) {
      throw new Error(`No code verifier saved for MCP server: ${this.mcpName}`)
    }
    return entry.codeVerifier
  }

  async saveState(state: string): Promise<void> {
    await this.assertCurrent?.()
    await McpAuth.updateOAuthState(
      this.authKey,
      state,
      this.authRevision,
      this.serverUrl,
      this.credentialIdentity(),
    )
  }

  async state(): Promise<string> {
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
    log.info("invalidating credentials", { mcpName: this.mcpName, type })
    const entry = await McpAuth.get(this.authKey)
    if (!entry) {
      return
    }

    switch (type) {
      case "all":
        await McpAuth.set(
          this.authKey,
          {},
          this.serverUrl,
          this.authRevision,
          this.credentialIdentity(),
        )
        break
      case "client":
        delete entry.clientInfo
        await McpAuth.set(
          this.authKey,
          entry,
          this.serverUrl,
          this.authRevision,
          this.credentialIdentity(),
        )
        break
      case "tokens":
        delete entry.tokens
        await McpAuth.set(
          this.authKey,
          entry,
          this.serverUrl,
          this.authRevision,
          this.credentialIdentity(),
        )
        break
    }
  }
}

export { OAUTH_CALLBACK_PORT, OAUTH_CALLBACK_PATH }
