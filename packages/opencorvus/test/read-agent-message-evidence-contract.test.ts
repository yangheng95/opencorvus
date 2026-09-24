import { describe, expect, test } from "bun:test"
import { ReadAgentMessageTestHooks } from "../src/tool/read-agent-message"

describe("read_agent_message causal evidence projection", () => {
  test("pages every causal Tool Message and fences equal-time messages by persisted identity", () => {
    const boundary = { time: { created: 100 }, id: "msg_m" }
    const candidates = [{ time: { created: 100 }, id: "msg_a" }, boundary, { time: { created: 100 }, id: "msg_z" }]
    expect(candidates.filter((candidate) => ReadAgentMessageTestHooks.orderedBeforeOrAt(candidate, boundary))).toEqual([
      candidates[0]!,
      boundary,
    ])

    const messages = Array.from({ length: 33 }, (_, index) => ({
      info: { time: { created: index }, id: `msg_${String(index).padStart(2, "0")}` },
    }))
    const visited: string[] = []
    let before: (typeof messages)[number] | undefined
    while (true) {
      const page = ReadAgentMessageTestHooks.causalInventoryPage(messages, before)
      visited.push(...page.page.map((message) => message.info.id))
      if (!page.next_before_message_id) break
      before = messages.find((message) => message.info.id === page.next_before_message_id)
      if (!before) throw new Error("Inventory cursor did not resolve")
    }
    expect([...new Set(visited)].sort()).toEqual(messages.map((message) => message.info.id).sort())
  })

  test("redacts inventory inputs and chunks large evidence output with a continuation offset", () => {
    expect(ReadAgentMessageTestHooks.evidenceOutputMaxCharsPerCall).toBe(30_000)
    expect(ReadAgentMessageTestHooks.evidenceReadsDescription).toContain(
      "The sum of every limit in one call must be at most 30000 characters",
    )
    expect(ReadAgentMessageTestHooks.evidenceReadsDescription).toContain(
      "Copy returned message_id and part_id values exactly",
    )
    const preview = ReadAgentMessageTestHooks.safeInputPreview({
      headers: { Authorization: "Bearer SYNTHETIC_REVIEW_CANARY" },
      request: "inspect source record",
    })
    expect(preview.input_preview).toBe('{"headers":{"Authorization":"<redacted>"},"request":"inspect source record"}')

    const output = "x".repeat(300_000)
    const chunk = ReadAgentMessageTestHooks.evidenceOutputChunk(
      output,
      0,
      ReadAgentMessageTestHooks.evidenceOutputDefaultChars,
    )
    expect(chunk).toMatchObject({
      redacted: false,
      total_chars: 300_000,
      offset: 0,
      end: 8_000,
      next_offset: 8_000,
    })
    expect(chunk.content).toHaveLength(8_000)
    expect(
      ReadAgentMessageTestHooks.evidenceOutputChunk('{"Authorization":"Bearer SYNTHETIC_REVIEW_CANARY"}', 0, 100),
    ).toMatchObject({ redacted: true, content: '{"Authorization":"<redacted>"}', next_offset: null })

    const longInput = JSON.stringify({
      command: `${"x".repeat(300)} https://example.invalid/records/42`,
      password: "SYNTHETIC FIRST SECOND",
      private_key: "-----BEGIN PRIVATE KEY-----\nSYNTHETIC_KEY_MATERIAL\n-----END PRIVATE KEY-----",
    })
    let offset = 0
    let recovered = ""
    while (true) {
      const page = ReadAgentMessageTestHooks.evidenceOutputChunk(longInput, offset, 120)
      recovered += page.content
      if (page.next_offset === null) break
      offset = page.next_offset
    }
    expect(JSON.parse(recovered)).toEqual({
      command: `${"x".repeat(300)} https://example.invalid/records/42`,
      password: "<redacted>",
      private_key: "<redacted>",
    })
  })
})
