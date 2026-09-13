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
  ).toBe('responseHeaders: { "set-cookie": "<redacted>", "x-codex-turn-state": "<redacted>" }')
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

test("ProviderError redacts complete structured credential fields while preserving safe coordinates", () => {
  const payload = {
    method: "GET",
    url: "https://example.invalid/records/42",
    headers: { Authorization: "Bearer SYNTHETIC_REVIEW_CANARY" },
    password: "SYNTHETIC FIRST SECOND",
    accessToken: "SYNTHETIC ACCESS TOKEN",
    refreshToken: "SYNTHETIC REFRESH TOKEN",
    state: "PUBLISHED",
    error: { code: 404 },
    nested: { private_key: "-----BEGIN PRIVATE KEY-----\nSYNTHETIC_KEY_MATERIAL\n-----END PRIVATE KEY-----" },
  }
  expect(ProviderError.redactSensitiveProviderValue(payload)).toEqual({
    method: "GET",
    url: "https://example.invalid/records/42",
    headers: { Authorization: "<redacted>" },
    password: "<redacted>",
    accessToken: "<redacted>",
    refreshToken: "<redacted>",
    state: "PUBLISHED",
    error: { code: 404 },
    nested: { private_key: "<redacted>" },
  })
  expect(ProviderError.redactSensitiveProviderPayload(JSON.stringify(payload))).toBe(
    '{"method":"GET","url":"https://example.invalid/records/42","headers":{"Authorization":"<redacted>"},"password":"<redacted>","accessToken":"<redacted>","refreshToken":"<redacted>","state":"PUBLISHED","error":{"code":404},"nested":{"private_key":"<redacted>"}}',
  )
  expect(
    ProviderError.redactSensitiveProviderPayload(
      '{"id":9007199254740993,"state":"PUBLISHED","error":{"code":404},"password":"SYNTHETIC FIRST SECOND","private_key":"-----BEGIN PRIVATE KEY-----\\nSYNTHETIC_KEY_MATERIAL\\n-----END PRIVATE KEY-----"}',
    ),
  ).toBe(
    '{"id":9007199254740993,"state":"PUBLISHED","error":{"code":404},"password":"<redacted>","private_key":"<redacted>"}',
  )
  expect(
    ProviderError.redactSensitiveProviderValue({
      body: JSON.stringify({ password: "SYNTHETIC FIRST SECOND", private_key: "SYNTHETIC PRIVATE KEY" }),
      headers: { "x-api-key": "SYNTHETIC_X_API_KEY", "x-auth-token": "SYNTHETIC_X_AUTH_TOKEN" },
    }),
  ).toEqual({
    body: '{"password":"<redacted>","private_key":"<redacted>"}',
    headers: { "x-api-key": "<redacted>", "x-auth-token": "<redacted>" },
  })
  const nestedPayload = JSON.stringify({
    body: JSON.stringify({
      password: 'SYNTHETIC "QUOTED" SECRET REST',
      private_key: "PEM SYNTHETIC PRIVATE KEY",
      accessToken: "SYNTHETIC ACCESS TOKEN",
      refreshToken: "SYNTHETIC REFRESH TOKEN",
    }),
  })
  const redactedNestedPayload = ProviderError.redactSensitiveProviderPayload(nestedPayload)
  expect(JSON.parse(redactedNestedPayload)).toEqual({
    body: JSON.stringify({
      password: "<redacted>",
      private_key: "<redacted>",
      accessToken: "<redacted>",
      refreshToken: "<redacted>",
    }),
  })
  const encodedHeaders = JSON.stringify({ "x-api-key": "SYNTHETIC_X_API_KEY" })
  expect(ProviderError.redactSensitiveProviderValue({ headers: encodedHeaders })).toEqual({
    headers: '{"x-api-key":"<redacted>"}',
  })
  expect(ProviderError.redactSensitiveProviderPayload(JSON.stringify({ headers: encodedHeaders }))).toBe(
    '{"headers":"{\\"x-api-key\\":\\"<redacted>\\"}"}',
  )
  let deepPayload = JSON.stringify({ password: "SYNTHETIC_DEEP_PASSWORD" })
  for (let depth = 0; depth < 10; depth++) deepPayload = JSON.stringify({ body: deepPayload })
  let deepProjection: unknown = JSON.parse(ProviderError.redactSensitiveProviderPayload(deepPayload))
  for (let depth = 0; depth < 10 && typeof deepProjection === "object" && deepProjection; depth++) {
    const body = (deepProjection as { body?: unknown }).body
    if (body === "<redacted>") {
      deepProjection = body
      break
    }
    if (typeof body !== "string") break
    deepProjection = JSON.parse(body)
  }
  expect(deepProjection).toBe("<redacted>")
  expect(ProviderError.redactSensitiveProviderPayload('{"ok":true /* password:"SYNTHETIC_COMMENT_PASSWORD" */}')).toBe(
    '{"ok":true /* <redacted> */}',
  )
  expect(
    ProviderError.redactSensitiveProviderPayload(
      '{/* source metadata */"body":"{\\"password\\":\\"SYNTHETIC_COMMENTED_PAYLOAD_SECRET\\"}"}',
    ),
  ).toBe('{/* source metadata */"body":"{\\"password\\":\\"<redacted>\\"}"}')
  expect(
    ProviderError.redactSensitiveProviderPayload(
      '{"url":"https://example.test/policies/password",/* source metadata */"ok":true}',
    ),
  ).toBe('{"url":"https://example.test/policies/password",/* source metadata */"ok":true}')
  expect(
    ProviderError.redactSensitiveProviderPayload(
      '{"credential":{/* password: "SYNTHETIC_LONG_COMMENT_SECRET" */ "value":"SYNTHETIC_VALUE"},"id":42,"state":"PUBLISHED"}',
    ),
  ).toBe('{"credential":"<redacted>","id":42,"state":"PUBLISHED"}')
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
