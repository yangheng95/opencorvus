import { APICallError } from "ai"
import { STATUS_CODES } from "http"
import { createScanner, parseTree, type Node as JSONNode } from "jsonc-parser"
import { iife } from "@/util/iife"

export namespace ProviderError {
  const SENSITIVE_PROVIDER_HEADER_NAME =
    /(?:^|[-_])(?:authorization|proxy[-_]?authorization|cookie|set[-_]?cookie|password|passwd|secret|token|api[-_]?key|access[-_]?key|private[-_]?key|client[-_]?secret|credential|oauth|code|state)(?:[-_]|$)/i

  const STRUCTURED_CREDENTIAL_FIELD_NAMES = new Set([
    "authorization",
    "proxyauthorization",
    "cookie",
    "setcookie",
    "password",
    "passwd",
    "secret",
    "token",
    "apikey",
    "accesstoken",
    "refreshtoken",
    "idtoken",
    "accesskey",
    "privatekey",
    "clientsecret",
    "credential",
    "oauth",
  ])

  function isStructuredCredentialField(name: string): boolean {
    return STRUCTURED_CREDENTIAL_FIELD_NAMES.has(name.replace(/[-_ ]/g, "").toLowerCase())
  }

  function isHeaderContainerField(name: string | undefined): boolean {
    if (!name) return false
    return new Set(["headers", "requestheaders", "responseheaders"]).has(name.replace(/[-_ ]/g, "").toLowerCase())
  }

  const SENSITIVE_COMMENT_FIELD_NAME =
    /\b(?:authorization|password|passwd|secret|token|api[-_ ]?key|access[-_ ]?(?:key|token)|refresh[-_ ]?token|id[-_ ]?token|private[-_ ]?key|client[-_ ]?secret|credential|oauth)\b/i
  // jsonc-parser exposes SyntaxKind as an ambient const enum, which cannot be
  // imported under verbatimModuleSyntax. These are its stable scanner values.
  const JSONC_LINE_COMMENT_TRIVIA = 12
  const JSONC_BLOCK_COMMENT_TRIVIA = 13
  const JSONC_EOF = 17

