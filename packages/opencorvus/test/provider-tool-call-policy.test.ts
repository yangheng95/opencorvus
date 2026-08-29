import { describe, expect, test } from "bun:test"
import type { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"

function model(input: { providerID: string; id: string; npm: string }): Provider.Model {
  return {
    id: input.id,
    providerID: input.providerID,
    name: input.id,
    limit: { context: 128_000, input: 128_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: true,
      temperature: true,
      input: { text: true, image: false, audio: false, video: false },
      output: { text: true, image: false, audio: false, video: false },
    },
    api: { id: input.id, npm: input.npm },
    options: {},
  } as Provider.Model
}

describe("Provider Tool-call request policy", () => {
  test("serializes an OpenAI Tool step through the canonical provider namespace", () => {
    const openAI = model({ providerID: "openai", id: "gpt-5.6-terra", npm: "@ai-sdk/openai" })
    const options = ProviderTransform.optionsForToolRequest(
      openAI,
      { store: false, parallelToolCalls: true },
      { toolChoice: "auto", activeToolCount: 5 },
    )

    expect(ProviderTransform.providerOptions(openAI, options)).toEqual({
      openai: { store: false, parallelToolCalls: false },
    })
  })

  test("preserves an explicitly parallel non-strict Provider Tool step", () => {
    const anthropic = model({ providerID: "anthropic", id: "claude-sonnet", npm: "@ai-sdk/anthropic" })
    const options = ProviderTransform.optionsForToolRequest(
      anthropic,
      { parallelToolCalls: true },
      { toolChoice: "auto", activeToolCount: 3 },
    )

    expect(ProviderTransform.providerOptions(anthropic, options)).toEqual({
      anthropic: { parallelToolCalls: true },
    })
  })

  test("preserves the configured OpenAI request when the step has no Tool surface", () => {
    const openAI = model({ providerID: "openai", id: "gpt-5.6-terra", npm: "@ai-sdk/openai" })
    const options = ProviderTransform.optionsForToolRequest(
      openAI,
      { store: false, parallelToolCalls: true },
      { toolChoice: "none", activeToolCount: 0 },
    )

    expect(ProviderTransform.providerOptions(openAI, options)).toEqual({
      openai: { store: false, parallelToolCalls: true },
    })
  })

  test("retains the required-Tool thinking constraint in the unified request policy", () => {
    const kimi = model({ providerID: "alibaba-cn", id: "kimi-k2.5", npm: "@ai-sdk/openai-compatible" })
    kimi.api.url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    const options = ProviderTransform.optionsForToolRequest(
      kimi,
      { enable_thinking: true },
      { toolChoice: "required", activeToolCount: 2 },
    )

    expect(ProviderTransform.providerOptions(kimi, options)).toEqual({
      "alibaba-cn": { enable_thinking: false },
    })
  })
})
