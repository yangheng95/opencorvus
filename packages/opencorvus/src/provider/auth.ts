import { createInstanceState } from "@/project/instance-state"
import { Plugin } from "../plugin"
import { map, filter, pipe, fromEntries, mapValues } from "remeda"
import z from "zod"
import { fn } from "@/util/fn"
import type { AuthHook, AuthOAuthResult, AuthPromptRule } from "@opencorvus-ai/plugin"
import { NamedError } from "@opencorvus-ai/util/error"
import { Auth } from "@/auth"
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
    return { methods, pending: {} as Record<string, AuthOAuthResult> }
  }

  const projectState = createInstanceState(() => Plugin.list().then(createState), undefined, "provider-auth")
  const globalState = lazy(() => Plugin.listGlobalProviderHooks().then(createState))

  function state(scope: Scope = "project") {
    return scope === "global" ? globalState() : projectState()
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
        await state(input.scope).then((s) => (s.pending[input.providerID] = result))
        return {
          url: result.url,
          method: result.method,
          instructions: result.instructions,
        }
      }
    },
  )

  export const callback = fn(
    z.object({
      providerID: z.string(),
      method: z.number(),
      code: z.string().optional(),
      scope: Scope.optional(),
    }),
    async (input) => {
      const match = await state(input.scope).then((s) => s.pending[input.providerID])
      if (!match) throw new OauthMissing({ providerID: input.providerID })
      let result

      if (match.method === "code") {
        if (!input.code) throw new OauthCodeMissing({ providerID: input.providerID })
        result = await match.callback(input.code)
      }

      if (match.method === "auto") {
        result = await match.callback()
      }

      if (result?.type === "success") {
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
        await state(input.scope).then((s) => (s.pending[input.providerID] = result))
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
}
