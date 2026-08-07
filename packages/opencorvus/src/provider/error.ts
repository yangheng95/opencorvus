import { APICallError } from "ai"
import { STATUS_CODES } from "http"
import { iife } from "@/util/iife"

export namespace ProviderError {
  // Adapted from overflow detection patterns in:
  // https://github.com/badlogic/pi-mono/blob/main/packages/ai/src/utils/overflow.ts
  const OVERFLOW_PATTERNS = [
    /prompt is too long/i, // Anthropic
    /input is too long for requested model/i, // Amazon Bedrock
    /exceeds the context window/i, // OpenAI (Completions + Responses API message text)
    /maximum context length/i, // OpenAI-compatible gateways
    /context length exceeded/i, // OpenAI-compatible gateways
    /input token count.*exceeds the maximum/i, // Google (Gemini)
    /input length.*exceed/i, // Generic provider wording
    /maximum prompt length is \d+/i, // xAI (Grok)
    /prompt.*exceed.*limit/i, // OpenAI-compatible gateways
    /reduce the length of the messages/i, // Groq
    /maximum context length is \d+ tokens/i, // OpenRouter, DeepSeek
    /too many tokens/i, // Mistral and OpenAI-compatible gateways
    /request too large/i, // 413 bodies with text
    /exceeds the available context size/i, // llama.cpp server
    /greater than the context length/i, // LM Studio
    /context window exceeds limit/i, // MiniMax
    /exceeded model token limit/i, // Kimi For Coding, Moonshot
    /range of input length should be \[\d+,\s*\d+\]/i, // Alibaba Coding Plan
    /context[_ ]length[_ ]exceeded/i, // Generic fallback
  ]

  const OVERFLOW_CODES = new Set([
    "context_length_exceeded",
    "context_overflow",
    "prompt_too_long",
    "input_too_long",
    "request_too_large",
    "tokens_exceeded",
    "max_tokens_exceeded",
  ])

  const QUOTA_EXHAUSTED_CODES = new Set([
    "insufficient_quota",
    "quota_exceeded",
    "usage_quota_exceeded",
    "billing_hard_limit_reached",
    "credits_exhausted",
  ])

  const QUOTA_EXHAUSTED_PATTERNS = [
    /usage allocated quota exceeded/i,
    /insufficient quota/i,
    /quota exceeded/i,
    /credit balance/i,
    /billing.*limit/i,
  ]

  function isOpenAiErrorRetryable(e: APICallError) {
    const status = e.statusCode
    if (!status) return e.isRetryable
    // openai sometimes returns 404 for models that are actually available
    return status === 404 || e.isRetryable
  }

  // Providers not reliably handled in this function:
  // - z.ai: can accept overflow silently (needs token-count/context-window checks)
  function isOverflow(message: string) {
    if (OVERFLOW_PATTERNS.some((p) => p.test(message))) return true

    // Providers/status patterns handled outside of regex list:
    // - Cerebras: often returns "400 (no body)" / "413 (no body)"
    // - Mistral: often returns "400 (no body)" / "413 (no body)"
    return /^4(00|13)\s*(status code)?\s*\(no body\)/i.test(message)
  }

  function stringValue(input: unknown) {
    return typeof input === "string" ? input : undefined
  }

  function errorObject(input: unknown) {
    if (!input || typeof input !== "object" || Array.isArray(input)) return undefined
    return input as Record<string, unknown>
  }

  function overflowSignal(body: unknown) {
    const root = errorObject(body)
    if (!root) return undefined
    const nested = errorObject(root.error)
    const sources = nested ? [nested, root] : [root]
    for (const source of sources) {
      const code = stringValue(source.code)?.toLowerCase()
      const type = stringValue(source.type)?.toLowerCase()
      if ((code && OVERFLOW_CODES.has(code)) || (type && OVERFLOW_CODES.has(type))) {
        return stringValue(source.message) ?? "Input exceeds context window of this model"
      }
    }
    for (const source of sources) {
      const message = stringValue(source.message) ?? stringValue(source.error)
      if (message && isOverflow(message)) return message
    }
    return undefined
  }

