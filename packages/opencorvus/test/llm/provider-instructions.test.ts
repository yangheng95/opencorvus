import { expect, test } from "bun:test"
import { ProviderTransform } from "../../src/provider/transform"
import { streamingModelMetadata } from "../fixture/streaming-language"

test("projects OpenAI OAuth instructions into its provider options while retaining request settings", () => {
  const prompt = ProviderTransform.instructionOptions(streamingModelMetadata, {
    text: "Use only the supplied evidence.",
    oauth: true,
    options: { store: false, reasoningEffort: "low" },
  })
  expect(prompt).toEqual({
    instructions: undefined,
    options: {
      store: false,
      reasoningEffort: "low",
      instructions: "Use only the supplied evidence.",
    },
  })
  expect(ProviderTransform.providerOptions(streamingModelMetadata, prompt.options)).toEqual({
    openai: {
      store: false,
      reasoningEffort: "low",
      instructions: "Use only the supplied evidence.",
    },
  })
})

for (const oauth of [false, true])
  test(`keeps SDK instructions for a custom Anthropic provider with oauth=${oauth}`, () => {
    const model = {
      ...streamingModelMetadata,
      providerID: "custom.anthropic",
      api: {
        ...streamingModelMetadata.api,
        id: "claude-model",
        npm: "@ai-sdk/anthropic",
      },
    }
    const prompt = ProviderTransform.instructionOptions(model, {
      text: "Evaluate the supplied criteria.",
      oauth,
      options: { thinking: { type: "enabled", budgetTokens: 1024 } },
    })
    expect(prompt).toEqual({
      instructions: "Evaluate the supplied criteria.",
      options: { thinking: { type: "enabled", budgetTokens: 1024 } },
    })
    expect(ProviderTransform.providerOptions(model, prompt.options)).toEqual({
      anthropic: { thinking: { type: "enabled", budgetTokens: 1024 } },
    })
  })
