import { describe, expect, test } from "bun:test"

import { matchesSearchParts } from "../src/services/text-search"

const provider = {
  id: "siliconflow-cn",
  name: "SiliconFlow (China)",
  models: [
    "siliconflow-cn/inclusionAI/Ling-flash-2.0",
    "siliconflow-cn/deepseek-ai/DeepSeek-V4-Flash",
    "siliconflow-cn/zai-org/GLM-5.2",
    "siliconflow-cn/deepseek-ai/DeepSeek-R1",
  ],
}

function matchingModels(query: string): string[] {
  return provider.models.filter((modelID) => matchesSearchParts(query, [modelID, provider.id, provider.name]))
}

describe("matchesSearchParts", () => {
  test("normalizes the query and returns models containing the complete substring", () => {
    expect(matchingModels(" FLASH ")).toEqual([
      "siliconflow-cn/inclusionAI/Ling-flash-2.0",
      "siliconflow-cn/deepseek-ai/DeepSeek-V4-Flash",
    ])
  })

  test("returns the provider's models when its ID contains the query", () => {
    expect(matchingModels("SILICONFLOW-CN")).toEqual(provider.models)
  })

  test("returns the provider's models when its name contains the query", () => {
    expect(matchingModels("flow (china)")).toEqual(provider.models)
  })
})