  export function redactSensitiveProviderText(input: string): string {
    return input
      .replace(/\*{4}[0-9A-Fa-f]{4,}\b/g, "****<redacted>")
      .replace(
        /\b((?:authorization|proxy[-_ ]?authorization|cookie|set[-_ ]?cookie|x[-_][a-z0-9_-]*(?:token|secret|credential|oauth|code|state)|api[-_ ]?key|password|passwd|secret|token|access[-_ ]?(?:key|token)|refresh[-_ ]?token|id[-_ ]?token|private[-_ ]?key|client[-_ ]?secret|credential|oauth)["']?\s*[:=]\s*)"[^"\r\n]*"/gi,
        '$1"<redacted>"',
      )
      .replace(
        /\b((?:authorization|proxy[-_ ]?authorization|cookie|set[-_ ]?cookie|x[-_][a-z0-9_-]*(?:token|secret|credential|oauth|code|state)|api[-_ ]?key|password|passwd|secret|token|access[-_ ]?(?:key|token)|refresh[-_ ]?token|id[-_ ]?token|private[-_ ]?key|client[-_ ]?secret|credential|oauth)["']?\s*[:=]\s*)'[^'\r\n]*'/gi,
        "$1'<redacted>'",
      )
      .replace(
        /\b((?:authorization|proxy-authorization|cookie|set-cookie|x[-_][a-z0-9_-]*(?:token|secret|credential|oauth|code|state))["']?\s*[:=]\s*)(?:bearer\s+)?[^,;\s"'}]+/gi,
        "$1<redacted>",
      )
      .replace(
        /\b((?:x[-_]?api[-_ ]?key|api[-_ ]?key|password|passwd|secret|token|access[-_ ]?key|private[-_ ]?key|client[-_ ]?secret|credential)["']?\s*[:=]\s*["']?)[^,;\s"'}]+/gi,
        "$1<redacted>",
      )
      .replace(/\b(bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1<redacted>")
  }

  function redactSensitiveProviderValueAtField(input: unknown, parentField?: string): unknown {
    if (typeof input === "string") return redactSensitiveProviderPayloadAtField(input, parentField)
    if (Array.isArray(input)) return input.map((value) => redactSensitiveProviderValueAtField(value, parentField))
    if (!input || typeof input !== "object") return input
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([name, value]) => [
        name,
        isStructuredCredentialField(name) ||
        (isHeaderContainerField(parentField) && SENSITIVE_PROVIDER_HEADER_NAME.test(name))
          ? "<redacted>"
          : redactSensitiveProviderValueAtField(value, name),
      ]),
    )
  }

  export function redactSensitiveProviderValue(input: unknown): unknown {
    return redactSensitiveProviderValueAtField(input)
  }

  type TextReplacement = { offset: number; length: number; text: string }

  function jsonStringReplacement(node: JSONNode, value: string): TextReplacement {
    return { offset: node.offset, length: node.length, text: JSON.stringify(value) }
  }

  function redactSensitiveJSONPayload(input: string, depth: number, rootContainerField?: string): string | undefined {
    const errors: Array<{ error: number; offset: number; length: number }> = []
    const root = parseTree(input, errors, { allowTrailingComma: true, disallowComments: false })
    if (!root || errors.length > 0) return undefined
    const replacements: TextReplacement[] = []
    const scanner = createScanner(input, false)
    for (let token = scanner.scan(); token !== JSONC_EOF; token = scanner.scan()) {
      if (token !== JSONC_LINE_COMMENT_TRIVIA && token !== JSONC_BLOCK_COMMENT_TRIVIA) continue
      const comment = input.slice(scanner.getTokenOffset(), scanner.getTokenOffset() + scanner.getTokenLength())
      if (!SENSITIVE_COMMENT_FIELD_NAME.test(comment)) continue
      replacements.push({
        offset: scanner.getTokenOffset(),
        length: scanner.getTokenLength(),
        text: token === JSONC_LINE_COMMENT_TRIVIA ? "// <redacted>" : "/* <redacted> */",
      })
    }
    const visit = (node: JSONNode, parentField?: string) => {
      if (node.type === "object") {
        for (const property of node.children ?? []) {
          const [nameNode, valueNode] = property.children ?? []
          if (!nameNode || !valueNode || typeof nameNode.value !== "string") continue
          const name = nameNode.value
          if (
            isStructuredCredentialField(name) ||
            (isHeaderContainerField(parentField) && SENSITIVE_PROVIDER_HEADER_NAME.test(name))
          ) {
            replacements.push(jsonStringReplacement(valueNode, "<redacted>"))
            continue
          }
          visit(valueNode, name)
        }
        return
      }
      if (node.type === "array") {
        for (const child of node.children ?? []) visit(child, parentField)
        return
      }
      if (node.type !== "string" || typeof node.value !== "string") return
      const looksLikeJSONContainer = /^\s*[\[{]/.test(node.value)
      if (looksLikeJSONContainer && depth >= 8) {
        replacements.push(jsonStringReplacement(node, "<redacted>"))
        return
      }
      const nested = redactSensitiveJSONPayload(node.value, depth + 1, parentField)
      const redacted = nested ?? redactSensitiveProviderText(node.value)
      if (redacted !== node.value) replacements.push(jsonStringReplacement(node, redacted))
    }
    visit(root, rootContainerField)
    if (replacements.length === 0) return input
    const nonOverlapping = replacements
      .filter(
        (candidate, index) =>
          !replacements.some(
            (container, containerIndex) =>
              containerIndex !== index &&
              container.offset <= candidate.offset &&
              container.offset + container.length >= candidate.offset + candidate.length &&
              (container.offset < candidate.offset || container.length > candidate.length),
          ),
      )
      .filter(
        (candidate, index, all) =>
          all.findIndex((other) => other.offset === candidate.offset && other.length === candidate.length) === index,
      )
    return nonOverlapping
      .sort((left, right) => right.offset - left.offset)
      .reduce(
        (current, replacement) =>
          current.slice(0, replacement.offset) +
          replacement.text +
          current.slice(replacement.offset + replacement.length),
        input,
      )
  }

  function redactSensitiveProviderPayloadAtField(input: string, parentField?: string): string {
    const structured = redactSensitiveJSONPayload(input, 0, parentField)
    if (structured !== undefined) return structured
    return redactSensitiveProviderText(input)
  }

  export function redactSensitiveProviderPayload(input: string): string {
    return redactSensitiveProviderPayloadAtField(input)
  }

  export function redactSensitiveProviderHeaders(
    input: Record<string, string> | undefined,
  ): Record<string, string> | undefined {
    if (!input) return undefined
    return Object.fromEntries(
      Object.entries(input).map(([name, value]) => [
        name,
        SENSITIVE_PROVIDER_HEADER_NAME.test(name) ? "<redacted>" : redactSensitiveProviderText(value),
      ]),
    )
  }

  export function safeProviderErrorDiagnostic(input: unknown): unknown {
    if (!APICallError.isInstance(input)) return input
    return {
      type: input.name,
      message: redactSensitiveProviderText(input.message),
      stack: input.stack ? redactSensitiveProviderText(input.stack) : undefined,
      statusCode: input.statusCode,
      isRetryable: input.isRetryable,
      responseHeaders: redactSensitiveProviderHeaders(input.responseHeaders),
      responseBody: input.responseBody ? redactSensitiveProviderText(input.responseBody) : undefined,
      url: redactSensitiveProviderURL(input.url),
    }
  }

  export function redactSensitiveProviderURL(input: string): string {
    try {
      const url = new URL(input)
      let changed = false
      if (url.username || url.password) {
        url.username = "<redacted>"
        url.password = "<redacted>"
        changed = true
      }
      for (const name of [...url.searchParams.keys()]) {
        if (!SENSITIVE_PROVIDER_HEADER_NAME.test(name)) continue
        url.searchParams.set(name, "<redacted>")
        changed = true
      }
      return changed ? url.toString() : redactSensitiveProviderText(input)
    } catch {
      return redactSensitiveProviderText(input)
    }
  }

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
        message: redactSensitiveProviderText(overflow),
        responseBody: redactSensitiveProviderText(responseBody),
      }
    }

    switch (body?.error?.code) {
      case "insufficient_quota":
        return {
          type: "api_error",
          message: "Quota exceeded. Check your plan and billing details.",
          isRetryable: false,
          responseBody: redactSensitiveProviderText(responseBody),
        }
      case "usage_not_included":
        return {
          type: "api_error",
          message: "To use Codex with your ChatGPT plan, upgrade to Plus: https://chatgpt.com/explore/plus.",
          isRetryable: false,
          responseBody: redactSensitiveProviderText(responseBody),
        }
      case "invalid_prompt":
        return {
          type: "api_error",
          message:
            typeof body?.error?.message === "string"
              ? redactSensitiveProviderText(body?.error?.message)
              : "Invalid prompt.",
          isRetryable: false,
          responseBody: redactSensitiveProviderText(responseBody),
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
        message: redactSensitiveProviderText(overflow),
        responseBody: input.error.responseBody ? redactSensitiveProviderText(input.error.responseBody) : undefined,
      }
    }

    const m = redactSensitiveProviderText(message(input.error))
    const quota = quotaExhaustedSignal({
      statusCode: input.error.statusCode,
      responseBody: input.error.responseBody,
      message: m,
    })
    if (isOverflow(m)) {
      return {
        type: "context_overflow",
        message: m,
        responseBody: input.error.responseBody ? redactSensitiveProviderText(input.error.responseBody) : undefined,
      }
    }

    const metadata = input.error.url ? { url: redactSensitiveProviderURL(input.error.url) } : undefined
    return {
      type: "api_error",
      message: m,
      statusCode: input.error.statusCode,
      isRetryable: quota
        ? false
        : input.providerID.startsWith("openai")
          ? isOpenAiErrorRetryable(input.error)
          : input.error.isRetryable,
      responseHeaders: redactSensitiveProviderHeaders(input.error.responseHeaders),
      responseBody: input.error.responseBody ? redactSensitiveProviderText(input.error.responseBody) : undefined,
      metadata,
    }
  }
}
