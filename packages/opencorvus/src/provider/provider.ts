import z from "zod"
import fuzzysort from "fuzzysort"
import { Config } from "../config/config"
import { mapValues, mergeDeep, omit, pickBy, sortBy } from "remeda"
import { APICallError, NoSuchModelError, type LanguageModel } from "ai"
import { Log } from "../util/log"
import { ModelsDev } from "./models"
import { NamedError } from "@opencorvus-ai/util/error"
import { Auth } from "../auth"
import { Env } from "../env"
import { Instance } from "../project/instance"
import { createInstanceState } from "../project/instance-state"
import { currentProjectDirectory } from "../project/instance-context"
import { Flag } from "../flag/flag"
import { iife } from "@/util/iife"
import { entries } from "@/util/object"
import { ProviderInfoSchema, ProviderModelSchema, type ProviderInfo, type ProviderModel } from "./model-schema"

import { ProviderTransform } from "./transform"
import { applyProviderPolicy } from "./policy"
import { CUSTOM_LOADERS, smallModelPriority, type CustomModelLoader } from "./vendor"
import { installProvider, loadProviderModule } from "./install"
import { InvalidModelReferenceError as ProviderInvalidModelReferenceError, parseModelReference } from "./model-ref"
import { ProviderError } from "./error"
import { proxiedFetchInit, resolveNetworkProxy } from "../util/network-proxy"
import { Plugin } from "../plugin"
import { BUNDLED_PROVIDERS } from "./bundled"
import { dashscopeKey } from "./dashscope"
import { canonicalDigestSource, containsRuntimeCapability } from "@/util/canonical-digest"
import { CanonicalCache } from "./canonical-cache"
import { activityTrackedReadableStream, withStreamActivity } from "@/util/stream-activity"

export namespace Provider {
  const log = Log.create({ service: "provider" })

  type LanguageModelProvider = {
    languageModel(modelId: string): LanguageModel
  }

  const DEFAULT_INACTIVITY_TIMEOUT_MS = 300_000
  const PROVIDER_INACTIVITY_TIMEOUT_MS: Record<string, number> = {
    "alibaba-coding-plan-cn": 60_000,
  }

  export function resolveFetchInactivityMs(providerID: string, configuredTimeout: unknown): number {
    const providerTimeout = PROVIDER_INACTIVITY_TIMEOUT_MS[providerID]
    const selectedTimeout =
      configuredTimeout !== undefined && configuredTimeout !== null
        ? configuredTimeout
        : (providerTimeout ?? DEFAULT_INACTIVITY_TIMEOUT_MS)

    if (selectedTimeout === false || typeof selectedTimeout !== "number" || selectedTimeout <= 0) return 0
    if (providerTimeout !== undefined) return Math.min(selectedTimeout, providerTimeout)
    return Math.max(selectedTimeout, DEFAULT_INACTIVITY_TIMEOUT_MS)
  }

  export function resolveFetchProxy(config: Config.Info): string | undefined {
    return resolveNetworkProxy(config, "llmProvider")
  }

  export function providerFetchInit(opts: BunFetchRequestInit, proxyUrl?: string): BunFetchRequestInit {
    return {
      ...proxiedFetchInit(opts, proxyUrl, "llmProvider"),
      // @ts-ignore see here: https://github.com/oven-sh/bun/issues/16682
      timeout: false,
    }
  }

