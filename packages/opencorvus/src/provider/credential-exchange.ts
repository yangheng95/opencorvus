import crypto from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Auth } from "@/auth"
import { ProviderOAuthFlowStore } from "@/provider/oauth-flow-store"

/** One owner for every remote Provider credential exchange and local commit. */
export namespace ProviderCredentialExchange {
  export const FailedError = NamedError.create(
    "ProviderCredentialExchangeFailedError",
    z.object({ providerID: z.string(), flowID: z.string() }),
  )

  export const ReplacedError = NamedError.create(
    "ProviderCredentialExchangeReplacedError",
    z.object({ providerID: z.string(), flowID: z.string() }),
  )

  export const TestHooks = {
    beforeAuthorizationBegin: undefined as ((input: { flowID: string; ownerID: string }) => Promise<void>) | undefined,
    afterExchangeStarted: undefined as ((input: { flowID: string; ownerID: string }) => Promise<void>) | undefined,
    afterCredentialReady: undefined as
      | ((input: { flowID: string; ownerID: string; credentialProviderID: string }) => Promise<void>)
      | undefined,
    afterCredentialCommit: undefined as
      | ((input: { flowID: string; ownerID: string; credentialProviderID: string }) => Promise<void>)
      | undefined,
    afterCredentialWrite: undefined as
      | ((input: { flowID: string; ownerID: string; credentialProviderID: string }) => Promise<void>)
      | undefined,
    exchangeRenewalIntervalMs: undefined as number | undefined,
  }

  async function settlementError(providerID: string, flowID: string): Promise<Error> {
    const settled =
      (await ProviderOAuthFlowStore.settleExpiredExchange(flowID)) ?? (await ProviderOAuthFlowStore.get(flowID))
    if (settled?.state === "exchange_uncertain") {
      return new ProviderOAuthFlowStore.ExchangeUncertainError({ providerID, flowID })
    }
    return new FailedError({ providerID, flowID })
  }

  async function runOwned(input: {
    flowID: string
    ownerID: string
    providerID: string
    exchangeFailure: "failed" | "uncertain"
    expectedGeneration: string
    exchange(): Promise<{ credential: Auth.Info; credentialProviderID: string }>
    commit(
      credentialProviderID: string,
      credential: Auth.Info,
      expectedGeneration: string,
      credentialGeneration: string,
    ): Promise<"committed" | "replaced">
  }): Promise<Auth.Info> {
    let renewalRunning = false
    let ownerLost = false
    const renewal = setInterval(
      () => {
        if (renewalRunning || ownerLost) return
        renewalRunning = true
        void ProviderOAuthFlowStore.renewExchange({ id: input.flowID, ownerID: input.ownerID })
          .then((renewed) => {
            if (!renewed) ownerLost = true
          })
          // A thrown lock or I/O observation is not a durable owner-loss fact.
          // Keep retrying; the exact owner transition below remains decisive.
          .catch(() => undefined)
          .finally(() => {
            renewalRunning = false
          })
      },
      TestHooks.exchangeRenewalIntervalMs ?? ProviderOAuthFlowStore.EXCHANGE_LEASE_MS / 3,
    )
    renewal.unref()

    try {
      await TestHooks.afterExchangeStarted?.({ flowID: input.flowID, ownerID: input.ownerID })
      let credential: Auth.Info
      let credentialProviderID: string
      try {
        const exchanged = await input.exchange()
        credential = Auth.Info.parse(exchanged.credential)
        credentialProviderID = exchanged.credentialProviderID
      } catch {
        const settled =
          input.exchangeFailure === "uncertain"
            ? await ProviderOAuthFlowStore.uncertainExchange({
                id: input.flowID,
                ownerID: input.ownerID,
                error: "Provider credential exchange returned an uncertain result",
              })
            : await ProviderOAuthFlowStore.failExchange({
                id: input.flowID,
                ownerID: input.ownerID,
                error: "Provider credential exchange failed before producing a credential",
              })
        if (!settled) throw await settlementError(input.providerID, input.flowID)
        if (input.exchangeFailure === "uncertain") {
          throw new ProviderOAuthFlowStore.ExchangeUncertainError({
            providerID: input.providerID,
            flowID: input.flowID,
          })
        }
        throw new FailedError({ providerID: input.providerID, flowID: input.flowID })
      }

      const credentialGeneration = crypto.randomUUID()
      const ready = await ProviderOAuthFlowStore.markCredentialReady({
        id: input.flowID,
        ownerID: input.ownerID,
        credentialProviderID,
        credentialDigest: ProviderOAuthFlowStore.digestCredential(credential),
        credentialGeneration,
      })
      if (!ready) throw await settlementError(input.providerID, input.flowID)
      await TestHooks.afterCredentialReady?.({
        flowID: input.flowID,
        ownerID: input.ownerID,
        credentialProviderID,
      })
      try {
        // A prior timer error is only a hint. This exact owner transition is
        // authoritative: if it renews now, the owner never lost the lease.
        const renewed = await ProviderOAuthFlowStore.renewExchange({ id: input.flowID, ownerID: input.ownerID })
        if (!renewed) throw await settlementError(input.providerID, input.flowID)
        ownerLost = false
      } catch {
        const uncertain = await ProviderOAuthFlowStore.uncertainExchange({
          id: input.flowID,
          ownerID: input.ownerID,
          error: "Provider credential exchange ownership could not be confirmed before commit",
        })
        if (!uncertain) throw await settlementError(input.providerID, input.flowID)
        throw new ProviderOAuthFlowStore.ExchangeUncertainError({
          providerID: input.providerID,
          flowID: input.flowID,
        })
      }

      let commit: "committed" | "replaced"
      try {
        commit = await input.commit(credentialProviderID, credential, input.expectedGeneration, credentialGeneration)
        await TestHooks.afterCredentialCommit?.({
          flowID: input.flowID,
          ownerID: input.ownerID,
          credentialProviderID,
        })
      } catch {
        // Atomic rename may have committed auth.json even if lock-release
        // integrity checks subsequently throw. Reconcile the exact output
        // generation and digest before classifying the exchange as uncertain.
        const reconciled = await ProviderOAuthFlowStore.reconcileCredentialCommit({
          id: input.flowID,
          ownerID: input.ownerID,
        })
        if (reconciled?.state === "consumed") return credential
        const uncertain = await ProviderOAuthFlowStore.uncertainExchange({
          id: input.flowID,
          ownerID: input.ownerID,
          error: "Provider credential commit result could not be confirmed",
        })
        if (!uncertain) {
          const settled =
            (await ProviderOAuthFlowStore.settleExpiredExchange(input.flowID)) ??
            (await ProviderOAuthFlowStore.get(input.flowID))
          if (settled?.state === "consumed") return credential
          throw await settlementError(input.providerID, input.flowID)
        }
        throw new ProviderOAuthFlowStore.ExchangeUncertainError({
          providerID: input.providerID,
          flowID: input.flowID,
        })
      }
      if (commit === "replaced") {
        const uncertain = await ProviderOAuthFlowStore.uncertainExchange({
          id: input.flowID,
          ownerID: input.ownerID,
          error: "Provider credential generation changed before exchanged credential commit",
        })
        if (!uncertain) throw await settlementError(input.providerID, input.flowID)
        throw new ReplacedError({ providerID: input.providerID, flowID: input.flowID })
      }

      await TestHooks.afterCredentialWrite?.({
        flowID: input.flowID,
        ownerID: input.ownerID,
        credentialProviderID,
      })
      const consumed = await ProviderOAuthFlowStore.consumeExchange({ id: input.flowID, ownerID: input.ownerID })
      if (!consumed) {
        const settled =
          (await ProviderOAuthFlowStore.settleExpiredExchange(input.flowID)) ??
          (await ProviderOAuthFlowStore.get(input.flowID))
        if (settled?.state === "consumed") return credential
        throw await settlementError(input.providerID, input.flowID)
      }
      return credential
    } finally {
      clearInterval(renewal)
    }
  }

