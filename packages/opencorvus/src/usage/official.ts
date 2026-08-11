import { Env as RuntimeEnv } from "@/runtime/env"
import Decimal from "decimal.js"
import z from "zod"

export namespace OfficialUsage {
  const Status = z.enum(["available", "partial", "unconfigured", "requires_configuration", "error"])
  const Authority = z.enum(["organization_usage", "financial_ledger", "account_credit", "cloud_control_plane"])
  const Tokens = z
    .object({
      input: z.number().nonnegative(),
      output: z.number().nonnegative(),
      cacheRead: z.number().nonnegative().nullable(),
      cacheWrite: z.number().nonnegative().nullable(),
      reasoning: z.number().nonnegative().nullable(),
      total: z.number().nonnegative(),
      calls: z.number().int().nonnegative().nullable(),
      inputIncludesCache: z.boolean(),
    })
    .strict()
    .meta({ ref: "OfficialUsageTokens" })

  const Reconciliation = z
    .object({
      localTokens: z.number().nonnegative(),
      officialTokens: z.number().nonnegative(),
      tokenDelta: z.number(),
      localEstimatedCostUSD: z.number().nonnegative(),
      officialCostUSD: z.number().nonnegative().nullable(),
      costDeltaUSD: z.number().nullable(),
      additive: z.literal(false),
    })
    .strict()
    .meta({ ref: "OfficialUsageReconciliation" })

  const OpenRouterKeyUsage = z
    .object({
      hash: z.string(),
      name: z.string(),
      disabled: z.boolean(),
      limitUSD: z.number().nonnegative().nullable(),
      limitRemainingUSD: z.number().nullable(),
      limitReset: z.enum(["daily", "weekly", "monthly"]).nullable(),
      includeByokInLimit: z.boolean(),
      usageUSD: z.number().nonnegative(),
      usageDailyUSD: z.number().nonnegative(),
      usageWeeklyUSD: z.number().nonnegative(),
      usageMonthlyUSD: z.number().nonnegative(),
      byokUsageUSD: z.number().nonnegative(),
      byokUsageDailyUSD: z.number().nonnegative(),
      byokUsageWeeklyUSD: z.number().nonnegative(),
      byokUsageMonthlyUSD: z.number().nonnegative(),
      createdAt: z.string(),
      updatedAt: z.string().nullable(),
    })
    .strict()
    .meta({ ref: "OfficialOpenRouterKeyUsage" })

  const OpenRouterKeyLedger = z
    .object({
      count: z.number().int().nonnegative(),
      activeCount: z.number().int().nonnegative(),
      limitedCount: z.number().int().nonnegative(),
      usageUSD: z.number().nonnegative(),
      usageDailyUSD: z.number().nonnegative(),
      usageWeeklyUSD: z.number().nonnegative(),
      usageMonthlyUSD: z.number().nonnegative(),
      byokUsageUSD: z.number().nonnegative(),
      byokUsageDailyUSD: z.number().nonnegative(),
      byokUsageWeeklyUSD: z.number().nonnegative(),
      byokUsageMonthlyUSD: z.number().nonnegative(),
      items: OpenRouterKeyUsage.array(),
    })
    .strict()
    .meta({ ref: "OfficialOpenRouterKeyLedger" })

  export const Source = z
    .object({
      id: z.string(),
      providerID: z.string(),
      label: z.string(),
      status: Status,
      authorities: Authority.array(),
      scope: z.string(),
      freshness: z.string(),
      credentialEnv: z.string().nullable(),
      documentationURL: z.string().url(),
      message: z.string().nullable(),
      period: z.object({ start: z.number().int(), end: z.number().int() }).strict().nullable(),
      periodAlignment: z.enum(["exact", "utc_day_envelope"]).nullable(),
      tokens: Tokens.nullable(),
      costUSD: z.number().nonnegative().nullable(),
      credits: z
        .object({ purchasedUSD: z.number().nonnegative(), usedUSD: z.number().nonnegative(), remainingUSD: z.number() })
        .strict()
        .nullable(),
      keyUsage: OpenRouterKeyLedger.nullable(),
      reconciliation: Reconciliation.nullable(),
    })
    .strict()
    .meta({ ref: "OfficialUsageSource" })
  export type Source = z.infer<typeof Source>

