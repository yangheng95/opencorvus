import { describe, expect, test } from "bun:test"
import { parseProcessRecoveryFactContext } from "../src/engine/process-recovery-fact"

describe("process recovery fact contract", () => {
  test("accepts the exact current context and rejects another database epoch", () => {
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
    expect(parsed).toMatchObject({
      schema_version: 1,
      origin: "process_shutdown",
      affected_subjects: [{ kind: "affected_created_session" }],
    })
    expect(() =>
      parseProcessRecoveryFactContext(
        { owned_session_ids: ["ses_0000000000000000000000000"] },
        "art_predecessor_epoch",
      ),
    ).toThrow(/has invalid context/)
  })
})