  function googleVertexVars(options: Record<string, any>) {
    const project =
      options["project"] ??
      Env.get("GOOGLE_VERTEX_PROJECT") ??
      Env.get("GOOGLE_CLOUD_PROJECT") ??
      Env.get("GCP_PROJECT") ??
      Env.get("GCLOUD_PROJECT")
    const location =
      options["location"] ??
      Env.get("GOOGLE_VERTEX_LOCATION") ??
      Env.get("GOOGLE_CLOUD_LOCATION") ??
      Env.get("VERTEX_LOCATION") ??
      "us-central1"
    const endpoint = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`

    return {
      GOOGLE_VERTEX_PROJECT: project,
      GOOGLE_VERTEX_LOCATION: location,
      GOOGLE_VERTEX_ENDPOINT: endpoint,
    }
  }

  function loadBaseURL(model: Model, options: Record<string, any>) {
    const raw = options["baseURL"] ?? model.api.url
    if (typeof raw !== "string") return raw
    const vars = model.providerID === "google-vertex" ? googleVertexVars(options) : undefined
    return raw.replace(/\$\{([^}]+)\}/g, (match, key) => {
      const val = Env.get(String(key)) ?? vars?.[String(key) as keyof typeof vars]
      return val ?? match
    })
  }

  export const Model = ProviderModelSchema
  export type Model = ProviderModel

  function sourceModelStatus(provider: ModelsDev.Provider, model: ModelsDev.Model): Model["status"] {
    if (model.status === "deprecated") {
      throw new Error(`Deprecated source model ${provider.id}/${model.id} cannot be published`)
    }
    return model.status ?? "active"
  }

  export const Info = ProviderInfoSchema
  export type Info = ProviderInfo

  export const LoadIssue = z
    .object({
      phase: z.string(),
      providerID: z.string().optional(),
      modelID: z.string().optional(),
      message: z.string(),
    })
    .strict()
  export type LoadIssue = z.infer<typeof LoadIssue>

  function loadIssue(phase: string, error: unknown, providerID?: string, modelID?: string): LoadIssue {
    const issue = {
      phase,
      ...(providerID ? { providerID } : {}),
      ...(modelID ? { modelID } : {}),
      message: error instanceof Error ? error.message : String(error),
    }
    log.error("provider load phase failed", issue)
    return issue
  }

  export function dedupeLoadIssues(issues: LoadIssue[]): LoadIssue[] {
    return issues.filter(
      (issue, index) =>
        issues.findIndex(
          (candidate) =>
            candidate.phase === issue.phase &&
            candidate.providerID === issue.providerID &&
            candidate.modelID === issue.modelID &&
            candidate.message === issue.message,
        ) === index,
    )
  }

  export function mergeModelCost(
    existing: Model["cost"] | undefined,
    configured:
      | { input?: number; output?: number; cache_read?: number; cache_write?: number }
      | undefined,
  ): Model["cost"] {
    return {
      available: configured !== undefined || existing?.available === true,
      input: configured?.input ?? existing?.input ?? 0,
      output: configured?.output ?? existing?.output ?? 0,
      cache: {
        read: configured?.cache_read ?? existing?.cache.read ?? 0,
        write: configured?.cache_write ?? existing?.cache.write ?? 0,
      },
      experimentalOver200K: existing?.experimentalOver200K,
    }
  }

  function fromModelsDevModel(provider: ModelsDev.Provider, model: ModelsDev.Model): Model {
    const m: Model = {
      id: model.id,
      providerID: provider.id,
      name: model.name,
      family: model.family,
      api: {
        id: model.id,
        url: model.provider?.api ?? provider.api!,
        npm: model.provider?.npm ?? provider.npm ?? "@ai-sdk/openai-compatible",
      },
      status: sourceModelStatus(provider, model),
      headers: model.headers ?? {},
      options: model.options ?? {},
      cost: {
        available: model.cost !== undefined,
        input: model.cost?.input ?? 0,
        output: model.cost?.output ?? 0,
        cache: {
          read: model.cost?.cache_read ?? 0,
          write: model.cost?.cache_write ?? 0,
        },
        experimentalOver200K: model.cost?.context_over_200k
          ? {
              cache: {
                read: model.cost.context_over_200k.cache_read ?? 0,
                write: model.cost.context_over_200k.cache_write ?? 0,
              },
              input: model.cost.context_over_200k.input,
              output: model.cost.context_over_200k.output,
            }
          : undefined,
      },
      limit: {
        context: model.limit.context,
        input: model.limit.input,
        output: model.limit.output,
      },
      capabilities: {
        temperature: model.temperature,
        reasoning: model.reasoning,
        attachment: model.attachment,
        toolcall: model.tool_call,
        input: {
          text: model.modalities?.input?.includes("text") ?? false,
          audio: model.modalities?.input?.includes("audio") ?? false,
          image: model.modalities?.input?.includes("image") ?? false,
          video: model.modalities?.input?.includes("video") ?? false,
          pdf: model.modalities?.input?.includes("pdf") ?? false,
        },
        output: {
          text: model.modalities?.output?.includes("text") ?? false,
          audio: model.modalities?.output?.includes("audio") ?? false,
          image: model.modalities?.output?.includes("image") ?? false,
          video: model.modalities?.output?.includes("video") ?? false,
          pdf: model.modalities?.output?.includes("pdf") ?? false,
        },
        interleaved: model.interleaved ?? false,
      },
      release_date: model.release_date,
      variants: {},
    }

    m.variants = mapValues(ProviderTransform.variants(m), (v) => v)

    return m
  }

  export function fromModelsDevProvider(provider: ModelsDev.Provider): Info {
    return {
      id: provider.id,
      source: "custom",
      name: provider.name,
      env: provider.env ?? [],
      options: {},
      models: Object.fromEntries(
        Object.entries(provider.models)
          .filter(([, model]) => model.status !== "deprecated")
          .map(([id, model]) => [id, fromModelsDevModel(provider, model)]),
      ),
    }
  }

  type ProviderState = {
    config: Config.Info
    models: Map<string, LanguageModel>
    providers: { [providerID: string]: Info }
    database: { [providerID: string]: Info }
    issues: LoadIssue[]
    sdk: CanonicalCache<LanguageModelProvider>
    modelLoaders: {
      [providerID: string]: CustomModelLoader
    }
  }

  async function buildState(
    config: Config.Info,
    options: {
      environment?: Record<string, string | undefined>
      pluginHooks?: () => Promise<Awaited<ReturnType<typeof Plugin.list>>>
      includeCustomLoaders?: boolean
    } = {},
  ): Promise<ProviderState> {
    using _ = log.time("state")
    const issues: LoadIssue[] = []
    const modelsDev = await ModelsDev.get().catch((error) => {
      issues.push(loadIssue("catalog.read", error))
      return {} as Record<string, ModelsDev.Provider>
    })
    const database: Record<string, Info> = {}
    const failedProviderIDs = new Set<string>()
    for (const [providerID, provider] of Object.entries(modelsDev)) {
      try {
        database[providerID] = fromModelsDevProvider(provider)
      } catch (error) {
        issues.push(loadIssue("catalog.provider", error, providerID))
      }
    }

    const disabled = new Set(config.disabled_providers ?? [])
    const enabled = config.enabled_providers ? new Set(config.enabled_providers) : null
    let savedAuth: Record<string, Auth.Info> = {}
    try {
      savedAuth = await Auth.all()
    } catch (error) {
      issues.push(loadIssue("auth.read", error))
    }
    const plugins = await (options.pluginHooks?.() ?? Plugin.list()).catch((error) => {
      if (!Auth.findReadError(error)) issues.push(loadIssue("plugin.catalog", error))
      return []
    })

    for (const hook of plugins) {
      const projection = hook.provider
      if (!projection?.models || disabled.has(projection.id)) continue
      const provider = database[projection.id]
      if (!provider) continue
      try {
        const models = await projection.models(provider, { auth: await Auth.get(projection.id) })
        provider.models = Object.fromEntries(
          Object.entries(models).map(([modelID, model]) => [
            modelID,
            {
              ...model,
              id: modelID,
              providerID: projection.id,
              cost: {
                ...model.cost,
                available: model.cost.available === true,
              },
            },
          ]),
        )
      } catch (error) {
        failedProviderIDs.add(projection.id)
        delete database[projection.id]
        if (!Auth.findReadError(error)) issues.push(loadIssue("plugin.models", error, projection.id))
      }
    }

    function isProviderAllowed(providerID: string): boolean {
      if (enabled && !enabled.has(providerID)) return false
      if (disabled.has(providerID)) return false
      return true
    }

    const providers: { [providerID: string]: Info } = {}
    const languages = new Map<string, LanguageModel>()
    const modelLoaders: {
      [providerID: string]: CustomModelLoader
    } = {}
    const sdk = new CanonicalCache<LanguageModelProvider>()

    log.info("init")

    const configProviders = entries((config.provider ?? {}) as NonNullable<Config.Info["provider"]>)

    function mergeProvider(providerID: string, provider: Partial<Info>) {
      if (failedProviderIDs.has(providerID)) return
      const existing = providers[providerID]
      if (existing) {
        // @ts-expect-error
        providers[providerID] = mergeDeep(existing, provider)
        return
      }
      const match = database[providerID]
      if (!match) return
      // @ts-expect-error
      providers[providerID] = mergeDeep(match, provider)
    }

    // extend database from config
    for (const [providerID, provider] of configProviders) {
      try {
        const existing = database[providerID]
        const parsed: Info = {
          id: providerID,
          name: provider.name ?? existing?.name ?? providerID,
          env: provider.env ?? existing?.env ?? [],
          options: mergeDeep(existing?.options ?? {}, provider.options ?? {}),
          source: "config",
          models: existing?.models ?? {},
        }

        for (const [modelID, model] of entries((provider.models ?? {}) as NonNullable<Config.Provider["models"]>)) {
          try {
            const existingModel = parsed.models[model.id ?? modelID]
            const name = iife(() => {
              if (model.name) return model.name
              if (model.id && model.id !== modelID) return modelID
              return existingModel?.name ?? modelID
            })
            const parsedModel: Model = {
              id: modelID,
              api: {
                id: model.id ?? existingModel?.api.id ?? modelID,
                npm:
                  model.provider?.npm ??
                  provider.npm ??
                  existingModel?.api.npm ??
                  modelsDev[providerID]?.npm ??
                  "@ai-sdk/openai-compatible",
                url: model.provider?.api ?? provider?.api ?? existingModel?.api.url ?? modelsDev[providerID]?.api,
              },
              status: model.status ?? existingModel?.status ?? "active",
              name,
              providerID,
              capabilities: {
                temperature: model.temperature ?? existingModel?.capabilities.temperature ?? false,
                reasoning: model.reasoning ?? existingModel?.capabilities.reasoning ?? false,
                attachment: model.attachment ?? existingModel?.capabilities.attachment ?? false,
                toolcall: model.tool_call ?? existingModel?.capabilities.toolcall ?? true,
                input: {
                  text: model.modalities?.input?.includes("text") ?? existingModel?.capabilities.input.text ?? true,
                  audio: model.modalities?.input?.includes("audio") ?? existingModel?.capabilities.input.audio ?? false,
                  image: model.modalities?.input?.includes("image") ?? existingModel?.capabilities.input.image ?? false,
                  video: model.modalities?.input?.includes("video") ?? existingModel?.capabilities.input.video ?? false,
                  pdf: model.modalities?.input?.includes("pdf") ?? existingModel?.capabilities.input.pdf ?? false,
                },
                output: {
                  text: model.modalities?.output?.includes("text") ?? existingModel?.capabilities.output.text ?? true,
                  audio:
                    model.modalities?.output?.includes("audio") ?? existingModel?.capabilities.output.audio ?? false,
                  image:
                    model.modalities?.output?.includes("image") ?? existingModel?.capabilities.output.image ?? false,
                  video:
                    model.modalities?.output?.includes("video") ?? existingModel?.capabilities.output.video ?? false,
                  pdf: model.modalities?.output?.includes("pdf") ?? existingModel?.capabilities.output.pdf ?? false,
                },
                interleaved: model.interleaved ?? false,
              },
              cost: mergeModelCost(existingModel?.cost, model.cost),
              options: mergeDeep(existingModel?.options ?? {}, model.options ?? {}),
              limit: {
                context: model.limit?.context ?? existingModel?.limit?.context ?? 0,
                input: model.limit?.input ?? existingModel?.limit?.input,
                output: model.limit?.output ?? existingModel?.limit?.output ?? 0,
              },
              headers: mergeDeep(existingModel?.headers ?? {}, model.headers ?? {}),
              family: model.family ?? existingModel?.family ?? "",
              release_date: model.release_date ?? existingModel?.release_date ?? "",
              variants: {},
            }
            const merged = mergeDeep(ProviderTransform.variants(parsedModel), model.variants ?? {}) as Record<
              string,
              Record<string, unknown> & { disabled?: boolean }
            >
            parsedModel.variants = mapValues(
              pickBy(merged, (v) => !v.disabled),
              (v) => omit(v, ["disabled"]),
            )
            parsed.models[modelID] = parsedModel
          } catch (error) {
            delete parsed.models[modelID]
            issues.push(loadIssue("config.model", error, providerID, modelID))
          }
        }
        database[providerID] = parsed
      } catch (error) {
        failedProviderIDs.add(providerID)
        delete database[providerID]
        issues.push(loadIssue("config.provider", error, providerID))
      }
    }

    // load env
    const env = options.environment ?? Env.all()
    // DashScope providers share keys: try provider-specific env vars first,
    // then the shared DASHSCOPE_API_KEY.
    const dashscopeCommonKeys = ["DASHSCOPE_API_KEY"]
    for (const [providerID, provider] of entries(database)) {
      if (disabled.has(providerID)) continue
      // DashScope detection: any model in this provider uses a dashscope API URL.
      // Previously checked provider.api?.includes("dashscope") but Provider.Info
      // has no top-level .api field — api.url lives per-model.
      const isDashScope = Object.values(provider.models).some((m) => m.api?.url?.includes("dashscope"))
      // alibaba-cn has special embedded-key logic below
      if (providerID === "alibaba-cn" || providerID === "alibaba") continue
      const candidates = isDashScope ? [...provider.env, ...dashscopeCommonKeys] : provider.env
      const apiKey = candidates.map((item) => env[item]?.trim()).find(Boolean)
      if (!apiKey) continue
      // When the provider declares more than one env candidate (e.g. ["AZURE_KEY", "OPENAI_KEY"]),
      // we cannot guess which one carries the active credential. Leave key unset and let the SDK pick.
      if (!isDashScope && provider.env.length > 1) continue
      mergeProvider(providerID, {
        source: "env",
        key: apiKey,
      })
    }

    // alibaba-coding-plan-cn: no embedded key. Provider is still registered
    // via the env loop above (ALIBABA_CODING_PLAN_API_KEY / DASHSCOPE_API_KEY),
    // Auth.all(), config, or surfaced via database() for the UI to prompt input.

    // alibaba-cn: resolve key from DASHSCOPE_API_KEY or embedded key
    if (!disabled.has("alibaba-cn")) {
      try {
        const key = await dashscopeKey(env)
        if (key) {
          mergeProvider("alibaba-cn", {
            source: "env",
            key,
          })
        }
      } catch (error) {
        failedProviderIDs.add("alibaba-cn")
        delete providers["alibaba-cn"]
        issues.push(loadIssue("provider.credential", error, "alibaba-cn"))
      }
    }

    // load apikeys
    for (const [providerID, provider] of Object.entries(savedAuth)) {
      if (disabled.has(providerID)) continue
      if (provider.type === "api") {
        mergeProvider(providerID, {
          source: "api",
          key: provider.key,
        })
      }
    }

    for (const plugin of plugins) {
      if (!plugin.auth) continue
      const providerID = plugin.auth.provider
      if (disabled.has(providerID)) continue

      try {
        const auth = await Auth.get(providerID)
        if (!auth) continue
        if (!plugin.auth.loader) continue

        const pluginOptions = await plugin.auth.loader(
          () => Auth.get(providerID) as any,
          database[plugin.auth.provider],
        )
        const opts = pluginOptions ?? {}
        const patch: Partial<Info> = providers[providerID] ? { options: opts } : { source: "custom", options: opts }
        mergeProvider(providerID, patch)
      } catch (error) {
        failedProviderIDs.add(providerID)
        delete providers[providerID]
        delete modelLoaders[providerID]
        if (!Auth.findReadError(error)) issues.push(loadIssue("plugin.auth", error, providerID))
      }
    }

    if (options.includeCustomLoaders !== false) {
      for (const [providerID, fn] of Object.entries(CUSTOM_LOADERS)) {
        if (disabled.has(providerID)) continue
        const data = database[providerID]
        if (!data) {
          log.error("Provider does not exist in model list " + providerID)
          continue
        }
        try {
          const result = await fn(data, { config })
          if (result && (result.autoload || providers[providerID])) {
            if (result.getModel) modelLoaders[providerID] = result.getModel
            const opts = result.options ?? {}
            const patch: Partial<Info> = providers[providerID] ? { options: opts } : { source: "custom", options: opts }
            mergeProvider(providerID, patch)
          }
        } catch (error) {
          failedProviderIDs.add(providerID)
          delete providers[providerID]
          delete modelLoaders[providerID]
          if (!Auth.findReadError(error)) issues.push(loadIssue("provider.loader", error, providerID))
        }
      }
    }

    // load config
    for (const [providerID, provider] of configProviders) {
      if (failedProviderIDs.has(providerID)) continue
      const partial: Partial<Info> = {
        source: "config",
      }
      if (provider.env) partial.env = provider.env
      if (provider.name) partial.name = provider.name
      if (provider.options) partial.options = provider.options
      mergeProvider(providerID, partial)
    }

    for (const [providerID, provider] of entries(providers)) {
      if (!isProviderAllowed(providerID)) {
        delete providers[providerID]
        continue
      }

      const configProvider = config.provider?.[providerID]

      for (const [modelID, model] of Object.entries(provider.models)) {
        try {
          model.api.id = model.api.id ?? model.id ?? modelID
          if (modelID === "gpt-5-chat-latest" || (providerID === "openrouter" && modelID === "openai/gpt-5-chat"))
            delete provider.models[modelID]
          if (model.status === "alpha" && !Flag.OPENCORVUS_ENABLE_EXPERIMENTAL_MODELS) delete provider.models[modelID]
          if (
            (configProvider?.blacklist && configProvider.blacklist.includes(modelID)) ||
            (configProvider?.whitelist && !configProvider.whitelist.includes(modelID))
          )
            delete provider.models[modelID]

          model.variants = mapValues(ProviderTransform.variants(model), (v) => v)

          // Filter out disabled variants from config
          const configVariants = configProvider?.models?.[modelID]?.variants
          if (configVariants && model.variants) {
            const merged = mergeDeep(model.variants, configVariants) as Record<
              string,
              Record<string, unknown> & { disabled?: boolean }
            >
            model.variants = mapValues(
              pickBy(merged, (v) => !v.disabled),
              (v) => omit(v, ["disabled"]),
            )
          }
        } catch (error) {
          delete provider.models[modelID]
          issues.push(loadIssue("provider.model", error, providerID, modelID))
        }
      }

      if (Object.keys(provider.models).length === 0) {
        delete providers[providerID]
        continue
      }

      log.info("found", { providerID })
    }

    return {
      config,
      models: languages,
      providers,
      database,
      issues: dedupeLoadIssues(issues),
      sdk,
      modelLoaders,
    }
  }

  const state = createInstanceState(async () => buildState(Config.Info.parse(await Config.get())), undefined, "provider")
  const scopedStates = new Map<string, CanonicalCache<Promise<ProviderState>>>()
  const globalScopedStates = new CanonicalCache<Promise<ProviderState>>()

  function configStateSource(config: Config.Info) {
    const snapshot = Config.Info.parse(config)
    return {
      snapshot,
      source: canonicalDigestSource("opencorvus.provider.config-state.v1", snapshot),
    }
  }

  function cachedState(
    states: CanonicalCache<Promise<ProviderState>>,
    source: ReturnType<typeof canonicalDigestSource>,
    init: () => Promise<ProviderState>,
  ): Promise<ProviderState> {
    const existing = states.get(source)
    if (existing) return existing
    const next = init().catch((error) => {
      states.delete(source, next)
      throw error
    })
    states.set(source, next)
    return next
  }

  function stateFor(config?: Config.Info): Promise<ProviderState> {
    if (!config) return state()
    const snapshot = Config.Info.parse(config)
    if (containsRuntimeCapability(snapshot)) return buildState(snapshot)
    const { source } = configStateSource(snapshot)
    const directory = currentProjectDirectory()
    const states = scopedStates.get(directory) ?? new CanonicalCache<Promise<ProviderState>>()
    scopedStates.set(directory, states)
    return cachedState(states, source, () => buildState(snapshot))
  }

  function globalStateFor(config: Config.Info): Promise<ProviderState> {
    const snapshot = Config.Info.parse(config)
    if (containsRuntimeCapability(snapshot)) {
      return buildState(snapshot, {
        environment: { ...process.env },
        pluginHooks: Plugin.listGlobalProviderHooks,
        includeCustomLoaders: false,
      })
    }
    const { source } = configStateSource(snapshot)
    return cachedState(globalScopedStates, source, () =>
      buildState(snapshot, {
        environment: { ...process.env },
        pluginHooks: Plugin.listGlobalProviderHooks,
        includeCustomLoaders: false,
      }),
    )
  }

  export async function reset(): Promise<void> {
    scopedStates.delete(currentProjectDirectory())
    await state.reset()
  }

  export async function resetAll(): Promise<void> {
    scopedStates.clear()
    globalScopedStates.clear()
    await state.resetAll()
  }

  export type RefreshCatalogResult = Awaited<ReturnType<typeof ModelsDev.refresh>>

  /** Refresh only the provider registry declaration. Live provider model lists have a separate explicit writer. */
  export async function refreshCatalog(): Promise<RefreshCatalogResult> {
    return await ModelsDev.refresh()
  }

  export type RefreshModelsResult =
    | {
        ok: true
        fetchedAt: number
        providers: Array<{ providerID: string; count: number; ids: string[] }>
      }
    | { ok: false; error: string }

  /** Refresh configured live model identities without refreshing the provider registry declaration. */
  export async function refreshModels(_config?: Config.Info): Promise<RefreshModelsResult> {
    return { ok: true, fetchedAt: Date.now(), providers: [] }
  }

  export async function list(opts?: { config?: Config.Info }) {
    return stateFor(opts?.config).then((state) => state.providers)
  }

  export async function listGlobal(config: Config.Info) {
    return globalStateFor(config).then((state) => state.providers)
  }

  export async function catalog(opts?: { config?: Config.Info }) {
    return stateFor(opts?.config).then((state) => ({
      database: state.database,
      providers: state.providers,
      issues: state.issues,
    }))
  }

  export async function catalogGlobal(config: Config.Info) {
    return globalStateFor(config).then((state) => ({
      database: state.database,
      providers: state.providers,
      issues: state.issues,
    }))
  }

  /**
   * Returns the augmented provider database — modelsDev entries plus any
   * built-in providers registered outside the remote catalog. Use this when you need the
   * full discoverable provider catalog (e.g. UI selectors that show
   * "API key required" for unconfigured providers); use list() when you only
   * want providers with actual credentials.
   */
  export async function database(opts?: { config?: Config.Info }) {
    return stateFor(opts?.config).then((state) => state.database)
  }

  export async function databaseGlobal(config: Config.Info) {
    return globalStateFor(config).then((state) => state.database)
  }

  async function getSDK(model: Model, opts?: { config?: Config.Info; state?: Promise<ProviderState> }) {
    try {
      using _ = log.time("getSDK", {
        providerID: model.providerID,
      })
      const s = await (opts?.state ?? stateFor(opts?.config))
      const config = s.config
      const provider = s.providers[model.providerID]
      const options = { ...provider.options }
      if (options["apiKey"] === undefined && provider.key) options["apiKey"] = provider.key
      applyProviderPolicy(model.providerID, options)

      if (model.providerID === "google-vertex" && !model.api.npm.includes("@ai-sdk/openai-compatible")) {
        delete options.fetch
      }

      if (model.api.npm.includes("@ai-sdk/openai-compatible") && options["includeUsage"] !== false) {
        options["includeUsage"] = true
      }

      const baseURL = loadBaseURL(model, options)
      if (baseURL !== undefined) options["baseURL"] = baseURL
      if (model.headers)
        options["headers"] = {
          ...options["headers"],
          ...model.headers,
        }

      const customFetch = options["fetch"]
      const proxyUrl = customFetch ? undefined : resolveFetchProxy(config)
      const declarativeOptions = { ...options }
      delete declarativeOptions["fetch"]
      const sdkSource = customFetch || containsRuntimeCapability(declarativeOptions)
        ? undefined
        : canonicalDigestSource("opencorvus.provider.sdk-instance.v1", {
            providerID: model.providerID,
            npm: model.api.npm,
            options: declarativeOptions,
          })
      const existing = sdkSource ? s.sdk.get(sdkSource) : undefined
      if (existing) return existing

      options["fetch"] = async (input: any, init?: BunFetchRequestInit) => {
        // Preserve custom fetch if it exists, wrap it with timeout logic
        const fetchFn = customFetch ?? fetch
        const opts = init ?? {}

        // Stable providers retain the 5min minimum for long model thinking.
        // alibaba-coding-plan-cn is documented to hang during peak hours, so
        // it is clamped fail-fast and never burns the orchestrator for 5min.
        const inactivityMs = resolveFetchInactivityMs(model.providerID, options["timeout"])

        // Inactivity-based abort: fires if no activity for the configured period.
        // The timer starts NOW (covers the initial connection phase) and resets
        // on every streaming chunk. This handles both:
        // - Server hangs before sending any response (initial connect timeout)
        // - Server stops sending data mid-stream (stream stall timeout)
        const fetchActivity =
          inactivityMs > 0
            ? withStreamActivity({
                idleMs: inactivityMs,
                signal: opts.signal ?? undefined,
                label: `provider:${model.providerID}`,
              })
            : undefined

        if (fetchActivity) {
          fetchActivity.signal.addEventListener(
            "abort",
            () => {
              if (fetchActivity.timedOut()) {
                log.warn("fetch inactivity timeout — no data for configured period, aborting", {
                  providerID: model.providerID,
                  inactivityMs,
                })
              }
              fetchActivity.dispose()
            },
            { once: true },
          )
          opts.signal = fetchActivity.signal
        }

        try {
          // Strip openai itemId metadata following what codex does
          // Codex uses #[serde(skip_serializing)] on id fields for all item types:
          // Message, Reasoning, FunctionCall, LocalShellCall, CustomToolCall, WebSearchCall
          // IDs are only re-attached for Azure with store=true
          if (model.api.npm === "@ai-sdk/openai" && opts.body && opts.method === "POST") {
            const body = JSON.parse(opts.body as string)
            const isAzure = model.providerID.includes("azure")
            const keepIds = isAzure && body.store === true
            if (!keepIds && Array.isArray(body.input)) {
              for (const item of body.input) {
                if ("id" in item) {
                  delete item.id
                }
              }
              opts.body = JSON.stringify(body)
            }
          }

          const response = await fetchFn(input, providerFetchInit(opts, proxyUrl))

          // Response headers are physical upstream activity.
          fetchActivity?.observe()

          // Some SDKs (e.g. @ai-sdk/openai-compatible) do not surface HTTP
          // errors from streaming responses — they silently consume the body
          // and later throw a generic "No output generated" error.  Extract
          // the upstream error here so callers get actionable messages.
          //
          // We throw an APICallError (not a plain Error) so:
          //   1. Message.fromError takes the APICallError branch and produces a
          //      Message.APIError with statusCode/isRetryable preserved
          //      (instead of falling through to NamedError.Unknown which loses
          //      the status and is treated as fatal).
          //   2. SessionRetry.retryable / llm/api.ts retryable() classify
          //      transient 408/429/5xx as retryable via the standard AI SDK
          //      contract, so the session loop backs off and retries instead
          //      of bubbling the failure up to the orchestrator stream-error
          //      path. Without this, an alibaba 429 rate-limit blew up the
          //      orchestrator into an "unknown session error" wake loop —
          //      see _session-20260428-130617.out incident.
          if (!response.ok) {
            fetchActivity?.dispose()
            const text = ProviderError.redactSensitiveProviderText(await response.text().catch(() => ""))
            let detail = ""
            try {
              const json = JSON.parse(text)
              detail = json?.error?.message ?? json?.message ?? text
            } catch {
              detail = text
            }
            const responseHeaders: Record<string, string> = {}
            response.headers.forEach((value, key) => {
              responseHeaders[key] = value
            })
            let requestBodyValues: unknown = undefined
            if (typeof opts.body === "string") {
              try {
                requestBodyValues = JSON.parse(opts.body)
              } catch {
                requestBodyValues = opts.body
              }
            }
            // fetch accepts string | URL | Request; URL has .href, Request has .url
            const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input?.url ?? "")
            throw new APICallError({
              message: ProviderError.redactSensitiveProviderText(
                `Provider ${model.providerID} returned HTTP ${response.status}: ${detail || response.statusText}`,
              ),
              url,
              requestBodyValues,
              statusCode: response.status,
              responseHeaders,
              responseBody: text,
            })
          }

          // For streaming responses, wrap the body so each chunk resets the timer.
          if (fetchActivity && response.body) {
            const wrapped = activityTrackedReadableStream({
              source: response.body,
              activity: fetchActivity,
            })

            // Return a new Response with the wrapped body, preserving headers/status
            return new Response(wrapped, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            })
          }

          // Non-streaming response — clear the inactivity timer
          fetchActivity?.dispose()
          return response
        } catch (error) {
          fetchActivity?.dispose()
          throw error
        }
      }

      const bundledFn = BUNDLED_PROVIDERS[model.api.npm]
      if (bundledFn) {
        log.info("using bundled provider", { providerID: model.providerID, pkg: model.api.npm })
        const loaded = bundledFn({
          name: model.providerID,
          ...options,
        })
        if (sdkSource) s.sdk.set(sdkSource, loaded)
        return loaded as LanguageModelProvider
      }

      let installedPath: string
      if (!model.api.npm.startsWith("file://")) {
        installedPath = await installProvider(model.api.npm, "latest")
      } else {
        installedPath = model.api.npm
      }

      const fn = await loadProviderModule(installedPath)
      const loaded = fn({
        name: model.providerID,
        ...options,
      })
      if (sdkSource) s.sdk.set(sdkSource, loaded)
      return loaded as LanguageModelProvider
    } catch (e) {
      throw new InitError({ providerID: model.providerID }, { cause: e })
    }
  }

  export async function getProvider(providerID: string, opts?: { config?: Config.Info }) {
    return stateFor(opts?.config).then((s) => s.providers[providerID])
  }

  export async function getProviderGlobal(providerID: string, config: Config.Info) {
    return globalStateFor(config).then((s) => s.providers[providerID])
  }

  function modelFromState(s: ProviderState, providerID: string, modelID: string): Model {
    const provider = s.providers[providerID]
    if (!provider) {
      const availableProviders = Object.keys(s.providers)
      const matches = fuzzysort.go(providerID, availableProviders, { limit: 3, threshold: -10000 })
      const suggestions = matches.map((m) => m.target)
      throw new ModelNotFoundError({ providerID, modelID, suggestions })
    }

    const info = provider.models[modelID]
    if (!info) {
      const availableModels = Object.keys(provider.models)
      const matches = fuzzysort.go(modelID, availableModels, { limit: 3, threshold: -10000 })
      const suggestions = matches.map((m) => m.target)
      throw new ModelNotFoundError({ providerID, modelID, suggestions })
    }
    return info
  }

  export async function getModel(providerID: string, modelID: string, opts?: { config?: Config.Info }) {
    return modelFromState(await stateFor(opts?.config), providerID, modelID)
  }

  export async function getModelGlobal(providerID: string, modelID: string, config: Config.Info) {
    return modelFromState(await globalStateFor(config), providerID, modelID)
  }

  export async function getLanguage(
    model: Model,
    opts?: { config?: Config.Info; state?: Promise<ProviderState> },
  ): Promise<LanguageModel> {
    const s = await (opts?.state ?? stateFor(opts?.config))
    const provider = s.providers[model.providerID]
    const canonical = provider?.models[model.id]
    if (!provider || !canonical) {
      const availableModels = provider ? Object.keys(provider.models) : Object.keys(s.providers)
      const matches = fuzzysort.go(provider ? model.id : model.providerID, availableModels, {
        limit: 3,
        threshold: -10000,
      })
      const suggestions = matches.map((m) => m.target)
      throw new ModelNotFoundError({ providerID: model.providerID, modelID: model.id, suggestions })
    }

    const key = `${canonical.providerID}/${canonical.id}`
    if (s.models.has(key)) return s.models.get(key)!

    const sdk = await getSDK(canonical, opts)

    try {
      const language = s.modelLoaders[canonical.providerID]
        ? await s.modelLoaders[canonical.providerID](sdk, canonical.api.id, provider.options)
        : sdk.languageModel(canonical.api.id)
      s.models.set(key, language)
      return language
    } catch (e) {
      if (e instanceof NoSuchModelError)
        throw new ModelNotFoundError(
          {
            modelID: canonical.id,
            providerID: canonical.providerID,
          },
          { cause: e },
        )
      throw e
    }
  }

  export async function getLanguageGlobal(model: Model, config: Config.Info): Promise<LanguageModel> {
    const globalState = globalStateFor(config)
    return getLanguage(model, { config, state: globalState })
  }

  export async function closest(providerID: string, query: string[], opts?: { config?: Config.Info }) {
    const s = await stateFor(opts?.config)
    const provider = s.providers[providerID]
    if (!provider) return undefined
    for (const item of query) {
      for (const modelID of Object.keys(provider.models)) {
        if (modelID.includes(item))
          return {
            providerID,
            modelID,
          }
      }
    }
  }

  export async function getSmallModel(providerID: string, opts?: { config?: Config.Info }) {
    const cfg = opts?.config ?? (await Config.get())

    if (cfg.small_model) {
      const parsed = parseModel(cfg.small_model)
      return getModel(parsed.providerID, parsed.modelID, { config: cfg })
    }

    const provider = await stateFor(opts?.config).then((state) => state.providers[providerID])
    if (provider) {
      const priority = smallModelPriority(providerID)
      for (const item of priority) {
        if (providerID === "amazon-bedrock") {
          const crossRegionPrefixes = ["global.", "us.", "eu."]
          const candidates = Object.keys(provider.models).filter((m) => m.includes(item))

          // Model selection priority:
          // 1. global. prefix (works everywhere)
          // 2. User's region prefix (us., eu.)
          // 3. Unprefixed model
          const globalMatch = candidates.find((m) => m.startsWith("global."))
          if (globalMatch) return getModel(providerID, globalMatch, { config: cfg })

          const region = provider.options?.region
          if (region) {
            const regionPrefix = region.split("-")[0]
            if (regionPrefix === "us" || regionPrefix === "eu") {
              const regionalMatch = candidates.find((m) => m.startsWith(`${regionPrefix}.`))
              if (regionalMatch) return getModel(providerID, regionalMatch, { config: cfg })
            }
          }

          const unprefixed = candidates.find((m) => !crossRegionPrefixes.some((p) => m.startsWith(p)))
          if (unprefixed) return getModel(providerID, unprefixed, { config: cfg })
        } else {
          for (const model of Object.keys(provider.models)) {
            if (model.includes(item)) return getModel(providerID, model, { config: cfg })
          }
        }
      }
    }

    return undefined
  }

  const priority = ["gpt-5", "claude-sonnet-4", "gemini-3-pro"]
  export function sort(models: Model[]) {
    return sortBy(
      models,
      [
        (model) =>
          priority.findIndex(
            (filter) => model.id === filter || model.id.startsWith(filter + "-") || model.id.startsWith(filter + "."),
          ),
        "desc",
      ],
      [(model) => (model.id.includes("latest") ? 0 : 1), "asc"],
      [(model) => model.id, "desc"],
    )
  }

  // Provider.defaultModel() was removed (spec §13.2, rule 8). It duplicated
  // `cfg.model → parseModel → throw` already owned by
  // agent/model.ts:resolveConfiguredModelRef, which is now THE single
  // configured-model entrypoint (and also applies session overlay). All
  // former callers funnel through resolveConfiguredModelRef / resolveAgentModel.

  export function parseModel(model: string) {
    return parseModelReference(model)
  }

  export const InvalidModelReferenceError = ProviderInvalidModelReferenceError

  export const ModelNotFoundError = NamedError.create(
    "ProviderModelNotFoundError",
    z.object({
      providerID: z.string(),
      modelID: z.string(),
      suggestions: z.array(z.string()).optional(),
    }),
  )

  // Provider.MissingModelConfigError removed with defaultModel() (spec §13.2,
  // rule 8). The single MissingModelConfigError lives in config/model-resolution-error.ts;
  // its NamedError name string is unchanged so name-based handling still works.

  export const InitError = NamedError.create(
    "ProviderInitError",
    z.object({
      providerID: z.string(),
    }),
  )
}
