import z from "zod"
import { Auth } from "../auth"
import { Config } from "../config/config"
import { resolveOpenAICodexOAuthCredential } from "../plugin/openai/codex"
import { ProviderCredentialExchange } from "./credential-exchange"

export namespace ProviderAccountUsage {
  export const Capability = z.enum(["monetary_balance", "rate_limits"]).meta({ ref: "ProviderAccountUsageCapability" })
  export type Capability = z.infer<typeof Capability>

  export const Capabilities = z.record(z.string(), Capability).meta({ ref: "ProviderAccountUsageCapabilities" })
  export type Capabilities = z.infer<typeof Capabilities>

  const MonetaryBalance = z
    .object({
      kind: z.literal("monetary_balance"),
      currency: z.literal("USD"),
      limit: z.number(),
      used: z.number(),
      remaining: z.number(),
      exceeded: z.boolean(),
    })
    .meta({ ref: "ProviderMonetaryBalanceUsage" })

  const RateLimitWindow = z
    .object({
      usedPercent: z.number().min(0).max(100),
      remainingPercent: z.number().min(0).max(100),
      windowMinutes: z.number().int().positive(),
      resetsAt: z.number().int().positive(),
    })
    .meta({ ref: "ProviderRateLimitWindow" })

  const RateLimits = z
    .object({
      kind: z.literal("rate_limits"),
      planType: z.string(),
      primary: RateLimitWindow.optional(),
      secondary: RateLimitWindow.optional(),
      credits: z
        .object({
          hasCredits: z.boolean(),
          unlimited: z.boolean(),
          balance: z.string().optional(),
        })
        .optional(),
    })
    .meta({ ref: "ProviderRateLimitsUsage" })

  export const Usage = z.discriminatedUnion("kind", [MonetaryBalance, RateLimits]).meta({ ref: "ProviderAccountUsage" })
  export type Usage = z.infer<typeof Usage>

  export const ErrorCode = z.enum([
    "PROVIDER_USAGE_UNSUPPORTED",
    "PROVIDER_CREDENTIAL_REQUIRED",
    "PROVIDER_USAGE_REQUEST_FAILED",
    "PROVIDER_USAGE_RESPONSE_INVALID",
  ])
  export type ErrorCode = z.infer<typeof ErrorCode>

  export const Response = z
    .discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), usage: Usage }),
      z.object({
        ok: z.literal(false),
        error: z.object({ code: ErrorCode, message: z.string() }),
      }),
    ])
    .meta({ ref: "ProviderAccountUsageResponse" })
  export type Response = z.infer<typeof Response>

  const OpenAIRateLimitWindowUpstream = z.object({
    used_percent: z.number(),
    limit_window_seconds: z.number().int().positive(),
    reset_at: z.number().int().positive(),
  })

  const OpenAIUsageUpstream = z.object({
    plan_type: z.string(),
    rate_limit: z
      .object({
        primary_window: OpenAIRateLimitWindowUpstream.nullish(),
        secondary_window: OpenAIRateLimitWindowUpstream.nullish(),
      })
      .nullish(),
    credits: z
      .object({
        has_credits: z.boolean(),
        unlimited: z.boolean(),
        balance: z.string().nullish(),
      })
      .nullish(),
  })

  const OPENAI_CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage"
  const REQUEST_TIMEOUT_MILLISECONDS = 15_000

  type Strategy = Readonly<{
    capability: Capability
    read: (config: Config.Info) => Promise<Response>
  }>

  function failure(code: ErrorCode, message: string): Response {
    return { ok: false, error: { code, message } }
  }

  function normalizeRateLimitWindow(
    window: z.infer<typeof OpenAIRateLimitWindowUpstream> | null | undefined,
  ): z.infer<typeof RateLimitWindow> | undefined {
    if (!window) return undefined
    const usedPercent = Math.min(100, Math.max(0, window.used_percent))
    return {
      usedPercent,
      remainingPercent: 100 - usedPercent,
      windowMinutes: Math.ceil(window.limit_window_seconds / 60),
      resetsAt: window.reset_at,
    }
  }

  async function readOpenAI(): Promise<Response> {
    const saved = await Auth.get("openai")
    if (saved?.type !== "oauth") {
      return failure(
        "PROVIDER_CREDENTIAL_REQUIRED",
        "ChatGPT OAuth authentication is required to load OpenAI Codex account usage.",
      )
    }

    try {
      const credential = await resolveOpenAICodexOAuthCredential({
        getAuth: () => Auth.get("openai"),
        refresh: ({ current, exchange }) =>
          ProviderCredentialExchange.refresh({ providerID: "openai", current, exchange }),
      })
      const headers = new Headers({
        Accept: "application/json",
        Authorization: `Bearer ${credential.access}`,
      })
      if (credential.accountId) headers.set("ChatGPT-Account-Id", credential.accountId)
      const response = await fetch(OPENAI_CODEX_USAGE_URL, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
      })
      if (!response.ok) {
        return failure(
          "PROVIDER_USAGE_REQUEST_FAILED",
          `GET ${OPENAI_CODEX_USAGE_URL} returned HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`,
        )
      }
      const parsed = OpenAIUsageUpstream.safeParse(await response.json())
      if (!parsed.success) {
        return failure(
          "PROVIDER_USAGE_RESPONSE_INVALID",
          `GET ${OPENAI_CODEX_USAGE_URL} response does not match the Codex account-usage protocol.`,
        )
      }
      const primary = normalizeRateLimitWindow(parsed.data.rate_limit?.primary_window)
      const secondary = normalizeRateLimitWindow(parsed.data.rate_limit?.secondary_window)
      const credits = parsed.data.credits
      return {
        ok: true,
        usage: {
          kind: "rate_limits",
          planType: parsed.data.plan_type,
          ...(primary ? { primary } : {}),
          ...(secondary ? { secondary } : {}),
          ...(credits
            ? {
                credits: {
                  hasCredits: credits.has_credits,
                  unlimited: credits.unlimited,
                  ...(credits.balance ? { balance: credits.balance } : {}),
                },
              }
            : {}),
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return failure("PROVIDER_USAGE_REQUEST_FAILED", `GET ${OPENAI_CODEX_USAGE_URL} failed: ${message}`)
    }
  }

  const STRATEGIES: Readonly<Record<string, Strategy>> = Object.freeze({
    openai: { capability: "rate_limits", read: readOpenAI },
  })

  export function capabilities(): Capabilities {
    return Capabilities.parse(
      Object.fromEntries(Object.entries(STRATEGIES).map(([providerID, strategy]) => [providerID, strategy.capability])),
    )
  }

  export async function read(providerID: string, config: Config.Info): Promise<Response> {
    const strategy = STRATEGIES[providerID]
    if (!strategy) {
      return failure("PROVIDER_USAGE_UNSUPPORTED", `Provider ${providerID} does not publish account usage.`)
    }
    return await strategy.read(config)
  }
}
