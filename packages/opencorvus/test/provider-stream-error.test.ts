import { expect, test } from "bun:test"
import { decodeProviderStreamError } from "@opencorvus-ai/transport-protocol"
import { ProviderError } from "@/provider/error"
import { Message } from "@/session/message"
import { collectLLMText, DefaultLLMActivityPolicy, type LLMActivityEvent } from "@/llm/activity"

// Shape captured from the actual skill-loader-341 Provider occurrence.
const overload = {
  type: "error",
  sequence_number: 2,
  error: {
    type: "service_unavailable_error",
    code: "server_is_overloaded",
    message: "Our servers are currently overloaded. Please try again later.",
    param: null,
  },
}

test("typed nested and flat stream events expose Provider message and code", () => {
  expect(decodeProviderStreamError(JSON.stringify(overload))).toEqual({
    body: overload,
    code: "server_is_overloaded",
    type: "service_unavailable_error",
    message: overload.error.message,
  })
  const flat = { type: "error", code: "server_error", message: "Please retry later.", param: null }
  expect(decodeProviderStreamError(flat)).toEqual({ body: flat, code: "server_error", type: undefined, message: flat.message })
  expect(ProviderError.parseStreamError(flat)).toEqual({
    type: "api_error", message: flat.message, isRetryable: false, responseBody: JSON.stringify(flat),
  })
})

test("actual overload maps to a readable APIError with its diagnostic body", () => {
  expect(Message.fromError(overload, { providerID: "openai" })).toEqual({
    name: "APIError",
    data: { message: overload.error.message, isRetryable: false, responseBody: JSON.stringify(overload) },
  })
})

test("stream diagnostics use structured redaction and retain ordinary coordinates", () => {
  const input = { ...overload, password: "SYNTHETIC TWO WORDS", request_id: "req_stream" }
  expect(ProviderError.parseStreamError(input)).toEqual({
    type: "api_error", message: overload.error.message, isRetryable: false,
    responseBody: JSON.stringify({ ...input, password: "<redacted>" }),
  })
})

test("flat quota and context failures retain their explicit contracts", () => {
  expect(ProviderError.parseStreamError({ type: "error", code: "insufficient_quota" })).toMatchObject({
    type: "api_error", message: "Quota exceeded. Check your plan and billing details.", isRetryable: false,
  })
  expect(ProviderError.parseStreamError({ type: "error", code: "context_length_exceeded", message: "Input too long." }))
    .toMatchObject({ type: "context_overflow", message: "Input too long." })
})

test("consumed output followed by a Provider error settles as an explicit failed activity", async () => {
  const events: LLMActivityEvent[] = []
  const deltas: string[] = []
  const result = await collectLLMText({
    context: { sessionID: "stream-error-contract", provider: "openai", model: "gpt-6.1-sol" },
    external: new AbortController().signal,
    policy: { ...DefaultLLMActivityPolicy, totalMs: 5_000, maxRetries: { default: 3 } },
    sink: (event) => events.push(event),
    onTextDelta: (delta) => { deltas.push(delta) },
    start: () => ({ fullStream: (async function* () {
      yield { type: "text-delta", text: "Partial answer" }
      yield { type: "error", error: overload }
    })() }),
  }).catch((error) => error)
  expect(deltas).toEqual(["Partial answer"])
  expect(result).toMatchObject({ cls: "provider_stream_error", attempts: 0, cause: overload })
  expect(events.filter((event) => event.type === "terminal")).toMatchObject([
    { outcome: "failed", cls: "provider_stream_error" },
  ])
})