  export async function authorization(input: {
    flowID: string
    ownerID: string
    providerID: string
    credentialProviderID?: string
    claimed?(mode: "exchange" | "dispose" | "expired"): void | Promise<void>
    exchange(): Promise<Auth.Info>
  }): Promise<Auth.Info> {
    const ownerID = input.ownerID
    const credentialProviderID = input.credentialProviderID ?? input.providerID
    await TestHooks.beforeAuthorizationBegin?.({ flowID: input.flowID, ownerID })
    const begun = await ProviderOAuthFlowStore.beginExchange({ id: input.flowID, ownerID })
    if (!begun) {
      const current = await ProviderOAuthFlowStore.get(input.flowID)
      if (
        current?.state === "pending" &&
        current.exchangeOwnerID === ownerID &&
        (current.exchangeLeaseExpiresAt ?? 0) <= Date.now()
      ) {
        await ProviderOAuthFlowStore.settleExpiredPending({ id: input.flowID, ownerID })
        await input.claimed?.("expired")
      }
      throw await settlementError(input.providerID, input.flowID)
    }
    if ((begun.credentialProviderID ?? begun.providerID) !== credentialProviderID) {
      try {
        await ProviderOAuthFlowStore.failExchange({
          id: input.flowID,
          ownerID,
          error: "Provider OAuth flow credential target changed before exchange",
        })
      } finally {
        await input.claimed?.("dispose")
      }
      throw new FailedError({ providerID: input.providerID, flowID: input.flowID })
    }
    let observed: Auth.Observation | undefined
    try {
      observed = await Auth.inspect(credentialProviderID)
    } catch (error) {
      try {
        await ProviderOAuthFlowStore.failExchange({
          id: input.flowID,
          ownerID,
          error: "Provider credential generation could not be inspected before exchange",
        })
      } finally {
        await input.claimed?.("dispose")
      }
      throw error
    }
    if (!begun.expectedCredentialGeneration || observed?.generation !== begun.expectedCredentialGeneration) {
      try {
        await ProviderOAuthFlowStore.failExchange({
          id: input.flowID,
          ownerID,
          error: "Provider credential generation changed after authorization started",
        })
      } finally {
        await input.claimed?.("dispose")
      }
      throw new ReplacedError({ providerID: input.providerID, flowID: input.flowID })
    }
    await input.claimed?.("exchange")
    return runOwned({
      flowID: input.flowID,
      ownerID,
      providerID: input.providerID,
      exchangeFailure: "failed",
      expectedGeneration: begun.expectedCredentialGeneration,
      exchange: async () => {
        return {
          credential: await input.exchange(),
          credentialProviderID,
        }
      },
      commit: async (targetProviderID, credential, expectedGeneration, credentialGeneration) =>
        (await Auth.setIfGeneration(targetProviderID, expectedGeneration, credential, credentialGeneration))
          ? "committed"
          : "replaced",
    })
  }

