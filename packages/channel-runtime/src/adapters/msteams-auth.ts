import { decodeProtectedHeader, importJWK, jwtVerify, type JWK, type JWTPayload } from "jose"

const BOT_CONNECTOR_ISSUER = "https://api.botframework.com"
const BOT_CONNECTOR_OPENID_METADATA = "https://login.botframework.com/v1/.well-known/openidconfiguration"
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CLOCK_SKEW_SECONDS = 5 * 60

type Activity = {
  serviceUrl?: string
  channelId?: string
}

type Header = {
  alg?: string
  kid?: string
  x5t?: string
}

type Metadata = {
  issuer?: string
  jwks_uri?: string
}

type Key = JWK & {
  kid?: string
  x5t?: string
  endorsements?: string[]
}

type Cached<T> = {
  value: T
  expires: number
}

function bearer(req: Request) {
  const raw = req.headers.get("authorization")
  const match = raw?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]
}

export class MSTeamsActivityAuth {
  private appId: string
  private fetchFn: typeof fetch
  private now: () => number
  private metadataURL: string
  private metadata?: Cached<Metadata>
  private keys?: Cached<Key[]>

  constructor(opts: { appId: string; fetch?: typeof fetch; now?: () => number; metadataURL?: string }) {
    this.appId = opts.appId
    this.fetchFn = opts.fetch ?? fetch
    this.now = opts.now ?? Date.now
    this.metadataURL = opts.metadataURL ?? BOT_CONNECTOR_OPENID_METADATA
  }

  async verify(req: Request, activity: Activity): Promise<boolean> {
    try {
      const token = bearer(req)
      if (!token) return false

      const header = decodeProtectedHeader(token) as Header
      if (header.alg !== "RS256") return false
      const keyID = header.kid ?? header.x5t
      if (!keyID) return false

      const metadata = await this.openIDMetadata()
      if (metadata.issuer !== BOT_CONNECTOR_ISSUER) return false

      const keys = await this.signingKeys(metadata)
      const key = keys.find((item) => item.kid === keyID || item.x5t === keyID)
      if (!key) return false
      if (activity.channelId !== "msteams") return false
      if (!key.endorsements?.includes("msteams")) return false

      const imported = await importJWK(key, "RS256")
      const verified = await jwtVerify(token, imported, {
        issuer: BOT_CONNECTOR_ISSUER,
        audience: this.appId,
        algorithms: ["RS256"],
        clockTolerance: CLOCK_SKEW_SECONDS,
        currentDate: new Date(this.now()),
      })
      return this.claimsMatch(verified.payload, activity)
    } catch {
      return false
    }
  }

  private claimsMatch(payload: JWTPayload, activity: Activity) {
    if (typeof payload.iat !== "number") return false
    if (!activity.serviceUrl) return false
    return payload.serviceUrl === activity.serviceUrl
  }

  private async openIDMetadata() {
    if (this.metadata && this.metadata.expires > this.now()) return this.metadata.value
    const res = await this.fetchFn(this.metadataURL, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`MS Teams OpenID metadata failed: ${res.status}`)
    const value = (await res.json()) as Metadata
    if (!value.jwks_uri || !value.issuer) throw new Error("MS Teams OpenID metadata is invalid")
    this.metadata = { value, expires: this.now() + CACHE_TTL_MS }
    this.keys = undefined
    return value
  }

  private async signingKeys(metadata: Metadata) {
    if (this.keys && this.keys.expires > this.now()) return this.keys.value
    if (!metadata.jwks_uri) throw new Error("MS Teams JWKS URI is missing")
    const res = await this.fetchFn(metadata.jwks_uri, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`MS Teams JWKS failed: ${res.status}`)
    const body = (await res.json()) as { keys?: Key[] }
    if (!body.keys || body.keys.length === 0) throw new Error("MS Teams JWKS is empty")
    this.keys = { value: body.keys, expires: this.now() + CACHE_TTL_MS }
    return body.keys
  }
}
