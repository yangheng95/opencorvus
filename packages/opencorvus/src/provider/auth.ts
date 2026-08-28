import { createInstanceState } from "@/project/instance-state"
import { Plugin } from "../plugin"
import { map, filter, pipe, fromEntries, mapValues } from "remeda"
import z from "zod"
import { fn } from "@/util/fn"
import type { AuthHook, AuthOAuthResult, AuthPromptRule } from "@opencorvus-ai/plugin"
import { NamedError } from "@opencorvus-ai/util/error"
import { Auth } from "@/auth"
import { ProviderOAuthFlowStore } from "@/provider/oauth-flow-store"
import { lazy } from "@/util/lazy"
import { ProviderCredentialExchange } from "@/provider/credential-exchange"
import crypto from "node:crypto"

type OAuthExecutor = {
  result: AuthOAuthResult
  ownerID: string
  stopRenewal(): void
  dispose(): Promise<void>
}

export namespace ProviderAuth {
  export const Scope = z.enum(["project", "global"])
  export type Scope = z.infer<typeof Scope>

  async function createState(hooks: Awaited<ReturnType<typeof Plugin.list>>) {
    const methods = pipe(
      hooks,
      filter((x) => x.auth?.provider !== undefined),
      map((x) => [x.auth!.provider, x.auth!] as const),
      fromEntries(),
    )
    // Keyed by flow occurrence ID, never by provider: the executor is the
    // plugin's live closure (PKCE material a restart cannot resurrect), and
    // the durable occurrence in ProviderOAuthFlowStore is what identifies it.
    return { methods, executors: new Map<string, OAuthExecutor>() }
  }

  async function disposeState(current: Awaited<ReturnType<typeof createState>>): Promise<void> {
    await Promise.all(
      [...current.executors.entries()].map(async ([flowID, executor]) => {
        executor.stopRenewal()
        let settlementFailure: unknown
        try {
          await ProviderOAuthFlowStore.failPending({
            id: flowID,
            ownerID: executor.ownerID,
            error: "Provider OAuth executor owner ended with its Project Instance",
          })
        } catch (error) {
          settlementFailure = error
        }
        try {
          await executor.dispose()
        } catch (disposeFailure) {
          throw new AggregateError(
            [settlementFailure, disposeFailure].filter((error) => error !== undefined),
            `Provider OAuth executor ${flowID} disposal failed`,
          )
        }
        if (settlementFailure) throw settlementFailure
      }),
    )
    current.executors.clear()
  }

  const projectState = createInstanceState(() => Plugin.list().then(createState), disposeState, "provider-auth")
  const globalState = lazy(() => Plugin.listGlobalProviderHooks().then(createState))
  let globalStateOverrideForTest: ReturnType<typeof createState> | undefined
  let projectStateOverrideForTest: ReturnType<typeof createState> | undefined

  function state(scope: Scope = "project") {
    if (scope === "global" && globalStateOverrideForTest) return globalStateOverrideForTest
    if (scope === "project" && projectStateOverrideForTest) return projectStateOverrideForTest
    return scope === "global" ? globalState() : projectState()
  }

  /**
   * Dispose every executor whose durable flow has already settled before a
   * new occurrence or plugin authorization side effect is created. A live
   * pending owner is never replaced by another authorize request.
   */
  async function disposeSettledExecutors(executors: Map<string, OAuthExecutor>) {
    for (const id of [...executors.keys()]) {
      const record = await ProviderOAuthFlowStore.get(id)
      if (!record || record.state !== "pending") {
        const settled = executors.get(id)
        settled?.stopRenewal()
        await settled?.dispose()
        executors.delete(id)
      }
    }
  }

