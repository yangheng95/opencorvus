import path from "path"
import z from "zod"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { withKeyedLock } from "../util/lock"

export namespace McpAuth {
  export const Tokens = z.object({
    accessToken: z.string(),
    refreshToken: z.string().optional(),
    expiresAt: z.number().optional(),
    scope: z.string().optional(),
  })
  export type Tokens = z.infer<typeof Tokens>

  export const ClientInfo = z.object({
    clientId: z.string(),
    clientSecret: z.string().optional(),
    clientIdIssuedAt: z.number().optional(),
    clientSecretExpiresAt: z.number().optional(),
  })
  export type ClientInfo = z.infer<typeof ClientInfo>

  export const StaticCredential = z.object({
    secret: z.string().min(1),
  })
  export type StaticCredential = z.infer<typeof StaticCredential>

  export const Entry = z.object({
    tokens: Tokens.optional(),
    clientInfo: ClientInfo.optional(),
    staticCredential: StaticCredential.optional(),
    codeVerifier: z.string().optional(),
    oauthState: z.string().optional(),
    serverUrl: z.string().optional(), // Track the URL these credentials are for
    credentialIdentity: z.string().optional(),
  })
  export type Entry = z.infer<typeof Entry>

  const filepath = path.join(Global.Path.data, "mcp-auth.json")
  const Store = z.record(z.string(), Entry)
  const storeLocks = new Map<string, Promise<unknown>>()
  const revisions = new Map<string, number>()

  export type Revision = number

  export function revision(authKey: string): Revision {
    return revisions.get(authKey) ?? 0
  }

  function assertRevision(authKey: string, expected?: Revision) {
    if (expected !== undefined && revision(authKey) !== expected) {
      throw new Error(`MCP auth lease was revoked: ${authKey}`)
    }
  }

  export function scopedKey(input: { projectID: string; mcpName: string }): string {
    const projectID = input.projectID.trim()
    const mcpName = input.mcpName.trim()
    if (!projectID) throw new Error("MCP auth scoped key requires a projectID")
    if (!mcpName) throw new Error("MCP auth scoped key requires an mcpName")
    return `${projectID}:${mcpName}`
  }

