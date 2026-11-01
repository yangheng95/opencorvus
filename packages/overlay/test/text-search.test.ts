import { describe, expect, test } from "bun:test"

import { matchesSearchParts, matchesSearchTerms } from "../src/services/text-search"

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

describe("matchesSearchTerms", () => {
  const candidates = [
    { id: "first", fields: ["catalog-a", "Luna", "Connected"] },
    { id: "second", fields: ["catalog-b", "Sol", "Connected"] },
    { id: "third", fields: ["catalog-a", "Sol", "Available"] },
    { id: "fourth", fields: ["catalog-a", "Sol", "Connected"] },
  ]
  const select = (query: string) => candidates
    .filter((candidate) => matchesSearchTerms(query, candidate.fields))
    .map((candidate) => candidate.id)

  test("matches every term against the same candidate's own metadata fields", () => {
    expect(select("catalog-a Sol Connected")).toEqual(["fourth"])
  })

  test("combines reordered terms with mixed case and Unicode whitespace", () => {
    expect(select("  CONNECTED\tSoL\u00a0catalog-A  ")).toEqual(["fourth"])
  })

  test("returns matching catalog entries in their original order", () => {
    expect(select("sol")).toEqual(["second", "third", "fourth"])
  })

  test("matches a provider ID and model family across fields", () => {
    expect(provider.models.filter((id) => matchesSearchTerms("china deepseek flash", [id, provider.name])))
      .toEqual(["siliconflow-cn/deepseek-ai/DeepSeek-V4-Flash"])
  })

  test("treats punctuation and path characters as literal metadata", () => {
    const rows = [
      { id: "literal", fields: ["100%_lab", "C:\\models\\精确", "C++ [v2]"] },
      { id: "other", fields: ["1000lab", "C:\\models\\精确", "C++ v2"] },
    ]
    expect(rows.filter((row) => matchesSearchTerms("[v2] 100%_lab 精确", row.fields)).map((row) => row.id))
      .toEqual(["literal"])
  })

  test("retains the complete collection for a blank query", () => {
    expect(select("\t \u00a0")).toEqual(candidates.map((candidate) => candidate.id))
    expect(matchesSearchTerms("", [])).toBe(true)
  })
})