  export const Result = z
    .object({
      fetchedAt: z.number().int(),
      sources: Source.array(),
      rule: z.literal("compare_never_sum"),
    })
    .strict()
    .meta({ ref: "OfficialUsageResult" })
  export type Result = z.infer<typeof Result>

  export type LocalProvider = {
    providerID: string
    tokens: number
    estimatedCostUSD: number
  }

  export type ReadInput = {
    start: number
    end: number
    local: readonly LocalProvider[]
  }

  type Dependencies = {
    fetch: typeof globalThis.fetch
    env: (name: string) => string | undefined
    now: () => number
  }

  const DEFAULT_DEPENDENCIES: Dependencies = {
    fetch: globalThis.fetch,
    env: (name) => RuntimeEnv.snapshot()[name],
    now: Date.now,
  }

  const OpenAIUsageResponse = z.object({
    data: z.array(
      z.object({
        results: z.array(
          z.object({
            input_tokens: z.number().nonnegative(),
            output_tokens: z.number().nonnegative(),
            input_cached_tokens: z.number().nonnegative().default(0),
            num_model_requests: z.number().int().nonnegative(),
          }),
        ),
      }),
    ),
    has_more: z.boolean(),
    next_page: z.string().nullable().optional(),
  })

  const OpenAICostResponse = z.object({
    data: z.array(
      z.object({
        results: z.array(
          z.object({
            amount: z.object({ currency: z.string(), value: z.number().nonnegative() }),
          }),
        ),
      }),
    ),
    has_more: z.boolean(),
    next_page: z.string().nullable().optional(),
  })

  const AnthropicUsageResponse = z.object({
    data: z.array(
      z.object({
        results: z.array(
          z.object({
            uncached_input_tokens: z.number().nonnegative(),
            cache_creation: z.object({
              ephemeral_1h_input_tokens: z.number().nonnegative(),
              ephemeral_5m_input_tokens: z.number().nonnegative(),
            }),
            cache_read_input_tokens: z.number().nonnegative(),
            output_tokens: z.number().nonnegative(),
          }),
        ),
      }),
    ),
    has_more: z.boolean(),
    next_page: z.string().nullable().optional(),
  })

  const AnthropicCostResponse = z.object({
    data: z.array(
      z.object({
        results: z.array(z.object({ amount: z.string().regex(/^\d+(?:\.\d+)?$/), currency: z.string() })),
      }),
    ),
    has_more: z.boolean(),
    next_page: z.string().nullable().optional(),
  })

  const OpenRouterCreditsResponse = z.object({
    data: z.object({ total_credits: z.number().nonnegative(), total_usage: z.number().nonnegative() }),
  })

  const OpenRouterKeysResponse = z.object({
    data: z.array(
      z.object({
        created_at: z.string(),
        updated_at: z.string().nullable(),
        hash: z.string(),
        name: z.string(),
        disabled: z.boolean(),
        limit: z.number().nonnegative().nullable(),
        limit_remaining: z.number().nullable(),
        limit_reset: z.enum(["daily", "weekly", "monthly"]).nullable(),
        include_byok_in_limit: z.boolean(),
        usage: z.number().nonnegative(),
        usage_daily: z.number().nonnegative(),
        usage_weekly: z.number().nonnegative(),
        usage_monthly: z.number().nonnegative(),
        byok_usage: z.number().nonnegative(),
        byok_usage_daily: z.number().nonnegative(),
        byok_usage_weekly: z.number().nonnegative(),
        byok_usage_monthly: z.number().nonnegative(),
      }),
    ),
  })

  function localFor(input: ReadInput, providerID: string): LocalProvider {
    return (
      input.local.find((item) => item.providerID === providerID) ?? {
        providerID,
        tokens: 0,
        estimatedCostUSD: 0,
      }
    )
  }

  function reconciliation(local: LocalProvider, officialTokens: number, officialCostUSD: number | null) {
    return {
      localTokens: local.tokens,
      officialTokens,
      tokenDelta: officialTokens - local.tokens,
      localEstimatedCostUSD: local.estimatedCostUSD,
      officialCostUSD,
      costDeltaUSD:
        officialCostUSD === null ? null : new Decimal(officialCostUSD).minus(local.estimatedCostUSD).toNumber(),
      additive: false as const,
    }
  }

  function utcDayEnvelope(input: ReadInput): { start: number; end: number; exact: boolean } {
    const day = 24 * 60 * 60 * 1_000
    const start = Math.floor(input.start / day) * day
    const end = Math.ceil(input.end / day) * day
    return { start, end, exact: start === input.start && end === input.end }
  }

