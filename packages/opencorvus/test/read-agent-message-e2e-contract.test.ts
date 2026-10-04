import { expect, test } from "bun:test"
import {
  EvidenceReaderCompletionError,
  EvidenceReaderSchemaOrderError,
  readerCompletionReferences,
  readerSchemaObservationOrder,
} from "../script/read-agent-message-e2e-contract"

const producer = { source: "session_message" as const, session_id: "ses_producer", message_id: "msg_producer_final" }
const reader = { source: "session_message", session_id: "ses_coordinator", message_id: "msg_actual_read" }
const input = {
  producerSessionID: producer.session_id,
  producerMessageID: producer.message_id,
  readerSessionID: reader.session_id,
  readerMessageID: reader.message_id,
  readerFinalMessageID: "msg_decision_final",
}
const decision = {
  orchestrator_session_id: "ses_coordinator",
  orchestrator_message_id: "msg_decision_final",
  evidence_locators: [producer, reader],
}

test("binds the actual request observation before the reader Tool start", () => {
  expect(
    readerSchemaObservationOrder({
      toolStartedAt: 200,
      observations: [
        { requestIndex: 3, observedAt: 100 },
        { requestIndex: 4, observedAt: 250 },
      ],
    }),
  ).toEqual({ toolStartedAt: 200, before: [{ requestIndex: 3, observedAt: 100, leadMilliseconds: 100 }] })
})

test("maps absent, equal-time and later schema observations to the exact order error", () => {
  for (const observations of [
    [{ requestIndex: 0 }],
    [{ requestIndex: 0, observedAt: 200 }],
    [{ requestIndex: 0, observedAt: 201 }],
  ]) {
    try {
      readerSchemaObservationOrder({ toolStartedAt: 200, observations })
      throw new Error("Expected schema order error")
    } catch (error) {
      expect(error).toBeInstanceOf(EvidenceReaderSchemaOrderError)
      expect((error as EvidenceReaderSchemaOrderError).code).toBe("SCHEMA_BEFORE_TOOL_REQUIRED")
    }
  }
})

test("binds coordinator final report to the exact canonical decision and retained read Message", () => {
  expect(readerCompletionReferences({ ...input, decision })).toEqual({
    producer,
    reader: {
      owner: "orchestrator",
      session_id: "ses_coordinator",
      message_id: "msg_decision_final",
      read_message_id: "msg_actual_read",
    },
  })
})

test("binds an independent worker reader final to the real session_message evidence locator", () => {
  expect(
    readerCompletionReferences({
      ...input,
      readerSessionID: "ses_verifier",
      readerMessageID: "msg_verifier_read",
      readerFinalMessageID: "msg_verifier_final",
      decision: {
        ...decision,
        evidence_locators: [
          producer,
          { source: "session_message", session_id: "ses_verifier", message_id: "msg_verifier_final" },
        ],
      },
    }),
  ).toEqual({
    producer,
    reader: {
      owner: "participant",
      session_id: "ses_verifier",
      message_id: "msg_verifier_final",
      read_message_id: "msg_verifier_read",
    },
  })
})

test("maps incomplete producer or reader authority to exact completion evidence errors", () => {
  for (const [selected, code] of [
    [{ ...input, decision: { ...decision, evidence_locators: [reader] } }, "PRODUCER_REFERENCE_REQUIRED"],
    [{ ...input, decision, readerFinalMessageID: undefined }, "READER_REPORT_REQUIRED"],
    [
      { ...input, decision: { ...decision, orchestrator_message_id: "msg_another_final" } },
      "READER_REFERENCE_REQUIRED",
    ],
  ] as const) {
    try {
      readerCompletionReferences(selected)
      throw new Error("Expected completion evidence error")
    } catch (error) {
      expect(error).toBeInstanceOf(EvidenceReaderCompletionError)
      expect((error as EvidenceReaderCompletionError).code).toBe(code)
    }
  }
})
