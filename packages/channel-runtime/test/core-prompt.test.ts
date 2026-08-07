import { describe, expect, mock, test } from "bun:test"
import { sdkMock } from "./sdk-mock"

mock.module("@opencorvus-ai/sdk", () => sdkMock)
mock.module("@opencorvus-ai/sdk", () => sdkMock)

const { ChannelRuntime } = await import("../src/core")

describe("channel runtime system prompt", () => {
  test("enforces visible execution principles", () => {
    const core = new ChannelRuntime() as unknown as { buildSystemPrompt: (platform: string) => string }
    const prompt = core.buildSystemPrompt("slack")

    expect(prompt).toContain("The visibility principle")
    expect(prompt).toContain("Do not launch retired terminal UI processes")
    expect(prompt).toContain("Search memory at the start of each task")
  })

  test("adds response style guidance", () => {
    const core = new ChannelRuntime() as unknown as { buildSystemPrompt: (platform: string) => string }
    const prompt = core.buildSystemPrompt("telegram")

    expect(prompt).toContain("## Response style")
    expect(prompt).toContain("one-line direct answer")
    expect(prompt).toContain("Avoid long walls of text")
  })
})

describe("channel runtime text formatting", () => {
  test("polishes whitespace for chat readability", () => {
    const core = new ChannelRuntime() as unknown as { polish: (text: string) => string }
    const text = "  hello \r\n\r\n\r\nworld  \r\n"

    expect(core.polish(text)).toBe("hello\n\nworld")
  })

  test("splits long text without truncation", () => {
    const core = new ChannelRuntime() as unknown as { split: (text: string, limit?: number) => string[] }
    const text = "a".repeat(4500)
    const parts = core.split(text, 3000)

    expect(parts).toHaveLength(2)
    expect(parts[0]?.length).toBe(3000)
    expect(parts[1]?.length).toBe(1500)
    expect(parts.join("")).toBe(text)
  })
})