  function renewPendingOwner(flowID: string, ownerID: string, onLost: () => Promise<void>): () => void {
    let running = false
    let stopped = false
    let lost = false
    const timer = setInterval(
      () => {
        if (running || stopped || lost) return
        running = true
        void ProviderOAuthFlowStore.renewPending({ id: flowID, ownerID })
          .then(async (renewed) => {
            if (renewed || stopped || lost) return
            await onLost()
            lost = true
            clearInterval(timer)
          })
          // A transient shared-file or lock error does not revoke this owner.
          // The next interval retries until the durable lease itself says the
          // exact owner is gone.
          .catch(() => undefined)
          .finally(() => {
            running = false
          })
      },
      TestHooks.pendingRenewalIntervalMs ?? ProviderOAuthFlowStore.EXCHANGE_LEASE_MS / 3,
    )
    timer.unref()
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }

  export const TestHooks = {
    pendingRenewalIntervalMs: undefined as number | undefined,
    async disposeProjectAuthStateForTest(): Promise<void> {
      if (!projectStateOverrideForTest) throw new Error("Project Provider auth test state is not installed")
      await disposeState(await projectStateOverrideForTest)
    },
    installGlobalAuthHooksForTest(hooks: Parameters<typeof createState>[0]): Disposable {
      const override = createState(hooks)
      globalStateOverrideForTest = override
      return {
        [Symbol.dispose]() {
          if (globalStateOverrideForTest === override) globalStateOverrideForTest = undefined
        },
      }
    },
    installProjectAuthHooksForTest(hooks: Parameters<typeof createState>[0]): Disposable {
      const override = createState(hooks)
      projectStateOverrideForTest = override
      return {
        [Symbol.dispose]() {
          if (projectStateOverrideForTest === override) projectStateOverrideForTest = undefined
        },
      }
    },
  }

  export const Method = z
    .object({
      type: z.union([z.literal("oauth"), z.literal("api")]),
      label: z.string(),
      preferred: z.boolean().optional(),
    })
    .meta({
      ref: "ProviderAuthMethod",
    })
  export type Method = z.infer<typeof Method>

  export async function methods(scope: Scope = "project") {
    const s = await state(scope).then((x) => x.methods)
    return mapValues(s, (x) =>
      x.methods.map(
        (y): Method => ({
          type: y.type,
          label: y.label,
          preferred: y.preferred === true ? true : undefined,
        }),
      ),
    )
  }

  export const Authorization = z
    .object({
      url: z.string(),
      method: z.union([z.literal("auto"), z.literal("code")]),
      instructions: z.string(),
      /** The durable flow occurrence this authorization opened. */
      flowID: ProviderOAuthFlowStore.FlowID,
    })
    .meta({
      ref: "ProviderAuthAuthorization",
    })
  export type Authorization = z.infer<typeof Authorization>

