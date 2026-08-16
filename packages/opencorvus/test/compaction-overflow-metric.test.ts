import { describe, expect, test } from "bun:test"
import { ContextBudget } from "../src/session/context-budget"
import { SessionLoop } from "../src/session/loop"
import type { Config } from "../src/config/config"
import type { Message } from "../src/session/message"
import type { Provider } from "../src/provider/provider"

const tokens = (input: number): Message.Assistant["tokens"] => ({
  input,
  output: 1_000,
  reasoning: 0,
  total: 0,
  cache: { read: 0, write: 0 },
})

/** 1M-context model, mirroring the production incident's provider limits. */
const model = {
  limit: { context: 1_048_576, input: 0, output: 128_000 },
} as unknown as Provider.Model

const config = {} as Config.Info

function stepFinishPart(input: number, id: string) {
  return {
    id,
    sessionID: "ses_test",
    messageID: "msg_test",
    type: "step-finish",
    reason: "tool-calls",
    cost: 0,
    tokens: tokens(input),
  }
}

/**
 * A turn's Message-level `tokens` accumulate across every provider step and
 * retry — the billing record. The compaction threshold is defined over the
 * context one request actually carries, which only the final `step-finish`
 * part holds. Judging the threshold on the accumulated total compacted
 * Sessions whose real context was nowhere near the line (a 6.9M-token
 * "usage" was recorded on this 1M model during a retry storm).
 */
describe("compaction overflow metric", () => {
  test("reads the final step's single-request usage, not the accumulated turn total", () => {
    const message = {
      info: { tokens: tokens(6_900_000) },
      parts: [
        stepFinishPart(500_000, "prt_step1"),
        { id: "prt_text", sessionID: "ses_test", messageID: "msg_test", type: "text", text: "reply" },
        stepFinishPart(150_000, "prt_step2"),
      ],
    } as unknown as Message.WithParts

    const lastRequest = SessionLoop.lastRequestTokenUsage(message)
    expect(lastRequest?.input).toBe(150_000)

    // The accumulated total would have fired the threshold; the real
    // last-request usage does not.
    expect(ContextBudget.isUsageOverflow({ config, tokens: tokens(6_900_000), model })).toBe(true)
    expect(ContextBudget.isUsageOverflow({ config, tokens: lastRequest!, model })).toBe(false)
  })

  test("a genuinely full context still triggers on the final step's usage", () => {
    const message = {
      info: { tokens: tokens(2_000_000) },
      parts: [stepFinishPart(1_000_000, "prt_step1")],
    } as unknown as Message.WithParts
    const lastRequest = SessionLoop.lastRequestTokenUsage(message)
    expect(ContextBudget.isUsageOverflow({ config, tokens: lastRequest!, model })).toBe(true)
  })

  test("a legacy Message without step-finish evidence reports no per-request usage", () => {
    const message = {
      info: { tokens: tokens(300_000) },
      parts: [{ id: "prt_text", sessionID: "ses_test", messageID: "msg_test", type: "text", text: "reply" }],
    } as unknown as Message.WithParts
    expect(SessionLoop.lastRequestTokenUsage(message)).toBeUndefined()
  })
})