  function isMissingAuthFileError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      ((error as { code?: unknown }).code === "ENOENT" || (error as { code?: unknown }).code === "ENOTDIR")
    )
  }

  export async function get(authKey: string): Promise<Entry | undefined> {
    const data = await all()
    return data[authKey]
  }

  /**
   * Get auth entry and validate it's for the correct URL.
   * Returns undefined if URL has changed (credentials are invalid).
   */
  export async function getForUrl(
    authKey: string,
    serverUrl: string,
    credentialIdentity?: string,
  ): Promise<Entry | undefined> {
    const entry = await get(authKey)
    if (!entry) return undefined

    // If no serverUrl is stored, this is from an old version - consider it invalid
    if (!entry.serverUrl) return undefined

    // If URL has changed, credentials are invalid
    if (entry.serverUrl !== serverUrl) return undefined
    if (credentialIdentity && entry.credentialIdentity !== credentialIdentity) {
      return undefined
    }

    return entry
  }

  export async function all(): Promise<Record<string, Entry>> {
    try {
      return Store.parse(await Filesystem.readJson<unknown>(filepath))
    } catch (error) {
      if (isMissingAuthFileError(error)) return {}
      throw error
    }
  }

  async function updateStore(
    authKey: string,
    update: (entry: Entry | undefined) => Entry | undefined,
    expectedRevision?: Revision,
  ) {
    await withKeyedLock(storeLocks, filepath, async () => {
      assertRevision(authKey, expectedRevision)
      const data = await all()
      const next = update(data[authKey] ? structuredClone(data[authKey]) : undefined)
      if (next) data[authKey] = Entry.parse(next)
      else delete data[authKey]
      await Filesystem.writeAtomic(filepath, JSON.stringify(data, null, 2), 0o600)
    })
  }

  export async function set(
    authKey: string,
    entry: Entry,
    serverUrl?: string,
    expectedRevision?: Revision,
    credentialIdentity?: string,
  ): Promise<void> {
    await updateStore(
      authKey,
      () => ({
        ...structuredClone(entry),
        ...(serverUrl ? { serverUrl } : {}),
        ...(credentialIdentity ? { credentialIdentity } : {}),
      }),
      expectedRevision,
    )
  }

  export async function setStaticCredential(
    authKey: string,
    secret: string,
    serverUrl: string,
    credentialIdentity: string,
  ): Promise<void> {
    await set(
      authKey,
      {
        staticCredential: StaticCredential.parse({ secret }),
      },
      serverUrl,
      undefined,
      credentialIdentity,
    )
  }

  export async function remove(authKey: string): Promise<void> {
    await removeMany([authKey])
  }

  export async function removeMany(authKeys: readonly string[]): Promise<void> {
    const keys = [...new Set(authKeys)]
    await withKeyedLock(storeLocks, filepath, async () => {
      const data = await all()
      for (const authKey of keys) delete data[authKey]
      await Filesystem.writeAtomic(filepath, JSON.stringify(data, null, 2), 0o600)
      for (const authKey of keys) revisions.set(authKey, revision(authKey) + 1)
    })
  }

  export function invalidate(authKey: string): void {
    revisions.set(authKey, revision(authKey) + 1)
  }

  export async function updateTokens(
    authKey: string,
    tokens: Tokens,
    serverUrl?: string,
    expectedRevision?: Revision,
    credentialIdentity?: string,
  ): Promise<void> {
    await updateStore(
      authKey,
      (entry) => ({
        ...(entry ? { ...entry, staticCredential: undefined } : {}),
        tokens,
        ...(serverUrl ? { serverUrl } : {}),
        ...(credentialIdentity ? { credentialIdentity } : {}),
      }),
      expectedRevision,
    )
  }

  export async function updateClientInfo(
    authKey: string,
    clientInfo: ClientInfo,
    serverUrl?: string,
    expectedRevision?: Revision,
    credentialIdentity?: string,
  ): Promise<void> {
    await updateStore(
      authKey,
      (entry) => ({
        ...(entry ? { ...entry, staticCredential: undefined } : {}),
        clientInfo,
        ...(serverUrl ? { serverUrl } : {}),
        ...(credentialIdentity ? { credentialIdentity } : {}),
      }),
      expectedRevision,
    )
  }

  export async function updateCodeVerifier(
    authKey: string,
    codeVerifier: string,
    expectedRevision?: Revision,
  ): Promise<void> {
    await updateStore(
      authKey,
      (entry) => ({ ...(entry ? { ...entry, staticCredential: undefined } : {}), codeVerifier }),
      expectedRevision,
    )
  }

  export async function clearCodeVerifier(authKey: string, expectedRevision?: Revision): Promise<void> {
    await updateStore(
      authKey,
      (entry) => {
        if (!entry) return
        delete entry.codeVerifier
        return entry
      },
      expectedRevision,
    )
  }

  export async function updateOAuthState(
    authKey: string,
    oauthState: string,
    expectedRevision?: Revision,
    serverUrl?: string,
    credentialIdentity?: string,
  ): Promise<void> {
    await updateStore(
      authKey,
      (entry) => ({
        ...(entry ? { ...entry, staticCredential: undefined } : {}),
        oauthState,
        ...(serverUrl ? { serverUrl } : {}),
        ...(credentialIdentity ? { credentialIdentity } : {}),
      }),
      expectedRevision,
    )
  }

  export async function getOAuthState(authKey: string): Promise<string | undefined> {
    const entry = await get(authKey)
    return entry?.oauthState
  }

  export async function clearOAuthState(authKey: string, expectedRevision?: Revision): Promise<void> {
    await updateStore(
      authKey,
      (entry) => {
        if (!entry) return
        delete entry.oauthState
        return entry
      },
      expectedRevision,
    )
  }

  export async function clearOAuthStateIfOwned(authKey: string, expectedRevision: Revision): Promise<boolean> {
    if (revision(authKey) !== expectedRevision) return false
    try {
      await clearOAuthState(authKey, expectedRevision)
      return true
    } catch (error) {
      if (revision(authKey) !== expectedRevision) return false
      throw error
    }
  }

  /**
   * Check if stored tokens are expired.
   * Returns null if no tokens exist, false if no expiry or not expired, true if expired.
   */
  export async function isTokenExpired(authKey: string): Promise<boolean | null> {
    const entry = await get(authKey)
    if (!entry?.tokens) return null
    if (!entry.tokens.expiresAt) return false
    return entry.tokens.expiresAt < Date.now() / 1000
  }
}