  async function awaitConcurrentRefresh(
    providerID: string,
    active: InstanceType<typeof ProviderOAuthFlowStore.ExchangeActiveError>,
  ): Promise<Extract<Auth.Info, { type: "oauth" }>> {
    while (true) {
      const flow = await ProviderOAuthFlowStore.get(active.data.flowID)
      if (!flow) throw new FailedError({ providerID, flowID: active.data.flowID })
      if (flow.state === "consumed") {
        const current = await Auth.get(providerID)
        if (current?.type !== "oauth") throw new ReplacedError({ providerID, flowID: flow.id })
        return current
      }
      if (flow.state === "failed") throw new FailedError({ providerID, flowID: flow.id })
      if (flow.state === "exchange_uncertain") {
        throw new ProviderOAuthFlowStore.ExchangeUncertainError({ providerID, flowID: flow.id })
      }
      if (
        (flow.state === "exchanging" || flow.state === "credential_ready") &&
        (flow.exchangeLeaseExpiresAt ?? 0) <= Date.now()
      ) {
        const settled = await ProviderOAuthFlowStore.settleExpiredExchange(flow.id)
        if (settled?.state === "consumed") {
          const current = await Auth.get(providerID)
          if (current?.type === "oauth") return current
          throw new ReplacedError({ providerID, flowID: flow.id })
        }
        throw new ProviderOAuthFlowStore.ExchangeUncertainError({ providerID, flowID: flow.id })
      }
      await delay(25)
    }
  }

  export async function refresh(input: {
    providerID: string
    current: Extract<Auth.Info, { type: "oauth" }>
    exchange(): Promise<Extract<Auth.Info, { type: "oauth" }>>
  }): Promise<Extract<Auth.Info, { type: "oauth" }>> {
    await ProviderOAuthFlowStore.settleExpiredForProvider(input.providerID)
    const currentDigest = ProviderOAuthFlowStore.digestCredential(Auth.Info.parse(input.current))
    const observed = await Auth.observe(input.providerID)
    const latest = observed.info
    if (latest?.type !== "oauth") throw new ReplacedError({ providerID: input.providerID, flowID: "not-opened" })
    if (ProviderOAuthFlowStore.digestCredential(latest) !== currentDigest) return latest

    const ownerID = crypto.randomUUID()
    let flow: ProviderOAuthFlowStore.Flow
    try {
      flow = await ProviderOAuthFlowStore.openRefresh({
        providerID: input.providerID,
        expectedCredentialGeneration: observed.generation,
        inputsDigest: ProviderOAuthFlowStore.digestInputs({
          generation: observed.generation,
          credentialDigest: currentDigest,
        }),
        ownerID,
      })
    } catch (error) {
      if (ProviderOAuthFlowStore.ExchangeActiveError.isInstance(error)) {
        const active = await ProviderOAuthFlowStore.get(error.data.flowID)
        if (active?.operation === "authorization") throw error
        return await awaitConcurrentRefresh(input.providerID, error)
      }
      throw error
    }

    const beforeExchange = await Auth.inspect(input.providerID)
    if (
      beforeExchange?.generation !== observed.generation ||
      beforeExchange.info?.type !== "oauth" ||
      ProviderOAuthFlowStore.digestCredential(beforeExchange.info) !== currentDigest
    ) {
      await ProviderOAuthFlowStore.failExchange({
        id: flow.id,
        ownerID,
        error: "Provider credential changed before refresh exchange",
      })
      if (beforeExchange?.info?.type !== "oauth") {
        throw new ReplacedError({ providerID: input.providerID, flowID: flow.id })
      }
      return beforeExchange.info
    }

    return (await runOwned({
      flowID: flow.id,
      ownerID,
      providerID: input.providerID,
      exchangeFailure: "uncertain",
      expectedGeneration: observed.generation,
      exchange: async () => ({ credential: await input.exchange(), credentialProviderID: input.providerID }),
      commit: async (_credentialProviderID, credential, expectedGeneration, credentialGeneration) =>
        (await Auth.setIfGeneration(input.providerID, expectedGeneration, credential, credentialGeneration))
          ? "committed"
          : "replaced",
    })) as Extract<Auth.Info, { type: "oauth" }>
  }
}
