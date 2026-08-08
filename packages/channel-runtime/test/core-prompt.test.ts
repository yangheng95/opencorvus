import { describe, expect, mock, test } from "bun:test"
import { sdkMock } from "./sdk-mock"

mock.module("@opencorvus-ai/sdk", () => sdkMock)

const { ChannelRuntime } = await import("../src/core")

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
