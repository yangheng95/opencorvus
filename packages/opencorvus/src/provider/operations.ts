import { streamText } from "../llm/api"
import { Auth } from "../auth"
import type { Config } from "../config/config"
import { ProviderLLM } from "./llm"
import { Provider } from "./provider"
import { ProviderError } from "./error"

export type ProviderOperationScope = {
  config: () => Promise<Config.Info>
  global: boolean
}

export type DiscoverProviderModelsInput = {
  api: string
  apiKey?: string
  providerID?: string
}

export type ProviderOperationResult<T> = {
  body: T
  status: 200 | 400
}

function normalizeApiBaseURL(raw: string): string | undefined {
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
    url.hash = ""
    url.search = ""
    url.pathname = url.pathname.replace(/\/+$/, "") || "/"
    return url.toString()
  } catch {
    return undefined
  }
}

function providerAllowsSavedKey(provider: Provider.Info | undefined, requestedApi: string): boolean {
  if (!provider) return false
  const allowed = new Set<string>()
  for (const model of Object.values(provider.models)) {
    const normalized = normalizeApiBaseURL(model.api.url)
    if (normalized) allowed.add(normalized)
  }
  return allowed.has(requestedApi)
}

async function scopedProvider(providerID: string, scope: ProviderOperationScope, config: Config.Info) {
  return scope.global ? Provider.getProviderGlobal(providerID, config) : Provider.getProvider(providerID, { config })
}

async function scopedModel(providerID: string, modelID: string, scope: ProviderOperationScope, config: Config.Info) {
  return scope.global
    ? Provider.getModelGlobal(providerID, modelID, config)
    : Provider.getModel(providerID, modelID, { config })
}

async function scopedLanguage(model: Provider.Model, scope: ProviderOperationScope, config: Config.Info) {
  return scope.global ? Provider.getLanguageGlobal(model, config) : Provider.getLanguage(model, { config })
}

export async function discoverProviderModels(
  input: DiscoverProviderModelsInput,
  scope: ProviderOperationScope,
): Promise<ProviderOperationResult<{ ok: boolean; models: string[]; count: number; error?: string }>> {
  const explicitKey = input.apiKey?.trim()
  const savedAuth = input.providerID ? await Auth.get(input.providerID) : undefined
  const savedKey = savedAuth?.type === "api" ? savedAuth.key.trim() : ""
  const requestedApi = normalizeApiBaseURL(input.api)
  if (!requestedApi) {
    return {
      status: 400,
      body: { ok: false, models: [], count: 0, error: "API URL must be an absolute http:// or https:// URL." },
    }
  }
  if (!explicitKey && savedKey) {
    const config = await scope.config()
    const provider = input.providerID ? await scopedProvider(input.providerID, scope, config) : undefined
    if (!providerAllowsSavedKey(provider, requestedApi)) {
      return {
        status: 400,
        body: {
          ok: false,
          models: [],
          count: 0,
          error: "Saved provider credentials can only be used with that provider's configured API URL.",
        },
      }
    }
  }
  const modelsURL = `${requestedApi.replace(/\/+$/, "")}/models`
  const apiKey = explicitKey || savedKey

  try {
    const response = await fetch(modelsURL, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: AbortSignal.timeout(15_000),
    })
    const text = await response.text()
    if (!response.ok) {
      return {
        status: 200,
        body: {
          ok: false,
          models: [],
          count: 0,
          error: `GET ${modelsURL} returned HTTP ${response.status}: ${text || response.statusText}`,
        },
      }
    }
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return {
        status: 200,
        body: { ok: false, models: [], count: 0, error: `GET ${modelsURL} did not return JSON.` },
      }
    }
    const data = (json as { data?: unknown }).data
    if (!Array.isArray(data)) {
      return {
        status: 200,
        body: { ok: false, models: [], count: 0, error: `GET ${modelsURL} response must contain a data array.` },
      }
    }
    const models = Array.from(
      new Set(
        data
          .map((item) => (item && typeof item === "object" ? (item as { id?: unknown }).id : undefined))
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
          .map((id) => id.trim()),
      ),
    ).sort((a, b) => a.localeCompare(b))
    if (models.length === 0) {
      return {
        status: 200,
        body: { ok: false, models: [], count: 0, error: `GET ${modelsURL} returned no model ids.` },
      }
    }
    return { status: 200, body: { ok: true, models, count: models.length } }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      status: 200,
      body: { ok: false, models: [], count: 0, error: `GET ${modelsURL} failed: ${message}` },
    }
  }
}

export async function testProviderConnection(
  providerID: string,
  modelID: string | undefined,
  scope: ProviderOperationScope,
): Promise<
  ProviderOperationResult<{
    ok: boolean
    status: "connected" | "error"
    providerID: string
    modelID: string
    message: string
  }>
> {
  const config = await scope.config()
  const provider = await scopedProvider(providerID, scope, config)
  if (!provider) {
    return {
      status: 400,
      body: {
        ok: false,
        status: "error",
        providerID,
        modelID: modelID ?? "",
        message: "Provider is not configured. Set API key or auth first.",
      },
    }
  }
  const selectedModelID = modelID ?? Provider.sort(Object.values(provider.models))[0]?.id
  if (!selectedModelID) {
    return {
      status: 400,
      body: {
        ok: false,
        status: "error",
        providerID,
        modelID: "",
        message: "Provider has no available models.",
      },
    }
  }

  try {
    const model = await scopedModel(providerID, selectedModelID, scope, config)
    const language = ProviderLLM.wrapModel(await scopedLanguage(model, scope, config), model, {})
    const auth = await Auth.get(providerID)
    const isCodexOauth = providerID === "openai" && auth?.type === "oauth"
    const stream = streamText({
      model: language,
      usagePurpose: "provider-connectivity",
      timeoutMs: false,
      ...(isCodexOauth ? {} : { maxOutputTokens: 64 }),
      abortSignal: AbortSignal.timeout(30_000),
      messages: [{ role: "user", content: "Reply with OK." }],
      ...(isCodexOauth && {
        providerOptions: { openai: { store: false, instructions: "You are a coding assistant. Reply concisely." } },
      }),
    })
    const streamErrors: string[] = []
    for await (const part of stream.fullStream) {
      if (part.type === "error") {
        const error = part.error
        streamErrors.push(
          ProviderError.redactSensitiveProviderText(error instanceof Error ? error.message : String(error)),
        )
      }
    }
    if (streamErrors.length > 0) {
      return {
        status: 200,
        body: { ok: false, status: "error", providerID, modelID: selectedModelID, message: streamErrors.join("; ") },
      }
    }
    return {
      status: 200,
      body: { ok: true, status: "connected", providerID, modelID: selectedModelID, message: "Provider is reachable." },
    }
  } catch (error) {
    if (Auth.findReadError(error)) throw error
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : undefined
    const message = ProviderError.redactSensitiveProviderText(
      cause?.message || (error instanceof Error ? error.message : String(error)),
    )
    return {
      status: 200,
      body: { ok: false, status: "error", providerID, modelID: selectedModelID, message },
    }
  }
}
