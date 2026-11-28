import { expect, test } from "bun:test"
import { decodeProviderStreamError } from "@opencorvus-ai/transport-protocol"
import { ProviderError } from "@/provider/error"
import { Message } from "@/session/message"
import { collectLLMText, DefaultLLMActivityPolicy, type LLMActivityEvent } from "@/llm/activity"
import { APICallError, StreamProviderError, TypeValidationError, streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

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

test("SDK stream overload retains its typed Provider diagnostic and redacted source payload", () => {
  const original = { ...overload, password: "SYNTHETIC SDK VALUE" }
  const error = new StreamProviderError({
    message: overload.error.message,
    code: overload.error.code,
    type: overload.error.type,
    isRetryable: true,
    data: original,
  })
  const canonical = Message.fromError(error, { providerID: "openai" })
  expect(canonical).toMatchObject({ name: "APIError", data: { message: overload.error.message, isRetryable: false } })
  if (canonical.name !== "APIError") throw new Error("Expected the canonical APIError")
  expect(JSON.parse(canonical.data.responseBody!)).toEqual({
    type: "error",
    error: { type: overload.error.type, code: overload.error.code, message: overload.error.message },
    data: { ...overload, password: "<redacted>" },
  })
  expect(DefaultLLMActivityPolicy.classify(error, {})).toBe("provider_stream_error")
})

test("SDK context code reaches the current overflow recovery classification", () => {
  const error = new StreamProviderError({ code: "context_length_exceeded", message: "Declared capacity was exceeded." })
  expect(DefaultLLMActivityPolicy.classify(error, {})).toBe("context_overflow")
  expect(Message.fromError(error, { providerID: "openai" })).toMatchObject({
    name: "ContextOverflowError", data: { message: error.message },
  })
})

test("SDK validation wrappers retain typed Provider diagnostics with structural redaction", () => {
  const packet = { type: "error", error: { type: "invalid_request_error", code: "invalid_function_parameters",
    message: "The declared constant is unsupported.", param: "tools[41].parameters" }, password: "SYNTHETIC VALIDATION VALUE" }
  const error = new TypeValidationError({ value: packet, cause: new Error("sequence_number is required") })
  expect(ProviderError.parseStreamError(error)).toEqual({ type: "api_error", message: packet.error.message,
    isRetryable: false, responseBody: JSON.stringify({ ...packet, password: "<redacted>" }) })
  expect(Message.fromError(error, { providerID: "openai" })).toEqual({ name: "APIError", data: {
    message: packet.error.message, isRetryable: false, responseBody: JSON.stringify({ ...packet, password: "<redacted>" }),
  } })
  expect(DefaultLLMActivityPolicy.classify(error, {})).toBe("provider_stream_error")
})

test("ordinary SDK value validation retains its explicit Unknown error contract", () => {
  const error = new TypeValidationError({ value: { recordCount: "six" }, cause: new Error("recordCount must be an integer") })
  expect(Message.fromError(error, { providerID: "openai" })).toEqual({ name: "UnknownError", data: { message: error.toString() } })
  expect(DefaultLLMActivityPolicy.classify(error, {})).toBe("unknown")
})

test("SDK-wrapped context errors retain overflow classification and diagnostic body", () => {
  const packet = { type: "error", code: "context_length_exceeded", message: "Declared capacity was exceeded." }
  const error = new TypeValidationError({ value: packet, cause: new Error("sequence_number is required") })
  expect(Message.fromError(error, { providerID: "openai" })).toEqual({ name: "ContextOverflowError", data: {
    message: packet.message, responseBody: JSON.stringify(packet),
  } })
  expect(DefaultLLMActivityPolicy.classify(error, {})).toBe("context_overflow")
})

for (const nested of [true, false]) for (const outputStarted of [false, true]) {
  test(`actual SDK preserves ${nested ? "nested" : "flat"} error packets without sequence metadata ${outputStarted ? "after" : "before"} output`, async () => {
    const failure = { type: "invalid_request_error", code: "invalid_function_parameters",
      message: "Invalid schema for function 'StructuredOutput': Unexpected constant value.", param: "tools[41].parameters" }
    const packet = nested ? { type: "error", error: failure } : { ...failure, type: "error" }
    const requests: Array<{ model: string; stream: boolean }> = []
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
      requests.push(await request.json() as { model: string; stream: boolean })
      const events = [...(outputStarted ? [
        { type: "response.created", response: { id: "validation-contract", created_at: 1, model: "validation-contract" } },
        { type: "response.output_item.added", output_index: 0, item: { type: "message", id: "partial-contract" } },
        { type: "response.output_text.delta", item_id: "partial-contract", output_index: 0, delta: "Retained partial output." },
      ] : []), packet]
      return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), {
        headers: { "content-type": "text/event-stream" },
      })
    } })
    try {
      const provider = createOpenAI({ apiKey: "local-validation-contract", baseURL: new URL("v1", server.url).toString() })
      const callbackErrors: unknown[] = []
      const result = streamText({ model: provider.responses("validation-contract"), prompt: "Read the current record.", maxRetries: 0,
        onError: ({ error }) => { callbackErrors.push(error) },
      })
      const errors: unknown[] = []; const text: string[] = []
      for await (const part of result.fullStream) {
        if (part.type === "error") errors.push(part.error)
        if (part.type === "text-delta") text.push(part.text)
      }
      expect(requests.map(({model,stream}) => ({model,stream}))).toEqual([{model:"validation-contract",stream:true}])
      expect(text).toEqual(outputStarted ? ["Retained partial output."] : [])
      expect(callbackErrors).toEqual(errors)
      expect(errors.map(error => ({ sdkValidation: TypeValidationError.isInstance(error),
        canonical: Message.fromError(error, { providerID: "openai" }), classification: DefaultLLMActivityPolicy.classify(error, {}),
      }))).toEqual([{ sdkValidation: true, canonical: { name: "APIError", data: {
        message: failure.message, isRetryable: false, responseBody: JSON.stringify(packet),
      } }, classification: "provider_stream_error" }])
    } finally { await server.stop(true) }
  })
}

