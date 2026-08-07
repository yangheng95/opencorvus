import { describe, expect, test } from "bun:test"
import { resolveProcessRecoveryInputAuthority } from "@/engine/process-recovery-fact"

describe("process recovery input authority", () => {
  test("uses the prepared Worker Turn message for a new occurrence after a terminal lifecycle", () => {
    expect(
      resolveProcessRecoveryInputAuthority({
        preparedWorkerInputMessageID: "msg_current_prepared_turn",
        lifecycleInputMessageID: "msg_prior_terminal_turn",
      }),
    ).toBe("msg_current_prepared_turn")
  })

  test("uses the lifecycle message for an interrupted executing occurrence", () => {
    expect(
      resolveProcessRecoveryInputAuthority({
        lifecycleInputMessageID: "msg_current_streaming_turn",
      }),
    ).toBe("msg_current_streaming_turn")
  })
})