  export const authorize = fn(
    z.object({
      providerID: z.string(),
      method: z.number(),
      inputs: z.record(z.string(), z.string()).optional(),
      scope: Scope.optional(),
    }),
    async (input): Promise<Authorization> => {
      const scope = input.scope ?? "project"
      const currentState = await state(scope)
      const auth = currentState.methods[input.providerID]
      if (!auth) throw new ProviderNotFound({ providerID: input.providerID })
      const method = auth.methods[input.method]
      if (!method) throw new MethodNotFound({ providerID: input.providerID, method: input.method })
      if (method.type !== "oauth") {
        throw new MethodAuthorizationTypeMismatch({
          providerID: input.providerID,
          method: input.method,
          expected: "oauth",
          actual: method.type,
        })
      }
      // Dispose settled plugin resources before opening the next durable
      // owner. If disposal is transiently unavailable, no new occurrence or
      // authorization side effect is created and the caller can retry.
      await disposeSettledExecutors(currentState.executors)
      const credentialProviderID = method.credentialProvider ?? input.providerID
      const observed = await Auth.observe(credentialProviderID)
      const ownerID = crypto.randomUUID()
      const flow = await ProviderOAuthFlowStore.open({
        providerID: input.providerID,
        credentialProviderID,
        expectedCredentialGeneration: observed.generation,
        ownerID,
        scope,
        method: input.method,
        inputsDigest: ProviderOAuthFlowStore.digestInputs(input.inputs),
      })
      let executor: OAuthExecutor | undefined
      const stopRenewal = renewPendingOwner(flow.id, ownerID, async () => {
        const current = await ProviderOAuthFlowStore.get(flow.id)
        if (current?.state === "pending") {
          if (current.exchangeOwnerID !== ownerID || (current.exchangeLeaseExpiresAt ?? 0) > Date.now()) return
          await ProviderOAuthFlowStore.settleExpiredPending({ id: flow.id, ownerID })
        }
        if (currentState.executors.get(flow.id) !== executor) return
        await executor?.dispose()
        currentState.executors.delete(flow.id)
      })
      let result: AuthOAuthResult | undefined
      try {
        result = await method.authorize(input.inputs)
        const renewed = await ProviderOAuthFlowStore.renewPending({ id: flow.id, ownerID }).catch(() => "transient")
        if (!renewed) throw new Error("Provider OAuth authorization occurrence lost its executor owner")
      } catch (error) {
        stopRenewal()
        const cleanupFailures: unknown[] = []
        try {
          await ProviderOAuthFlowStore.failPending({
            id: flow.id,
            ownerID,
            error: "Provider OAuth authorization preparation failed",
          })
        } catch (failure) {
          cleanupFailures.push(failure)
        }
        try {
          await result?.dispose?.()
        } catch (failure) {
          cleanupFailures.push(failure)
        }
        if (cleanupFailures.length > 0) {
          throw new AggregateError(
            [error, ...cleanupFailures],
            `Provider OAuth authorization ${flow.id} preparation and cleanup failed`,
          )
        }
        throw error
      }
      let disposal: Promise<void> | undefined
      executor = {
        result,
        ownerID,
        stopRenewal,
        async dispose() {
          if (disposal) return disposal
          disposal = Promise.resolve().then(() => result.dispose?.())
          try {
            await disposal
          } catch (error) {
            disposal = undefined
            throw error
          }
        },
      }
      currentState.executors.set(flow.id, executor)
      return {
        url: result.url,
        method: result.method,
        instructions: result.instructions,
        flowID: flow.id,
      }
    },
  )

