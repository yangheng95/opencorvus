// SSE = Server-Sent Events; ID = identifier; ms = milliseconds.

export const RECOVERY_DIAGNOSTICS_PREFIX = "[recovery-diagnostics]"

const RECOVERY_STARTED_EVENT = "conversation-recovery.started"
const RECOVERY_FAILED_EVENT = "conversation-recovery.failed"
const RECOVERY_ABORTED_EVENT = "conversation-recovery.aborted"
const RECOVERY_SUCCEEDED_EVENT = "conversation-recovery.succeeded"

interface ConversationRecoveryBaseInput {
  channel: string
  reason: string
  taskID: string
  source: string
}

export type ConversationRecoveryStartedInput = ConversationRecoveryBaseInput

export type ConversationRecoveryFailedInput = ConversationRecoveryBaseInput & {
  durationMs: number
  error: string
}

export type ConversationRecoveryAbortedInput = ConversationRecoveryBaseInput & {
  durationMs: number
  error: string
}

export type ConversationRecoverySucceededInput = ConversationRecoveryBaseInput & {
  durationMs: number
  resumeSequence: number
}

export type ConversationRecoveryDiagnosticsRecord =
  | (ConversationRecoveryStartedInput & { event: typeof RECOVERY_STARTED_EVENT })
  | (ConversationRecoveryFailedInput & { event: typeof RECOVERY_FAILED_EVENT })
  | (ConversationRecoveryAbortedInput & { event: typeof RECOVERY_ABORTED_EVENT })
  | (ConversationRecoverySucceededInput & { event: typeof RECOVERY_SUCCEEDED_EVENT })

export type ConversationRecoveryDiagnosticsSink = (
  prefix: typeof RECOVERY_DIAGNOSTICS_PREFIX,
  record: ConversationRecoveryDiagnosticsRecord,
) => void

const defaultConversationRecoveryDiagnosticsSink: ConversationRecoveryDiagnosticsSink = (prefix, record) => {
  console.info(prefix, record)
}

let conversationRecoveryDiagnosticsSink = defaultConversationRecoveryDiagnosticsSink

function emitConversationRecoveryDiagnostic(record: ConversationRecoveryDiagnosticsRecord): void {
  conversationRecoveryDiagnosticsSink(RECOVERY_DIAGNOSTICS_PREFIX, record)
}

export function recordConversationRecoveryStarted(input: ConversationRecoveryStartedInput): void {
  emitConversationRecoveryDiagnostic({
    event: RECOVERY_STARTED_EVENT,
    ...input,
  })
}

export function recordConversationRecoveryFailed(input: ConversationRecoveryFailedInput): void {
  emitConversationRecoveryDiagnostic({
    event: RECOVERY_FAILED_EVENT,
    ...input,
  })
}

export function recordConversationRecoveryAborted(input: ConversationRecoveryAbortedInput): void {
  emitConversationRecoveryDiagnostic({
    event: RECOVERY_ABORTED_EVENT,
    ...input,
  })
}

export function recordConversationRecoverySucceeded(input: ConversationRecoverySucceededInput): void {
  emitConversationRecoveryDiagnostic({
    event: RECOVERY_SUCCEEDED_EVENT,
    ...input,
  })
}

export function __setConversationRecoveryDiagnosticsSinkForTest(sink: ConversationRecoveryDiagnosticsSink): void {
  conversationRecoveryDiagnosticsSink = sink
}

export function __resetConversationRecoveryDiagnosticsSinkForTest(): void {
  conversationRecoveryDiagnosticsSink = defaultConversationRecoveryDiagnosticsSink
}
