import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import fs from "fs/promises"
import lockfile from "proper-lockfile"
import z from "zod"
import { Installation } from "../installation"
import { Flag } from "../flag/flag"
import { lazy } from "@/util/lazy"
import { Filesystem } from "../util/filesystem"
import { withKeyedLock } from "../util/lock"
import bootstrapCatalogText from "./models-bootstrap.json" with { type: "text" }

export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" })
  const KILO_API_URL = "https://api.kilo.ai/api/gateway"
  const OMITTED_PRODUCT_PROVIDER_IDS = new Set(["opencorvus"])

  const ExperimentalModeCost = z
    .object({
      input: z.number(),
      output: z.number(),
      cache_read: z.number().optional(),
      cache_write: z.number().optional(),
    })
    .strict()

  const ExperimentalMode = z
    .object({
      cost: ExperimentalModeCost.optional(),
      provider: z
        .object({
          body: z.record(z.string(), z.unknown()),
          headers: z.record(z.string(), z.string()).optional(),
        })
        .strict(),
    })
    .strict()

  const Experimental = z
    .object({
      modes: z.record(z.string(), ExperimentalMode),
    })
    .strict()

  export const Model = z.object({
    id: z.string(),
    name: z.string(),
    family: z.string().optional(),
    release_date: z.string(),
    attachment: z.boolean(),
    reasoning: z.boolean(),
    temperature: z.boolean().default(false),
    tool_call: z.boolean(),
    interleaved: z
      .union([
        z.literal(true),
        z
          .object({
            field: z.enum(["reasoning_content", "reasoning_details"]),
          })
          .strict(),
      ])
      .optional(),
    cost: z
      .object({
        input: z.number(),
        output: z.number(),
        cache_read: z.number().optional(),
        cache_write: z.number().optional(),
        context_over_200k: z
          .object({
            input: z.number(),
            output: z.number(),
            cache_read: z.number().optional(),
            cache_write: z.number().optional(),
          })
          .optional(),
      })
      .optional(),
    limit: z.object({
      context: z.number(),
      input: z.number().optional(),
      output: z.number(),
    }),
    modalities: z
      .object({
        input: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
        output: z.array(z.enum(["text", "audio", "image", "video", "pdf"])),
      })
      .optional(),
    experimental: Experimental.optional(),
    status: z.enum(["alpha", "beta", "deprecated"]).optional(),
    options: z.record(z.string(), z.any()).default({}),
    headers: z.record(z.string(), z.string()).optional(),
    provider: z.object({ npm: z.string().optional(), api: z.string().optional() }).optional(),
    variants: z.record(z.string(), z.record(z.string(), z.any())).optional(),
  }).passthrough()
  export type Model = z.infer<typeof Model>

  export const Provider = z
    .object({
      api: z.string().optional(),
      name: z.string(),
      env: z.array(z.string()),
      id: z.string(),
      npm: z.string().optional(),
      models: z.record(z.string(), Model),
    })
    .passthrough()

  export type Provider = z.infer<typeof Provider>

  const Catalog = z.record(z.string(), Provider)

  function kiloModel(id: string): Model {
    return {
      id,
      name: id === "inclusionai/ling-2.6-1t" ? "inclusionAI: Ling-2.6-1T" : id,
      family: "ling",
      attachment: false,
      reasoning: false,
      tool_call: true,
      temperature: true,
      release_date: "2026-04-23",
      modalities: {
        input: ["text"],
        output: ["text"],
      },
      limit: {
        context: 262_144,
        output: 32_768,
      },
      cost: {
        input: 0.3,
        output: 2.5,
        cache_read: 0.06,
      },
      options: {},
    }
  }

  function kiloProvider(input?: Provider): Provider {
    const ids = Object.keys(input?.models ?? {})
    const modelIDs = ids.length > 0 ? ids : ["inclusionai/ling-2.6-1t"]
    return {
      id: "kilo",
      env: input?.env ?? ["KILO_API_KEY"],
      npm: "@ai-sdk/openai-compatible",
      api: input?.api ?? KILO_API_URL,
      name: input?.name ?? "Kilo Gateway",
      models: Object.fromEntries(modelIDs.map((id) => [id, input?.models?.[id] ?? kiloModel(id)])),
    }
  }

  export function withLocalProviders(input: Record<string, Provider>): Record<string, Provider> {
    const catalog = withoutOmittedProductProviders(input)
    return {
      ...catalog,
      kilo: kiloProvider(input.kilo),
    }
  }

  function url() {
    return Flag.OPENCORVUS_MODELS_URL || "https://models.dev"
  }

  const LOCAL_PROVIDER_IDS = ["kilo"] as const
  const catalogWriterLocks = new Map<string, Promise<unknown>>()

  function withoutOmittedProductProviders(input: Record<string, Provider>): Record<string, Provider> {
    return Object.fromEntries(
      Object.entries(input).filter(([providerID]) => !OMITTED_PRODUCT_PROVIDER_IDS.has(providerID)),
    )
  }

  export function catalogPath(): string {
    return path.resolve(Flag.OPENCORVUS_MODELS_PATH ?? path.join(Global.Path.data, "models.json"))
  }

  function bootstrapCatalog(): Record<string, Provider> {
    let input: unknown
    try {
      input = JSON.parse(bootstrapCatalogText as unknown as string)
    } catch (error) {
      throw new Error(
        `Bundled model catalog is invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    const remote = parseCatalog(input, "bundled bootstrap", false)
    return parseCatalog(withLocalProviders(remote), "bundled bootstrap")
  }

  async function provisionDefaultCatalog(): Promise<void> {
    if (Flag.OPENCORVUS_MODELS_PATH) return
    const source = catalogPath()
    if (await Filesystem.exists(source)) return
    const body = JSON.stringify(bootstrapCatalog(), null, 2)
    const created = await Filesystem.writeAtomicIfAbsent(source, body, 0o600)
    if (created) log.info("provisioned bundled model catalog", { source })
  }

  async function writeCatalogTransaction(
    update: (current: Record<string, Provider>) => Record<string, Provider>,
  ): Promise<Record<string, Provider>> {
    const source = catalogPath()
    await provisionDefaultCatalog()
    await fs.mkdir(path.dirname(source), { recursive: true })
    return withKeyedLock(catalogWriterLocks, source, async () => {
      const release = await lockfile.lock(source, { realpath: false })
      try {
        const current = parseCatalog(await Filesystem.readJson<unknown>(source), source)
        const next = parseCatalog(update(current), source)
        await Filesystem.writeAtomic(source, JSON.stringify(next, null, 2), 0o600)
        ModelsDev.Data.reset()
        return next
      } finally {
        await release()
      }
    })
  }

  function parseCatalog(input: unknown, source: string, requireLocalProviders = true): Record<string, Provider> {
    const parsed = Catalog.safeParse(input)
    if (!parsed.success) {
      const details = parsed.error.issues
        .slice(0, 20)
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join("; ")
      throw new Error(`Model catalog ${source} is invalid: ${details}`)
    }
    const catalog = withoutOmittedProductProviders(parsed.data)
    if (requireLocalProviders) {
      for (const providerID of LOCAL_PROVIDER_IDS) {
        if (!catalog[providerID]) {
          throw new Error(`Model catalog ${source} is missing required provider ${providerID}`)
        }
      }
    }
    return catalog
  }

  export const Data = lazy(async () => {
    const source = catalogPath()
    await provisionDefaultCatalog()
    let input: unknown
    try {
      input = await Filesystem.readJson(source)
    } catch (error) {
      throw new Error(`Model catalog ${source} is unreadable: ${error instanceof Error ? error.message : String(error)}`)
    }
    return parseCatalog(input, source)
  })

  export async function get() {
    const result = await Data()
    return result as Record<string, Provider>
  }

  /**
   * Pull a fresh registry catalog from the configured URL and atomically replace
   * the canonical catalog file. Returns `{ ok: true, fetchedAt }` on a
   * successful update, otherwise `{ ok: false, error }`. Callers are the
   * UI button in ProvidersPanel, `opencorvus models --refresh`, and
   * `POST /provider/refresh` — there is no implicit invocation.
   */
  export async function refresh(): Promise<{ ok: true; fetchedAt: number } | { ok: false; error: string }> {
    try {
      const result = await fetch(`${url()}/api.json`, {
        headers: { "User-Agent": Installation.USER_AGENT },
        signal: AbortSignal.timeout(10 * 1000),
      })
      if (!result.ok) {
        const error = `${result.status} ${result.statusText}`
        log.error("registry refresh non-2xx", { error })
        return { ok: false, error }
      }
      const source = `${url()}/api.json`
      const remote = parseCatalog(await result.json(), source, false)
      await writeCatalogTransaction(() => withLocalProviders(remote))
      const fetchedAt = Date.now()
      log.info("registry refreshed", { fetchedAt })
      return { ok: true, fetchedAt }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      log.error("registry refresh failed", { error })
      return { ok: false, error }
    }
  }
}
