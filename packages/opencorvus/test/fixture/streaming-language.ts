import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test"
import type { ProviderModel } from "../../src/provider/model-schema"

export const streamingModelMetadata = {
  id: "gpt-6.1-sol",
  providerID: "openai",
  api: { id: "gpt-6.1-sol", npm: "@ai-sdk/openai", url: "https://api.openai.com/v1" },
  name: "Streaming contract model",
  capabilities: {
    temperature: false,
    reasoning: true,
    attachment: false,
    toolcall: true,
    interleaved: false,
    input: { text: true, audio: false, image: false, video: false, pdf: false },
    output: { text: true, audio: false, image: false, video: false, pdf: false },
  },
  cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
  limit: { context: 100_000, output: 4_096 },
  status: "active",
  options: {},
  headers: {},
  release_date: "2026-10-27",
} satisfies ProviderModel

/** Keeps the installed SDK's prompt validation and stream processing real. */
export function streamingTextModel(chunks: string[]) {
  return new MockLanguageModelV4({
    doStream: {
      stream: convertArrayToReadableStream([
        { type: "text-start", id: "text-1" },
        ...chunks.map((delta) => ({ type: "text-delta" as const, id: "text-1", delta })),
        { type: "text-end", id: "text-1" },
        {
          type: "finish",
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
        },
      ]),
    },
  })
}
