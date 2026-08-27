import path from "path"
import z from "zod"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { withSharedJsonFactLock } from "../util/process-lock"

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

  export interface CredentialSnapshot {
    tokens: Tokens | undefined
    clientInfo: ClientInfo | undefined
    tokenClientInfo: ClientInfo | undefined
  }

  export interface RefreshSnapshot {
    tokens: Tokens
    clientInfo: ClientInfo | undefined
  }

  export const StaticCredential = z.object({
    secret: z.string().min(1),
  })
  export type StaticCredential = z.infer<typeof StaticCredential>

  export const OAuthCallbackTerminal = z.object({
    outcome: z.enum([
      "connected",
      "provider_rejected",
      "missing_code",
      "failed",
      "broker_rotated",
      "superseded",
      "revoked",
      "exchange_uncertain",
    ]),
    completedAt: z.number().int().nonnegative(),
    /**
     * Non-secret callback broker generation that admitted this occurrence.
     * Retaining it on the tombstone lets the broker project an exact terminal
     * for HTTP duplicates after all spendable state and verifier material has
     * been destroyed.
     */
    callbackGeneration: z.string().min(1).optional(),
  })
  export type OAuthCallbackTerminal = z.infer<typeof OAuthCallbackTerminal>

  export function oauthCallbackTerminalMessage(outcome: Exclude<OAuthCallbackTerminal["outcome"], "connected">) {
    return {
      provider_rejected: "OAuth authorization was rejected by the provider",
      missing_code: "OAuth callback did not include an authorization code",
      failed: "MCP OAuth callback did not establish a connected server",
      broker_rotated: "MCP OAuth callback broker changed before authorization completed",
      superseded: "MCP OAuth authorization was superseded by a newer flow",
      revoked: "MCP OAuth authorization was revoked before completion",
      exchange_uncertain: "MCP OAuth exchange outcome is uncertain and cannot be replayed",
    }[outcome]
  }

  export const OAuthFinishingOccurrence = z.object({
    oauthState: z.string().min(1),
    ownerID: z.string().min(1),
    leaseExpiresAt: z.number().int().nonnegative(),
  })
  export type OAuthFinishingOccurrence = z.infer<typeof OAuthFinishingOccurrence>

  export const Entry = z.object({
    tokens: Tokens.optional(),
    clientInfo: ClientInfo.optional(),
    staticCredential: StaticCredential.optional(),
    /**
     * A configure's uncommitted secret. It is staged BEFORE the definition
     * commits — without destroying the active credential the previous
     * definition still serves — and settled by exactly one owner: the
     * configure call promotes it on success or drops it on failure, and
     * credential reconciliation promotes-or-drops it after a crash by
     * comparing its identity to the committed definition. Never served.
     */
    stagedStaticCredential: z
      .object({
        secret: z.string().min(1),
        serverUrl: z.string(),
        credentialIdentity: z.string(),
      })
      .optional(),
    codeVerifier: z.string().optional(),
    oauthState: z.string().optional(),
    oauthFinishing: OAuthFinishingOccurrence.optional(),
    oauthCallbackTerminals: z.record(z.string(), OAuthCallbackTerminal).optional(),
    /**
     * Data-root callback broker generation that owns dynamic client
     * registration and any still-open OAuth state. Tokens are deliberately
     * independent: rotating a local redirect URI must not discard a valid
     * credential already committed by the authorization server.
     */
    callbackGeneration: z.string().optional(),
    callbackRedirectUrl: z.string().url().optional(),
    clientCallbackGeneration: z.string().optional(),
    clientCallbackRedirectUrl: z.string().url().optional(),
    /**
     * Exact dynamic client used to mint the currently stored token set.
     * Broker rotation may retire `clientInfo` for future authorization, but a
     * refresh token remains bound to this client until the token set itself is
     * invalidated.
     */
    tokenClientInfo: ClientInfo.optional(),
    serverUrl: z.string().optional(), // Track the URL these credentials are for
    credentialIdentity: z.string().optional(),
    /**
     * Lease generation, durable in the store itself.
     *
     * A holder of a long-running OAuth flow establishes a lease once and
     * presents its generation with every write of that flow, so it must stay
     * stable across the flow's own writes — an OAuth exchange is several
     * store writes under one captured generation. `beginCredentialLease`,
     * explicit `invalidate`, and broker rotation of an unspent pending flow
     * mint; ordinary writes preserve. The empty generation
     * is never handed out as a lease, so a value captured before a removal
     * can never match anything after recreation. Keeping the generation in
     * the file rather than in memory is what makes a revoke performed by
     * another backend on the same data root visible here.
     */
    revision: z.string().optional(),
  })
  export type Entry = z.infer<typeof Entry>

  function filepath() {
    return path.join(Global.Path.data, "mcp-auth.json")
  }
  const Store = z.record(z.string(), Entry)
  const storeLocks = new Map<string, Promise<unknown>>()
  const CALLBACK_TERMINAL_RETENTION_MS = 24 * 60 * 60 * 1000
  const EXACT_MUTATION_ATTEMPTS = 3
  let afterProjectRemovalReadForTest: (() => Promise<void>) | undefined

  export type Revision = string

  /** The revision an absent or never-revoked entry reads as. */
  const INITIAL_REVISION: Revision = ""

  /**
   * The durable revocation generation for one credential.
   *
   * A key with no entry reads as the initial generation. Generations are
   * random, so a generation captured before a removal can never match one
   * minted after a later revoke.
   */
  export async function revision(authKey: string): Promise<Revision> {
    const data = await all()
    return data[authKey]?.revision ?? INITIAL_REVISION
  }

  /**
   * Ensure every OAuth provider admission captures a real durable revision.
   *
   * Upgrade-era token/client entries may predate revisions, and a completely
   * fresh connection may have no entry yet. Minting here is not a revoke and
   * does not clear or supersede any flow facts; it only gives every later
   * provider write a compare-and-swap owner. An explicit remove after this
   * admission can therefore never be undone by a stale refresh writer.
   */
  export async function ensureRevision(authKey: string, assertAdmission?: () => Promise<void>): Promise<Revision> {
    const candidate = crypto.randomUUID()
    let result: Revision | undefined
    try {
      await mutate(async () => {
        await assertAdmission?.()
        const data = await all()
        const current = data[authKey]
        if (current?.revision) {
          result = current.revision
          return
        }
        result = candidate
        data[authKey] = Entry.parse({ ...(current ?? {}), revision: candidate })
        await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
      })
    } catch (error) {
      const current = await get(authKey)
      if (current?.revision === candidate) return candidate
      throw error
    }
    if (!result) throw new Error(`MCP auth revision admission did not settle: ${authKey}`)
    return result
  }

  function assertRevisionInStore(data: Record<string, Entry>, authKey: string, expected?: Revision) {
    if (expected === undefined) return
    // The empty generation is the absence of a lease, never a lease. A caller
    // presenting it skipped `beginCredentialLease`, and admitting it is what
    // let a value captured before a removal write into a recreated credential.
    if (expected === INITIAL_REVISION) {
      throw new Error(`MCP auth write presented an unestablished lease: ${authKey}`)
    }
    if ((data[authKey]?.revision ?? INITIAL_REVISION) !== expected) {
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

  export function parseScopedKey(authKey: string): { projectID: string; mcpName: string } | undefined {
    const separator = authKey.indexOf(":")
    if (separator <= 0 || separator === authKey.length - 1) return undefined
    return { projectID: authKey.slice(0, separator), mcpName: authKey.slice(separator + 1) }
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
      return Store.parse(await Filesystem.readJson<unknown>(filepath()))
    } catch (error) {
      if (isMissingAuthFileError(error)) return {}
      throw error
    }
  }

  /**
   * Read, change and replace the MCP credential store under one cross-process
   * lock, for the same reason `Auth` does: a second backend on the same data
   * root would otherwise overwrite a credential it never read. The revision
   * compare-and-swap runs inside this lock against the counter stored in the
   * file, so a revoke performed by another backend is visible to it.
   */
  function mutate<T>(run: () => Promise<T>): Promise<T> {
    return withSharedJsonFactLock({ locks: storeLocks, filepath: filepath(), empty: "{}", mode: 0o600, run })
  }

  function sameFact(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right)
  }

  async function waitForExactMutationRetry(attempt: number): Promise<void> {
    if (attempt <= 0) return
    await new Promise<void>((resolve) => setTimeout(resolve, attempt * 10))
  }

  async function updateStore(
    authKey: string,
    update: (entry: Entry | undefined) => Entry | undefined,
    expectedRevision?: Revision,
    finishingAccess?: { oauthState: string; ownerID: string } | "expired" | "observe",
    assertAdmission?: () => Promise<void>,
  ) {
    await mutate(async () => {
      await assertAdmission?.()
      // The comparison, the change and the replacement are one read-modify-write
      // inside the cross-process lock. Comparing against a value read before
      // the lock is what let a revoke performed between the two be missed.
      const data = await all()
      assertRevisionInStore(data, authKey, expectedRevision)
      const current = data[authKey]
      if (current?.oauthFinishing && finishingAccess !== "observe") {
        const exactOwner =
          typeof finishingAccess === "object" &&
          finishingAccess.oauthState === current.oauthFinishing.oauthState &&
          finishingAccess.ownerID === current.oauthFinishing.ownerID &&
          current.oauthFinishing.leaseExpiresAt > Date.now()
        const expiredOwner = finishingAccess === "expired" && current.oauthFinishing.leaseExpiresAt <= Date.now()
        if (!exactOwner && !expiredOwner) {
          throw new Error(`MCP OAuth finishing occurrence is not current: ${authKey}`)
        }
      }
      const next = update(current ? structuredClone(current) : undefined)
      // A write preserves the generation: the holder's captured revision must
      // stay valid across every write of its own flow. `ensureRevision` only
      // initializes a missing generation; after that, only an explicit
      // revocation/removal owner mints a new one.
      if (next) data[authKey] = Entry.parse({ ...next, revision: current?.revision })
      else delete data[authKey]
      await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
    })
  }

  function retainCallbackTerminals(entry: Entry, now: number): Record<string, OAuthCallbackTerminal> {
    return Object.fromEntries(
      Object.entries(entry.oauthCallbackTerminals ?? {}).filter(
        ([, terminal]) => terminal.completedAt + CALLBACK_TERMINAL_RETENTION_MS > now,
      ),
    )
  }

  function publishTerminalInEntry(
    entry: Entry,
    oauthState: string,
    outcome: OAuthCallbackTerminal["outcome"],
    now: number,
  ): void {
    const terminals = retainCallbackTerminals(entry, now)
    const current = terminals[oauthState]
    if (current && current.outcome !== outcome) {
      throw new Error(`MCP OAuth callback occurrence already settled as ${current.outcome}: ${oauthState}`)
    }
    terminals[oauthState] = current ?? {
      outcome,
      completedAt: now,
      ...(entry.callbackGeneration ? { callbackGeneration: entry.callbackGeneration } : {}),
    }
    entry.oauthCallbackTerminals = terminals
  }

  function terminalizeActiveFlow(entry: Entry, now: number, pendingOutcome: "revoked" | "superseded"): void {
    if (entry.oauthFinishing) {
      publishTerminalInEntry(entry, entry.oauthFinishing.oauthState, "exchange_uncertain", now)
    } else if (entry.oauthState) {
      publishTerminalInEntry(entry, entry.oauthState, pendingOutcome, now)
    }
    delete entry.oauthState
    delete entry.oauthFinishing
    delete entry.codeVerifier
    delete entry.callbackGeneration
    delete entry.callbackRedirectUrl
  }

  export function hasCredentialOrFlowMaterial(entry: Entry): boolean {
    const { revision: _revision, oauthCallbackTerminals: _oauthCallbackTerminals, ...material } = entry
    return Object.values(material).some((value) => value !== undefined)
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

  export async function stageStaticCredential(
    authKey: string,
    secret: string,
    serverUrl: string,
    credentialIdentity: string,
    assertAdmission?: () => Promise<void>,
  ): Promise<void> {
    await updateStore(
      authKey,
      (entry) => ({
        ...(entry ?? {}),
        stagedStaticCredential: { secret, serverUrl, credentialIdentity },
      }),
      undefined,
      undefined,
      assertAdmission,
    )
  }

  /**
   * Promote the staged secret to the active credential iff it matches the
   * committed definition's identity; a staged secret for any other identity
   * is dropped. Returns whether a promotion happened.
   */
  export async function promoteStagedStaticCredential(
    authKey: string,
    expected: { serverUrl: string; credentialIdentity: string },
    assertAdmission?: () => Promise<void>,
  ): Promise<boolean> {
    let promoted = false
    await updateStore(
      authKey,
      (entry) => {
        if (!entry?.stagedStaticCredential) return entry
        const { stagedStaticCredential: staged, ...rest } = entry
        if (staged.serverUrl !== expected.serverUrl || staged.credentialIdentity !== expected.credentialIdentity) {
          const { revision: _revision, ...material } = rest
          return Object.keys(material).length > 0 ? rest : undefined
        }
        promoted = true
        return {
          ...rest,
          staticCredential: StaticCredential.parse({ secret: staged.secret }),
          serverUrl: staged.serverUrl,
          credentialIdentity: staged.credentialIdentity,
        }
      },
      undefined,
      undefined,
      assertAdmission,
    )
    return promoted
  }

  /** Drop an unpromoted staged secret; the active credential is untouched. */
  export async function clearStagedStaticCredential(
    authKey: string,
    assertAdmission?: () => Promise<void>,
  ): Promise<void> {
    await updateStore(
      authKey,
      (entry) => {
        if (!entry?.stagedStaticCredential) return entry
        const { stagedStaticCredential: _staged, ...rest } = entry
        const { revision: _revision, ...material } = rest
        return Object.keys(material).length > 0 ? rest : undefined
      },
      undefined,
      undefined,
      assertAdmission,
    )
  }

  export async function remove(authKey: string, assertAdmission?: () => Promise<void>): Promise<void> {
    await removeMany([authKey], assertAdmission)
  }

  export async function removeProject(projectID: string): Promise<void> {
    for (let attempt = 0; attempt < EXACT_MUTATION_ATTEMPTS; attempt += 1) {
      await waitForExactMutationRetry(attempt)
      try {
        await mutate(async () => {
          const data = await all()
          await afterProjectRemovalReadForTest?.()
          const now = Date.now()
          for (const [authKey, current] of Object.entries(data)) {
            if (parseScopedKey(authKey)?.projectID !== projectID) continue
            const entry = structuredClone(current)
            terminalizeActiveFlow(entry, now, "revoked")
            const terminals = retainCallbackTerminals(entry, now)
            if (Object.keys(terminals).length === 0) {
              delete data[authKey]
              continue
            }
            data[authKey] = Entry.parse({
              oauthCallbackTerminals: terminals,
              revision: crypto.randomUUID(),
            })
          }
          await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
        })
        return
      } catch (error) {
        let current: Record<string, Entry>
        try {
          current = await all()
        } catch (readError) {
          if (attempt === EXACT_MUTATION_ATTEMPTS - 1) {
            throw new AggregateError(
              [error, readError],
              `MCP Project credential cleanup could not be reconciled: ${projectID}`,
            )
          }
          continue
        }
        const residue = Object.entries(current).some(
          ([authKey, entry]) => parseScopedKey(authKey)?.projectID === projectID && hasCredentialOrFlowMaterial(entry),
        )
        if (!residue) return
        if (attempt === EXACT_MUTATION_ATTEMPTS - 1) throw error
      }
    }
  }

  export namespace TestHooks {
    export function setAfterProjectRemovalRead(hook: (() => Promise<void>) | undefined): void {
      afterProjectRemovalReadForTest = hook
    }
  }

  export async function removeMany(authKeys: readonly string[], assertAdmission?: () => Promise<void>): Promise<void> {
    const keys = [...new Set(authKeys)]
    const targetRevisions = new Map(keys.map((authKey) => [authKey, crypto.randomUUID()]))
    for (let attempt = 0; attempt < EXACT_MUTATION_ATTEMPTS; attempt += 1) {
      await waitForExactMutationRetry(attempt)
      const targets = new Map<string, { kind: "absent" } | { kind: "entry"; entry: Entry }>()
      let planned = false
      try {
        await mutate(async () => {
          await assertAdmission?.()
          const data = await all()
          const now = Date.now()
          for (const authKey of keys) {
            const current = data[authKey]
            if (!current) {
              targets.set(authKey, { kind: "absent" })
              continue
            }
            const entry = structuredClone(current)
            terminalizeActiveFlow(entry, now, "revoked")
            const terminals = retainCallbackTerminals(entry, now)
            if (Object.keys(terminals).length === 0) {
              delete data[authKey]
              targets.set(authKey, { kind: "absent" })
              continue
            }
            const target = Entry.parse({
              oauthCallbackTerminals: terminals,
              revision: targetRevisions.get(authKey),
            })
            data[authKey] = target
            targets.set(authKey, { kind: "entry", entry: target })
          }
          planned = true
          await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
        })
        return
      } catch (error) {
        if (planned) {
          const current = await all()
          const exactTargetCommitted = keys.every((authKey) => {
            const target = targets.get(authKey)
            if (!target) return false
            if (target.kind === "absent") return current[authKey] === undefined
            return JSON.stringify(current[authKey]) === JSON.stringify(target.entry)
          })
          if (exactTargetCommitted) return
        }
        if (attempt === EXACT_MUTATION_ATTEMPTS - 1) throw error
      }
    }
  }

  /**
   * Establish the next credential lease in one store write.
   *
   * This is how a flow starts: an unspent pending occurrence is terminalized
   * as superseded, and an expired finishing occurrence as exchange-uncertain;
   * a live finishing owner refuses replacement. The caller receives the only
   * copy of the new generation in the same cross-process mutation, so no peer
   * can observe the old lease as current between terminal settlement and the
   * new admission. An absent entry is created bare; a flow that dies before
   * publishing state leaves it for credential reconciliation to collect.
   */
  export async function beginCredentialLease(
    authKey: string,
    serverUrl?: string,
    credentialIdentity?: string,
    assertAdmission?: () => Promise<void>,
    pendingPolicy: "supersede" | "reject" = "supersede",
  ): Promise<Revision> {
    const generation = crypto.randomUUID()
    try {
      await mutate(async () => {
        await assertAdmission?.()
        const data = await all()
        const current = data[authKey]
        const now = Date.now()
        if (current?.oauthFinishing && current.oauthFinishing.leaseExpiresAt > now) {
          throw new Error(`MCP OAuth finish is still active: ${authKey}`)
        }
        if (pendingPolicy === "reject" && current?.oauthState) {
          throw new Error(`MCP OAuth authorization is already pending: ${authKey}`)
        }
        const settled = current ? structuredClone(current) : undefined
        if (settled?.oauthFinishing) {
          publishTerminalInEntry(settled, settled.oauthFinishing.oauthState, "exchange_uncertain", now)
        }
        if (settled?.oauthState) publishTerminalInEntry(settled, settled.oauthState, "superseded", now)
        const {
          oauthState: _oauthState,
          oauthFinishing: _oauthFinishing,
          codeVerifier: _codeVerifier,
          callbackGeneration: _callbackGeneration,
          callbackRedirectUrl: _callbackRedirectUrl,
          ...retained
        } = settled ?? {}
        data[authKey] = Entry.parse({
          ...retained,
          ...(serverUrl ? { serverUrl } : {}),
          ...(credentialIdentity ? { credentialIdentity } : {}),
          revision: generation,
        })
        await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
      })
    } catch (error) {
      if ((await get(authKey))?.revision === generation) return generation
      throw error
    }
    return generation
  }

  /**
   * End every outstanding lease on one credential without removing it.
   *
   * The write terminalizes any pending occurrence as `revoked`, any finishing
   * occurrence as `exchange_uncertain`, and mints a new durable generation.
   * Any holder that presents the generation it captured is refused from now
   * on, in this process and in every peer backend reading the same store. A key
   * with no entry has nothing to revoke — no lease over it can exist, because
   * the empty generation is never handed out.
   */
  export async function invalidate(authKey: string, assertAdmission?: () => Promise<void>): Promise<void> {
    const revision = crypto.randomUUID()
    try {
      await mutate(async () => {
        await assertAdmission?.()
        const data = await all()
        const current = data[authKey]
        if (!current) return
        const entry = structuredClone(current)
        terminalizeActiveFlow(entry, Date.now(), "revoked")
        data[authKey] = Entry.parse({ ...entry, revision })
        await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
      })
    } catch (error) {
      if ((await get(authKey))?.revision === revision) return
      throw error
    }
  }

  /**
   * Retire one exact credential lease after its owner finishes without handing
   * the lease to another operation. A newer revision wins and is untouched.
   */
  export async function retireCredentialLeaseIfOwned(authKey: string, expectedRevision: Revision): Promise<boolean> {
    const retiredRevision = crypto.randomUUID()
    let retired = false
    try {
      await mutate(async () => {
        const data = await all()
        const current = data[authKey]
        if (!current || (current.revision ?? INITIAL_REVISION) !== expectedRevision) return
        const entry = structuredClone(current)
        terminalizeActiveFlow(entry, Date.now(), "revoked")
        data[authKey] = Entry.parse({ ...entry, revision: retiredRevision })
        await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
        retired = true
      })
    } catch (error) {
      const current = await get(authKey)
      if (current?.revision === retiredRevision) return true
      if ((current?.revision ?? INITIAL_REVISION) !== expectedRevision) return false
      throw error
    }
    return retired
  }

  /**
   * Revoke one exact OAuth occurrence after its authorize-time configuration
   * identity stops matching the canonical definition.
   *
   * A newer flow may acquire the same auth key between the caller's config
   * read and this store lock. The old callback is therefore allowed to mutate
   * only its captured revision + state (+ finishing owner once spent). If a
   * newer lease already won, its admission has retained the old state's
   * terminal and this function observes that fact without touching the new
   * entry.
   */
  export async function revokeOAuthOccurrenceIfOwned(
    authKey: string,
    oauthState: string,
    expectedRevision: Revision,
    finishingOwnerID?: string,
  ): Promise<OAuthCallbackTerminal | undefined> {
    let result: OAuthCallbackTerminal | undefined
    const revokedRevision = crypto.randomUUID()
    try {
      await mutate(async () => {
        const data = await all()
        const current = data[authKey]
        const completed = current?.oauthCallbackTerminals?.[oauthState]
        if (completed) {
          result = completed
          return
        }
        if (!current || (current.revision ?? INITIAL_REVISION) !== expectedRevision) return
        const pendingOwned = finishingOwnerID === undefined && current.oauthState === oauthState
        const finishingOwned =
          finishingOwnerID !== undefined &&
          current.oauthFinishing?.oauthState === oauthState &&
          current.oauthFinishing.ownerID === finishingOwnerID
        if (!pendingOwned && !finishingOwned) return

        const entry = structuredClone(current)
        terminalizeActiveFlow(entry, Date.now(), "revoked")
        data[authKey] = Entry.parse({ ...entry, revision: revokedRevision })
        result = data[authKey]?.oauthCallbackTerminals?.[oauthState]
        await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
      })
    } catch (error) {
      const completed = await getOAuthCallbackTerminal(authKey, oauthState)
      if (completed) return completed
      throw error
    }
    return result
  }

  export async function updateTokens(
    authKey: string,
    tokens: Tokens,
    serverUrl?: string,
    expectedRevision?: Revision,
    credentialIdentity?: string,
    finishing?: { oauthState: string; ownerID: string },
    expectedRefresh?: RefreshSnapshot,
  ): Promise<void> {
    const committedTokens = Tokens.parse(tokens)
    let target:
      | {
          tokenClientInfo: ClientInfo | undefined
          serverUrl: string | undefined
          credentialIdentity: string | undefined
        }
      | undefined
    for (let attempt = 0; attempt < EXACT_MUTATION_ATTEMPTS; attempt += 1) {
      await waitForExactMutationRetry(attempt)
      try {
        await updateStore(
          authKey,
          (entry) => {
            if (finishing) {
              const occurrence = entry?.oauthFinishing
              if (
                !occurrence ||
                occurrence.oauthState !== finishing.oauthState ||
                occurrence.ownerID !== finishing.ownerID ||
                occurrence.leaseExpiresAt <= Date.now()
              ) {
                throw new Error(`MCP OAuth finishing occurrence is not current: ${authKey}`)
              }
            } else if (expectedRefresh) {
              const currentRefreshClient =
                entry?.tokens && entry.tokenClientInfo ? entry.tokenClientInfo : entry?.clientInfo
              if (
                !sameFact(entry?.tokens, Tokens.parse(expectedRefresh.tokens)) ||
                !sameFact(currentRefreshClient, expectedRefresh.clientInfo)
              ) {
                throw new Error(`MCP OAuth refresh input changed before token commit: ${authKey}`)
              }
            }
            target = {
              tokenClientInfo: expectedRefresh
                ? expectedRefresh.clientInfo
                : entry?.clientInfo
                  ? ClientInfo.parse(entry.clientInfo)
                  : entry?.tokenClientInfo
                    ? ClientInfo.parse(entry.tokenClientInfo)
                    : undefined,
              serverUrl: serverUrl ?? entry?.serverUrl,
              credentialIdentity: credentialIdentity ?? entry?.credentialIdentity,
            }
            return {
              ...(entry ? { ...entry, staticCredential: undefined } : {}),
              tokens: committedTokens,
              ...(target.tokenClientInfo ? { tokenClientInfo: target.tokenClientInfo } : {}),
              ...(serverUrl ? { serverUrl } : {}),
              ...(credentialIdentity ? { credentialIdentity } : {}),
            }
          },
          expectedRevision,
          finishing,
        )
        return
      } catch (error) {
        let current: Entry | undefined
        try {
          current = await get(authKey)
        } catch (readError) {
          if (attempt === EXACT_MUTATION_ATTEMPTS - 1) {
            throw new AggregateError([error, readError], `MCP OAuth token commit could not be reconciled: ${authKey}`)
          }
          continue
        }
        const revisionIsExact = expectedRevision !== undefined && current?.revision === expectedRevision
        const finishingIsExact =
          finishing !== undefined &&
          current?.oauthFinishing?.oauthState === finishing.oauthState &&
          current.oauthFinishing.ownerID === finishing.ownerID &&
          current.oauthFinishing.leaseExpiresAt > Date.now()
        const currentRefreshClient =
          current?.tokens && current.tokenClientInfo ? current.tokenClientInfo : current?.clientInfo
        const refreshInputIsExact =
          expectedRefresh !== undefined &&
          sameFact(current?.tokens, expectedRefresh.tokens) &&
          sameFact(currentRefreshClient, expectedRefresh.clientInfo)
        const credentialInputIsExact =
          (!serverUrl || current?.serverUrl === serverUrl) &&
          (!credentialIdentity || current?.credentialIdentity === credentialIdentity)
        if (
          target &&
          current &&
          revisionIsExact &&
          (finishing === undefined || finishingIsExact) &&
          sameFact(current.tokens, committedTokens) &&
          sameFact(current.tokenClientInfo, target.tokenClientInfo) &&
          current.serverUrl === target.serverUrl &&
          current.credentialIdentity === target.credentialIdentity &&
          current.staticCredential === undefined
        ) {
          return
        }
        const inputIsStillExact = revisionIsExact && credentialInputIsExact && (finishingIsExact || refreshInputIsExact)
        if (!inputIsStillExact || attempt === EXACT_MUTATION_ATTEMPTS - 1) throw error
      }
    }
  }

  export async function updateClientInfo(
    authKey: string,
    clientInfo: ClientInfo,
    serverUrl?: string,
    expectedRevision?: Revision,
    credentialIdentity?: string,
    callbackGeneration?: string,
    callbackRedirectUrl?: string,
  ): Promise<void> {
    await updateStore(
      authKey,
      (entry) => ({
        ...(entry ? { ...entry, staticCredential: undefined } : {}),
        clientInfo,
        ...(serverUrl ? { serverUrl } : {}),
        ...(credentialIdentity ? { credentialIdentity } : {}),
        ...(callbackGeneration ? { clientCallbackGeneration: callbackGeneration } : {}),
        ...(callbackRedirectUrl ? { clientCallbackRedirectUrl: callbackRedirectUrl } : {}),
      }),
      expectedRevision,
    )
  }

  export async function invalidateCredentials(
    authKey: string,
    type: "all" | "client" | "tokens",
    expectedRevision?: Revision,
    expected?: CredentialSnapshot,
  ): Promise<void> {
    try {
      await updateStore(
        authKey,
        (entry) => {
          if (!entry) return entry
          if (
            expected &&
            ((type !== "client" &&
              (!sameFact(entry.tokens, expected.tokens) ||
                !sameFact(entry.tokenClientInfo, expected.tokenClientInfo))) ||
              (type !== "tokens" && !sameFact(entry.clientInfo, expected.clientInfo)))
          ) {
            throw new Error(`MCP OAuth credential input changed before invalidation: ${authKey}`)
          }
          if (type === "all" || type === "tokens") {
            delete entry.tokens
            delete entry.tokenClientInfo
          }
          if (type === "all" || type === "client") {
            delete entry.clientInfo
            delete entry.clientCallbackGeneration
            delete entry.clientCallbackRedirectUrl
          }
          if (type === "all") delete entry.staticCredential
          return entry
        },
        expectedRevision,
      )
    } catch (error) {
      const current = await get(authKey)
      const revisionIsExact = expectedRevision === undefined || current?.revision === expectedRevision
      const tokensAreRetired = type === "client" || (!current?.tokens && !current?.tokenClientInfo)
      const clientIsRetired = type === "tokens" || !current?.clientInfo
      const staticCredentialIsRetired = type !== "all" || !current?.staticCredential
      if (revisionIsExact && tokensAreRetired && clientIsRetired && staticCredentialIsRetired) return
      throw error
    }
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
    callbackGeneration?: string,
    callbackRedirectUrl?: string,
  ): Promise<void> {
    await updateStore(
      authKey,
      (entry) => {
        if (entry?.oauthFinishing) throw new Error(`MCP OAuth finish is still active: ${authKey}`)
        const next = entry ? { ...entry, staticCredential: undefined } : {}
        if (entry?.oauthState && entry.oauthState !== oauthState) {
          publishTerminalInEntry(next, entry.oauthState, "superseded", Date.now())
        }
        return {
          ...next,
          oauthState,
          ...(serverUrl ? { serverUrl } : {}),
          ...(credentialIdentity ? { credentialIdentity } : {}),
          ...(callbackGeneration ? { callbackGeneration } : {}),
          ...(callbackRedirectUrl ? { callbackRedirectUrl } : {}),
        }
      },
      expectedRevision,
    )
  }

  /**
   * Settle every fact bound to an obsolete callback broker generation.
   *
   * The mutation is one store replacement, so no backend can publish a new
   * flow under the current generation and have a peer rotation erase it.
   * Existing tokens and static credentials are not callback-bound.
   */
  export async function settleCallbackGeneration(currentGeneration: string): Promise<void> {
    const isSettled = (data: Record<string, Entry>) => {
      const now = Date.now()
      return Object.values(data).every((entry) => {
        if (entry.oauthFinishing && entry.oauthFinishing.leaseExpiresAt <= now) return false
        const flowObsolete =
          !entry.oauthFinishing &&
          (entry.oauthState !== undefined ||
            entry.codeVerifier !== undefined ||
            entry.callbackGeneration !== undefined ||
            entry.callbackRedirectUrl !== undefined) &&
          entry.callbackGeneration !== currentGeneration
        const clientObsolete =
          !entry.oauthFinishing &&
          entry.clientInfo !== undefined &&
          entry.clientCallbackGeneration !== currentGeneration
        return !flowObsolete && !clientObsolete
      })
    }
    try {
      await mutate(async () => {
        const data = await all()
        let changed = false
        const now = Date.now()
        for (const [authKey, current] of Object.entries(data)) {
          const entry = structuredClone(current)
          let entryChanged = false
          if (entry.oauthFinishing && entry.oauthFinishing.leaseExpiresAt <= now) {
            publishTerminalInEntry(entry, entry.oauthFinishing.oauthState, "exchange_uncertain", now)
            delete entry.oauthFinishing
            delete entry.codeVerifier
            delete entry.callbackGeneration
            delete entry.callbackRedirectUrl
            entryChanged = true
          }
          const flowObsolete =
            !entry.oauthFinishing &&
            (entry.oauthState !== undefined ||
              entry.codeVerifier !== undefined ||
              entry.callbackGeneration !== undefined ||
              entry.callbackRedirectUrl !== undefined) &&
            entry.callbackGeneration !== currentGeneration
          const clientObsolete =
            !entry.oauthFinishing &&
            entry.clientInfo !== undefined &&
            entry.clientCallbackGeneration !== currentGeneration
          if (!flowObsolete && !clientObsolete && !entryChanged) continue
          if (flowObsolete) {
            entryChanged = true
            if (entry.oauthState !== undefined) {
              publishTerminalInEntry(entry, entry.oauthState, "broker_rotated", now)
              entry.revision = crypto.randomUUID()
            }
            delete entry.oauthState
            delete entry.codeVerifier
            delete entry.callbackGeneration
            delete entry.callbackRedirectUrl
          }
          if (clientObsolete) {
            entryChanged = true
            if (entry.tokens && entry.clientInfo && !entry.tokenClientInfo) {
              entry.tokenClientInfo = ClientInfo.parse(entry.clientInfo)
            }
            delete entry.clientInfo
            delete entry.clientCallbackGeneration
            delete entry.clientCallbackRedirectUrl
          }
          if (entryChanged) {
            changed = true
            data[authKey] = Entry.parse(entry)
          }
        }
        if (changed) await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
      })
    } catch (error) {
      if (isSettled(await all())) return
      throw error
    }
  }

  export async function findOAuthState(
    oauthState: string,
    callbackGeneration: string,
  ): Promise<
    { authKey: string; projectID: string; mcpName: string; phase: "pending" | "finishing"; entry: Entry } | undefined
  > {
    for (const [authKey, entry] of Object.entries(await all())) {
      const phase =
        entry.oauthState === oauthState
          ? ("pending" as const)
          : entry.oauthFinishing?.oauthState === oauthState
            ? ("finishing" as const)
            : undefined
      if (!phase || entry.callbackGeneration !== callbackGeneration) continue
      const scope = parseScopedKey(authKey)
      if (!scope) continue
      return { authKey, ...scope, phase, entry }
    }
    return undefined
  }

  export async function getOAuthCallbackTerminal(
    authKey: string,
    oauthState: string,
  ): Promise<OAuthCallbackTerminal | undefined> {
    return (await get(authKey))?.oauthCallbackTerminals?.[oauthState]
  }

  export async function findOAuthCallbackTerminal(
    oauthState: string,
    callbackGeneration: string,
  ): Promise<{ authKey: string; projectID: string; mcpName: string; terminal: OAuthCallbackTerminal } | undefined> {
    for (const [authKey, entry] of Object.entries(await all())) {
      const terminal = entry.oauthCallbackTerminals?.[oauthState]
      if (!terminal || terminal.callbackGeneration !== callbackGeneration) continue
      const scope = parseScopedKey(authKey)
      if (!scope) continue
      return { authKey, ...scope, terminal }
    }
    return undefined
  }

  export async function publishOAuthCallbackTerminal(
    authKey: string,
    oauthState: string,
    outcome: OAuthCallbackTerminal["outcome"],
    expectedRevision: Revision,
    ownerID: string,
  ): Promise<void> {
    for (let attempt = 0; attempt < EXACT_MUTATION_ATTEMPTS; attempt += 1) {
      await waitForExactMutationRetry(attempt)
      try {
        await updateStore(
          authKey,
          (entry) => {
            const terminal = entry?.oauthCallbackTerminals?.[oauthState]
            if (terminal) {
              if (terminal.outcome === outcome) return entry
              throw new Error(`MCP OAuth callback occurrence already settled as ${terminal.outcome}: ${oauthState}`)
            }
            if (
              !entry ||
              entry.oauthFinishing?.oauthState !== oauthState ||
              entry.oauthFinishing.ownerID !== ownerID ||
              entry.oauthFinishing.leaseExpiresAt <= Date.now()
            ) {
              throw new Error(`MCP OAuth finishing occurrence is not current: ${authKey}`)
            }
            publishTerminalInEntry(entry, oauthState, outcome, Date.now())
            delete entry.oauthFinishing
            delete entry.codeVerifier
            delete entry.callbackGeneration
            delete entry.callbackRedirectUrl
            return entry
          },
          expectedRevision,
          { oauthState, ownerID },
        )
        return
      } catch (error) {
        let current: Entry | undefined
        try {
          current = await get(authKey)
        } catch (readError) {
          if (attempt === EXACT_MUTATION_ATTEMPTS - 1) {
            throw new AggregateError(
              [error, readError],
              `MCP OAuth callback terminal could not be reconciled: ${authKey}`,
            )
          }
          continue
        }
        const terminal = current?.oauthCallbackTerminals?.[oauthState]
        if (terminal?.outcome === outcome) return
        const ownerIsStillExact =
          current?.revision === expectedRevision &&
          current.oauthFinishing?.oauthState === oauthState &&
          current.oauthFinishing.ownerID === ownerID &&
          current.oauthFinishing.leaseExpiresAt > Date.now()
        if (!ownerIsStillExact || attempt === EXACT_MUTATION_ATTEMPTS - 1) throw error
      }
    }
  }

  export async function renewOAuthFinishing(
    authKey: string,
    oauthState: string,
    expectedRevision: Revision,
    ownerID: string,
    leaseExpiresAt: number,
  ): Promise<boolean> {
    if (leaseExpiresAt <= Date.now()) throw new Error("MCP OAuth finishing renewal must extend into the future")
    let renewed = false
    try {
      await updateStore(
        authKey,
        (entry) => {
          const current = entry?.oauthFinishing
          if (
            !entry ||
            !current ||
            current.oauthState !== oauthState ||
            current.ownerID !== ownerID ||
            current.leaseExpiresAt <= Date.now()
          ) {
            return entry
          }
          current.leaseExpiresAt = leaseExpiresAt
          renewed = true
          return entry
        },
        expectedRevision,
        { oauthState, ownerID },
      )
    } catch (error) {
      const current = await get(authKey)
      if (
        current?.revision === expectedRevision &&
        current.oauthFinishing?.oauthState === oauthState &&
        current.oauthFinishing.ownerID === ownerID &&
        current.oauthFinishing.leaseExpiresAt >= leaseExpiresAt
      ) {
        return true
      }
      throw error
    }
    return renewed
  }

  export async function settleExpiredOAuthFinishing(
    authKey: string,
    oauthState: string,
    expectedRevision: Revision,
  ): Promise<OAuthCallbackTerminal | undefined> {
    const settle = async () => {
      let result: OAuthCallbackTerminal | undefined
      await updateStore(
        authKey,
        (entry) => {
          const existing = entry?.oauthCallbackTerminals?.[oauthState]
          if (existing) {
            result = existing
            return entry
          }
          if (!entry || entry.oauthFinishing?.oauthState !== oauthState) return entry
          const now = Date.now()
          if (entry.oauthFinishing.leaseExpiresAt > now) return entry
          publishTerminalInEntry(entry, oauthState, "exchange_uncertain", now)
          delete entry.oauthFinishing
          delete entry.codeVerifier
          delete entry.callbackGeneration
          delete entry.callbackRedirectUrl
          result = entry.oauthCallbackTerminals?.[oauthState]
          return entry
        },
        expectedRevision,
        "expired",
      )
      return result
    }
    try {
      return await settle()
    } catch (error) {
      const terminal = await getOAuthCallbackTerminal(authKey, oauthState)
      if (terminal) return terminal
      throw error
    }
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

  /**
   * Spend an OAuth state, exactly once.
   *
   * The comparison and the clear are one read-modify-write inside the
   * cross-process lock, so of any number of callbacks bearing the same state
   * exactly one observes it present and gets `true`. That is what makes an
   * authorization code single-use: a duplicate callback — an identity
   * provider's double redirect, a browser retry, a link prefetcher — cannot
   * drive a second token exchange for a code the first exchange already
   * redeemed, which on a compliant authorization server would revoke the
   * credentials the flow just obtained.
   *
   * Returns false when the state is absent, already spent, or superseded.
   */
  export async function spendOAuthState(
    authKey: string,
    oauthState: string,
    expectedRevision: Revision,
    ownerID: string,
    leaseExpiresAt: number,
  ): Promise<boolean> {
    if (leaseExpiresAt <= Date.now()) throw new Error("MCP OAuth finishing lease must expire in the future")
    let spent = false
    try {
      await updateStore(
        authKey,
        (entry) => {
          if (!entry || entry.oauthState !== oauthState) return entry
          delete entry.oauthState
          entry.oauthFinishing = { oauthState, ownerID, leaseExpiresAt }
          spent = true
          return entry
        },
        expectedRevision,
        "observe",
      )
    } catch (error) {
      const current = await get(authKey)
      if (
        current?.revision === expectedRevision &&
        current.oauthFinishing?.oauthState === oauthState &&
        current.oauthFinishing.ownerID === ownerID
      ) {
        return true
      }
      // A lease that was revoked or a credential that was removed between
      // authorize and callback are both answers to the question this asks —
      // "is this state still current?" — and the answer is no. Letting the
      // store's raw revocation error escape made a stale flow a 500 from an
      // UnknownError where a spent one is a typed 400, for the same fact.
      if (!isLeaseRevokedError(error)) throw error
      return false
    }
    return spent
  }

  function isLeaseRevokedError(error: unknown): boolean {
    return error instanceof Error && error.message.startsWith("MCP auth lease was revoked:")
  }

  /**
   * Terminalize a rejected OAuth flow in one durable write.
   *
   * State and PKCE verifier are one flow identity. Clearing only the state
   * lets a later lease that dies after writing its new state be reconstructed
   * with the rejected flow's verifier.
   */
  export async function abandonOAuthState(
    authKey: string,
    oauthState: string,
    expectedRevision: Revision,
    outcome: "provider_rejected" | "missing_code",
  ): Promise<boolean> {
    for (let attempt = 0; attempt < EXACT_MUTATION_ATTEMPTS; attempt += 1) {
      let abandoned = false
      await waitForExactMutationRetry(attempt)
      try {
        await updateStore(
          authKey,
          (entry) => {
            const terminal = entry?.oauthCallbackTerminals?.[oauthState]
            if (terminal) {
              abandoned = terminal.outcome === outcome
              return entry
            }
            if (!entry || entry.oauthState !== oauthState) return entry
            publishTerminalInEntry(entry, oauthState, outcome, Date.now())
            delete entry.oauthState
            delete entry.codeVerifier
            delete entry.callbackGeneration
            delete entry.callbackRedirectUrl
            abandoned = true
            return entry
          },
          expectedRevision,
          "observe",
        )
        return abandoned
      } catch (error) {
        let current: Entry | undefined
        try {
          current = await get(authKey)
        } catch (readError) {
          if (attempt === EXACT_MUTATION_ATTEMPTS - 1) {
            throw new AggregateError(
              [error, readError],
              `MCP OAuth callback abandonment could not be reconciled: ${authKey}`,
            )
          }
          continue
        }
        if (current?.oauthCallbackTerminals?.[oauthState]?.outcome === outcome) return true
        const ownerIsStillExact = current?.revision === expectedRevision && current.oauthState === oauthState
        if (!ownerIsStillExact || attempt === EXACT_MUTATION_ATTEMPTS - 1) throw error
      }
    }
    return false
  }

  export async function clearOAuthStateIfOwned(authKey: string, expectedRevision: Revision): Promise<boolean> {
    if ((await revision(authKey)) !== expectedRevision) return false
    try {
      await clearOAuthState(authKey, expectedRevision)
      return true
    } catch (error) {
      if ((await revision(authKey)) !== expectedRevision) return false
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
