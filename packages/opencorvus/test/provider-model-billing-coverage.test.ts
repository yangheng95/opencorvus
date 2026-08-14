import { afterEach, describe, expect, spyOn, test } from "bun:test"

import { CopilotModels } from "../src/plugin/github-copilot/models"
import { Provider } from "../src/provider/provider"

afterEach(() => {
  ;(globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.()
})

describe("Provider model billing coverage", () => {
  test("preserves request-time long-context pricing when config overrides only the base rate", () => {
    const longContext = {
      input: 2,
      output: 4,
      cache: { read: 0.2, write: 0.5 },
    }
    expect(
      Provider.mergeModelCost(
        {
          available: true,
          input: 1,
          output: 2,
          cache: { read: 0.1, write: 0.25 },
          experimentalOver200K: longContext,
        },
        { input: 1.5 },
      ),
    ).toEqual({
      available: true,
      input: 1.5,
      output: 2,
      cache: { read: 0.1, write: 0.25 },
      experimentalOver200K: longContext,
    })
  })

  test("does not label an absent configured/catalog price as confirmed free", () => {
    expect(Provider.mergeModelCost(undefined, undefined)).toEqual({
      available: false,
      input: 0,
      output: 0,
      cache: { read: 0, write: 0 },
      experimentalOver200K: undefined,
    })
  })

  test("preserves the catalog price when Copilot omits optional remote token prices", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              model_picker_enabled: true,
              id: "remote-model",
              name: "Remote model",
              version: "remote-model-2026-08-01",
              capabilities: {
                family: "remote",
                limits: {
                  max_context_window_tokens: 200_000,
                  max_output_tokens: 8_192,
                  max_prompt_tokens: 191_808,
                },
                supports: { tool_calls: true },
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    )
    const catalogCost = {
      available: true as const,
      input: 3,
      output: 15,
      cache: { read: 0.3, write: 3.75 },
      experimentalOver200K: { input: 6, output: 22.5, cache: { read: 0.6, write: 7.5 } },
    }
    const result = await CopilotModels.get(
      "https://api.githubcopilot.com",
      {},
      {
        "catalog-model": {
          id: "catalog-model",
          providerID: "github-copilot",
          api: { id: "remote-model", url: "https://api.githubcopilot.com", npm: "@ai-sdk/github-copilot" },
          name: "Catalog model",
          family: "catalog",
          capabilities: {
            temperature: true,
            reasoning: false,
            attachment: true,
            toolcall: true,
            input: { text: true, audio: false, image: false, video: false, pdf: false },
            output: { text: true, audio: false, image: false, video: false, pdf: false },
            interleaved: false,
          },
          cost: catalogCost,
          limit: { context: 200_000, input: 191_808, output: 8_192 },
          status: "active",
          options: {},
          headers: {},
          release_date: "2026-08-01",
        },
      },
    )
    expect(result.models["catalog-model"].cost).toEqual(catalogCost)
  })
})
