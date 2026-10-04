import { TaskCompletionDecisionPayloadSchema } from "@/engine/completion-decision-facts"

const CompletionEvidence = TaskCompletionDecisionPayloadSchema.pick({
  orchestrator_session_id: true,
  orchestrator_message_id: true,
  evidence_locators: true,
}).strip()

export class EvidenceReaderSchemaOrderError extends Error {
  override readonly name = "EvidenceReaderSchemaOrderError"
  readonly code = "SCHEMA_BEFORE_TOOL_REQUIRED"
  constructor() {
    super("Actual outbound reader schema must be observed before the eight-field Tool starts")
  }
}

export function readerSchemaObservationOrder(input: {
  toolStartedAt: number
  observations: readonly { requestIndex: number; observedAt?: number }[]
}) {
  const before = input.observations.filter(
    (observation) => Number.isFinite(observation.observedAt) && observation.observedAt! < input.toolStartedAt,
  )
  if (before.length === 0) throw new EvidenceReaderSchemaOrderError()
  return {
    toolStartedAt: input.toolStartedAt,
    before: before.map((observation) => ({
      requestIndex: observation.requestIndex,
      observedAt: observation.observedAt!,
      leadMilliseconds: input.toolStartedAt - observation.observedAt!,
    })),
  }
}

export class EvidenceReaderCompletionError extends Error {
  override readonly name = "EvidenceReaderCompletionError"
  constructor(readonly code: "PRODUCER_REFERENCE_REQUIRED" | "READER_REPORT_REQUIRED" | "READER_REFERENCE_REQUIRED") {
    super(code)
  }
}

/** Read the existing producer/decision ownership contract; no new acceptance authority. */
export function readerCompletionReferences(input: {
  decision: unknown
  producerSessionID: string
  producerMessageID: string
  readerSessionID: string
  readerMessageID: string
  readerFinalMessageID?: string
}) {
  const decision = CompletionEvidence.parse(input.decision)
  const referenced = (sessionID: string, messageID: string) =>
    decision.evidence_locators.some(
      (locator) =>
        locator.source === "session_message" && locator.session_id === sessionID && locator.message_id === messageID,
    )
  if (!referenced(input.producerSessionID, input.producerMessageID)) {
    throw new EvidenceReaderCompletionError("PRODUCER_REFERENCE_REQUIRED")
  }
  if (!input.readerFinalMessageID) throw new EvidenceReaderCompletionError("READER_REPORT_REQUIRED")
  const coordinator = decision.orchestrator_session_id === input.readerSessionID
  const accepted = coordinator
    ? decision.orchestrator_message_id === input.readerFinalMessageID &&
      referenced(input.readerSessionID, input.readerMessageID)
    : referenced(input.readerSessionID, input.readerFinalMessageID)
  if (!accepted) throw new EvidenceReaderCompletionError("READER_REFERENCE_REQUIRED")
  return {
    producer: {
      source: "session_message" as const,
      session_id: input.producerSessionID,
      message_id: input.producerMessageID,
    },
    reader: {
      owner: coordinator ? ("orchestrator" as const) : ("participant" as const),
      session_id: input.readerSessionID,
      message_id: input.readerFinalMessageID,
      read_message_id: input.readerMessageID,
    },
  }
}
