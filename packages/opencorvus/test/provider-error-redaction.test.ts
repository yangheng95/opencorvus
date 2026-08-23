import { expect, test } from "bun:test"
import { APICallError } from "ai"
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

test("ProviderError projects safe response-header diagnostics without transient credentials", () => {
  expect(
    ProviderError.redactSensitiveProviderHeaders({
      "set-cookie": "session=secret; HttpOnly; Secure",
      "x-codex-turn-state": "encrypted-turn-state",
      "proxy-authorization": "Bearer proxy-secret",
      "retry-after": "120",
      "x-oai-request-id": "req_safe_diagnostic",
    }),
  ).toEqual({
    "set-cookie": "<redacted>",
    "x-codex-turn-state": "<redacted>",
    "proxy-authorization": "<redacted>",
    "retry-after": "120",
    "x-oai-request-id": "req_safe_diagnostic",
  })
  expect(
    ProviderError.redactSensitiveProviderText(
      'responseHeaders: { "set-cookie": "session=secret; HttpOnly", "x-codex-turn-state": "turn-secret" }',
    ),
  ).toBe(
    'responseHeaders: { "set-cookie": "<redacted>", "x-codex-turn-state": "<redacted>" }',
  )
  expect(
    ProviderError.parseAPICallError({
      providerID: "openai",
      error: new APICallError({
        message: "Provider openai returned HTTP 429: usage limit reached",
        url: "https://example.invalid/responses",
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: {
          "set-cookie": "session=secret",
          "x-codex-turn-state": "encrypted-turn-state",
          "retry-after": "120",
        },
        responseBody: '{"error":{"type":"usage_limit_reached","message":"usage limit reached"}}',
        isRetryable: false,
      }),
    }),
  ).toMatchObject({
    type: "api_error",
    statusCode: 429,
    responseHeaders: {
      "set-cookie": "<redacted>",
      "x-codex-turn-state": "<redacted>",
      "retry-after": "120",
    },
    metadata: { url: "https://example.invalid/responses" },
  })
  expect(
    ProviderError.redactSensitiveProviderURL(
      "https://user:password@example.invalid/responses?api_key=query-secret&access_token=access-secret&refresh_token=refresh-secret&id_token=id-secret&client_secret=client-secret&private_key=private-secret&authorization=bearer-secret&request_id=req-safe",
    ),
  ).toBe(
    "https://%3Credacted%3E:%3Credacted%3E@example.invalid/responses?api_key=%3Credacted%3E&access_token=%3Credacted%3E&refresh_token=%3Credacted%3E&id_token=%3Credacted%3E&client_secret=%3Credacted%3E&private_key=%3Credacted%3E&authorization=%3Credacted%3E&request_id=req-safe",
  )
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
