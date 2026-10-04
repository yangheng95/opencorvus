import { describe, expect, test } from "bun:test"
import { ReadAgentMessageInputSchema, ReadAgentMessageTestHooks } from "../src/tool/read-agent-message"

describe("read_agent_message causal evidence projection", () => {
  test("reports effective budgets for omitted limits and accepts eight explicitly allocated chunks", () => {
    const sources = [{ kind: "dispatch_origin", dispatch_id: "art_current" }]
    const reads = Array.from({ length: 8 }, (_, index) => ({ message_id: "msg_origin", part_id: `prt_${index}`, field: "output" }))
    for (const [evidence_reads, requested_total] of [
      [reads.slice(0, 7), 56_000],
      [[...reads.slice(0, 7), { ...reads[7], limit: 1000 }], 57_000],
    ] as const) {
      const parsed = ReadAgentMessageInputSchema.safeParse({ sources, evidence_reads })
      if (parsed.success) throw new Error("Expected the aggregate evidence budget error")
      expect(parsed.error.issues).toEqual([{
        code: "custom", path: ["evidence_reads"],
        message: `Evidence reads requested ${requested_total} characters; the aggregate maximum is 30000. Each omitted limit requests 8000; explicitly allocate per-read limits within the aggregate budget.`,
        params: { requested_total, default_limit: 8000, max_total: 30000 },
      }])
    }
    const allocated = ReadAgentMessageInputSchema.parse({ sources, evidence_reads: reads.map((read) => ({ ...read, limit: 3750 })) })
    expect(allocated.evidence_reads?.map(({ limit, offset }) => ({ limit, offset }))).toEqual(
      Array.from({ length: 8 }, () => ({ limit: 3750, offset: 0 })),
    )
    expect(ReadAgentMessageInputSchema.parse({ sources, evidence_reads: reads.slice(0, 3) }).evidence_reads?.map((read) => read.limit)).toEqual([8000, 8000, 8000])
  })

  test("pages every causal Tool Message and fences equal-time messages by persisted identity", () => {
    const boundary = { time: { created: 100 }, id: "msg_m" }
    const candidates = [{ time: { created: 100 }, id: "msg_a" }, boundary, { time: { created: 100 }, id: "msg_z" }]
    expect(candidates.filter((candidate) => ReadAgentMessageTestHooks.orderedBeforeOrAt(candidate, boundary))).toEqual([
      candidates[0]!,
      boundary,
    ])

    const entries = Array.from({ length: 33 }, (_, index) => ({ message_id: "msg_shared", part_id: `part_${String(index).padStart(2, "0")}` }))
    const visited: string[] = []
    let before: (typeof entries)[number] | undefined
    while (true) {
      const page = ReadAgentMessageTestHooks.causalInventoryPage(entries, before)
      expect(page.page.length).toBeLessThanOrEqual(16)
      visited.push(...page.page.map((entry) => entry.part_id))
      if (!page.next_before) break
      before = { message_id: page.next_before.before_message_id, part_id: page.next_before.before_part_id }
    }
    expect([...new Set(visited)].sort()).toEqual(entries.map((entry) => entry.part_id).sort())
  })

  test("redacts inventory inputs and chunks large evidence output with a continuation offset", () => {
    expect(ReadAgentMessageTestHooks.evidenceOutputMaxCharsPerCall).toBe(30_000)
    expect(ReadAgentMessageTestHooks.evidenceReadsDescription).toContain(
      "The sum of every effective limit in one call must be at most 30000 characters",
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

  test("reports a bounded compact reference index with an explicit oversized result", () => {
    const reference = {
      source: { kind: "dispatch_result" as const, message_id: "msg_final" },
      message_id: "msg_early",
      part_id: "part_source",
      tool_name: "api_fetch",
      status: "completed",
      input_preview: ReadAgentMessageTestHooks.safeInputPreview(
        {
          url: "https://example.invalid/messages/msg_early",
          Authorization: "Bearer SYNTHETIC_REVIEW_CANARY",
        },
        160,
      ).input_preview,
      input_preview_truncated: false,
    }
    expect(ReadAgentMessageTestHooks.compactCausalToolReferenceIndex([reference])).toEqual({
      complete: true,
      tool_count: 1,
      refs: [
        {
          ...reference,
          input_preview: '{"url":"https://example.invalid/messages/msg_early","Authorization":"<redacted>"}',
        },
      ],
    })
    const oversized = ReadAgentMessageTestHooks.compactCausalToolReferenceIndex([
      { ...reference, input_preview: "x".repeat(21_000) },
      { ...reference, message_id: "msg_late", input_preview: "x".repeat(21_000) },
    ])
    expect(oversized).toEqual({ complete: false, tool_count: 2, refs: [] })
  })
})
