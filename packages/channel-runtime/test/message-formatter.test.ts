import { describe, expect, test } from "bun:test"
import { formatToolStatus, polishText, splitText, toolInputDebug } from "../src/message-formatter"

describe("message formatter", () => {
  test("polishes and splits text", () => {
    expect(polishText("  hello \r\n\r\n\r\nworld  \r\n")).toBe("hello\n\nworld")
    const parts = splitText("a".repeat(4100), 3000)
    expect(parts).toHaveLength(2)
    expect(parts.join("")).toBe("a".repeat(4100))
  })

  test("renders tool status with and without debug", () => {
    expect(formatToolStatus("bash", { command: "echo hi" }, {})).toBe("`$ bash`")
    expect(formatToolStatus("bash", { command: "echo hi" }, { OPENCORVUS_CHANNEL_DEBUG_TOOL_INPUT: "1" })).toBe(
      "`$ echo hi`",
    )
    expect(formatToolStatus("input", { action: "click", x: 1, y: 2 }, {})).toBe("`input.click`")
  })

  test("parses debug env", () => {
    expect(toolInputDebug({ OPENCORVUS_CHANNEL_DEBUG_TOOL_INPUT: "1" })).toBe(true)
    expect(toolInputDebug({ OPENCORVUS_CHANNEL_DEBUG_TOOL_INPUT: "false" })).toBe(false)
  })
})
