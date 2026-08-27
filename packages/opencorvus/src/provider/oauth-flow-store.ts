import crypto from "node:crypto"
import path from "node:path"
import z from "zod"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { withSharedJsonFactLock } from "@/util/process-lock"
import { NamedError } from "@opencorvus-ai/util/error"
import { Auth } from "@/auth"

/**
 * Durable Provider OAuth flow occurrences.
 *
 * A Provider authorization used to be one process-local slot per provider:
 * a second authorize silently replaced the first, restart lost both, and the
 * callback matched only the provider ID — it could not prove which method or
 * inputs produced the code it was handed. Each flow is now an occurrence with
 * its own identity, provider, scope, operation, method, an inputs digest and
 * durable exchange/commit phases in the shared data root. Runtime refreshes
 * use the same Provider-wide owner because the credential store is global to
 * that data root.
 *
 * What stays process-local is the plugin's callback closure — it carries live
 * PKCE material a restart cannot resurrect. The occurrence is what makes that
 * loss exact instead of silent: a callback for a flow whose executor died
 * finds a pending occurrence with no executor and fails with that fact,
 * rather than a generic "nothing pending".
 */
export namespace ProviderOAuthFlowStore {
  export const FlowID = z.string().trim().min(1)
  export const FlowScope = z.enum(["project", "global", "runtime"])
  export type FlowScope = z.infer<typeof FlowScope>
  export const FlowState = z.enum([
    "pending",
    "exchanging",
    "credential_ready",
    "superseded",
    "consumed",
    "failed",
    "exchange_uncertain",
  ])
  export type FlowState = z.infer<typeof FlowState>

  export const Flow = z.object({
    id: FlowID,
    providerID: z.string().min(1),
    scope: FlowScope,
    operation: z.enum(["authorization", "refresh"]).default("authorization"),
    method: z.number().int().nonnegative(),
    /** SHA-256 of the canonicalized authorize inputs; raw inputs never land here. */
    inputsDigest: z.string(),
    state: FlowState,
    timeCreated: z.number(),
    timeSettled: z.number().optional(),
    timeExchangeStarted: z.number().optional(),
    timeCredentialReady: z.number().optional(),
    exchangeOwnerID: z.string().optional(),
    exchangeLeaseExpiresAt: z.number().optional(),
    credentialProviderID: z.string().optional(),
    expectedCredentialGeneration: z.string().uuid().optional(),
    credentialDigest: z.string().optional(),
    credentialGeneration: z.string().uuid().optional(),
    error: z.string().optional(),
  })
  export type Flow = z.infer<typeof Flow>

  const Store = z.record(z.string(), Flow)

  /** Settled occurrences older than this are pruned on the next write. */
  const SETTLED_RETENTION_MS = 24 * 60 * 60 * 1000
  export const EXCHANGE_LEASE_MS = 120_000

  const locks = new Map<string, Promise<unknown>>()

  function filepath(): string {
    return path.join(Global.Path.data, "provider-oauth-flows.json")
  }

  export function digestInputs(inputs: Record<string, string> | undefined): string {
    const canonical = JSON.stringify(
      Object.fromEntries(Object.entries(inputs ?? {}).sort(([left], [right]) => left.localeCompare(right))),
    )
    return crypto.createHash("sha256").update(canonical).digest("hex")
  }