  export const callback = fn(
    z.object({
      providerID: z.string(),
      method: z.number(),
      code: z.string().optional(),
      /** The exact flow this code belongs to. */
      flowID: ProviderOAuthFlowStore.FlowID,
      scope: Scope.optional(),
    }),
    async (input) => {
      const scope = input.scope ?? "project"
      const flow = await ProviderOAuthFlowStore.get(input.flowID)
      if (!flow || flow.state === "superseded") throw new OauthMissing({ providerID: input.providerID })
      if (flow.state !== "pending") {
        throw new OauthFlowAlreadySettled({ providerID: input.providerID, flowID: flow.id, state: flow.state })
      }
      if (flow.providerID !== input.providerID || flow.scope !== scope || flow.method !== input.method) {
        // The code in hand was produced by a different flow than the one the
        // caller believes it is finishing. Refusing here is what binds the
        // method to the occurrence — the old slot compared only provider IDs.
        throw new OauthFlowMismatch({
          providerID: input.providerID,
          flowID: flow.id,
          expectedMethod: flow.method,
          method: input.method,
        })
      }
      // Claim the executor exactly once; a concurrent second callback for the
      // same occurrence finds it gone.
      const executors = await state(scope).then((s) => s.executors)
      const match = executors.get(flow.id)
      if (!match) {
        // The occurrence is durable but its executor lived in a process that
        // is gone — or another caller is finishing it right now. Either way
        // this caller cannot finish it, and the reason is exact.
        throw new OauthFlowNotExecutable({ providerID: input.providerID, flowID: flow.id })
      }
      if (match.result.method === "code" && !input.code) {
        throw new OauthCodeMissing({ providerID: input.providerID })
      }
      let exchangeClaimed = false
      let exchangeFailure: unknown
      try {
        await ProviderCredentialExchange.authorization({
          flowID: flow.id,
          ownerID: match.ownerID,
          providerID: input.providerID,
          credentialProviderID: flow.credentialProviderID,
          claimed: async (mode) => {
            match.stopRenewal()
            if (mode === "exchange") {
              exchangeClaimed = true
              return
            }
            await match.dispose()
            if (executors.get(flow.id) === match) executors.delete(flow.id)
          },
          exchange: async () => {
            const result =
              match.result.method === "code" ? await match.result.callback(input.code!) : await match.result.callback()
            if (result.type !== "success") throw new OauthCallbackFailed({})

            let credential: Auth.Info
            if ("key" in result) {
              credential = { type: "api", key: result.key, metadata: result.metadata }
            } else {
              credential = {
                type: "oauth",
                access: result.access,
                refresh: result.refresh,
                expires: result.expires,
                ...(result.accountId ? { accountId: result.accountId } : {}),
                ...(result.enterpriseUrl ? { enterpriseUrl: result.enterpriseUrl } : {}),
              }
            }
            return credential
          },
        })
      } catch (error) {
        exchangeFailure = error
      }
      let disposeFailure: unknown
      if (exchangeClaimed) {
        try {
          await match.dispose()
          if (executors.get(flow.id) === match) executors.delete(flow.id)
        } catch (error) {
          disposeFailure = error
        }
      }
      if (exchangeFailure && disposeFailure) {
        throw new AggregateError(
          [exchangeFailure, disposeFailure],
          `Provider OAuth callback ${flow.id} failed and could not dispose`,
        )
      }
      if (exchangeFailure) throw exchangeFailure
      if (disposeFailure) throw disposeFailure
    },
  )

