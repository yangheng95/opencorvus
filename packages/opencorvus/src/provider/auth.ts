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
    return { methods, executors: new Map<string, AuthOAuthResult>() }
  }

  const projectState = createInstanceState(() => Plugin.list().then(createState), undefined, "provider-auth")
  const globalState = lazy(() => Plugin.listGlobalProviderHooks().then(createState))
  let globalStateOverrideForTest: ReturnType<typeof createState> | undefined

  function state(scope: Scope = "project") {
    if (scope === "global" && globalStateOverrideForTest) return globalStateOverrideForTest
    return scope === "global" ? globalState() : projectState()
  }

  /**
   * Hold a flow's live executor, releasing every executor whose flow is no
   * longer pending. The open that minted this flow superseded any previous
   * pending occurrence for the provider and scope; without the sweep the
   * superseded closure (and its PKCE material) would live as long as the
   * scope's state — for the global scope, the life of the process.
   */
  async function holdExecutor(scope: Scope, flowID: string, executor: AuthOAuthResult) {
    const executors = await state(scope).then((s) => s.executors)
    for (const id of [...executors.keys()]) {
      const record = await ProviderOAuthFlowStore.get(id)
      if (!record || record.state !== "pending") executors.delete(id)
    }
    executors.set(flowID, executor)
  }

  export const TestHooks = {
    installGlobalAuthHooksForTest(hooks: Parameters<typeof createState>[0]): Disposable {
      const override = createState(hooks)
      globalStateOverrideForTest = override
      return {
        [Symbol.dispose]() {
          if (globalStateOverrideForTest === override) globalStateOverrideForTest = undefined
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
      flowID: z.string(),
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
    async (input): Promise<Authorization | undefined> => {
      const auth = await state(input.scope).then((s) => s.methods[input.providerID])
      const method = auth.methods[input.method]
      if (method.type === "oauth") {
        const result = await method.authorize(input.inputs)
        // The durable occurrence supersedes any pending flow for this
        // provider and scope — an explicit fact of the old flow, not a silent
        // replacement — and the live executor is held under the occurrence's
        // own identity.
        const flow = await ProviderOAuthFlowStore.open({
          providerID: input.providerID,
          scope: input.scope ?? "project",
          method: input.method,
          inputsDigest: ProviderOAuthFlowStore.digestInputs(input.inputs),
        })
        await holdExecutor(input.scope ?? "project", flow.id, result)
        return {
          url: result.url,
          method: result.method,
          instructions: result.instructions,
          flowID: flow.id,
        }
      }
    },
  )

  export const callback = fn(
    z.object({
      providerID: z.string(),
      method: z.number(),
      code: z.string().optional(),
      /** The exact flow this code belongs to. Omitted, the current pending
       *  occurrence for the provider and scope is resolved — and must still
       *  match the declared method. */
      flowID: z.string().optional(),
      scope: Scope.optional(),
    }),
    async (input) => {
      const scope = input.scope ?? "project"
      const flow = input.flowID
        ? await ProviderOAuthFlowStore.get(input.flowID)
        : await ProviderOAuthFlowStore.pendingFor(input.providerID, scope)
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
      executors.delete(flow.id)
      if (!match) {
        // The occurrence is durable but its executor lived in a process that
        // is gone — or another caller is finishing it right now. Either way
        // this caller cannot finish it, and the reason is exact.
        throw new OauthFlowNotExecutable({ providerID: input.providerID, flowID: flow.id })
      }
      let result

      try {
        if (match.method === "code") {
          if (!input.code) throw new OauthCodeMissing({ providerID: input.providerID })
          result = await match.callback(input.code)
        }

        if (match.method === "auto") {
          result = await match.callback()
        }
      } catch (error) {
        await ProviderOAuthFlowStore.settle({
          id: flow.id,
          state: "failed",
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }

      if (result?.type === "success") {
        // Consuming the occurrence before the credential write makes the
        // write single-shot: a concurrent callback that lost the settle race
        // must not write a second credential for the same flow.
        const consumed = await ProviderOAuthFlowStore.settle({ id: flow.id, state: "consumed" })
        if (!consumed) {
          // Losing the settle means another writer got there first — for a
          // claimed executor that can only be a supersession, so no
          // credential was written. Report the flow's real durable state.
          const settled = await ProviderOAuthFlowStore.get(flow.id)
          throw new OauthFlowAlreadySettled({
            providerID: input.providerID,
            flowID: flow.id,
            state: settled?.state ?? "superseded",
          })
        }
        if ("key" in result) {
          await Auth.set(input.providerID, {
            type: "api",
            key: result.key,
            metadata: result.metadata,
          })
        }
        if ("refresh" in result) {
          const info: Auth.Info = {
            type: "oauth",
            access: result.access,
            refresh: result.refresh,
            expires: result.expires,
          }
          if (result.accountId) {
            info.accountId = result.accountId
          }
          if (result.enterpriseUrl) {
            info.enterpriseUrl = result.enterpriseUrl
          }
          await Auth.set(input.providerID, info)
        }
        return
      }

      await ProviderOAuthFlowStore.settle({
        id: flow.id,
        state: "failed",
        error: "Provider OAuth callback returned no credential",
      })
      throw new OauthCallbackFailed({})
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

      if (method.type === "api") {
        if (method.authorize) {
          const result = await method.authorize(input.inputs)
          if (result.type === "success") {
            await Auth.set(result.provider ?? input.providerID, {
              type: "api",
              key: result.key,
              metadata: result.metadata,
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
        return
      }

      if (method.type === "oauth") {
        const result = await method.authorize(input.inputs)
        const flow = await ProviderOAuthFlowStore.open({
          providerID: input.providerID,
          scope: input.scope ?? "project",
          method: input.method,
          inputsDigest: ProviderOAuthFlowStore.digestInputs(input.inputs),
        })
        await holdExecutor(input.scope ?? "project", flow.id, result)
        return
      }
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