for (const outputStarted of [false, true]) test(`real SDK HTTP errors ${outputStarted ? "after" : "before"} output enter the canonical Provider error contract`, async () => {
  const requests: Array<{ model: string; stream: boolean }> = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const input = await request.json() as { model: string; stream: boolean }
    requests.push({ model: input.model, stream: input.stream })
    const events = [...(outputStarted ? [
      { type: "response.created", response: { id: "response-contract", created_at: 1, model: "stream-contract" } },
      { type: "response.output_item.added", output_index: 0, item: { type: "message", id: "message-contract" } },
      { type: "response.output_text.delta", item_id: "message-contract", output_index: 0, delta: "Retained partial output." },
    ] : []), overload]
    return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), {
      headers: { "content-type": "text/event-stream" },
    })
  } })
  try {
    const provider = createOpenAI({ apiKey: "local-stream-contract", baseURL: new URL("v1", server.url).toString() })
    const callbackErrors: unknown[] = []
    const result = streamText({ model: provider.responses("stream-contract"), prompt: "Read the current record.", maxRetries: 0,
      onError: ({ error }) => { callbackErrors.push(error) },
    })
    const errors: unknown[] = []
    const text: string[] = []
    for await (const part of result.fullStream) {
      if (part.type === "error") errors.push(part.error)
      if (part.type === "text-delta") text.push(part.text)
    }
    expect(requests).toEqual([{ model: "stream-contract", stream: true }])
    if (outputStarted) expect(text).toEqual(["Retained partial output."])
    expect(callbackErrors).toEqual(errors)
    expect(errors.map((error) => ({
      errorType: StreamProviderError.isInstance(error) ? "stream" : APICallError.isInstance(error) ? "api-call" : "other",
      canonical: Message.fromError(error, { providerID: "openai" }),
      classification: DefaultLLMActivityPolicy.classify(error, {}),
    }))).toMatchObject([{
      errorType: outputStarted ? "stream" : "api-call",
      canonical: { name: "APIError", data: { message: overload.error.message, isRetryable: !outputStarted,
        ...(outputStarted ? {} : { statusCode: 503 }),
      } },
      classification: outputStarted ? "provider_stream_error" : "server_5xx",
    }])
  } finally { await server.stop(true) }
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

for (const [label, error] of [
  ["raw", overload],
  ["SDK", new StreamProviderError({ message: overload.error.message, type: overload.error.type, code: overload.error.code, data: overload })],
  ["SDK validation", new TypeValidationError({ value: { type: "error", error: overload.error }, cause: new Error("sequence_number is required") })],
] as const) test(`consumed output followed by a ${label} Provider error settles as an explicit failed activity`, async () => {
  const events: LLMActivityEvent[] = []
  const deltas: string[] = []
  const result = await collectLLMText({
    context: { sessionID: "stream-error-contract", provider: "openai", model: "gpt-6.1-sol" },
    external: new AbortController().signal,
    policy: { ...DefaultLLMActivityPolicy, totalMs: 5_000, maxRetries: { default: 3 } },
    sink: (event) => events.push(event),
    onTextDelta: (delta) => { deltas.push(delta) },
    start: () => ({ stream: (async function* () {
      yield { type: "text-delta", text: "Partial answer" }
      yield { type: "error", error }
    })() }),
  }).catch((error) => error)
  expect(deltas).toEqual(["Partial answer"])
  expect(result).toMatchObject({ cls: "provider_stream_error", attempts: 0, cause: error })
  expect(events.filter((event) => event.type === "terminal")).toMatchObject([
    { outcome: "failed", cls: "provider_stream_error" },
  ])
})