  const PromptOption = z.object({
    label: z.string(),
    value: z.string(),
    hint: z.string().optional(),
  })
  export const Prompt = z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("text"),
        key: z.string(),
        message: z.string(),
        placeholder: z.string().optional(),
      }),
      z.object({
        type: z.literal("select"),
        key: z.string(),
        message: z.string(),
        selectValue: z.string(),
        options: z.array(PromptOption).min(1),
      }),
    ])
    .meta({ ref: "ProviderAuthPrompt" })
  export type Prompt = z.infer<typeof Prompt>

  export function matchesWhen(rule: AuthPromptRule, inputs: Record<string, string>): boolean {
    const matches = inputs[rule.key] === rule.value
    return rule.op === "eq" ? matches : !matches
  }

  function selectPromptValue(
    prompt: Extract<NonNullable<AuthHook["methods"][number]["prompts"]>[number], { type: "select" }>,
  ) {
    const selectValue = typeof prompt.selectValue === "string" ? prompt.selectValue : ""
    if (!selectValue) {
      throw new Error(`Provider auth select prompt ${prompt.key} requires selectValue`)
    }
    if (!prompt.options.some((option) => option.value === selectValue)) {
      throw new Error(
        `Provider auth select prompt ${prompt.key} selectValue ${JSON.stringify(selectValue)} is not in options`,
      )
    }
    return selectValue
  }

  export const prompts = fn(
    z.object({
      providerID: z.string(),
      method: z.number(),
      inputs: z.record(z.string(), z.string()).optional(),
      scope: Scope.optional(),
    }),
    async (input): Promise<Prompt[]> => {
      const auth = await state(input.scope).then((s) => s.methods[input.providerID])
      if (!auth) return []
      const method = auth.methods[input.method]
      if (!method?.prompts) return []
      const currentInputs = input.inputs ?? {}
      return method.prompts
        .filter((prompt) => !prompt.when || matchesWhen(prompt.when, currentInputs))
        .map((p): Prompt => {
          if (p.type === "select") {
            return {
              type: "select",
              key: p.key,
              message: p.message,
              selectValue: selectPromptValue(p),
              options: p.options,
            }
          }
          return {
            type: "text",
            key: p.key,
            message: p.message,
            placeholder: p.placeholder,
          }
        })
    },
  )

  export const execute = fn(
    z.object({
      providerID: z.string(),
      method: z.number(),
      inputs: z.record(z.string(), z.string()).optional(),
      scope: Scope.optional(),
    }),
    async (input) => {
      const auth = await state(input.scope).then((s) => s.methods[input.providerID])
      if (!auth) throw new ProviderNotFound({ providerID: input.providerID })
      const method = auth.methods[input.method]
      if (!method) throw new MethodNotFound({ providerID: input.providerID, method: input.method })

      if (method.type !== "api") {
        throw new MethodExecutionTypeMismatch({
          providerID: input.providerID,
          method: input.method,
          expected: "api",
          actual: method.type,
        })
      }

      if (method.authorize) {
        const result = await method.authorize(input.inputs)
        if (result.type === "success") {
          const { key: _, ...inputMetadata } = input.inputs ?? {}
          const metadata = { ...inputMetadata, ...(result.metadata ?? {}) }
          await Auth.set(result.provider ?? input.providerID, {
            type: "api",
            key: result.key,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          })
          return
        }
        throw new AuthExecuteFailed({})
      }
      // API methods with provider-specific prompts use an explicit `key`
      // field; every other collected value is persisted as provider metadata.
      if (!input.inputs) throw new AuthExecuteFailed({})
      const key = input.inputs.key
      if (!key) throw new AuthExecuteFailed({})
      const { key: _, ...metadata } = input.inputs
      await Auth.set(input.providerID, {
        type: "api",
        key,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      })
    },
  )

  export const api = fn(
    z.object({
      providerID: z.string(),
      key: z.string(),
    }),
    async (input) => {
      await Auth.set(input.providerID, {
        type: "api",
        key: input.key,
      })
    },
  )

  export const ProviderNotFound = NamedError.create(
    "ProviderAuthProviderNotFound",
    z.object({ providerID: z.string() }),
  )
  export const MethodNotFound = NamedError.create(
    "ProviderAuthMethodNotFound",
    z.object({ providerID: z.string(), method: z.number() }),
  )
  export const MethodExecutionTypeMismatch = NamedError.create(
    "ProviderAuthMethodExecutionTypeMismatch",
    z.object({
      providerID: z.string(),
      method: z.number(),
      expected: z.literal("api"),
      actual: z.literal("oauth"),
    }),
  )
  export const MethodAuthorizationTypeMismatch = NamedError.create(
    "ProviderAuthMethodAuthorizationTypeMismatch",
    z.object({
      providerID: z.string(),
      method: z.number(),
      expected: z.literal("oauth"),
      actual: z.literal("api"),
    }),
  )
  export const AuthExecuteFailed = NamedError.create("ProviderAuthExecuteFailed", z.object({}))

  export const OauthMissing = NamedError.create(
    "ProviderAuthOauthMissing",
    z.object({
      providerID: z.string(),
    }),
  )
  export const OauthCodeMissing = NamedError.create(
    "ProviderAuthOauthCodeMissing",
    z.object({
      providerID: z.string(),
    }),
  )

  export const OauthCallbackFailed = NamedError.create("ProviderAuthOauthCallbackFailed", z.object({}))

  export const OauthFlowMismatch = NamedError.create(
    "ProviderAuthOauthFlowMismatch",
    z.object({
      providerID: z.string(),
      flowID: z.string(),
      expectedMethod: z.number(),
      method: z.number(),
    }),
  )

  export const OauthFlowAlreadySettled = NamedError.create(
    "ProviderAuthOauthFlowAlreadySettled",
    z.object({ providerID: z.string(), flowID: z.string(), state: z.string() }),
  )

  export const OauthFlowNotExecutable = NamedError.create(
    "ProviderAuthOauthFlowNotExecutable",
    z.object({ providerID: z.string(), flowID: z.string() }),
  )
}
