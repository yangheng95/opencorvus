import { describe, expect, test } from "bun:test"
import { parseProcessRecoveryFactContext } from "../src/engine/process-recovery-fact"

/**
 * Recovery facts are immutable audit rows read back by every later build. The
 * v1 reader contract once shipped with no writer producing it, so each
 * graceful shutdown minted a fact the next build refused to parse — and the
 * refusal propagated as HTTP 500 for the entire Task conversation view. This
 * suite fences both halves: historical shapes stay readable forever, and
 * garbage still fails loudly.
 */
describe("process recovery fact compatibility", () => {
  test("accepts the current v1 context", () => {
    const parsed = parseProcessRecoveryFactContext(
      {
        schema_version: 1,
        origin: "process_shutdown",
        physical_evidence: { kind: "unmanaged_process_cause_unknown", reason: "server shutdown" },
        affected_subjects: [
          { kind: "affected_created_session", session_id: "ses_0000000000000000000000000", session_created_at: 42 },
        ],
      },
      "art_test_v1",
    )
    expect(parsed.kind).toBe("v1")
    if (parsed.kind === "v1") {
      expect(parsed.context.origin).toBe("process_shutdown")
      expect(parsed.context.affected_subjects).toHaveLength(1)
    }
  })

  test("accepts the pre-v1 shutdown handoff shape written by earlier builds", () => {
    const parsed = parseProcessRecoveryFactContext(
      { owned_session_ids: ["ses_0000000000000000000000000", "ses_1111111111111111111111111"] },
      "art_test_legacy",
    )
    expect(parsed).toEqual({
      kind: "legacy_shutdown_handoff",
      ownedSessionIDs: ["ses_0000000000000000000000000", "ses_1111111111111111111111111"],
    })
  })

  test("still rejects a context that matches no known writer", () => {
    expect(() => parseProcessRecoveryFactContext({ unrelated: true }, "art_test_bad")).toThrow(
      /has invalid context/,
    )
  })
})