  export function digestCredential(credential: unknown): string {
    const canonicalize = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(canonicalize)
      if (!value || typeof value !== "object") return value
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, canonicalize(nested)]),
      )
    }
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(canonicalize(credential)))
      .digest("hex")
  }

  async function read(): Promise<Record<string, Flow>> {
    try {
      return Store.parse(await Filesystem.readJson<unknown>(filepath()))
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        ((error as { code?: unknown }).code === "ENOENT" || (error as { code?: unknown }).code === "ENOTDIR")
      ) {
        return {}
      }
      throw error
    }
  }

  function mutate<T>(run: () => Promise<T>): Promise<T> {
    return withSharedJsonFactLock({ locks, filepath: filepath(), empty: "{}", mode: 0o600, run })
  }

  async function write(data: Record<string, Flow>): Promise<void> {
    const now = Date.now()
    for (const [id, flow] of Object.entries(data)) {
      if (flow.operation === "refresh" && flow.state === "exchange_uncertain") {
        // A rotating refresh token may still be the current credential after
        // an ambiguous transport result. Its replay fence outlives the normal
        // retention window and is collected only after that exact credential
        // generation has advanced.
        if (!flow.expectedCredentialGeneration) continue
        const current = await Auth.inspect(flow.credentialProviderID ?? flow.providerID)
        if (!current || current.generation === flow.expectedCredentialGeneration) continue
      }
      if (
        !["pending", "exchanging", "credential_ready"].includes(flow.state) &&
        (flow.timeSettled ?? flow.timeCreated) < now - SETTLED_RETENTION_MS
      ) {
        delete data[id]
      }
    }
    await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
  }

  function ownsProvider(flow: Flow, providerID: string): boolean {
    return flow.providerID === providerID || flow.credentialProviderID === providerID
  }

  /**
   * Open a new authorization occurrence only when no renewable Provider-wide
   * owner is active. Project/global are presentation scopes over one
   * data-root credential, so they cannot own parallel flows.
   */
  export async function open(input: {
    providerID: string
    credentialProviderID?: string
    expectedCredentialGeneration: string
    ownerID: string
    scope: "project" | "global"
    method: number
    inputsDigest: string
  }): Promise<Flow> {
    const flow: Flow = Flow.parse({
      id: crypto.randomUUID(),
      providerID: input.providerID,
      credentialProviderID: input.credentialProviderID ?? input.providerID,
      expectedCredentialGeneration: input.expectedCredentialGeneration,
      scope: input.scope,
      operation: "authorization",
      method: input.method,
      inputsDigest: input.inputsDigest,
      state: "pending",
      timeCreated: Date.now(),
      exchangeOwnerID: input.ownerID,
      exchangeLeaseExpiresAt: Date.now() + EXCHANGE_LEASE_MS,
    })
    await mutate(async () => {
      const data = await read()
      const now = Date.now()
      const providerIDs = new Set([input.providerID, input.credentialProviderID ?? input.providerID])
      for (const existing of Object.values(data)) {
        const conflictingProviderID = [...providerIDs].find((providerID) => ownsProvider(existing, providerID))
        if (!conflictingProviderID) continue
        if (existing.state === "pending" && existing.operation === "authorization") {
          if ((existing.exchangeLeaseExpiresAt ?? 0) > now) {
            throw new ExchangeActiveError({
              providerID: conflictingProviderID,
              scope: existing.scope,
              flowID: existing.id,
              leaseExpiresAt: existing.exchangeLeaseExpiresAt!,
            })
          }
          existing.state = "failed"
          existing.timeSettled = now
          existing.error = "Provider OAuth executor owner expired before callback"
          clearExchangeOwner(existing)
          continue
        }
        if (existing.state !== "exchanging" && existing.state !== "credential_ready") continue
        if ((existing.exchangeLeaseExpiresAt ?? 0) > now) {
          throw new ExchangeActiveError({
            providerID: conflictingProviderID,
            scope: existing.scope,
            flowID: existing.id,
            leaseExpiresAt: existing.exchangeLeaseExpiresAt!,
          })
        }
        await settleExpired(existing, now)
      }
      data[flow.id] = flow
      await write(data)
    })
    return flow
  }

  /**
   * Open and claim an automatic refresh in one shared-file critical section.
   * An uncertain refresh of the same credential generation is never replayed.
   */
  export async function openRefresh(input: {
    providerID: string
    inputsDigest: string
    expectedCredentialGeneration: string
    ownerID: string
    now?: number
  }): Promise<Flow> {
    const result = await mutate(async () => {
      const data = await read()
      const now = input.now ?? Date.now()
      const active = Object.values(data).find(
        (existing) =>
          ownsProvider(existing, input.providerID) &&
          (existing.state === "pending" || existing.state === "exchanging" || existing.state === "credential_ready") &&
          (existing.exchangeLeaseExpiresAt ?? 0) > now,
      )
      if (active) {
        return {
          type: "active" as const,
          flow: active,
        }
      }

      for (const existing of Object.values(data)) {
        if (!ownsProvider(existing, input.providerID)) continue
        if (existing.state === "pending" && (existing.exchangeLeaseExpiresAt ?? 0) <= now) {
          existing.state = "failed"
          existing.timeSettled = now
          existing.error = "Provider OAuth executor owner expired before callback"
          clearExchangeOwner(existing)
        }
        if (existing.state === "exchanging" || existing.state === "credential_ready") {
          await settleExpired(existing, now)
        }
        if (
          existing.operation === "refresh" &&
          existing.state === "exchange_uncertain" &&
          existing.inputsDigest === input.inputsDigest
        ) {
          await write(data)
          return { type: "uncertain" as const, flow: existing }
        }
      }

      const flow = Flow.parse({
        id: crypto.randomUUID(),
        providerID: input.providerID,
        credentialProviderID: input.providerID,
        expectedCredentialGeneration: input.expectedCredentialGeneration,
        scope: "runtime",
        operation: "refresh",
        method: 0,
        inputsDigest: input.inputsDigest,
        state: "exchanging",
        timeCreated: now,
        timeExchangeStarted: now,
        exchangeOwnerID: input.ownerID,
        exchangeLeaseExpiresAt: now + EXCHANGE_LEASE_MS,
      })
      data[flow.id] = flow
      await write(data)
      return { type: "opened" as const, flow }
    })
    if (result.type === "active") {
      throw new ExchangeActiveError({
        providerID: input.providerID,
        scope: result.flow.scope,
        flowID: result.flow.id,
        leaseExpiresAt: result.flow.exchangeLeaseExpiresAt!,
      })
    }
    if (result.type === "uncertain") {
      throw new ExchangeUncertainError({ providerID: input.providerID, flowID: result.flow.id })
    }
    return result.flow
  }

  export async function get(id: string): Promise<Flow | undefined> {
    return (await read())[id]
  }

  function clearExchangeOwner(flow: Flow): void {
    delete flow.exchangeOwnerID
    delete flow.exchangeLeaseExpiresAt
  }

  function settleUncertain(flow: Flow, now: number, error: string): void {
    flow.state = "exchange_uncertain"
    flow.timeSettled = now
    flow.error = error
    clearExchangeOwner(flow)
  }

  async function settleExpired(flow: Flow, now: number): Promise<void> {
    if (
      flow.state === "credential_ready" &&
      flow.credentialProviderID &&
      flow.credentialDigest &&
      flow.credentialGeneration
    ) {
      const committed = await Auth.inspect(flow.credentialProviderID)
      if (
        committed?.info &&
        committed.generation === flow.credentialGeneration &&
        digestCredential(committed.info) === flow.credentialDigest
      ) {
        flow.state = "consumed"
        flow.timeSettled = now
        delete flow.error
        clearExchangeOwner(flow)
        return
      }
    }
    settleUncertain(flow, now, "Provider OAuth exchange owner expired before credential settlement")
  }

  function ownedExchange(
    flow: Flow | undefined,
    ownerID: string,
    states: readonly ("exchanging" | "credential_ready")[],
    now: number,
  ): flow is Flow {
    return (
      !!flow &&
      states.includes(flow.state as "exchanging" | "credential_ready") &&
      flow.exchangeOwnerID === ownerID &&
      (flow.exchangeLeaseExpiresAt ?? 0) > now
    )
  }

  export async function beginExchange(input: { id: string; ownerID: string; now?: number }): Promise<Flow | undefined> {
    return mutate(async () => {
      const data = await read()
      const flow = data[input.id]
      const now = input.now ?? Date.now()
      if (
        !flow ||
        flow.state !== "pending" ||
        flow.exchangeOwnerID !== input.ownerID ||
        (flow.exchangeLeaseExpiresAt ?? 0) <= now
      ) {
        return undefined
      }
      const providerIDs = [flow.providerID, flow.credentialProviderID].filter((providerID): providerID is string =>
        Boolean(providerID),
      )
      for (const existing of Object.values(data)) {
        if (existing.id === flow.id || providerIDs.every((providerID) => !ownsProvider(existing, providerID))) continue
        if (existing.state !== "exchanging" && existing.state !== "credential_ready") continue
        if ((existing.exchangeLeaseExpiresAt ?? 0) > now) {
          throw new ExchangeActiveError({
            providerID: flow.providerID,
            scope: existing.scope,
            flowID: existing.id,
            leaseExpiresAt: existing.exchangeLeaseExpiresAt!,
          })
        }
        await settleExpired(existing, now)
      }
      flow.state = "exchanging"
      flow.timeExchangeStarted = now
      flow.exchangeOwnerID = input.ownerID
      flow.exchangeLeaseExpiresAt = now + EXCHANGE_LEASE_MS
      await write(data)
      return flow
    })
  }

  export async function renewPending(input: { id: string; ownerID: string; now?: number }): Promise<Flow | undefined> {
    await TestHooks.beforeRenewPending?.({ id: input.id, ownerID: input.ownerID })
    return mutate(async () => {
      const data = await read()
      const now = input.now ?? Date.now()
      const flow = data[input.id]
      if (
        !flow ||
        flow.state !== "pending" ||
        flow.exchangeOwnerID !== input.ownerID ||
        (flow.exchangeLeaseExpiresAt ?? 0) <= now
      ) {
        return undefined
      }
      flow.exchangeLeaseExpiresAt = now + EXCHANGE_LEASE_MS
      await write(data)
      return flow
    })
  }

  export async function failPending(input: {
    id: string
    ownerID: string
    error: string
    now?: number
  }): Promise<Flow | undefined> {
    await TestHooks.beforeFailPending?.({ id: input.id, ownerID: input.ownerID })
    return mutate(async () => {
      const data = await read()
      const now = input.now ?? Date.now()
      const flow = data[input.id]
      if (
        !flow ||
        flow.state !== "pending" ||
        flow.exchangeOwnerID !== input.ownerID ||
        (flow.exchangeLeaseExpiresAt ?? 0) <= now
      ) {
        return undefined
      }
      flow.state = "failed"
      flow.timeSettled = now
      flow.error = input.error
      clearExchangeOwner(flow)
      await write(data)
      return flow
    })
  }

  export async function settleExpiredPending(input: {
    id: string
    ownerID: string
    now?: number
  }): Promise<Flow | undefined> {
    return mutate(async () => {
      const data = await read()
      const now = input.now ?? Date.now()
      const flow = data[input.id]
      if (
        !flow ||
        flow.state !== "pending" ||
        flow.exchangeOwnerID !== input.ownerID ||
        (flow.exchangeLeaseExpiresAt ?? 0) > now
      ) {
        return undefined
      }
      flow.state = "failed"
      flow.timeSettled = now
      flow.error = "Provider OAuth executor owner expired before callback"
      clearExchangeOwner(flow)
      await write(data)
      return flow
    })
  }

  export async function renewExchange(input: { id: string; ownerID: string; now?: number }): Promise<Flow | undefined> {
    await TestHooks.beforeRenewExchange?.({ id: input.id, ownerID: input.ownerID })
    return mutate(async () => {
      const data = await read()
      const now = input.now ?? Date.now()
      const flow = data[input.id]
      if (!ownedExchange(flow, input.ownerID, ["exchanging", "credential_ready"], now)) return undefined
      flow.exchangeLeaseExpiresAt = now + EXCHANGE_LEASE_MS
      await write(data)
      return flow
    })
  }

  export async function markCredentialReady(input: {
    id: string
    ownerID: string
    credentialProviderID: string
    credentialDigest: string
    credentialGeneration: string
    now?: number
  }): Promise<Flow | undefined> {
    return mutate(async () => {
      const data = await read()
      const now = input.now ?? Date.now()
      const flow = data[input.id]
      if (!ownedExchange(flow, input.ownerID, ["exchanging"], now)) return undefined
      if (flow.credentialProviderID !== input.credentialProviderID) return undefined
      flow.state = "credential_ready"
      flow.timeCredentialReady = now
      flow.credentialProviderID = input.credentialProviderID
      flow.credentialDigest = input.credentialDigest
      flow.credentialGeneration = input.credentialGeneration
      flow.exchangeLeaseExpiresAt = now + EXCHANGE_LEASE_MS
      await write(data)
      return flow
    })
  }

  export async function consumeExchange(input: {
    id: string
    ownerID: string
    now?: number
  }): Promise<Flow | undefined> {
    return mutate(async () => {
      const data = await read()
      const now = input.now ?? Date.now()
      const flow = data[input.id]
      if (!ownedExchange(flow, input.ownerID, ["credential_ready"], now)) return undefined
      flow.state = "consumed"
      flow.timeSettled = now
      clearExchangeOwner(flow)
      await write(data)
      return flow
    })
  }

  /**
   * Resolve an ambiguous Auth commit result from the journaled output fact.
   * This covers an atomic auth.json replacement that succeeded before the
   * shared-lock release reported an integrity failure.
   */
  export async function reconcileCredentialCommit(input: {
    id: string
    ownerID: string
    now?: number
  }): Promise<Flow | undefined> {
    return mutate(async () => {
      const data = await read()
      const now = input.now ?? Date.now()
      const flow = data[input.id]
      if (!ownedExchange(flow, input.ownerID, ["credential_ready"], now)) return undefined
      if (!flow.credentialProviderID || !flow.credentialDigest || !flow.credentialGeneration) return undefined
      const committed = await Auth.inspect(flow.credentialProviderID)
      if (
        committed?.generation !== flow.credentialGeneration ||
        !committed.info ||
        digestCredential(committed.info) !== flow.credentialDigest
      ) {
        return undefined
      }
      flow.state = "consumed"
      flow.timeSettled = now
      delete flow.error
      clearExchangeOwner(flow)
      await write(data)
      return flow
    })
  }

  export async function failExchange(input: {
    id: string
    ownerID: string
    error: string
    now?: number
  }): Promise<Flow | undefined> {
    return mutate(async () => {
      const data = await read()
      const flow = data[input.id]
      const now = input.now ?? Date.now()
      if (!ownedExchange(flow, input.ownerID, ["exchanging", "credential_ready"], now)) return undefined
      flow.state = "failed"
      flow.timeSettled = now
      flow.error = input.error
      clearExchangeOwner(flow)
      await write(data)
      return flow
    })
  }

  export async function uncertainExchange(input: {
    id: string
    ownerID: string
    error: string
    now?: number
  }): Promise<Flow | undefined> {
    return mutate(async () => {
      const data = await read()
      const flow = data[input.id]
      const now = input.now ?? Date.now()
      if (!ownedExchange(flow, input.ownerID, ["exchanging", "credential_ready"], now)) return undefined
      settleUncertain(flow, now, input.error)
      await write(data)
      return flow
    })
  }

  export async function settleExpiredExchange(id: string, now = Date.now()): Promise<Flow | undefined> {
    return mutate(async () => {
      const data = await read()
      const flow = data[id]
      if (
        !flow ||
        (flow.state !== "exchanging" && flow.state !== "credential_ready") ||
        (flow.exchangeLeaseExpiresAt ?? 0) > now
      ) {
        return undefined
      }
      await settleExpired(flow, now)
      await write(data)
      return flow
    })
  }

  export async function settleExpiredForProvider(providerID: string, now = Date.now()): Promise<Flow[]> {
    return mutate(async () => {
      const data = await read()
      const settled: Flow[] = []
      for (const flow of Object.values(data)) {
        if (
          !ownsProvider(flow, providerID) ||
          (flow.state !== "exchanging" && flow.state !== "credential_ready") ||
          (flow.exchangeLeaseExpiresAt ?? 0) > now
        ) {
          continue
        }
        await settleExpired(flow, now)
        settled.push(flow)
      }
      if (settled.length > 0) await write(data)
      return settled
    })
  }

  export const ExchangeActiveError = NamedError.create(
    "ProviderAuthOAuthExchangeActiveError",
    z.object({
      providerID: z.string(),
      scope: FlowScope,
      flowID: FlowID,
      leaseExpiresAt: z.number(),
    }),
  )

  export const ExchangeUncertainError = NamedError.create(
    "ProviderAuthOAuthExchangeUncertainError",
    z.object({
      providerID: z.string(),
      flowID: FlowID,
    }),
  )

  export namespace TestHooks {
    export let beforeRenewPending: ((input: { id: string; ownerID: string }) => Promise<void>) | undefined
    export let beforeFailPending: ((input: { id: string; ownerID: string }) => Promise<void>) | undefined
    export let beforeRenewExchange: ((input: { id: string; ownerID: string }) => Promise<void>) | undefined
    /** Observe the pending occurrence without adding a production fallback lookup path. */
    export async function pendingFor(providerID: string, scope: "project" | "global"): Promise<Flow | undefined> {
      const data = await read()
      return Object.values(data).find(
        (flow) => flow.state === "pending" && flow.providerID === providerID && flow.scope === scope,
      )
    }

    export async function exchangeFor(providerID: string, scope: "project" | "global"): Promise<Flow | undefined> {
      const data = await read()
      return Object.values(data).find(
        (flow) =>
          (flow.state === "exchanging" || flow.state === "credential_ready") &&
          flow.providerID === providerID &&
          flow.scope === scope,
      )
    }

    export async function latestFor(
      providerID: string,
      operation: "authorization" | "refresh",
    ): Promise<Flow | undefined> {
      const data = await read()
      return Object.values(data)
        .filter((flow) => flow.providerID === providerID && flow.operation === operation)
        .sort((left, right) => right.timeCreated - left.timeCreated || right.id.localeCompare(left.id))[0]
    }

    export async function expireExchange(id: string): Promise<Flow | undefined> {
      return mutate(async () => {
        const data = await read()
        const flow = data[id]
        if (!flow || (flow.state !== "exchanging" && flow.state !== "credential_ready")) return undefined
        flow.exchangeLeaseExpiresAt = Date.now() - 1
        await write(data)
        return flow
      })
    }

    export async function expirePending(id: string): Promise<Flow | undefined> {
      return mutate(async () => {
        const data = await read()
        const flow = data[id]
        if (!flow || flow.state !== "pending") return undefined
        flow.exchangeLeaseExpiresAt = Date.now() - 1
        await write(data)
        return flow
      })
    }

    export async function ageSettlement(id: string, ageMs: number): Promise<Flow | undefined> {
      return mutate(async () => {
        const data = await read()
        const flow = data[id]
        if (!flow?.timeSettled) return undefined
        flow.timeSettled = Date.now() - ageMs
        await Filesystem.writeAtomic(filepath(), JSON.stringify(data, null, 2), 0o600)
        return flow
      })
    }
  }
}
