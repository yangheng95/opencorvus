import { expect, test } from "bun:test"
import { ProviderError } from "@/provider/error"

test("ProviderError redacts provider credential fragments while preserving diagnostics", () => {
  const message = [
    `Provider deepseek returned HTTP 401: Authentication Fails, Your api key: ${"*".repeat(4)}0f37 is invalid`,
    "authorization: Bearer sk-live-secret",
    "retry with bearer another-token",
  ].join("; ")

  expect(ProviderError.redactSensitiveProviderText(message)).toBe(
    [
      "Provider deepseek returned HTTP 401: Authentication Fails, Your api key: <redacted> is invalid",
      "authorization: <redacted>",
      "retry with bearer <redacted>",
    ].join("; "),
  )
  expect(
    ProviderError.redactSensitiveProviderText(
      'api_key: sk-secret-123; apiKey=camel-secret; "x-api-key":"json-secret"; ?api-key=query-secret',
    ),
  ).toBe('api_key: <redacted>; apiKey=<redacted>; "x-api-key":"<redacted>"; ?api-key=<redacted>')
})

test("ProviderError returns redacted stream error contracts for every recognized provider error", () => {
  const masked = "****0f37"
  expect(
    ProviderError.parseStreamError({
      type: "error",
      error: { code: "context_length_exceeded", message: `maximum context length; api key: ${masked}` },
    }),
  ).toEqual({
    type: "context_overflow",
    message: "maximum context length; api key: <redacted>",
    responseBody:
      '{"type":"error","error":{"code":"context_length_exceeded","message":"maximum context length; api key: <redacted>"}}',
  })
  expect(
    ProviderError.parseStreamError({
      type: "error",
      error: { code: "usage_not_included", message: `authorization: Bearer ${masked}` },
    }),
  ).toEqual({
    type: "api_error",
    message: "To use Codex with your ChatGPT plan, upgrade to Plus: https://chatgpt.com/explore/plus.",
    isRetryable: false,
    responseBody: '{"type":"error","error":{"code":"usage_not_included","message":"authorization: <redacted>"}}',
  })
})
