import { describe, expect, test } from "bun:test"
import { ModelsDev } from "@/provider/models"
import { Installation } from "@/installation"

const cost = {
  input: 3.6,
  output: 21.6,
  cache_read: 0.36,
  cache_write: 0.72,
  reasoning: 21.6,
  input_audio: 3.6,
  output_audio: 7.2,
}

function model() {
  return {
    id: "audio-model",
    name: "Audio model",
    release_date: "2026-10-22",
    attachment: true,
    reasoning: true,
    temperature: false,
    tool_call: true,
    limit: { context: 200_000, output: 8_192 },
    options: {},
    cost: { ...cost, context_over_200k: cost },
    experimental: {
      modes: { fast: { cost, provider: { body: { service_tier: "priority" } } } },
    },
  }
}

describe("model catalog cost contract", () => {
  test("identifies catalog requests with an HTTP product token and a separate context comment", () => {
    // RFC 9110 product-version is a token, whose alphabet excludes slash.
    const identity = /^([!#$%&'*+.^_`|~\w-]+)\/([!#$%&'*+.^_`|~\w-]+) \(([^()]*)\)$/.exec(Installation.USER_AGENT)
    expect(identity?.slice(1)).toEqual(["opencorvus", Installation.VERSION, `${Installation.CHANNEL}; cli`])
  })

  test("preserves audio and reasoning prices in model, long-context and experimental mode costs", () => {
    const parsed = ModelsDev.Model.parse(model())
    expect(parsed.cost).toEqual({ ...cost, context_over_200k: cost })
    expect(parsed.experimental?.modes.fast).toEqual({ cost, provider: { body: { service_tier: "priority" } } })
  })

  test("accepts the same cost fields in complete live metadata", () => {
    const parsed = ModelsDev.LiveModelInfo.parse(model())
    expect(parsed.cost?.input_audio).toBe(3.6)
    expect(parsed.experimental?.modes.fast.cost).toEqual(cost)
  })

  test("reports a typed field error for an invalid audio price", () => {
    const input = model()
    const parsed = ModelsDev.Model.safeParse({
      ...input,
      experimental: { modes: { fast: { ...input.experimental.modes.fast, cost: { ...cost, input_audio: "3.6" } } } },
    })
    if (parsed.success) throw new Error("Expected an invalid audio price to produce a schema error")
    expect(parsed.error.issues).toEqual([
      expect.objectContaining({ code: "invalid_type", expected: "number", path: ["experimental", "modes", "fast", "cost", "input_audio"] }),
    ])
  })
})