  export function quotaExhaustedSignal(input: {
    statusCode?: number
    responseBody?: string
    message?: string
  }): string | undefined {
    if (input.statusCode !== 429) return undefined

    const body = json(input.responseBody)
    const root = errorObject(body)
    const nested = root ? errorObject(root.error) : undefined
    const sources = [nested, root].filter((source): source is Record<string, unknown> => !!source)
    for (const source of sources) {
      const code = stringValue(source.code)?.toLowerCase()
      const type = stringValue(source.type)?.toLowerCase()
      if ((code && QUOTA_EXHAUSTED_CODES.has(code)) || (type && QUOTA_EXHAUSTED_CODES.has(type))) {
        return stringValue(source.message) ?? input.message ?? "Provider quota exhausted."
      }
    }

    const messages = [
      input.message,
      ...sources.flatMap((source) => [stringValue(source.message), stringValue(source.error)]),
    ].filter((value): value is string => !!value)
    const matched = messages.find((value) => QUOTA_EXHAUSTED_PATTERNS.some((pattern) => pattern.test(value)))
    return matched
  }

  function message(e: APICallError) {
    return iife(() => {
      const msg = e.message
      if (msg === "") {
        if (e.responseBody) return e.responseBody
        if (e.statusCode) {
          const err = STATUS_CODES[e.statusCode]
          if (err) return err
        }
        return "Unknown error"
      }

      if (!e.responseBody || (e.statusCode && msg !== STATUS_CODES[e.statusCode])) {
        return msg
      }

      try {
        const body = JSON.parse(e.responseBody)
        const error = errorObject(body.error)
        const errMsg = stringValue(body.message) ?? stringValue(error?.message) ?? stringValue(body.error)
        if (errMsg) {
          return `${msg}: ${errMsg}`
        }
      } catch {}

      return `${msg}: ${e.responseBody}`
    }).trim()
  }

  function json(input: unknown) {
    if (typeof input === "string") {
      try {
        const result = JSON.parse(input)
        if (result && typeof result === "object") return result
        return undefined
      } catch {
        return undefined
      }
    }
    if (typeof input === "object" && input !== null) {
      return input
    }
    return undefined
  }

  export type ParsedStreamError =
    | {
        type: "context_overflow"
        message: string
        responseBody: string
      }
    | {
        type: "api_error"
        message: string
        isRetryable: false
        responseBody: string
      }

  export function parseStreamError(input: unknown): ParsedStreamError | undefined {
    const body = json(input)
    if (!body) return

    const responseBody = JSON.stringify(body)
    if (body.type !== "error") return

    const overflow = overflowSignal(body)
    if (overflow) {
      return {
        type: "context_overflow",
        message: overflow,
        responseBody,
      }
    }

    switch (body?.error?.code) {
      case "insufficient_quota":
        return {
          type: "api_error",
          message: "Quota exceeded. Check your plan and billing details.",
          isRetryable: false,
          responseBody,
        }
      case "usage_not_included":
        return {
          type: "api_error",
          message: "To use Codex with your ChatGPT plan, upgrade to Plus: https://chatgpt.com/explore/plus.",
          isRetryable: false,
          responseBody,
        }
      case "invalid_prompt":
        return {
          type: "api_error",
          message: typeof body?.error?.message === "string" ? body?.error?.message : "Invalid prompt.",
          isRetryable: false,
          responseBody,
        }
    }
  }

  export type ParsedAPICallError =
    | {
        type: "context_overflow"
        message: string
        responseBody?: string
      }
    | {
        type: "api_error"
        message: string
        statusCode?: number
        isRetryable: boolean
        responseHeaders?: Record<string, string>
        responseBody?: string
        metadata?: Record<string, string>
      }

  export function parseAPICallError(input: { providerID: string; error: APICallError }): ParsedAPICallError {
    const body = json(input.error.responseBody)
    const overflow = overflowSignal(body)
    if (overflow) {
      return {
        type: "context_overflow",
        message: overflow,
        responseBody: input.error.responseBody,
      }
    }

    const m = message(input.error)
    const quota = quotaExhaustedSignal({
      statusCode: input.error.statusCode,
      responseBody: input.error.responseBody,
      message: m,
    })
    if (isOverflow(m)) {
      return {
        type: "context_overflow",
        message: m,
        responseBody: input.error.responseBody,
      }
    }

    const metadata = input.error.url ? { url: input.error.url } : undefined
    return {
      type: "api_error",
      message: m,
      statusCode: input.error.statusCode,
      isRetryable: quota
        ? false
        : input.providerID.startsWith("openai")
          ? isOpenAiErrorRetryable(input.error)
          : input.error.isRetryable,
      responseHeaders: input.error.responseHeaders,
      responseBody: input.error.responseBody,
      metadata,
    }
  }
}