  function failureMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Official usage source failed."
  }

  function base(
    input: Pick<
      Source,
      "id" | "providerID" | "label" | "authorities" | "scope" | "freshness" | "credentialEnv" | "documentationURL"
    >,
  ): Source {
    return {
      ...input,
      status: input.credentialEnv ? "unconfigured" : "requires_configuration",
      message: null,
      period: null,
      periodAlignment: null,
      tokens: null,
      costUSD: null,
      credits: null,
      keyUsage: null,
      reconciliation: null,
    }
  }

  function inventory(): Source[] {
    return [
      base({
        id: "openai-organization",
        providerID: "openai",
        label: "OpenAI organization",
        authorities: ["organization_usage", "financial_ledger"],
        scope: "Entire OpenAI organization; may include traffic outside OpenCorvus.",
        freshness: "Provider aggregation lag applies; Costs is the financial authority.",
        credentialEnv: "OPENAI_ADMIN_KEY",
        documentationURL:
          "https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage",
      }),
      base({
        id: "anthropic-organization",
        providerID: "anthropic",
        label: "Anthropic organization",
        authorities: ["organization_usage", "financial_ledger"],
        scope: "Entire Anthropic organization; may include traffic outside OpenCorvus.",
        freshness: "Provider aggregation lag applies; Cost Report is the financial authority.",
        credentialEnv: "ANTHROPIC_ADMIN_KEY",
        documentationURL: "https://platform.claude.com/docs/en/api/admin/usage_report/retrieve_messages",
      }),
      base({
        id: "openrouter-account",
        providerID: "openrouter",
        label: "OpenRouter account credits",
        authorities: ["account_credit"],
        scope: "Lifetime purchased and used credits for the authenticated OpenRouter account.",
        freshness: "Live account credit balance; not a natural-period Token ledger.",
        credentialEnv: "OPENROUTER_MANAGEMENT_KEY",
        documentationURL: "https://openrouter.ai/docs/api/api-reference/credits/get-credits",
      }),
      base({
        id: "aws-bedrock-control-plane",
        providerID: "amazon-bedrock",
        label: "AWS Bedrock control plane",
        authorities: ["cloud_control_plane"],
        scope: "AWS account and Region through CloudWatch plus Cost Explorer or CUR.",
        freshness: "CloudWatch and billing export grains differ.",
        credentialEnv: null,
        documentationURL: "https://docs.aws.amazon.com/bedrock/latest/userguide/cost-mgmt-request-metadata.html",
      }),
      base({
        id: "azure-openai-control-plane",
        providerID: "azure",
        label: "Azure OpenAI control plane",
        authorities: ["cloud_control_plane"],
        scope: "Azure subscription and resource through Azure Monitor plus Cost Management.",
        freshness: "Metric and invoice settlement grains differ.",
        credentialEnv: null,
        documentationURL: "https://learn.microsoft.com/en-us/azure/ai-services/openai/monitor-openai-reference",
      }),
      base({
        id: "vertex-ai-control-plane",
        providerID: "google-vertex",
        label: "Google Vertex AI control plane",
        authorities: ["cloud_control_plane"],
        scope: "Google Cloud project through Cloud Monitoring plus Cloud Billing export.",
        freshness: "Metric and billing export grains differ.",
        credentialEnv: null,
        documentationURL: "https://cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list",
      }),
    ]
  }

  export function empty(now = Date.now()): Result {
    return Result.parse({ fetchedAt: now, sources: inventory(), rule: "compare_never_sum" })
  }

  async function requestJSON<T>(
    dependencies: Dependencies,
    url: URL,
    headers: Record<string, string>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const response = await dependencies.fetch(url, { headers, signal: AbortSignal.timeout(15_000) })
    if (!response.ok) throw new Error(`Official usage endpoint returned HTTP ${response.status}.`)
    return schema.parse(await response.json())
  }

  async function paginated<T extends { has_more: boolean; next_page?: string | null }>(input: {
    dependencies: Dependencies
    url: URL
    headers: Record<string, string>
    schema: z.ZodType<T>
    pageParameter: string
  }): Promise<T[]> {
    const pages: T[] = []
    let page: string | undefined
    for (let count = 0; count < 100; count++) {
      const url = new URL(input.url)
      if (page) url.searchParams.set(input.pageParameter, page)
      const result = await requestJSON(input.dependencies, url, input.headers, input.schema)
      pages.push(result)
      if (!result.has_more) return pages
      if (!result.next_page) throw new Error("Official usage pagination omitted next_page while has_more was true.")
      page = result.next_page
    }
    throw new Error("Official usage pagination exceeded 100 pages.")
  }

  async function openAI(source: Source, input: ReadInput, dependencies: Dependencies): Promise<Source> {
    const key = dependencies.env("OPENAI_ADMIN_KEY")
    if (!key) return source
    const envelope = utcDayEnvelope(input)
    const query = new URLSearchParams({
      start_time: String(Math.floor(envelope.start / 1_000)),
      end_time: String(Math.ceil(envelope.end / 1_000)),
      bucket_width: "1d",
      limit: "31",
    })
    query.append("group_by[]", "model")
    const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" }
    const costQuery = new URLSearchParams({
      start_time: String(Math.floor(envelope.start / 1_000)),
      end_time: String(Math.ceil(envelope.end / 1_000)),
      bucket_width: "1d",
      limit: "31",
    })
    const [usageResult, costResult] = await Promise.allSettled([
      paginated({
        dependencies,
        url: new URL(`https://api.openai.com/v1/organization/usage/completions?${query}`),
        headers,
        schema: OpenAIUsageResponse,
        pageParameter: "page",
      }),
      paginated({
        dependencies,
        url: new URL(`https://api.openai.com/v1/organization/costs?${costQuery}`),
        headers,
        schema: OpenAICostResponse,
        pageParameter: "page",
      }),
    ])
    if (usageResult.status === "rejected" && costResult.status === "rejected") {
      throw new AggregateError([usageResult.reason, costResult.reason], "OpenAI Usage and Costs both failed.")
    }
    const usage =
      usageResult.status === "fulfilled"
        ? usageResult.value.flatMap((page) => page.data).flatMap((bucket) => bucket.results)
        : null
    const costs =
      costResult.status === "fulfilled"
        ? costResult.value.flatMap((page) => page.data).flatMap((bucket) => bucket.results)
        : null
    const messages = [
      ...(usageResult.status === "rejected" ? [`Usage: ${failureMessage(usageResult.reason)}`] : []),
      ...(costResult.status === "rejected" ? [`Costs: ${failureMessage(costResult.reason)}`] : []),
    ]
    let costAvailable = costs !== null
    let costUSD: number | null = null
    if (costs) {
      try {
        costUSD = costs
          .reduce((sum, item) => {
            if (item.amount.currency.toLowerCase() !== "usd") {
              throw new Error(`OpenAI Costs returned unsupported currency ${item.amount.currency}.`)
            }
            return sum.plus(item.amount.value)
          }, new Decimal(0))
          .toNumber()
      } catch (error) {
        costAvailable = false
        messages.push(`Costs: ${failureMessage(error)}`)
      }
    }
    if (!usage) {
      return {
        ...source,
        status: "partial",
        message: messages.join(" "),
        period: { start: envelope.start, end: envelope.end },
        periodAlignment: envelope.exact ? "exact" : "utc_day_envelope",
        costUSD,
      }
    }
    const inputTokens = usage.reduce((sum, item) => sum + item.input_tokens, 0)
    const outputTokens = usage.reduce((sum, item) => sum + item.output_tokens, 0)
    const cacheRead = usage.reduce((sum, item) => sum + item.input_cached_tokens, 0)
    const calls = usage.reduce((sum, item) => sum + item.num_model_requests, 0)
    const total = inputTokens + outputTokens
    return {
      ...source,
      status: costAvailable ? "available" : "partial",
      message: messages.join(" ") || null,
      period: { start: envelope.start, end: envelope.end },
      periodAlignment: envelope.exact ? "exact" : "utc_day_envelope",
      tokens: {
        input: inputTokens,
        output: outputTokens,
        cacheRead,
        cacheWrite: null,
        reasoning: null,
        total,
        calls,
        inputIncludesCache: true,
      },
      costUSD,
      reconciliation: envelope.exact ? reconciliation(localFor(input, "openai"), total, costUSD) : null,
    }
  }

  async function anthropic(source: Source, input: ReadInput, dependencies: Dependencies): Promise<Source> {
    const key = dependencies.env("ANTHROPIC_ADMIN_KEY")
    if (!key) return source
    const envelope = utcDayEnvelope(input)
    const query = new URLSearchParams({
      starting_at: new Date(envelope.start).toISOString(),
      ending_at: new Date(envelope.end).toISOString(),
      bucket_width: "1d",
      limit: "31",
    })
    query.append("group_by[]", "model")
    const costQuery = new URLSearchParams(query)
    costQuery.delete("group_by[]")
    costQuery.append("group_by[]", "description")
    const headers = { "x-api-key": key, "anthropic-version": "2023-06-01", Accept: "application/json" }
    const [usageResult, costResult] = await Promise.allSettled([
      paginated({
        dependencies,
        url: new URL(`https://api.anthropic.com/v1/organizations/usage_report/messages?${query}`),
        headers,
        schema: AnthropicUsageResponse,
        pageParameter: "page",
      }),
      paginated({
        dependencies,
        url: new URL(`https://api.anthropic.com/v1/organizations/cost_report?${costQuery}`),
        headers,
        schema: AnthropicCostResponse,
        pageParameter: "page",
      }),
    ])
    if (usageResult.status === "rejected" && costResult.status === "rejected") {
      throw new AggregateError([usageResult.reason, costResult.reason], "Anthropic Usage and Cost Report both failed.")
    }
    const usage =
      usageResult.status === "fulfilled"
        ? usageResult.value.flatMap((page) => page.data).flatMap((bucket) => bucket.results)
        : null
    const costs =
      costResult.status === "fulfilled"
        ? costResult.value.flatMap((page) => page.data).flatMap((bucket) => bucket.results)
        : null
    const messages = [
      ...(usageResult.status === "rejected" ? [`Usage: ${failureMessage(usageResult.reason)}`] : []),
      ...(costResult.status === "rejected" ? [`Cost Report: ${failureMessage(costResult.reason)}`] : []),
    ]
    let costAvailable = costs !== null
    let costUSD: number | null = null
    if (costs) {
      try {
        costUSD = costs
          .reduce((sum, item) => {
            if (item.currency.toUpperCase() !== "USD") {
              throw new Error(`Anthropic Cost Report returned unsupported currency ${item.currency}.`)
            }
            return sum.plus(new Decimal(item.amount).div(100))
          }, new Decimal(0))
          .toNumber()
      } catch (error) {
        costAvailable = false
        messages.push(`Cost Report: ${failureMessage(error)}`)
      }
    }
    if (!usage) {
      return {
        ...source,
        status: "partial",
        message: messages.join(" "),
        period: { start: envelope.start, end: envelope.end },
        periodAlignment: envelope.exact ? "exact" : "utc_day_envelope",
        costUSD,
      }
    }
    const inputTokens = usage.reduce((sum, item) => sum + item.uncached_input_tokens, 0)
    const cacheRead = usage.reduce((sum, item) => sum + item.cache_read_input_tokens, 0)
    const cacheWrite = usage.reduce(
      (sum, item) =>
        sum + item.cache_creation.ephemeral_1h_input_tokens + item.cache_creation.ephemeral_5m_input_tokens,
      0,
    )
    const outputTokens = usage.reduce((sum, item) => sum + item.output_tokens, 0)
    const total = inputTokens + cacheRead + cacheWrite + outputTokens
    return {
      ...source,
      status: costAvailable ? "available" : "partial",
      message: messages.join(" ") || null,
      period: { start: envelope.start, end: envelope.end },
      periodAlignment: envelope.exact ? "exact" : "utc_day_envelope",
      tokens: {
        input: inputTokens,
        output: outputTokens,
        cacheRead,
        cacheWrite,
        reasoning: null,
        total,
        calls: null,
        inputIncludesCache: false,
      },
      costUSD,
      reconciliation: envelope.exact ? reconciliation(localFor(input, "anthropic"), total, costUSD) : null,
    }
  }

  async function openRouter(source: Source, dependencies: Dependencies): Promise<Source> {
    const key = dependencies.env("OPENROUTER_MANAGEMENT_KEY")
    if (!key) return source
    const headers = { Authorization: `Bearer ${key}`, Accept: "application/json" }
    const [creditsResult, keysResult] = await Promise.allSettled([
      requestJSON(dependencies, new URL("https://openrouter.ai/api/v1/credits"), headers, OpenRouterCreditsResponse),
      (async () => {
        const items: z.infer<typeof OpenRouterKeysResponse>["data"] = []
        for (let page = 0; page < 100; page++) {
          const url = new URL("https://openrouter.ai/api/v1/keys")
          if (page > 0) url.searchParams.set("offset", String(page * 100))
          const result = await requestJSON(dependencies, url, headers, OpenRouterKeysResponse)
          items.push(...result.data)
          if (result.data.length < 100) return items
        }
        throw new Error("OpenRouter key pagination exceeded 100 pages.")
      })(),
    ])
    if (creditsResult.status === "rejected" && keysResult.status === "rejected") {
      throw new AggregateError([creditsResult.reason, keysResult.reason], "OpenRouter Credits and Keys both failed.")
    }
    const messages = [
      ...(creditsResult.status === "rejected" ? [`Credits: ${failureMessage(creditsResult.reason)}`] : []),
      ...(keysResult.status === "rejected" ? [`Keys: ${failureMessage(keysResult.reason)}`] : []),
    ]
    const credits =
      creditsResult.status === "fulfilled"
        ? {
            purchasedUSD: creditsResult.value.data.total_credits,
            usedUSD: creditsResult.value.data.total_usage,
            remainingUSD: new Decimal(creditsResult.value.data.total_credits)
              .minus(creditsResult.value.data.total_usage)
              .toNumber(),
          }
        : null
    const keys = keysResult.status === "fulfilled" ? keysResult.value : null
    const keyItems =
      keys?.map((item) => ({
        hash: item.hash,
        name: item.name,
        disabled: item.disabled,
        limitUSD: item.limit,
        limitRemainingUSD: item.limit_remaining,
        limitReset: item.limit_reset,
        includeByokInLimit: item.include_byok_in_limit,
        usageUSD: item.usage,
        usageDailyUSD: item.usage_daily,
        usageWeeklyUSD: item.usage_weekly,
        usageMonthlyUSD: item.usage_monthly,
        byokUsageUSD: item.byok_usage,
        byokUsageDailyUSD: item.byok_usage_daily,
        byokUsageWeeklyUSD: item.byok_usage_weekly,
        byokUsageMonthlyUSD: item.byok_usage_monthly,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })) ?? null
    const sum = (select: (item: NonNullable<typeof keyItems>[number]) => number) =>
      keyItems!.reduce((total, item) => total.plus(select(item)), new Decimal(0)).toNumber()
    return {
      ...source,
      status: credits && keyItems ? "available" : "partial",
      message: messages.join(" ") || null,
      credits,
      keyUsage:
        keyItems === null
          ? null
          : {
              count: keyItems.length,
              activeCount: keyItems.filter((item) => !item.disabled).length,
              limitedCount: keyItems.filter((item) => item.limitUSD !== null).length,
              usageUSD: sum((item) => item.usageUSD),
              usageDailyUSD: sum((item) => item.usageDailyUSD),
              usageWeeklyUSD: sum((item) => item.usageWeeklyUSD),
              usageMonthlyUSD: sum((item) => item.usageMonthlyUSD),
              byokUsageUSD: sum((item) => item.byokUsageUSD),
              byokUsageDailyUSD: sum((item) => item.byokUsageDailyUSD),
              byokUsageWeeklyUSD: sum((item) => item.byokUsageWeeklyUSD),
              byokUsageMonthlyUSD: sum((item) => item.byokUsageMonthlyUSD),
              items: keyItems,
            },
    }
  }

  export async function read(input: ReadInput, override: Partial<Dependencies> = {}): Promise<Result> {
    const dependencies = { ...DEFAULT_DEPENDENCIES, ...override }
    const sources = inventory()
    const strategies = new Map<string, (source: Source) => Promise<Source>>([
      ["openai-organization", (source) => openAI(source, input, dependencies)],
      ["anthropic-organization", (source) => anthropic(source, input, dependencies)],
      ["openrouter-account", (source) => openRouter(source, dependencies)],
    ])
    const resolved = await Promise.all(
      sources.map(async (source) => {
        const strategy = strategies.get(source.id)
        if (!strategy) return source
        try {
          return await strategy(source)
        } catch (error) {
          return {
            ...source,
            status: "error" as const,
            message: failureMessage(error),
          }
        }
      }),
    )
    return Result.parse({ fetchedAt: dependencies.now(), sources: resolved, rule: "compare_never_sum" })
  }
}
